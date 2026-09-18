import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import ledgerData from '@/lib/coach-revenue-ledger.json';

export const dynamic = 'force-dynamic';

interface StripeCustomer {
    id: string;
    email?: string | null;
    name?: string | null;
}

interface StripeProduct {
    id: string;
    name: string;
    active?: boolean;
}

interface StripeSubscriptionItem {
    plan?: {
        id?: string;
        amount?: number;
        currency?: string;
        interval?: string;
        interval_count?: number;
        product?: string;
    };
    price?: {
        id?: string;
        unit_amount?: number;
        currency?: string;
        product?: string;
        recurring?: {
            interval?: string;
            interval_count?: number;
        };
    };
    quantity?: number;
}

interface StripeSubscription {
    id: string;
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
    customer: string | StripeCustomer;
    items?: {
        data: StripeSubscriptionItem[];
    };
}

interface StripeCharge {
    id: string;
    amount: number;
    currency: string;
    created: number;
    status: string;
    paid: boolean;
    refunded: boolean;
    description?: string | null;
    billing_details?: {
        email?: string | null;
        name?: string | null;
    };
    receipt_url?: string | null;
}

// In-memory cache for 60 seconds to prevent hitting Stripe rate limits
let memoryCache: {
    data: any;
    timestamp: number;
} | null = null;
const CACHE_TTL_MS = 60 * 1000;

// Rate limiting map: max 25 requests per 60 seconds per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(key: string, limit = 25, windowMs = 60 * 1000): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }
    if (record.count >= limit) {
        return false;
    }
    record.count += 1;
    return true;
}

// Helper: inject strict security headers preventing caching, sniffing, or embedding
function secureJsonResponse(data: any, status = 200) {
    const res = NextResponse.json(data, { status });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return res;
}

export async function GET(req: Request) {
    // 1. Strict Coach Authorization Guard
    // Blocks all athletes and unauthenticated callers
    const auth = await requireCoach();
    if ('error' in auth) {
        return auth.error;
    }

    // 2. Sliding-window Rate Limiting per user ID
    const userId = auth.user.id;
    if (!checkRateLimit(userId)) {
        console.warn(`[SECURITY RATE LIMIT] Rate limit exceeded on revenue endpoint for user: ${auth.user.email}`);
        return secureJsonResponse({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    // Audit Log Access
    console.info(`[SECURITY AUDIT] Revenue data successfully accessed by owner: ${auth.user.email} at ${new Date().toISOString()}`);

    // 2. Fetch coach billing credentials from Database (enables live Vercel connection without manual env vars)
    let dbConfig: any = null;
    try {
        if (auth.user.email) {
            dbConfig = await prisma.coachBillingConfig.findUnique({
                where: { coachEmail: auth.user.email.toLowerCase() },
            });
        }
        if (!dbConfig) {
            dbConfig = await prisma.coachBillingConfig.findFirst({
                orderBy: { updatedAt: 'desc' },
            });
        }
    } catch (e) {
        console.error('Error fetching CoachBillingConfig from DB:', e);
    }
    
    // Exclusively lock to Coach Darath's product ID
    const targetProductId = 'prod_PcfIQXv2L5xYid';

    const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || dbConfig?.stripeSecretKey;

    if (!stripeKey) {
        return secureJsonResponse({
            connected: false,
            cycleRevenue: 0,
            cycleFee: 0,
            cycleNet: 0,
            mrr: 0,
            mrrNet: 0,
            activeSubscribers: 0,
            pastDueCount: 0,
            grossThisMonth: 0,
            feeThisMonth: 0,
            netThisMonth: 0,
            athletes: [],
            unmatchedSubscribers: [],
            recentCharges: [],
            history: null,
            availableProducts: [
                { id: targetProductId, name: '[BPS] Coach Darath', activeSubs: 0 }
            ],
            selectedProductId: targetProductId,
            currency: 'USD',
            message: 'Stripe API key is not configured. Connect your key below or in settings.',
        });
    }

    try {
        const stripeHeaders = {
            Authorization: `Bearer ${stripeKey.trim()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const now = Date.now();
        let allSubscriptions: StripeSubscription[] = [];
        let charges: StripeCharge[] = [];
        let productsMap = new Map<string, string>();

        if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
            allSubscriptions = memoryCache.data.allSubscriptions;
            charges = memoryCache.data.charges;
            productsMap = memoryCache.data.productsMap;
        } else {
            // 3. Fetch products map (up to 100 products)
            try {
                const prodRes = await fetch('https://api.stripe.com/v1/products?limit=100', {
                    headers: stripeHeaders,
                });
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    (prodData.data || []).forEach((p: StripeProduct) => {
                        productsMap.set(p.id, p.name);
                    });
                }
            } catch {
                // Products read permission may not be present on restricted key
            }

            // 4. Paginate subscriptions from Stripe (retrieve all subscriptions)
            let startingAfter: string | undefined = undefined;
            while (true) {
                const subUrl = 'https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer' 
                    + (startingAfter ? `&starting_after=${startingAfter}` : '');

                const subRes = await fetch(subUrl, { headers: stripeHeaders });

                if (!subRes.ok) {
                    const errData = await subRes.json().catch(() => ({}));
                    const errorMsg = errData?.error?.message || `Stripe API error (${subRes.status})`;
                    return secureJsonResponse({
                        connected: false,
                        error: errorMsg,
                        cycleRevenue: 0,
                        mrr: 0,
                        activeSubscribers: 0,
                        athletes: [],
                        history: null,
                        availableProducts: [],
                        selectedProductId: targetProductId,
                    });
                }

                const subData = await subRes.json();
                const pageSubs: StripeSubscription[] = subData.data || [];
                allSubscriptions.push(...pageSubs);

                if (!subData.has_more || pageSubs.length === 0) break;
                startingAfter = pageSubs[pageSubs.length - 1].id;
            }

            // 5. Fetch recent charges from Stripe (limit 100)
            const chargesRes = await fetch('https://api.stripe.com/v1/charges?limit=100', {
                headers: stripeHeaders,
            });

            if (chargesRes.ok) {
                const chargeData = await chargesRes.json();
                charges = chargeData.data || [];
            }

            // Save to memory cache
            memoryCache = {
                data: { allSubscriptions, charges, productsMap },
                timestamp: now,
            };
        }

        // Helper functions for matching, fees, and display
        const calculateStripeFee = (amountInDollars: number): number => {
            if (amountInDollars <= 0) return 0;
            // Standard Stripe US card processing fee: 2.9% + $0.30
            return Math.round(amountInDollars * 100 * 0.029 + 30) / 100;
        };

        const KNOWN_EMAIL_ALIASES: Record<string, string> = {
            'tasker.hannah@yahoo.com': 'hannahtasker09@gmail.com',
            'gbaezanevarez@icloud.com': 'gilbaezanevarez@gmail.com',
            'sdiaz_7@outlook.com': 'fruitsnackclan@gmail.com',
            'josecoolblue@gmail.com': 'jose.j.vargas04@gmail.com',
            'raylabelle178@gmail.com': 'thejokerlabelle@gmail.com',
            'marcello.chicko@icloud.com': 'marcello.chicko@icloud.com',
        };

        const normalizeString = (str: string): string => {
            return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        };

        const normalizeGmail = (email: string): string => {
            if (!email) return '';
            const [user, domain] = email.toLowerCase().trim().split('@');
            if (domain === 'gmail.com' || domain === 'googlemail.com') {
                const cleanUser = user.split('+')[0].replace(/\./g, '');
                return `${cleanUser}@gmail.com`;
            }
            return `${user}@${domain}`;
        };

        const formatPlanBillingInterval = (amount: number, interval: string, intervalCount: number): string => {
            const formattedAmount = `$${amount}`;
            if (interval === 'week') {
                if (intervalCount === 4) return `${formattedAmount} / 4 wks`;
                if (intervalCount === 1) return `${formattedAmount} / wk`;
                return `${formattedAmount} / ${intervalCount} wks`;
            }
            if (interval === 'month') {
                if (intervalCount === 1) return `${formattedAmount} / mo`;
                return `${formattedAmount} / ${intervalCount} mos`;
            }
            if (interval === 'year') {
                return `${formattedAmount} / yr`;
            }
            return `${formattedAmount} / ${interval}`;
        };

        // 6. Filter strictly for Coach Darath's product and only active / trialing / past_due
        // Exclude all cancelled, incomplete, and past subscriptions
        const coachDarathSubs = allSubscriptions.filter((sub) => {
            if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return false;
            if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') return false;
            const items = sub.items?.data || [];
            return items.some((item) => {
                const prodId = item.price?.product || item.plan?.product;
                return prodId === targetProductId;
            });
        });

        // 7. Fetch all active athletes from database
        const dbAthletes = await prisma.athlete.findMany({
            where: {
                role: { not: 'coach' },
            },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
            },
            orderBy: { name: 'asc' },
        });

        // 8. Compute Run-rate, MRR, Fees, Net Profit, and Matched Athletes
        let cycleRevenueTotal = 0;
        let cycleFeeTotal = 0;
        let cycleNetTotal = 0;
        let annualizedMrrTotal = 0;
        let annualizedMrrNetTotal = 0;
        let activeCount = 0;
        let pastDueCount = 0;
        let primaryCurrency = 'USD';

        const coachCustomerEmails = new Set<string>();
        const matchedAthletes: any[] = [];
        const unmatchedSubscribers: any[] = [];
        const usedAthleteIds = new Set<string>();

        coachDarathSubs.forEach((sub) => {
            const customerObj = typeof sub.customer === 'object' ? sub.customer : null;
            const customerEmail = customerObj?.email?.toLowerCase()?.trim() || '';
            const customerName = customerObj?.name || undefined;
            if (customerEmail) coachCustomerEmails.add(customerEmail);

            // Find item corresponding to Coach Darath's product
            const matchingItem = sub.items?.data?.find((it) => {
                const pid = it.price?.product || it.plan?.product;
                return pid === targetProductId;
            }) || sub.items?.data?.[0];

            const rawAmountCents = matchingItem?.price?.unit_amount ?? matchingItem?.plan?.amount ?? 0;
            const rawAmountDollars = rawAmountCents / 100;
            const quantity = matchingItem?.quantity ?? 1;
            const interval = matchingItem?.price?.recurring?.interval ?? matchingItem?.plan?.interval ?? 'month';
            const intervalCount = matchingItem?.price?.recurring?.interval_count ?? matchingItem?.plan?.interval_count ?? 1;
            const currency = (matchingItem?.price?.currency ?? matchingItem?.plan?.currency ?? 'usd').toUpperCase();
            primaryCurrency = currency;

            const planDisplay = formatPlanBillingInterval(rawAmountDollars, interval, intervalCount);

            // Fee and Net calculation per payment
            const stripeFee = calculateStripeFee(rawAmountDollars);
            const netAmount = Math.round((rawAmountDollars - stripeFee) * 100) / 100;

            let monthlyNormalizedDollars = rawAmountDollars * quantity;
            let monthlyNetDollars = netAmount * quantity;
            if (interval === 'week') {
                monthlyNormalizedDollars = Math.round((rawAmountDollars * quantity * 52.143) / (intervalCount * 12));
                monthlyNetDollars = Math.round((netAmount * quantity * 52.143) / (intervalCount * 12));
            } else if (interval === 'month') {
                monthlyNormalizedDollars = Math.round((rawAmountDollars * quantity) / intervalCount);
                monthlyNetDollars = Math.round((netAmount * quantity) / intervalCount);
            }

            if (sub.status === 'active' || sub.status === 'trialing') {
                cycleRevenueTotal += rawAmountDollars * quantity;
                cycleFeeTotal += stripeFee * quantity;
                cycleNetTotal += netAmount * quantity;
                annualizedMrrTotal += monthlyNormalizedDollars;
                annualizedMrrNetTotal += monthlyNetDollars;
                activeCount++;
            } else if (sub.status === 'past_due') {
                pastDueCount++;
            }

            // Smart Matching: 4-Layer Matcher
            const cNormEmail = normalizeGmail(customerEmail);
            const cNormName = normalizeString(customerName || '');

            // 1. Exact Email Match (prefer active profile)
            let matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && a.email.toLowerCase().trim() === customerEmail && a.status === 'active');
            if (!matched) {
                matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && a.email.toLowerCase().trim() === customerEmail);
            }

            // 2. Known Alias Mapping
            if (!matched && customerEmail && KNOWN_EMAIL_ALIASES[customerEmail]) {
                const targetEmail = KNOWN_EMAIL_ALIASES[customerEmail].toLowerCase().trim();
                matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && a.email.toLowerCase().trim() === targetEmail && a.status === 'active');
                if (!matched) {
                    matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && a.email.toLowerCase().trim() === targetEmail);
                }
            }

            // 3. Normalized Gmail Match
            if (!matched && cNormEmail) {
                matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && normalizeGmail(a.email) === cNormEmail && a.status === 'active');
                if (!matched) {
                    matched = dbAthletes.find(a => !usedAthleteIds.has(a.id) && normalizeGmail(a.email) === cNormEmail);
                }
            }

            // 4. Normalized Full Name Match
            if (!matched && cNormName && cNormName.length >= 3) {
                matched = dbAthletes.find(a => {
                    if (usedAthleteIds.has(a.id) || a.status !== 'active') return false;
                    const aNorm = normalizeString(a.name);
                    return aNorm === cNormName || (aNorm.length >= 4 && (cNormName.includes(aNorm) || aNorm.includes(cNormName)));
                });
                if (!matched) {
                    matched = dbAthletes.find(a => {
                        if (usedAthleteIds.has(a.id)) return false;
                        const aNorm = normalizeString(a.name);
                        return aNorm === cNormName || (aNorm.length >= 4 && (cNormName.includes(aNorm) || aNorm.includes(cNormName)));
                    });
                }
            }

            const customerId = customerObj?.id || (typeof sub.customer === 'string' ? sub.customer : null);
            const stripeSubscriptionId = sub.id;
            const stripeSubscriptionUrl = stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}` : null;
            const stripeCustomerUrl = customerId ? `https://dashboard.stripe.com/customers/${customerId}` : null;

            if (matched) {
                usedAthleteIds.add(matched.id);
                matchedAthletes.push({
                    id: matched.id,
                    name: matched.name,
                    email: matched.email,
                    customerEmail: customerEmail && customerEmail !== matched.email.toLowerCase() ? customerEmail : null,
                    customerName: customerName || null,
                    hasSubscription: true,
                    status: sub.status,
                    rawAmount: rawAmountDollars,
                    stripeFee,
                    netAmount,
                    billingInterval: planDisplay,
                    interval,
                    intervalCount,
                    monthlyAmount: monthlyNormalizedDollars,
                    monthlyNet: monthlyNetDollars,
                    currency,
                    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    productName: '[BPS] Coach Darath',
                    stripeSubscriptionId,
                    stripeCustomerId: customerId,
                    stripeSubscriptionUrl,
                    stripeCustomerUrl,
                });
            } else {
                unmatchedSubscribers.push({
                    id: `ext-${unmatchedSubscribers.length}`,
                    email: customerEmail,
                    name: customerName || customerEmail.split('@')[0],
                    status: sub.status,
                    rawAmount: rawAmountDollars,
                    stripeFee,
                    netAmount,
                    billingInterval: planDisplay,
                    monthlyAmount: monthlyNormalizedDollars,
                    monthlyNet: monthlyNetDollars,
                    currency,
                    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
                    productName: '[BPS] Coach Darath',
                    stripeSubscriptionId,
                    stripeCustomerId: customerId,
                    stripeSubscriptionUrl,
                    stripeCustomerUrl,
                });
            }
        });

        // Sort matched athletes alphabetically by name
        matchedAthletes.sort((a, b) => a.name.localeCompare(b.name));

        // 9. Calculate Gross Revenue This Month for Coach Darath's active customers
        const nowDate = new Date();
        const startOfMonthTimestamp = Math.floor(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000);
        let grossThisMonthCents = 0;
        const filteredCharges: any[] = [];

        charges.forEach((ch) => {
            const chEmail = ch.billing_details?.email?.toLowerCase()?.trim();
            if (chEmail && coachCustomerEmails.has(chEmail)) {
                filteredCharges.push(ch);
                if (ch.status === 'succeeded' && ch.paid && !ch.refunded && ch.created >= startOfMonthTimestamp) {
                    grossThisMonthCents += ch.amount;
                }
            }
        });

        // 10. Merge ledger history with live charges for instant month-by-month & year filtering
        const historicalCharges: any[] = [...(ledgerData.charges || [])];
        const knownChargeIds = new Set(historicalCharges.map((c) => c.id));

        filteredCharges.forEach((ch) => {
            if (ch.status === 'succeeded' && ch.paid && !ch.refunded) {
                if (!knownChargeIds.has(ch.id)) {
                    knownChargeIds.add(ch.id);
                    const chDate = new Date(ch.created * 1000);
                    const amountDollars = ch.amount / 100;
                    const chFee = calculateStripeFee(amountDollars);
                    const chNet = Math.round((amountDollars - chFee) * 100) / 100;
                    historicalCharges.unshift({
                        id: ch.id,
                        amount: amountDollars,
                        fee: chFee,
                        net: chNet,
                        currency: (ch.currency || 'usd').toUpperCase(),
                        created: ch.created * 1000,
                        year: chDate.getFullYear(),
                        month: chDate.getMonth() + 1,
                        day: chDate.getDate(),
                        status: ch.status,
                        paid: ch.paid,
                        customerEmail: ch.billing_details?.email?.toLowerCase()?.trim() || '',
                        customerName: ch.billing_details?.name || null,
                        description: ch.description || 'Subscription',
                        receiptUrl: ch.receipt_url || null,
                    });
                }
            }
        });

        // Sort all charges descending by created timestamp
        historicalCharges.sort((a, b) => b.created - a.created);

        // Compute dynamically updated yearly and monthly aggregations with fee & net profit
        const yearlyBreakdown: Record<string, {
            total: number;
            fee: number;
            net: number;
            count: number;
            months: Record<number, { total: number; fee: number; net: number; count: number }>;
        }> = {};
        let allTimeGross = 0;
        let allTimeFee = 0;
        let allTimeNet = 0;
        let allTimeCount = 0;

        historicalCharges.forEach((ch) => {
            const fee = ch.fee !== undefined ? ch.fee : calculateStripeFee(ch.amount);
            const net = ch.net !== undefined ? ch.net : Math.round((ch.amount - fee) * 100) / 100;
            ch.fee = fee;
            ch.net = net;

            allTimeGross += ch.amount;
            allTimeFee += fee;
            allTimeNet += net;
            allTimeCount++;

            const yStr = String(ch.year);
            if (!yearlyBreakdown[yStr]) {
                yearlyBreakdown[yStr] = {
                    total: 0,
                    fee: 0,
                    net: 0,
                    count: 0,
                    months: {
                        1: { total: 0, fee: 0, net: 0, count: 0 },
                        2: { total: 0, fee: 0, net: 0, count: 0 },
                        3: { total: 0, fee: 0, net: 0, count: 0 },
                        4: { total: 0, fee: 0, net: 0, count: 0 },
                        5: { total: 0, fee: 0, net: 0, count: 0 },
                        6: { total: 0, fee: 0, net: 0, count: 0 },
                        7: { total: 0, fee: 0, net: 0, count: 0 },
                        8: { total: 0, fee: 0, net: 0, count: 0 },
                        9: { total: 0, fee: 0, net: 0, count: 0 },
                        10: { total: 0, fee: 0, net: 0, count: 0 },
                        11: { total: 0, fee: 0, net: 0, count: 0 },
                        12: { total: 0, fee: 0, net: 0, count: 0 },
                    }
                };
            }
            yearlyBreakdown[yStr].total += ch.amount;
            yearlyBreakdown[yStr].fee += fee;
            yearlyBreakdown[yStr].net += net;
            yearlyBreakdown[yStr].count++;
            if (yearlyBreakdown[yStr].months[ch.month]) {
                yearlyBreakdown[yStr].months[ch.month].total += ch.amount;
                yearlyBreakdown[yStr].months[ch.month].fee += fee;
                yearlyBreakdown[yStr].months[ch.month].net += net;
                yearlyBreakdown[yStr].months[ch.month].count++;
            }
        });

        const currentYearStr = String(nowDate.getFullYear());
        const currentMonthNum = nowDate.getMonth() + 1;
        const currentMonthData = yearlyBreakdown[currentYearStr]?.months[currentMonthNum] || { total: Math.round(grossThisMonthCents / 100), fee: 0, net: 0, count: 0 };
        const currentMonthGross = currentMonthData.total;
        const currentMonthFee = Math.round(currentMonthData.fee * 100) / 100;
        const currentMonthNet = Math.round(currentMonthData.net * 100) / 100;

        const formattedCharges = historicalCharges.slice(0, 15).map((ch, idx) => ({
            id: ch.id || `ch-${idx}`,
            amount: ch.amount,
            fee: ch.fee,
            net: ch.net,
            currency: ch.currency,
            created: ch.created,
            status: ch.status,
            paid: ch.paid,
            customerEmail: ch.customerEmail || 'Customer',
            customerName: ch.customerName || null,
            description: ch.description || 'Subscription',
            receiptUrl: ch.receiptUrl || null,
        }));

        const availableProducts = [
            {
                id: targetProductId,
                name: '[BPS] Coach Darath',
                activeSubs: activeCount,
            },
        ];

        return secureJsonResponse({
            connected: true,
            cycleRevenue: cycleRevenueTotal,
            cycleFee: Math.round(cycleFeeTotal * 100) / 100,
            cycleNet: Math.round(cycleNetTotal * 100) / 100,
            mrr: annualizedMrrTotal,
            mrrNet: annualizedMrrNetTotal,
            activeSubscribers: activeCount,
            pastDueCount,
            grossThisMonth: currentMonthGross,
            feeThisMonth: currentMonthFee,
            netThisMonth: currentMonthNet,
            athletes: matchedAthletes,
            unmatchedSubscribers,
            recentCharges: formattedCharges,
            history: {
                allTimeGross: Math.round(allTimeGross * 100) / 100,
                allTimeFee: Math.round(allTimeFee * 100) / 100,
                allTimeNet: Math.round(allTimeNet * 100) / 100,
                allTimeCount,
                availableYears: Object.keys(yearlyBreakdown).map(Number).sort((a, b) => b - a),
                yearlyBreakdown,
                charges: historicalCharges,
            },
            availableProducts,
            selectedProductId: targetProductId,
            currency: primaryCurrency,
            totalAthleteRosterCount: dbAthletes.length,
            config: {
                hasDbConfig: !!dbConfig,
                stripeProductId: targetProductId,
                portalUrl: dbConfig?.portalUrl || null,
            },
        });

    } catch (err: any) {
        console.error('[SECURITY ALERT] Error executing Stripe revenue query:', err);
        return secureJsonResponse({
            connected: false,
            error: err.message || 'Failed to securely fetch revenue data from Stripe.',
            mrr: 0,
            activeSubscribers: 0,
            athletes: [],
            history: null,
            availableProducts: [],
            selectedProductId: null,
        }, 500);
    }
}

/**
 * POST /api/coach/revenue
 * Allows authorized coach/owner to configure or update Stripe credentials directly.
 * Tests restricted API key before saving.
 */
export async function POST(req: Request) {
    const auth = await requireCoach();
    if ('error' in auth) {
        return auth.error;
    }

    try {
        const body = await req.json();
        const { stripeSecretKey, stripeProductId, portalUrl } = body;

        // If key provided, test it first against Stripe
        if (stripeSecretKey) {
            const trimmedKey = stripeSecretKey.trim();
            const testRes = await fetch('https://api.stripe.com/v1/subscriptions?limit=1', {
                headers: {
                    Authorization: `Bearer ${trimmedKey}`,
                },
            });

            if (!testRes.ok) {
                const errData = await testRes.json().catch(() => ({}));
                return secureJsonResponse({
                    error: errData?.error?.message || 'Invalid Stripe API Key. Verification failed.',
                }, 400);
            }
        }

        const email = auth.user.email?.toLowerCase() || 'darathkhon@gmail.com';

        // Check if config exists for this coach or any coach
        const existing = await prisma.coachBillingConfig.findFirst({
            where: { coachEmail: email },
        }) || await prisma.coachBillingConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
        });

        const targetEmail = existing ? existing.coachEmail : email;

        const updated = await prisma.coachBillingConfig.upsert({
            where: { coachEmail: targetEmail },
            create: {
                coachEmail: targetEmail,
                stripeSecretKey: stripeSecretKey ? stripeSecretKey.trim() : (existing?.stripeSecretKey || null),
                stripeProductId: stripeProductId !== undefined ? (stripeProductId ? stripeProductId.trim() : null) : (existing?.stripeProductId || 'prod_PcfIQXv2L5xYid'),
                portalUrl: portalUrl !== undefined ? (portalUrl ? portalUrl.trim() : null) : (existing?.portalUrl || null),
            },
            update: {
                ...(stripeSecretKey ? { stripeSecretKey: stripeSecretKey.trim() } : {}),
                ...(stripeProductId !== undefined ? { stripeProductId: stripeProductId ? stripeProductId.trim() : null } : {}),
                ...(portalUrl !== undefined ? { portalUrl: portalUrl ? portalUrl.trim() : null } : {}),
            },
        });

        // Invalidate in-memory cache so fresh revenue data is fetched immediately
        memoryCache = null;

        return secureJsonResponse({
            success: true,
            message: 'Stripe configuration saved and verified successfully.',
            config: {
                coachEmail: updated.coachEmail,
                stripeProductId: updated.stripeProductId,
                portalUrl: updated.portalUrl,
                hasKey: !!updated.stripeSecretKey,
            },
        });
    } catch (err: any) {
        console.error('Error saving billing config:', err);
        return secureJsonResponse({ error: err.message || 'Failed to save configuration' }, 500);
    }
}


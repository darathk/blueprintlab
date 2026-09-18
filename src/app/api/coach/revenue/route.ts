import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

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

// In-memory cache for 60 seconds to prevent hitting Stripe rate limits on multi-page fetching
let memoryCache: {
    data: any;
    timestamp: number;
} | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function GET(req: Request) {
    // 1. Strict Coach Authorization check
    const auth = await requireCoach();
    if ('error' in auth) {
        return auth.error;
    }

    const { searchParams } = new URL(req.url);
    const queryProductId = searchParams.get('productId');
    const envProductId = process.env.STRIPE_PRODUCT_ID;
    
    // Default to coach's product ID if set
    const targetProductId = queryProductId === 'all' 
        ? null 
        : (queryProductId || envProductId || 'prod_PcfIQXv2L5xYid');

    const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY;

    if (!stripeKey) {
        return NextResponse.json({
            connected: false,
            mrr: 0,
            activeSubscribers: 0,
            pastDueCount: 0,
            grossThisMonth: 0,
            athletes: [],
            unmatchedSubscribers: [],
            recentCharges: [],
            availableProducts: [],
            selectedProductId: null,
            currency: 'USD',
            message: 'Stripe API key is not configured.',
            instructions: 'Add your Stripe Restricted API Key (starts with rk_live_...) to your environment variables as STRIPE_SECRET_KEY.',
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
            // 2. Fetch products map (up to 100 products)
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

            // 3. Paginate subscriptions from Stripe (retrieve all subscriptions)
            let startingAfter: string | undefined = undefined;
            while (true) {
                const subUrl = 'https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer' 
                    + (startingAfter ? `&starting_after=${startingAfter}` : '');

                const subRes = await fetch(subUrl, { headers: stripeHeaders });

                if (!subRes.ok) {
                    const errData = await subRes.json().catch(() => ({}));
                    const errorMsg = errData?.error?.message || `Stripe API error (${subRes.status})`;
                    return NextResponse.json({
                        connected: false,
                        error: errorMsg,
                        mrr: 0,
                        activeSubscribers: 0,
                        athletes: [],
                        availableProducts: [],
                        selectedProductId: null,
                    }, { status: 200 });
                }

                const subData = await subRes.json();
                const pageSubs: StripeSubscription[] = subData.data || [];
                allSubscriptions.push(...pageSubs);

                if (!subData.has_more || pageSubs.length === 0) break;
                startingAfter = pageSubs[pageSubs.length - 1].id;
            }

            // 4. Fetch recent charges from Stripe (limit 50)
            const chargesRes = await fetch('https://api.stripe.com/v1/charges?limit=50', {
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

        // 5. Discover all Products from subscriptions & count active subscribers
        const productStats = new Map<string, { id: string; name: string; activeSubs: number }>();

        allSubscriptions.forEach((sub) => {
            const items = sub.items?.data || [];
            items.forEach((item) => {
                const prodId = item.price?.product || item.plan?.product;

                if (prodId && typeof prodId === 'string') {
                    const existing = productStats.get(prodId) || {
                        id: prodId,
                        name: productsMap.get(prodId) || prodId,
                        activeSubs: 0,
                    };
                    if (sub.status === 'active' || sub.status === 'trialing') {
                        existing.activeSubs += 1;
                    }
                    productStats.set(prodId, existing);
                }
            });
        });

        // Sort products by active subscriber count
        const availableProducts = Array.from(productStats.values()).sort((a, b) => b.activeSubs - a.activeSubs);

        // 6. Filter Subscriptions by Coach Product if targetProductId is specified
        const subscriptions = allSubscriptions.filter((sub) => {
            if (!targetProductId) return true; // Include all if no product filter
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
                activeProgramId: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });

        // 8. Compute MRR and Metrics for the filtered subscriptions
        let totalMrrCents = 0;
        let activeCount = 0;
        let pastDueCount = 0;
        let primaryCurrency = 'usd';

        // Map filtered subscriptions by customer email
        const subMapByEmail = new Map<string, {
            sub: StripeSubscription;
            amountMonthly: number;
            currency: string;
            customerName?: string;
            productName?: string;
        }>();

        const activeSubEmails = new Set<string>();

        subscriptions.forEach((sub) => {
            const customerObj = typeof sub.customer === 'object' ? sub.customer : null;
            const email = customerObj?.email?.toLowerCase()?.trim();
            const customerName = customerObj?.name || undefined;

            // Find item corresponding to the target product (or the first item)
            let matchingItem = sub.items?.data?.[0];
            if (targetProductId && sub.items?.data) {
                const found = sub.items.data.find((it) => {
                    const pid = it.price?.product || it.plan?.product;
                    return pid === targetProductId;
                });
                if (found) matchingItem = found;
            }

            const rawAmount = matchingItem?.price?.unit_amount ?? matchingItem?.plan?.amount ?? 0;
            const quantity = matchingItem?.quantity ?? 1;
            const interval = matchingItem?.price?.recurring?.interval ?? matchingItem?.plan?.interval ?? 'month';
            const intervalCount = matchingItem?.price?.recurring?.interval_count ?? matchingItem?.plan?.interval_count ?? 1;
            const currency = matchingItem?.price?.currency ?? matchingItem?.plan?.currency ?? 'usd';
            primaryCurrency = currency;

            const prodId = matchingItem?.price?.product || matchingItem?.plan?.product;
            const productName = prodId ? (productsMap.get(prodId) || productStats.get(prodId)?.name || prodId) : '';

            let normalizedMonthlyCents = rawAmount * quantity;
            const count = intervalCount || 1;
            if (interval === 'week') {
                normalizedMonthlyCents = Math.round((rawAmount * quantity * 52.143) / (count * 12));
            } else if (interval === 'year') {
                normalizedMonthlyCents = Math.round((rawAmount * quantity) / (12 * count));
            } else if (interval === 'month') {
                normalizedMonthlyCents = Math.round((rawAmount * quantity) / count);
            } else if (interval === 'day') {
                normalizedMonthlyCents = Math.round((rawAmount * quantity * 30.416) / count);
            }

            if (sub.status === 'active' || sub.status === 'trialing') {
                totalMrrCents += normalizedMonthlyCents;
                activeCount++;
                if (email) activeSubEmails.add(email);
            } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
                pastDueCount++;
            }

            if (email) {
                const existing = subMapByEmail.get(email);
                if (!existing || (sub.status === 'active' && existing.sub.status !== 'active')) {
                    subMapByEmail.set(email, {
                        sub,
                        amountMonthly: normalizedMonthlyCents / 100,
                        currency: currency.toUpperCase(),
                        customerName,
                        productName,
                    });
                }
            }
        });

        // 9. Calculate Gross Revenue This Month
        const allowedCustomerEmails = targetProductId ? new Set(Array.from(subMapByEmail.keys())) : null;

        const nowDate = new Date();
        const startOfMonthTimestamp = Math.floor(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000);
        let grossThisMonthCents = 0;

        charges.forEach((ch) => {
            const chEmail = ch.billing_details?.email?.toLowerCase()?.trim();
            if (ch.status === 'succeeded' && ch.paid && !ch.refunded && ch.created >= startOfMonthTimestamp) {
                if (!allowedCustomerEmails || (chEmail && allowedCustomerEmails.has(chEmail))) {
                    grossThisMonthCents += ch.amount;
                }
            }
        });

        // 10. Match DB Athletes with Stripe Status
        const matchedAthletes = dbAthletes.map((athlete) => {
            const athleteEmail = athlete.email.toLowerCase().trim();
            const subInfo = subMapByEmail.get(athleteEmail);

            if (subInfo) {
                const s = subInfo.sub;
                return {
                    id: athlete.id,
                    name: athlete.name,
                    email: athlete.email,
                    hasSubscription: true,
                    status: s.status, // active, past_due, canceled, trialing, unpaid
                    monthlyAmount: subInfo.amountMonthly,
                    currency: subInfo.currency,
                    currentPeriodEnd: s.current_period_end ? s.current_period_end * 1000 : null,
                    cancelAtPeriodEnd: s.cancel_at_period_end,
                    stripeSubscriptionId: s.id,
                    productName: subInfo.productName || null,
                };
            }

            return {
                id: athlete.id,
                name: athlete.name,
                email: athlete.email,
                hasSubscription: false,
                status: 'none',
                monthlyAmount: 0,
                currency: primaryCurrency.toUpperCase(),
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                stripeSubscriptionId: null,
                productName: null,
            };
        });

        // 11. Find any Stripe subscriptions that aren't in the DB (external/unmatched)
        const dbEmailSet = new Set(dbAthletes.map(a => a.email.toLowerCase().trim()));
        const unmatchedSubscribers: Array<{
            id: string;
            email: string;
            name: string;
            status: string;
            monthlyAmount: number;
            currency: string;
            currentPeriodEnd: number | null;
            productName?: string;
        }> = [];

        subMapByEmail.forEach((info, email) => {
            if (!dbEmailSet.has(email)) {
                unmatchedSubscribers.push({
                    id: info.sub.id,
                    email: email,
                    name: info.customerName || email.split('@')[0],
                    status: info.sub.status,
                    monthlyAmount: info.amountMonthly,
                    currency: info.currency,
                    currentPeriodEnd: info.sub.current_period_end ? info.sub.current_period_end * 1000 : null,
                    productName: info.productName,
                });
            }
        });

        // 12. Filter Recent Charges
        const filteredCharges = charges.filter((ch) => {
            if (!allowedCustomerEmails) return true;
            const chEmail = ch.billing_details?.email?.toLowerCase()?.trim();
            return chEmail && allowedCustomerEmails.has(chEmail);
        });

        const formattedCharges = filteredCharges.slice(0, 15).map((ch) => ({
            id: ch.id,
            amount: ch.amount / 100,
            currency: ch.currency.toUpperCase(),
            created: ch.created * 1000,
            status: ch.status,
            paid: ch.paid,
            customerEmail: ch.billing_details?.email || 'Customer',
            customerName: ch.billing_details?.name || null,
            description: ch.description || 'Subscription',
            receiptUrl: ch.receipt_url || null,
        }));

        return NextResponse.json({
            connected: true,
            mrr: Math.round(totalMrrCents / 100),
            activeSubscribers: activeCount,
            pastDueCount,
            grossThisMonth: Math.round(grossThisMonthCents / 100),
            athletes: matchedAthletes,
            unmatchedSubscribers,
            recentCharges: formattedCharges,
            availableProducts,
            selectedProductId: targetProductId,
            currency: primaryCurrency.toUpperCase(),
            totalAthleteRosterCount: dbAthletes.length,
        });

    } catch (err: any) {
        console.error('Error fetching Stripe revenue:', err);
        return NextResponse.json({
            connected: false,
            error: err.message || 'Failed to fetch revenue data from Stripe.',
            mrr: 0,
            activeSubscribers: 0,
            athletes: [],
            availableProducts: [],
            selectedProductId: null,
        }, { status: 500 });
    }
}

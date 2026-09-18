import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface StripeCustomer {
    id: string;
    email?: string | null;
    name?: string | null;
}

interface StripeSubscriptionItem {
    plan?: {
        amount?: number;
        currency?: string;
        interval?: string;
    };
    price?: {
        unit_amount?: number;
        currency?: string;
        recurring?: {
            interval?: string;
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

export async function GET() {
    // 1. Strict Coach Authorization check
    const auth = await requireCoach();
    if ('error' in auth) {
        return auth.error;
    }

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

        // 2. Fetch subscriptions from Stripe
        const subRes = await fetch('https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer', {
            headers: stripeHeaders,
            next: { revalidate: 60 },
        });

        if (!subRes.ok) {
            const errData = await subRes.json().catch(() => ({}));
            const errorMsg = errData?.error?.message || `Stripe API error (${subRes.status})`;
            return NextResponse.json({
                connected: false,
                error: errorMsg,
                mrr: 0,
                activeSubscribers: 0,
                athletes: [],
            }, { status: 200 });
        }

        const subData = await subRes.json();
        const subscriptions: StripeSubscription[] = subData.data || [];

        // 3. Fetch recent charges from Stripe
        const chargesRes = await fetch('https://api.stripe.com/v1/charges?limit=30', {
            headers: stripeHeaders,
            next: { revalidate: 60 },
        });

        let charges: StripeCharge[] = [];
        if (chargesRes.ok) {
            const chargeData = await chargesRes.json();
            charges = chargeData.data || [];
        }

        // 4. Fetch all active athletes from database
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

        // 5. Compute MRR and Metrics
        let totalMrrCents = 0;
        let activeCount = 0;
        let pastDueCount = 0;
        let primaryCurrency = 'usd';

        // Map subscriptions by customer email
        const subMapByEmail = new Map<string, {
            sub: StripeSubscription;
            amountMonthly: number;
            currency: string;
            customerName?: string;
        }>();

        const activeSubEmails = new Set<string>();

        subscriptions.forEach((sub) => {
            const customerObj = typeof sub.customer === 'object' ? sub.customer : null;
            const email = customerObj?.email?.toLowerCase()?.trim();
            const customerName = customerObj?.name || undefined;

            const item = sub.items?.data?.[0];
            const rawAmount = item?.price?.unit_amount ?? item?.plan?.amount ?? 0;
            const quantity = item?.quantity ?? 1;
            const interval = item?.price?.recurring?.interval ?? item?.plan?.interval ?? 'month';
            const currency = item?.price?.currency ?? item?.plan?.currency ?? 'usd';
            primaryCurrency = currency;

            let normalizedMonthlyCents = rawAmount * quantity;
            if (interval === 'year') {
                normalizedMonthlyCents = Math.round(normalizedMonthlyCents / 12);
            } else if (interval === 'week') {
                normalizedMonthlyCents = Math.round(normalizedMonthlyCents * 4.333);
            } else if (interval === 'day') {
                normalizedMonthlyCents = Math.round(normalizedMonthlyCents * 30);
            }

            if (sub.status === 'active' || sub.status === 'trialing') {
                totalMrrCents += normalizedMonthlyCents;
                activeCount++;
                if (email) activeSubEmails.add(email);
            } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
                pastDueCount++;
            }

            if (email) {
                // Keep the most active or highest subscription if multiple exist
                const existing = subMapByEmail.get(email);
                if (!existing || (sub.status === 'active' && existing.sub.status !== 'active')) {
                    subMapByEmail.set(email, {
                        sub,
                        amountMonthly: normalizedMonthlyCents / 100,
                        currency: currency.toUpperCase(),
                        customerName,
                    });
                }
            }
        });

        // 6. Calculate Gross Revenue This Month
        const now = new Date();
        const startOfMonthTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
        let grossThisMonthCents = 0;

        charges.forEach((ch) => {
            if (ch.status === 'succeeded' && ch.paid && !ch.refunded && ch.created >= startOfMonthTimestamp) {
                grossThisMonthCents += ch.amount;
            }
        });

        // 7. Match DB Athletes with Stripe Status
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
            };
        });

        // 8. Find any Stripe subscriptions that aren't in the DB (external/unmatched)
        const dbEmailSet = new Set(dbAthletes.map(a => a.email.toLowerCase().trim()));
        const unmatchedSubscribers: Array<{
            id: string;
            email: string;
            name: string;
            status: string;
            monthlyAmount: number;
            currency: string;
            currentPeriodEnd: number | null;
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
                });
            }
        });

        // 9. Format Recent Charges for Activity Feed
        const formattedCharges = charges.slice(0, 15).map((ch) => ({
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
        }, { status: 500 });
    }
}

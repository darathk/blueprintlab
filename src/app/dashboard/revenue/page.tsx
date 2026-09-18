'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
    DollarSign, 
    TrendingUp, 
    Users, 
    CreditCard, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    ExternalLink, 
    RefreshCw, 
    ShieldCheck, 
    Search,
    ArrowUpRight,
    FileText,
    Tag,
    ChevronLeft,
    ChevronRight,
    Calendar,
    BarChart3,
    Settings,
    Key,
    Save,
    User
} from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface AthleteBilling {
    id: string;
    name: string;
    email: string;
    customerEmail?: string | null;
    customerName?: string | null;
    hasSubscription: boolean;
    status: string; // active, past_due, canceled, trialing, unpaid, none
    rawAmount?: number;
    stripeFee?: number;
    netAmount?: number;
    billingInterval?: string;
    interval?: string;
    intervalCount?: number;
    monthlyAmount: number;
    monthlyNet?: number;
    currency: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionUrl?: string | null;
    stripeCustomerUrl?: string | null;
    productName?: string | null;
}

interface UnmatchedSubscriber {
    id: string;
    email: string;
    name: string;
    status: string;
    rawAmount?: number;
    stripeFee?: number;
    netAmount?: number;
    billingInterval?: string;
    monthlyAmount: number;
    monthlyNet?: number;
    currency: string;
    currentPeriodEnd: number | null;
    productName?: string;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionUrl?: string | null;
    stripeCustomerUrl?: string | null;
}

interface RecentCharge {
    id: string;
    amount: number;
    fee?: number;
    net?: number;
    currency: string;
    created: number;
    status: string;
    paid: boolean;
    customerEmail: string;
    customerName: string | null;
    description: string;
    receiptUrl: string | null;
}

interface StripeProductItem {
    id: string;
    name: string;
    activeSubs: number;
}

interface MonthStat {
    total: number;
    fee?: number;
    net?: number;
    count: number;
}

interface YearStat {
    total: number;
    fee?: number;
    net?: number;
    count: number;
    months: Record<number, MonthStat>;
}

interface HistoricalCharge {
    id: string;
    amount: number;
    fee?: number;
    net?: number;
    currency: string;
    created: number;
    year: number;
    month: number;
    day: number;
    status: string;
    paid: boolean;
    customerEmail: string;
    customerName: string | null;
    description: string;
    receiptUrl: string | null;
}

interface RevenueHistory {
    allTimeGross: number;
    allTimeFee?: number;
    allTimeNet?: number;
    allTimeCount: number;
    availableYears: number[];
    yearlyBreakdown: Record<string, YearStat>;
    charges: HistoricalCharge[];
}

interface RevenueData {
    connected: boolean;
    cycleRevenue?: number;
    cycleFee?: number;
    cycleNet?: number;
    mrr: number;
    mrrNet?: number;
    activeSubscribers: number;
    pastDueCount: number;
    grossThisMonth: number;
    feeThisMonth?: number;
    netThisMonth?: number;
    athletes: AthleteBilling[];
    unmatchedSubscribers?: UnmatchedSubscriber[];
    recentCharges?: RecentCharge[];
    history?: RevenueHistory | null;
    availableProducts?: StripeProductItem[];
    selectedProductId?: string | null;
    currency: string;
    totalAthleteRosterCount?: number;
    error?: string;
    message?: string;
    instructions?: string;
    config?: {
        hasDbConfig?: boolean;
        stripeProductId?: string | null;
        portalUrl?: string | null;
    };
}

export default function CoachRevenuePage() {
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'past_due'>('all');

    // Period & Time Filter State
    const [selectedYear, setSelectedYear] = useState<string>('2026');
    const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
    const [chargeSearchQuery, setChargeSearchQuery] = useState('');
    const [transactionsPage, setTransactionsPage] = useState(1);
    const [chartMetric, setChartMetric] = useState<'net' | 'gross'>('net');
    const CHARGES_PER_PAGE = 25;

    // Stripe Billing Settings Drawer / Form State
    const [showSettings, setShowSettings] = useState(false);
    const [formKey, setFormKey] = useState('');
    const [formProductId, setFormProductId] = useState('prod_PcfIQXv2L5xYid');
    const [formPortalUrl, setFormPortalUrl] = useState('https://billing.stripe.com/p/login/3cI7sL30jevG1f6frI2B200');
    const [savingConfig, setSavingConfig] = useState(false);
    const [configFeedback, setConfigFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleSaveConfig = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSavingConfig(true);
        setConfigFeedback(null);
        try {
            const res = await fetch('/api/coach/revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stripeSecretKey: formKey || undefined,
                    stripeProductId: formProductId || undefined,
                    portalUrl: formPortalUrl || undefined,
                }),
            });
            const resJson = await res.json();
            if (res.ok) {
                setConfigFeedback({ type: 'success', message: 'Stripe credentials successfully connected & verified!' });
                setFormKey('');
                await fetchRevenue(true);
            } else {
                setConfigFeedback({ type: 'error', message: resJson.error || 'Failed to verify or save credentials' });
            }
        } catch (err: any) {
            setConfigFeedback({ type: 'error', message: err.message || 'Network error saving config' });
        } finally {
            setSavingConfig(false);
        }
    };

    const fetchRevenue = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await fetch('/api/coach/revenue');
            if (res.ok) {
                const json: RevenueData = await res.json();
                setData(json);
                if (json.config?.stripeProductId) {
                    setFormProductId(json.config.stripeProductId);
                }
                if (json.config?.portalUrl) {
                    setFormPortalUrl(json.config.portalUrl);
                }
            } else {
                setData({
                    connected: false,
                    error: `Failed to load revenue data (HTTP ${res.status})`,
                    cycleRevenue: 0,
                    mrr: 0,
                    activeSubscribers: 0,
                    pastDueCount: 0,
                    grossThisMonth: 0,
                    athletes: [],
                    currency: 'USD',
                });
            }
        } catch (err: any) {
            setData({
                connected: false,
                error: err.message || 'Network error fetching revenue',
                cycleRevenue: 0,
                mrr: 0,
                activeSubscribers: 0,
                pastDueCount: 0,
                grossThisMonth: 0,
                athletes: [],
                currency: 'USD',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRevenue();
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const searchParam = params.get('search') || params.get('q') || params.get('athlete');
            if (searchParam) {
                setSearchQuery(searchParam);
                setTimeout(() => {
                    const el = document.getElementById('athlete-subscriptions-roster');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 400);
            }
        }
    }, []);

    const filteredAthletes = useMemo(() => {
        if (!data?.athletes) return [];
        return data.athletes.filter((athlete) => {
            const query = searchQuery.toLowerCase().trim();
            const matchesQuery = !query ||
                athlete.name.toLowerCase().includes(query) ||
                athlete.email.toLowerCase().includes(query) ||
                (athlete.customerEmail && athlete.customerEmail.toLowerCase().includes(query));
            
            if (!matchesQuery) return false;

            if (filterStatus === 'past_due') {
                return athlete.status === 'past_due' || athlete.status === 'unpaid';
            }
            return true;
        });
    }, [data?.athletes, searchQuery, filterStatus]);

    const formatMoney = (val: number, currency = 'USD', decimals?: number) => {
        const numDecimals = decimals !== undefined ? decimals : (val % 1 !== 0 ? 2 : 0);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: numDecimals,
            maximumFractionDigits: numDecimals,
        }).format(val);
    };

    const formatDate = (ts: number | null) => {
        if (!ts) return 'N/A';
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Reset pagination when filters change
    useEffect(() => {
        setTransactionsPage(1);
    }, [selectedYear, selectedMonth, chargeSearchQuery]);

    // Helper to calculate Stripe fee fallback if missing
    const calculateStripeFee = (amount: number, fee?: number): number => {
        if (fee !== undefined) return fee;
        if (amount <= 0) return 0;
        return Math.round(amount * 100 * 0.029 + 30) / 100;
    };

    // Period statistics calculation (Gross, Stripe Fees, Net Profit)
    const periodStats = useMemo(() => {
        if (!data?.history) {
            const gross = data?.grossThisMonth || 0;
            const fees = data?.feeThisMonth !== undefined ? data.feeThisMonth : calculateStripeFee(gross);
            const net = data?.netThisMonth !== undefined ? data.netThisMonth : Math.round((gross - fees) * 100) / 100;
            return {
                grossCollected: gross,
                stripeFees: fees,
                netProfit: net,
                count: 0,
                avgTicket: 0,
                avgNet: 0,
                margin: gross > 0 ? Math.round((net / gross) * 1000) / 10 : 96.9,
                periodLabel: 'September 2026',
            };
        }

        const history = data.history;

        if (selectedYear === 'all') {
            const gross = history.allTimeGross;
            const fees = history.allTimeFee !== undefined ? history.allTimeFee : calculateStripeFee(gross);
            const net = history.allTimeNet !== undefined ? history.allTimeNet : Math.round((gross - fees) * 100) / 100;
            const count = history.allTimeCount;
            return {
                grossCollected: gross,
                stripeFees: fees,
                netProfit: net,
                count: count,
                avgTicket: count > 0 ? Math.round((gross / count) * 100) / 100 : 0,
                avgNet: count > 0 ? Math.round((net / count) * 100) / 100 : 0,
                margin: gross > 0 ? Math.round((net / gross) * 1000) / 10 : 96.9,
                periodLabel: 'All-Time (2024–2026)',
            };
        }

        const yearData = history.yearlyBreakdown?.[selectedYear];
        if (!yearData) {
            return {
                grossCollected: 0,
                stripeFees: 0,
                netProfit: 0,
                count: 0,
                avgTicket: 0,
                avgNet: 0,
                margin: 0,
                periodLabel: selectedYear,
            };
        }

        if (selectedMonth === 'all') {
            const gross = yearData.total;
            const fees = yearData.fee !== undefined ? yearData.fee : calculateStripeFee(gross);
            const net = yearData.net !== undefined ? yearData.net : Math.round((gross - fees) * 100) / 100;
            const count = yearData.count;
            return {
                grossCollected: gross,
                stripeFees: fees,
                netProfit: net,
                count: count,
                avgTicket: count > 0 ? Math.round((gross / count) * 100) / 100 : 0,
                avgNet: count > 0 ? Math.round((net / count) * 100) / 100 : 0,
                margin: gross > 0 ? Math.round((net / gross) * 1000) / 10 : 96.9,
                periodLabel: `Full Year ${selectedYear}`,
            };
        }

        const monthData = yearData.months?.[selectedMonth] || { total: 0, fee: 0, net: 0, count: 0 };
        const gross = monthData.total;
        const fees = monthData.fee !== undefined ? monthData.fee : calculateStripeFee(gross);
        const net = monthData.net !== undefined ? monthData.net : Math.round((gross - fees) * 100) / 100;
        const count = monthData.count;
        const monthName = MONTH_FULL_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`;

        return {
            grossCollected: gross,
            stripeFees: fees,
            netProfit: net,
            count: count,
            avgTicket: count > 0 ? Math.round((gross / count) * 100) / 100 : 0,
            avgNet: count > 0 ? Math.round((net / count) * 100) / 100 : 0,
            margin: gross > 0 ? Math.round((net / gross) * 1000) / 10 : 96.9,
            periodLabel: `${monthName} ${selectedYear}`,
        };
    }, [data, selectedYear, selectedMonth]);

    // Filtered charges for the selected period with live search and precalculated fees
    const filteredHistoricalCharges = useMemo(() => {
        if (!data?.history?.charges) return [];
        const query = chargeSearchQuery.toLowerCase().trim();

        return data.history.charges.filter((ch) => {
            if (selectedYear !== 'all' && String(ch.year) !== selectedYear) {
                return false;
            }
            if (selectedMonth !== 'all' && ch.month !== selectedMonth) {
                return false;
            }
            if (query) {
                const matchesEmail = (ch.customerEmail || '').toLowerCase().includes(query);
                const matchesName = (ch.customerName || '').toLowerCase().includes(query);
                const matchesDesc = (ch.description || '').toLowerCase().includes(query);
                const matchesAmount = ch.amount.toString().includes(query);
                if (!matchesEmail && !matchesName && !matchesDesc && !matchesAmount) {
                    return false;
                }
            }
            return true;
        }).map((ch) => {
            const fee = ch.fee !== undefined ? ch.fee : calculateStripeFee(ch.amount);
            const net = ch.net !== undefined ? ch.net : Math.round((ch.amount - fee) * 100) / 100;
            return {
                ...ch,
                fee,
                net,
            };
        });
    }, [data?.history?.charges, selectedYear, selectedMonth, chargeSearchQuery]);

    // Pagination for historical charges
    const paginatedCharges = useMemo(() => {
        const startIndex = (transactionsPage - 1) * CHARGES_PER_PAGE;
        return filteredHistoricalCharges.slice(startIndex, startIndex + CHARGES_PER_PAGE);
    }, [filteredHistoricalCharges, transactionsPage]);

    const totalPages = Math.ceil(filteredHistoricalCharges.length / CHARGES_PER_PAGE) || 1;

    const renderSettingsForm = (showCloseButton = false) => (
        <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'linear-gradient(145deg, rgba(24, 24, 38, 0.95), rgba(16, 16, 26, 0.98))',
            border: '1px solid rgba(125, 135, 210, 0.3)',
            marginBottom: '24px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        background: 'rgba(125, 135, 210, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                    }}>
                        <Key size={18} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                            Stripe Connection Credentials
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', margin: 0 }}>
                            Configure your Restricted Key and Product ID to isolate coaching revenue.
                        </p>
                    </div>
                </div>
                {showCloseButton && (
                    <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="glass-button chat-press"
                        style={{
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                        }}
                    >
                        ✕ Close
                    </button>
                )}
            </div>

            {configFeedback && (
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: configFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${configFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: configFeedback.type === 'success' ? '#10b981' : '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                }}>
                    {configFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{configFeedback.message}</span>
                </div>
            )}

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                            Restricted Stripe Key
                        </label>
                        <input
                            type="password"
                            value={formKey}
                            onChange={(e) => setFormKey(e.target.value)}
                            placeholder="rk_live_... (leave empty if already configured)"
                            className="glass-input"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                fontSize: '0.85rem',
                                borderRadius: '10px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--card-border)',
                                color: 'var(--foreground)',
                                outline: 'none',
                            }}
                        />
                        <span style={{ fontSize: '0.73rem', color: 'var(--secondary-foreground)', display: 'block', marginTop: '4px' }}>
                            Encrypted in database. Never exposed to browser or athlete clients.
                        </span>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                            Coach Product ID
                        </label>
                        <input
                            type="text"
                            value={formProductId}
                            onChange={(e) => setFormProductId(e.target.value)}
                            placeholder="e.g. prod_PcfIQXv2L5xYid"
                            className="glass-input"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                fontSize: '0.85rem',
                                borderRadius: '10px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--card-border)',
                                color: 'var(--foreground)',
                                outline: 'none',
                            }}
                        />
                        <span style={{ fontSize: '0.73rem', color: 'var(--secondary-foreground)', display: 'block', marginTop: '4px' }}>
                            Isolates calculations strictly to subscriptions for your coaching product.
                        </span>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                        Stripe Customer Billing Portal URL
                    </label>
                    <input
                        type="url"
                        value={formPortalUrl}
                        onChange={(e) => setFormPortalUrl(e.target.value)}
                        placeholder="https://billing.stripe.com/p/login/..."
                        className="glass-input"
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '0.85rem',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--card-border)',
                            color: 'var(--foreground)',
                            outline: 'none',
                        }}
                    />
                    <span style={{ fontSize: '0.73rem', color: 'var(--secondary-foreground)', display: 'block', marginTop: '4px' }}>
                        Used by athletes in their Settings page to self-manage payment cards and cancellations.
                    </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    <button
                        type="submit"
                        disabled={savingConfig}
                        className="glass-button chat-press"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--primary), #4f46e5)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <Save size={15} className={savingConfig ? 'animate-spin' : ''} />
                        <span>{savingConfig ? 'Verifying with Stripe...' : 'Save & Sync Live Revenue'}</span>
                    </button>
                </div>
            </form>
        </div>
    );

    return (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 20px 120px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '28px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Link href="/dashboard" style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', textDecoration: 'none' }}>
                                Command Center
                            </Link>
                            <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>/</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Revenue</span>
                        </div>
                        <h1 style={{
                            fontSize: '1.85rem',
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            color: 'var(--foreground)',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}>
                            <span>Revenue & Subscriptions</span>
                            {data?.connected && (
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                    Live Sync
                                </span>
                            )}
                        </h1>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Dedicated Coach Product Badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            color: 'var(--foreground)',
                            background: 'rgba(125, 135, 210, 0.12)',
                            border: '1px solid rgba(125, 135, 210, 0.3)',
                        }}>
                            <Tag size={14} style={{ color: 'var(--primary)' }} />
                            <span>[BPS] Coach Darath</span>
                        </div>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="glass-button chat-press"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: showSettings ? 'rgba(125, 135, 210, 0.25)' : undefined,
                            }}
                        >
                            <Settings size={15} />
                            <span>Settings</span>
                        </button>

                        <button
                            onClick={() => fetchRevenue(true)}
                            disabled={loading || refreshing}
                            className="glass-button chat-press"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                            <span>Refresh</span>
                        </button>

                        <a
                            href="https://dashboard.stripe.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass-button chat-press"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                color: 'var(--foreground)',
                            }}
                        >
                            <span>Stripe Dashboard</span>
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Collapsible Stripe Settings Panel (for Connected State) */}
            {data?.connected && showSettings && renderSettingsForm(true)}

            {/* Loading Skeleton */}
            {loading && !data && (
                <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: 'var(--secondary-foreground)',
                }}>
                    <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Loading revenue metrics from Stripe...</p>
                </div>
            )}

            {/* Stripe Setup Guide (When Not Connected) */}
            {!loading && data && !data.connected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="glass-panel" style={{
                        padding: '32px',
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(20, 20, 30, 0.85), rgba(12, 12, 18, 0.95))',
                        border: '1px solid rgba(125, 135, 210, 0.25)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: '16px',
                                background: 'rgba(125, 135, 210, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary)',
                                flexShrink: 0,
                            }}>
                                <CreditCard size={26} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0' }}>
                                    Connect Your Stripe Revenue
                                </h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', margin: 0, lineHeight: 1.5 }}>
                                    Sync real-time Monthly Recurring Revenue (MRR), paying athlete counts, and payment statuses directly into your coach dashboard.
                                </p>
                            </div>
                        </div>

                        {data.error && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '24px',
                            }}>
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                <span>{data.error}</span>
                            </div>
                        )}

                        {/* Security Notice */}
                        <div style={{
                            padding: '16px 18px',
                            borderRadius: '16px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            gap: '12px',
                            marginBottom: '28px',
                        }}>
                            <ShieldCheck size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>
                                    Safe & Restricted Read-Only Access
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', lineHeight: 1.4 }}>
                                    We only need a <strong>Restricted Key</strong> with Read permissions. This key cannot withdraw funds, change prices, or perform any actions — it only reads your active subscriptions and charges to calculate your MRR.
                                </div>
                            </div>
                        </div>

                        {/* How to link steps */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '16px',
                            padding: '20px',
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--foreground)' }}>
                                How to connect your Stripe account & product:
                            </h3>

                            <ol style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '0.88rem',
                                color: 'var(--secondary-foreground)',
                                lineHeight: 1.7,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }}>
                                <li>
                                    Log in to your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Stripe Dashboard &gt; Developers &gt; API Keys</a>.
                                </li>
                                <li>
                                    Click <strong>Create restricted key</strong> and name it <code>BlueprintLab Read-Only</code>.
                                </li>
                                <li>
                                    Set permissions to <strong>Read</strong> for:
                                    <div style={{
                                        display: 'inline-flex',
                                        gap: '6px',
                                        flexWrap: 'wrap',
                                        marginTop: '4px',
                                        marginLeft: '4px'
                                    }}>
                                        <span style={codeBadge}>Subscriptions: Read</span>
                                        <span style={codeBadge}>Products: Read</span>
                                        <span style={codeBadge}>Customers: Read</span>
                                        <span style={codeBadge}>Charges: Read</span>
                                        <span style={codeBadge}>Balance: Read</span>
                                    </div>
                                </li>
                                <li>
                                    Copy your new key (starts with <code>rk_live_...</code>).
                                </li>
                                <li>
                                    <strong>Find your Product ID</strong>: In your Stripe Dashboard, go to <strong>Product catalog</strong> (or <strong>Products</strong>), click on your coaching product, and copy the <strong>Product ID</strong> (starts with <code>prod_...</code>, e.g. <code>prod_R123456789</code>).
                                </li>
                                <li>
                                    Paste your <strong>Restricted Key</strong> and <strong>Product ID</strong> below to instantly connect and verify your live Stripe metrics:
                                </li>
                            </ol>
                        </div>

                        {/* Interactive Direct Connect Form */}
                        <div style={{ marginTop: '24px' }}>
                            {renderSettingsForm(false)}
                        </div>
                    </div>
                </div>
            )}

            {/* Live Metrics (When Connected) */}
            {data && data.connected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Time Period & Filter Navigation Bar */}
                    <div className="glass-panel" style={{
                        padding: '14px 20px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '14px',
                        background: 'linear-gradient(145deg, rgba(22, 22, 36, 0.9), rgba(14, 14, 24, 0.96))',
                        border: '1px solid rgba(125, 135, 210, 0.25)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.25)',
                    }}>
                        {/* Year Selector Tabs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--secondary-foreground)', fontSize: '0.82rem', fontWeight: 600, marginRight: '2px' }}>
                                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                                <span>Period:</span>
                            </div>

                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '2px',
                                borderRadius: '11px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                height: 36,
                                gap: '2px',
                            }}>
                                {['2026', '2025', '2024', 'all'].map((yr) => {
                                    const isCurrent = yr === '2026';
                                    const isSelected = selectedYear === yr;
                                    const label = yr === 'all' ? 'All-Time' : (isCurrent ? '2026 (Current)' : yr);
                                    return (
                                        <button
                                            key={yr}
                                            type="button"
                                            onClick={() => {
                                                setSelectedYear(yr);
                                                setSelectedMonth('all');
                                            }}
                                            className="chat-press"
                                            style={{
                                                height: 30,
                                                padding: '0 13px',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                border: 'none',
                                                background: isSelected ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'transparent',
                                                color: isSelected ? '#fff' : 'var(--secondary-foreground)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                boxShadow: isSelected ? '0 2px 10px rgba(125, 135, 210, 0.35)' : 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Month Indicator & Quick Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {selectedYear !== 'all' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>Month:</span>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                        className="glass-input"
                                        style={{
                                            height: 36,
                                            padding: '0 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            background: 'rgba(0, 0, 0, 0.45)',
                                            color: 'var(--foreground)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            cursor: 'pointer',
                                            outline: 'none',
                                        }}
                                    >
                                        <option value="all" style={{ background: '#181826', color: '#fff' }}>All Months ({selectedYear})</option>
                                        {MONTH_NAMES.map((name, idx) => {
                                            const mNum = idx + 1;
                                            const monthGross = data?.history?.yearlyBreakdown?.[selectedYear]?.months?.[mNum]?.total || 0;
                                            return (
                                                <option key={mNum} value={mNum} style={{ background: '#181826', color: '#fff' }}>
                                                    {name} — {formatMoney(monthGross, data.currency)}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}

                            {selectedMonth !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedMonth('all')}
                                    className="glass-button chat-press"
                                    style={{
                                        height: 36,
                                        padding: '0 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        color: 'var(--secondary-foreground)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    ✕ Reset to Full Year
                                </button>
                            )}

                            <div style={{
                                height: 36,
                                padding: '0 14px',
                                borderRadius: '10px',
                                background: 'rgba(125, 135, 210, 0.14)',
                                border: '1px solid rgba(125, 135, 210, 0.3)',
                                fontSize: '0.8rem',
                                fontWeight: 750,
                                color: 'var(--primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                letterSpacing: '0.01em',
                            }}>
                                {periodStats.periodLabel}
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '16px',
                    }}>
                        {/* Period Net Profit (Take-Home Hero Card) */}
                        <div className="glass-panel" style={{
                            padding: '22px 24px',
                            borderRadius: '20px',
                            minHeight: '172px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(16, 185, 129, 0.38)',
                            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.14) 0%, rgba(18, 22, 28, 0.88) 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(16, 185, 129, 0.35), 0 8px 30px rgba(16, 185, 129, 0.12)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Period Net Profit
                                    </span>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        background: 'rgba(16, 185, 129, 0.22)',
                                        color: '#34d399',
                                        border: '1px solid rgba(16, 185, 129, 0.35)',
                                    }}>
                                        {periodStats.margin}% Margin
                                    </span>
                                </div>
                                <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(16, 185, 129, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                                    <DollarSign size={19} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                                    {formatMoney(periodStats.netProfit, data.currency, 0)}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                                        After <strong style={{ color: '#f87171', fontWeight: 700 }}>-{formatMoney(periodStats.stripeFees, data.currency, periodStats.stripeFees % 1 !== 0 ? 2 : 0)}</strong> fees
                                    </span>
                                    <span>•</span>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>{periodStats.periodLabel}</span>
                                </div>
                            </div>
                        </div>

                        {/* Period Gross Volume Card */}
                        <div className="glass-panel" style={{
                            padding: '22px 24px',
                            borderRadius: '20px',
                            minHeight: '172px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(125, 135, 210, 0.3)',
                            background: 'linear-gradient(145deg, rgba(125, 135, 210, 0.12) 0%, rgba(20, 20, 32, 0.85) 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(125, 135, 210, 0.25), 0 8px 30px rgba(0, 0, 0, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Period Gross Collected
                                </span>
                                <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(125, 135, 210, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                    <TrendingUp size={19} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                                    {formatMoney(periodStats.grossCollected, data.currency, 0)}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span>{periodStats.count} charges</span>
                                    <span>•</span>
                                    <span>Avg {formatMoney(periodStats.avgTicket, data.currency, 0)} (Net {formatMoney(periodStats.avgNet, data.currency, 0)})</span>
                                </div>
                            </div>
                        </div>

                        {/* Current Active Roster Net Payout */}
                        <div className="glass-panel" style={{
                            padding: '22px 24px',
                            borderRadius: '20px',
                            minHeight: '172px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(56, 189, 248, 0.28)',
                            background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.10) 0%, rgba(20, 20, 32, 0.85) 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(56, 189, 248, 0.22), 0 8px 30px rgba(0, 0, 0, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Roster Cycle Net Payout
                                    </span>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                    }}>
                                        {data.activeSubscribers} Active
                                    </span>
                                </div>
                                <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(56, 189, 248, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}>
                                    <Users size={19} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                                    +{formatMoney(data.cycleNet || (data.cycleRevenue ? data.cycleRevenue - (data.cycleFee || 0) : 0), data.currency, 2)}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span>from {formatMoney(data.cycleRevenue || data.mrr, data.currency, 0)} gross</span>
                                    <span>•</span>
                                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{formatMoney(data.mrrNet || 0, data.currency, 0)}/mo net</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Health & Stripe Rates */}
                        <div className="glass-panel" style={{
                            padding: '22px 24px',
                            borderRadius: '20px',
                            minHeight: '172px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: data.pastDueCount > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)',
                            background: data.pastDueCount > 0
                                ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 32, 0.85) 100%)'
                                : 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 20, 32, 0.85) 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 30px rgba(0, 0, 0, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Payment Health
                                </span>
                                <div style={{ 
                                    width: 38, 
                                    height: 38, 
                                    borderRadius: '11px', 
                                    background: data.pastDueCount > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: data.pastDueCount > 0 ? '#ef4444' : '#10b981',
                                    flexShrink: 0,
                                }}>
                                    {data.pastDueCount > 0 ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
                                </div>
                            </div>
                            <div>
                                <div style={{ 
                                    fontSize: '2.15rem', 
                                    fontWeight: 900, 
                                    color: data.pastDueCount > 0 ? '#f87171' : '#fff', 
                                    letterSpacing: '-0.03em', 
                                    lineHeight: 1.15 
                                }}>
                                    {data.pastDueCount === 0 ? '100%' : `${data.pastDueCount} Past Due`}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', marginTop: '6px' }}>
                                    {data.pastDueCount === 0 ? 'Stripe standard processing (2.9% + 30¢)' : 'Action required on past-due renewals'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Month-by-Month Revenue Visualizer */}
                    {data?.history && selectedYear !== 'all' && (() => {
                        const yearMonths = data.history.yearlyBreakdown[selectedYear]?.months || {};
                        const yearGrossTotal = data.history.yearlyBreakdown[selectedYear]?.total || 0;
                        const yearFeeTotal = data.history.yearlyBreakdown[selectedYear]?.fee ?? calculateStripeFee(yearGrossTotal);
                        const yearNetTotal = data.history.yearlyBreakdown[selectedYear]?.net ?? Math.round((yearGrossTotal - yearFeeTotal) * 100) / 100;

                        const maxAmount = Math.max(
                            ...Object.values(yearMonths).map(m => {
                                const g = m.total || 0;
                                if (chartMetric === 'net') {
                                    const f = m.fee !== undefined ? m.fee : calculateStripeFee(g);
                                    return m.net !== undefined ? m.net : Math.max(0, g - f);
                                }
                                return g;
                            }),
                            1
                        );

                        const peakAmount = Math.max(
                            ...Object.values(yearMonths).map(m => {
                                const g = m.total || 0;
                                if (chartMetric === 'net') {
                                    const f = m.fee !== undefined ? m.fee : calculateStripeFee(g);
                                    return m.net !== undefined ? m.net : Math.max(0, g - f);
                                }
                                return g;
                            }),
                            0
                        );

                        const isCurrentYear = selectedYear === '2026';
                        const currentRealMonth = new Date().getMonth() + 1;

                        return (
                            <div className="glass-panel" style={{
                                padding: '24px 26px',
                                borderRadius: '24px',
                                background: 'linear-gradient(145deg, rgba(20, 20, 34, 0.88), rgba(12, 12, 24, 0.96))',
                                border: '1px solid rgba(125, 135, 210, 0.25)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 30px rgba(0, 0, 0, 0.25)',
                            }}>
                                {/* Card Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '14px',
                                    marginBottom: '24px',
                                }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <BarChart3 size={18} style={{ color: chartMetric === 'net' ? '#10b981' : 'var(--primary)' }} />
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                                                Month-by-Month {chartMetric === 'net' ? 'Net Profit' : 'Gross Revenue'} — {selectedYear}
                                            </h2>
                                        </div>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', margin: 0 }}>
                                            Click any month bar to drill down into payments • Peak:{' '}
                                            <strong style={{ color: chartMetric === 'net' ? '#10b981' : 'var(--foreground)' }}>
                                                {formatMoney(peakAmount, data.currency, 0)} {chartMetric === 'net' ? 'Net Take-Home' : 'Gross'}
                                            </strong>
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {/* Metric Mode Segmented Control */}
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            padding: '2px',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            height: 34,
                                            gap: '2px',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setChartMetric('net')}
                                                className="chat-press"
                                                style={{
                                                    height: 28,
                                                    padding: '0 12px',
                                                    borderRadius: '7px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    border: 'none',
                                                    background: chartMetric === 'net' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                                                    color: chartMetric === 'net' ? '#fff' : 'var(--secondary-foreground)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    boxShadow: chartMetric === 'net' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                                                }}
                                            >
                                                Net Profit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setChartMetric('gross')}
                                                className="chat-press"
                                                style={{
                                                    height: 28,
                                                    padding: '0 12px',
                                                    borderRadius: '7px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    border: 'none',
                                                    background: chartMetric === 'gross' ? 'linear-gradient(135deg, var(--primary), #4f46e5)' : 'transparent',
                                                    color: chartMetric === 'gross' ? '#fff' : 'var(--secondary-foreground)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    boxShadow: chartMetric === 'gross' ? '0 2px 8px rgba(125, 135, 210, 0.3)' : 'none',
                                                }}
                                            >
                                                Gross
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedMonth('all')}
                                            className="chat-press"
                                            style={{
                                                height: 34,
                                                padding: '0 14px',
                                                borderRadius: '10px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                border: 'none',
                                                background: selectedMonth === 'all' ? (chartMetric === 'net' ? '#10b981' : 'var(--primary)') : 'rgba(255, 255, 255, 0.05)',
                                                color: selectedMonth === 'all' ? '#fff' : 'var(--secondary-foreground)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            All {selectedYear} Months
                                        </button>

                                        <div style={{
                                            height: 34,
                                            padding: '0 14px',
                                            borderRadius: '10px',
                                            background: chartMetric === 'net' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(125, 135, 210, 0.14)',
                                            border: chartMetric === 'net' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(125, 135, 210, 0.3)',
                                            fontSize: '0.82rem',
                                            fontWeight: 800,
                                            color: chartMetric === 'net' ? '#10b981' : '#fff',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                        }}>
                                            {chartMetric === 'net'
                                                ? `${formatMoney(yearNetTotal, data.currency, 0)} Net Profit`
                                                : `${formatMoney(yearGrossTotal, data.currency, 0)} Gross`}
                                        </div>
                                    </div>
                                </div>

                                {/* Month Columns Bar Chart */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                                    gap: '12px',
                                    alignItems: 'end',
                                    padding: '16px 4px 8px',
                                    overflowX: 'auto',
                                }}>
                                    {MONTH_NAMES.map((mName, idx) => {
                                        const mNum = idx + 1;
                                        const mStat = yearMonths[mNum] || { total: 0, fee: 0, net: 0, count: 0 };
                                        const grossVal = mStat.total || 0;
                                        const feeVal = mStat.fee !== undefined ? mStat.fee : calculateStripeFee(grossVal);
                                        const netVal = mStat.net !== undefined ? mStat.net : Math.round((grossVal - feeVal) * 100) / 100;
                                        const displayVal = chartMetric === 'net' ? netVal : grossVal;

                                        const isSelected = selectedMonth === mNum;
                                        const isDimmed = selectedMonth !== 'all' && !isSelected;
                                        const isFuture = isCurrentYear && mNum > currentRealMonth;
                                        const isCurrentMonth = isCurrentYear && mNum === currentRealMonth;
                                        const barPercent = Math.max(displayVal > 0 ? (displayVal / maxAmount) * 100 : 4, 4);

                                        return (
                                            <div
                                                key={mNum}
                                                onClick={() => {
                                                    if (isFuture) return;
                                                    setSelectedMonth(isSelected ? 'all' : mNum);
                                                }}
                                                title={`${MONTH_FULL_NAMES[idx]} ${selectedYear}: Gross ${formatMoney(grossVal, data.currency, 0)} • Stripe Fee -${formatMoney(feeVal, data.currency, feeVal % 1 !== 0 ? 2 : 0)} • Net Profit ${formatMoney(netVal, data.currency, 0)} (${mStat.count} payments)`}
                                                className="chat-press"
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: isFuture ? 'default' : 'pointer',
                                                    opacity: isFuture ? 0.3 : (isDimmed ? 0.45 : 1),
                                                    transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                                                    minWidth: 54,
                                                }}
                                            >
                                                {/* Amount on top of bar */}
                                                <div style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 750,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    color: isSelected
                                                        ? (chartMetric === 'net' ? '#10b981' : 'var(--primary)')
                                                        : (displayVal > 0 ? (chartMetric === 'net' ? '#34d399' : 'var(--foreground)') : 'transparent'),
                                                    marginBottom: '8px',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {displayVal > 0 ? (displayVal >= 1000 ? `$${(displayVal / 1000).toFixed(1)}k` : `$${Math.round(displayVal)}`) : '—'}
                                                </div>

                                                {/* Bar Container */}
                                                <div style={{
                                                    width: '100%',
                                                    height: 146,
                                                    borderRadius: '12px',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: isSelected 
                                                        ? (chartMetric === 'net' ? '1.5px solid #10b981' : '1.5px solid var(--primary)')
                                                        : (isCurrentMonth ? (chartMetric === 'net' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(125, 135, 210, 0.4)') : '1px solid rgba(255, 255, 255, 0.06)'),
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'flex-end',
                                                    padding: '3px',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    boxShadow: isSelected
                                                        ? (chartMetric === 'net' ? '0 0 18px rgba(16, 185, 129, 0.4)' : '0 0 18px rgba(125, 135, 210, 0.35)')
                                                        : 'none',
                                                }}>
                                                    <div style={{
                                                        width: '100%',
                                                        height: `${barPercent}%`,
                                                        borderRadius: '9px',
                                                        background: chartMetric === 'net'
                                                            ? (isSelected
                                                                ? 'linear-gradient(180deg, #10b981, #059669)'
                                                                : (isCurrentMonth
                                                                    ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.88), rgba(5, 150, 105, 0.88))'
                                                                    : (displayVal > 0
                                                                        ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.65), rgba(5, 150, 105, 0.45))'
                                                                        : 'rgba(255, 255, 255, 0.05)')))
                                                            : (isSelected
                                                                ? 'linear-gradient(180deg, #38bdf8, #6366f1)'
                                                                : (isCurrentMonth
                                                                    ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.85), rgba(99, 102, 241, 0.85))'
                                                                    : (displayVal > 0
                                                                        ? 'linear-gradient(180deg, rgba(125, 135, 210, 0.65), rgba(99, 102, 241, 0.45))'
                                                                        : 'rgba(255, 255, 255, 0.05)'))),
                                                        transition: 'height 0.4s cubic-bezier(0.23, 1, 0.32, 1), background 0.2s ease',
                                                    }} />
                                                </div>

                                                {/* Month label and count */}
                                                <div style={{
                                                    marginTop: '8px',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{
                                                        fontSize: '0.8rem',
                                                        fontWeight: isSelected || isCurrentMonth ? 800 : 600,
                                                        color: isSelected ? (chartMetric === 'net' ? '#10b981' : 'var(--primary)') : (isCurrentMonth ? (chartMetric === 'net' ? '#34d399' : '#38bdf8') : 'var(--foreground)'),
                                                    }}>
                                                        {mName}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.68rem',
                                                        color: 'var(--secondary-foreground)',
                                                        marginTop: '2px',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}>
                                                        {mStat.count > 0 ? `${mStat.count} chgs` : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* All-Time Year-by-Year Comparison Visualizer */}
                    {data?.history && selectedYear === 'all' && (
                        <div className="glass-panel" style={{
                            padding: '24px 26px',
                            borderRadius: '24px',
                            background: 'linear-gradient(145deg, rgba(20, 20, 34, 0.88), rgba(12, 12, 24, 0.96))',
                            border: '1px solid rgba(125, 135, 210, 0.25)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 30px rgba(0, 0, 0, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                                        Annual Revenue & Profit Performance (2024–2026)
                                    </h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', margin: '4px 0 0 0' }}>
                                        Click any year card to drill down into its full month-by-month trajectory
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{
                                        padding: '6px 14px',
                                        borderRadius: '10px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        color: '#10b981',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                    }}>
                                        {formatMoney(data.history.allTimeNet, data.currency, 0)} Net Profit
                                    </div>
                                    <div style={{
                                        padding: '6px 14px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--card-border)',
                                        color: 'var(--secondary-foreground)',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                    }}>
                                        {formatMoney(data.history.allTimeGross, data.currency, 0)} Gross (Fees: -{formatMoney(data.history.allTimeFee, data.currency, 0)})
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                                {['2024', '2025', '2026'].map((y) => {
                                    const yStat = data.history?.yearlyBreakdown?.[y] || { total: 0, fee: 0, net: 0, count: 0 };
                                    const yGross = yStat.total || 0;
                                    const yFee = yStat.fee !== undefined ? yStat.fee : calculateStripeFee(yGross);
                                    const yNet = yStat.net !== undefined ? yStat.net : Math.round((yGross - yFee) * 100) / 100;
                                    const pctOfTotal = Math.round((yGross / (data.history?.allTimeGross || 1)) * 100);

                                    return (
                                        <div
                                            key={y}
                                            onClick={() => {
                                                setSelectedYear(y);
                                                setSelectedMonth('all');
                                            }}
                                            className="chat-press"
                                            style={{
                                                padding: '22px',
                                                borderRadius: '18px',
                                                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015))',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>
                                                    {y} {y === '2026' ? '• YTD' : ''}
                                                </span>
                                                <span style={{ fontSize: '0.74rem', fontWeight: 750, padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                                    {pctOfTotal}% of all-time
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                                                {formatMoney(yNet, data.currency, 0)}
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(16, 185, 129, 0.85)', marginLeft: '6px' }}>
                                                    Net Profit
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '4px' }}>
                                                {formatMoney(yGross, data.currency, 0)} gross • -{formatMoney(yFee, data.currency, 0)} Stripe fees
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', opacity: 0.8, marginBottom: '14px' }}>
                                                {yStat.count} paid charges • Avg Net {formatMoney(yStat.count > 0 ? yNet / yStat.count : 0, data.currency, 2)}
                                            </div>
                                            {/* Progress Track */}
                                            <div style={{ width: '100%', height: 6, borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${pctOfTotal}%`,
                                                    height: '100%',
                                                    borderRadius: '4px',
                                                    background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Athlete Subscription Roster Section */}
                    <div id="athlete-subscriptions-roster" className="glass-panel" style={{
                        padding: '24px 26px',
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(20, 20, 34, 0.88), rgba(12, 12, 24, 0.96))',
                        border: '1px solid rgba(125, 135, 210, 0.25)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 30px rgba(0, 0, 0, 0.25)',
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px',
                            marginBottom: '22px',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                                    Athlete Subscriptions
                                </h2>
                                <p style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', margin: 0 }}>
                                    Active paying subscriptions for [BPS] Coach Darath ({data.athletes.length} active athletes)
                                </p>
                            </div>

                            {/* Search and Filters */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{
                                    position: 'relative',
                                    minWidth: 230,
                                }}>
                                    <Search size={14} style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--secondary-foreground)',
                                        pointerEvents: 'none',
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search athletes or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            padding: '0 12px 0 34px',
                                            borderRadius: '11px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            color: 'var(--foreground)',
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            transition: 'border-color 0.15s ease',
                                        }}
                                    />
                                </div>

                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    padding: '2px',
                                    borderRadius: '11px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    height: 36,
                                    gap: '2px',
                                }}>
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className="chat-press"
                                        style={{
                                            height: 30,
                                            padding: '0 12px',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            border: 'none',
                                            background: filterStatus === 'all' ? 'var(--primary)' : 'transparent',
                                            color: filterStatus === 'all' ? '#fff' : 'var(--secondary-foreground)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        Active ({data.athletes.length})
                                    </button>
                                    {data.pastDueCount > 0 && (
                                        <button
                                            onClick={() => setFilterStatus('past_due')}
                                            className="chat-press"
                                            style={{
                                                height: 30,
                                                padding: '0 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                border: 'none',
                                                background: filterStatus === 'past_due' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                                                color: filterStatus === 'past_due' ? '#f87171' : 'var(--secondary-foreground)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            Past Due ({data.pastDueCount})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Roster Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                            }}>
                                <thead>
                                    <tr style={{
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: 'var(--secondary-foreground)',
                                        background: 'rgba(255, 255, 255, 0.015)',
                                    }}>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Athlete</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross Plan</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stripe Fee</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Take-Home</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next Billing</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Stripe & Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAthletes.map((athlete) => {
                                        const athleteGross = athlete.rawAmount || athlete.monthlyAmount;
                                        const athleteFee = athlete.stripeFee ?? calculateStripeFee(athleteGross);
                                        const athleteNet = athlete.netAmount ?? Math.round((athleteGross - athleteFee) * 100) / 100;
                                        const athleteMonthlyNet = athlete.monthlyNet ?? Math.round((athlete.monthlyAmount - calculateStripeFee(athlete.monthlyAmount)) * 100) / 100;
                                        const initials = athlete.name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AT';

                                        return (
                                            <tr
                                                key={athlete.id}
                                                style={{
                                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                    transition: 'background 0.15s ease',
                                                }}
                                                className="hover:bg-white/[0.02]"
                                            >
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                                                        <div style={{
                                                            width: 34,
                                                            height: 34,
                                                            borderRadius: '50%',
                                                            background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.25), rgba(99, 102, 241, 0.18))',
                                                            border: '1px solid rgba(125, 135, 210, 0.35)',
                                                            color: '#c4b5fd',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 750,
                                                            fontSize: '0.75rem',
                                                            flexShrink: 0,
                                                            letterSpacing: '0.02em',
                                                        }}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 750, color: 'var(--foreground)', fontSize: '0.88rem' }}>
                                                                {athlete.name}
                                                            </div>
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground)', opacity: 0.85 }}>
                                                                {athlete.email}
                                                            </div>
                                                            {athlete.customerEmail && (
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <span>Stripe: {athlete.customerEmail}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    {athlete.status === 'active' ? (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                        }}>
                                                            <CheckCircle2 size={12} />
                                                            Active
                                                        </span>
                                                    ) : athlete.status === 'trialing' ? (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(125, 135, 210, 0.15)',
                                                            color: 'var(--primary)',
                                                            border: '1px solid rgba(125, 135, 210, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                        }}>
                                                            <Clock size={12} />
                                                            Trialing
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#f87171',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                        }}>
                                                            <AlertCircle size={12} />
                                                            Past Due
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                                                    <div style={{ color: 'var(--foreground)', fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }}>
                                                        {athlete.billingInterval || (athlete.rawAmount ? `$${athlete.rawAmount} / 4 wks` : formatMoney(athlete.monthlyAmount, athlete.currency))}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatMoney(athlete.monthlyAmount, athlete.currency, 0)}/mo equiv
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 650,
                                                        color: 'rgba(255, 255, 255, 0.75)',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}>
                                                        -{formatMoney(athleteFee, athlete.currency, 2)}
                                                    </span>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground)', marginTop: '3px' }}>
                                                        2.9% + 30¢
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                                                        +{formatMoney(athleteNet, athlete.currency, 2)}
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(16, 185, 129, 0.8)', marginLeft: '4px' }}>
                                                            {athlete.intervalCount === 4 && athlete.interval === 'week' ? '/ 4 wks' : (athlete.interval === 'month' ? '/ mo' : '')}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(16, 185, 129, 0.75)', marginTop: '2px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatMoney(athleteMonthlyNet, athlete.currency, 0)}/mo net
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', color: 'var(--secondary-foreground)', fontSize: '0.8rem' }}>
                                                    {athlete.currentPeriodEnd ? (
                                                        <div>
                                                            <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--foreground)' }}>{formatDate(athlete.currentPeriodEnd)}</div>
                                                            {athlete.cancelAtPeriodEnd && (
                                                                <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 600 }}>Cancels at end of cycle</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                                        {/* Direct Link to Stripe Subscription (Cancel or Change Plan) */}
                                                        {(athlete.stripeSubscriptionUrl || athlete.stripeSubscriptionId) ? (
                                                            <a
                                                                href={athlete.stripeSubscriptionUrl || `https://dashboard.stripe.com/subscriptions/${athlete.stripeSubscriptionId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="chat-press"
                                                                title="Open subscription in Stripe Dashboard to cancel, update plan, or change price"
                                                                style={{
                                                                    height: 30,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    padding: '0 10px',
                                                                    fontSize: '0.74rem',
                                                                    fontWeight: 700,
                                                                    borderRadius: '8px',
                                                                    background: 'linear-gradient(135deg, rgba(99, 91, 255, 0.24), rgba(125, 135, 210, 0.28))',
                                                                    border: '1px solid rgba(99, 91, 255, 0.5)',
                                                                    color: '#c4b5fd',
                                                                    textDecoration: 'none',
                                                                    boxShadow: '0 2px 8px rgba(99, 91, 255, 0.15)',
                                                                    whiteSpace: 'nowrap',
                                                                    transition: 'all 0.15s ease',
                                                                }}
                                                            >
                                                                <CreditCard size={12} style={{ color: '#a78bfa' }} />
                                                                <span>Stripe Sub</span>
                                                                <ExternalLink size={11} style={{ opacity: 0.8 }} />
                                                            </a>
                                                        ) : null}

                                                        {/* Direct Link to Stripe Customer Profile */}
                                                        {(athlete.stripeCustomerUrl || athlete.stripeCustomerId) ? (
                                                            <a
                                                                href={athlete.stripeCustomerUrl || `https://dashboard.stripe.com/customers/${athlete.stripeCustomerId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="glass-button chat-press"
                                                                title="Open customer profile in Stripe Dashboard"
                                                                style={{
                                                                    height: 30,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '0 9px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 600,
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(255, 255, 255, 0.04)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.09)',
                                                                    color: 'var(--secondary-foreground)',
                                                                    textDecoration: 'none',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                <User size={12} />
                                                                <span>Customer</span>
                                                                <ExternalLink size={10} style={{ opacity: 0.6 }} />
                                                            </a>
                                                        ) : null}

                                                        {/* BlueprintLab App Profile */}
                                                        <Link
                                                            href={`/dashboard/athletes/${athlete.id}`}
                                                            className="glass-button chat-press"
                                                            title="View Athlete Training Analytics in BlueprintLab"
                                                            style={{
                                                                height: 30,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                padding: '0 9px',
                                                                fontSize: '0.72rem',
                                                                fontWeight: 600,
                                                                borderRadius: '8px',
                                                                background: 'rgba(255, 255, 255, 0.03)',
                                                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                                                color: 'var(--secondary-foreground)',
                                                                textDecoration: 'none',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            <span>App</span>
                                                            <ArrowUpRight size={11} />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredAthletes.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                                                No athletes found matching this search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Unmatched Subscribers (If someone subscribes via Stripe but not registered) */}
                    {data.unmatchedSubscribers && data.unmatchedSubscribers.length > 0 && (
                        <div className="glass-panel" style={{
                            padding: '24px',
                            borderRadius: '24px',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <AlertCircle size={18} style={{ color: '#f59e0b' }} />
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>
                                    Additional Stripe Subscribers ({data.unmatchedSubscribers.length})
                                </h2>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', margin: '0 0 16px 0' }}>
                                These Stripe customers are paying subscribers whose emails do not match any athlete currently created in your BlueprintLab roster:
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                {data.unmatchedSubscribers.map((unmatched) => {
                                    const uGross = unmatched.rawAmount || unmatched.monthlyAmount;
                                    const uFee = unmatched.stripeFee ?? calculateStripeFee(uGross);
                                    const uNet = unmatched.netAmount ?? Math.round((uGross - uFee) * 100) / 100;

                                    return (
                                        <div
                                            key={unmatched.id}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: '12px',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid var(--card-border)',
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.85rem' }}>
                                                {unmatched.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                                {unmatched.email}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', flexWrap: 'wrap', gap: '4px' }}>
                                                <span style={{ color: '#10b981', fontWeight: 800 }}>
                                                    +{formatMoney(uNet, unmatched.currency, 2)} Net
                                                </span>
                                                <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.72rem' }}>
                                                    Renews {formatDate(unmatched.currentPeriodEnd)}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                                Gross {formatMoney(uGross, unmatched.currency, 2)} • Stripe Fee -{formatMoney(uFee, unmatched.currency, 2)}
                                            </div>
                                            {unmatched.productName && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '4px' }}>
                                                    Product: {unmatched.productName}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {(unmatched.stripeSubscriptionUrl || unmatched.stripeSubscriptionId) && (
                                                    <a
                                                        href={unmatched.stripeSubscriptionUrl || `https://dashboard.stripe.com/subscriptions/${unmatched.stripeSubscriptionId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="chat-press"
                                                        title="Open subscription in Stripe Dashboard to cancel, update plan, or pause"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            padding: '5px 10px',
                                                            fontSize: '0.73rem',
                                                            fontWeight: 700,
                                                            borderRadius: '7px',
                                                            background: 'linear-gradient(135deg, rgba(99, 91, 255, 0.25), rgba(125, 135, 210, 0.28))',
                                                            border: '1px solid rgba(99, 91, 255, 0.5)',
                                                            color: '#c4b5fd',
                                                            textDecoration: 'none',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        <CreditCard size={11} />
                                                        <span>Manage on Stripe</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                )}
                                                {(unmatched.stripeCustomerUrl || unmatched.stripeCustomerId) && (
                                                    <a
                                                        href={unmatched.stripeCustomerUrl || `https://dashboard.stripe.com/customers/${unmatched.stripeCustomerId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="glass-button chat-press"
                                                        title="Open customer profile in Stripe Dashboard"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '5px 8px',
                                                            fontSize: '0.73rem',
                                                            fontWeight: 600,
                                                            borderRadius: '7px',
                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'var(--secondary-foreground)',
                                                            textDecoration: 'none',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        <User size={11} />
                                                        <span>Customer Profile</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Historical Transactions Ledger (Filtered by Year & Month with Live Search) */}
                    <div className="glass-panel" style={{
                        padding: '24px 26px',
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(20, 20, 34, 0.88), rgba(12, 12, 24, 0.96))',
                        border: '1px solid rgba(125, 135, 210, 0.25)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 30px rgba(0, 0, 0, 0.25)',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px',
                            marginBottom: '22px',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                                    Historical Transactions Ledger
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)' }}>
                                        Showing <strong>{periodStats.periodLabel}</strong> ({filteredHistoricalCharges.length} paid charges):
                                    </span>
                                    <span style={{
                                        height: 28,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0 10px',
                                        borderRadius: '8px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--foreground)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        Gross: {formatMoney(periodStats.grossCollected, data.currency, 0)}
                                    </span>
                                    <span style={{
                                        height: 28,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0 10px',
                                        borderRadius: '8px',
                                        background: 'rgba(239, 68, 68, 0.12)',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#f87171',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        Fees: -{formatMoney(periodStats.stripeFees, data.currency, periodStats.stripeFees % 1 !== 0 ? 2 : 0)}
                                    </span>
                                    <span style={{
                                        height: 28,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0 10px',
                                        borderRadius: '8px',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.35)',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: '#10b981',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        Net Profit: +{formatMoney(periodStats.netProfit, data.currency, 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Search bar inside ledger */}
                            <div style={{
                                position: 'relative',
                                minWidth: 260,
                            }}>
                                <Search size={14} style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--secondary-foreground)',
                                    pointerEvents: 'none',
                                }} />
                                <input
                                    type="text"
                                    placeholder="Search in this period..."
                                    value={chargeSearchQuery}
                                    onChange={(e) => setChargeSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        height: 36,
                                        padding: '0 12px 0 34px',
                                        borderRadius: '11px',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: 'var(--foreground)',
                                        fontSize: '0.82rem',
                                        outline: 'none',
                                        transition: 'border-color 0.15s ease',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Charges Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                            }}>
                                <thead>
                                    <tr style={{
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: 'var(--secondary-foreground)',
                                        background: 'rgba(255, 255, 255, 0.015)',
                                    }}>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer / Athlete</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Gross</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Stripe Fee</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Net Profit</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Receipt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCharges.map((ch) => (
                                        <tr
                                            key={ch.id}
                                            style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                transition: 'background 0.15s ease',
                                            }}
                                            className="hover:bg-white/[0.02]"
                                        >
                                            <td style={{ padding: '14px 16px', color: 'var(--foreground)', fontWeight: 650, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                {formatDate(ch.created)}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: 750, color: 'var(--foreground)' }}>
                                                    {ch.customerName || ch.customerEmail}
                                                </div>
                                                {ch.customerName && (
                                                    <div style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground)', opacity: 0.85 }}>
                                                        {ch.customerEmail}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: 'var(--secondary-foreground)', fontSize: '0.82rem' }}>
                                                {ch.description || 'Subscription'}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                }}>
                                                    <CheckCircle2 size={12} />
                                                    Paid
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 650, color: 'var(--foreground)', fontSize: '0.88rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                +{formatMoney(ch.amount, ch.currency, 2)}
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 650,
                                                    color: 'rgba(255, 255, 255, 0.75)',
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}>
                                                    -{formatMoney(ch.fee ?? calculateStripeFee(ch.amount), ch.currency, 2)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '0.92rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                +{formatMoney(ch.net ?? Math.round((ch.amount - (ch.fee ?? calculateStripeFee(ch.amount))) * 100) / 100, ch.currency, 2)}
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                {ch.receiptUrl ? (
                                                    <a
                                                        href={ch.receiptUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Open Stripe Receipt"
                                                        className="glass-button chat-press"
                                                        style={{
                                                            height: 30,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '0 10px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            color: 'var(--secondary-foreground)',
                                                            textDecoration: 'none',
                                                            borderRadius: '8px',
                                                        }}
                                                    >
                                                        <FileText size={13} />
                                                        <span>Receipt</span>
                                                        <ExternalLink size={11} />
                                                    </a>
                                                ) : (
                                                    <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}

                                    {paginatedCharges.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                                                No charges found for this period {chargeSearchQuery ? 'matching search' : ''}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Snappy Pagination Controls */}
                        {filteredHistoricalCharges.length > CHARGES_PER_PAGE && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '22px',
                                paddingTop: '18px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                flexWrap: 'wrap',
                                gap: '12px',
                            }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                                    Showing {(transactionsPage - 1) * CHARGES_PER_PAGE + 1}–{Math.min(transactionsPage * CHARGES_PER_PAGE, filteredHistoricalCharges.length)} of {filteredHistoricalCharges.length} charges
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        type="button"
                                        disabled={transactionsPage === 1}
                                        onClick={() => setTransactionsPage(p => Math.max(1, p - 1))}
                                        className="glass-button chat-press"
                                        style={{
                                            height: 34,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '0 12px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            borderRadius: '9px',
                                            cursor: transactionsPage === 1 ? 'not-allowed' : 'pointer',
                                            opacity: transactionsPage === 1 ? 0.4 : 1,
                                        }}
                                    >
                                        <ChevronLeft size={14} />
                                        <span>Previous</span>
                                    </button>

                                    <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--foreground)', padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
                                        {transactionsPage} / {totalPages}
                                    </span>

                                    <button
                                        type="button"
                                        disabled={transactionsPage === totalPages}
                                        onClick={() => setTransactionsPage(p => Math.min(totalPages, p + 1))}
                                        className="glass-button chat-press"
                                        style={{
                                            height: 34,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '0 12px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            borderRadius: '9px',
                                            cursor: transactionsPage === totalPages ? 'not-allowed' : 'pointer',
                                            opacity: transactionsPage === totalPages ? 0.4 : 1,
                                        }}
                                    >
                                        <span>Next</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const codeBadge: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.08)',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--foreground)',
};

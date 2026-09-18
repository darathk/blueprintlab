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
    Filter,
    FileText,
    Tag,
    ChevronDown,
    Settings,
    Key,
    Save
} from 'lucide-react';

interface AthleteBilling {
    id: string;
    name: string;
    email: string;
    customerEmail?: string | null;
    customerName?: string | null;
    hasSubscription: boolean;
    status: string; // active, past_due, canceled, trialing, unpaid, none
    rawAmount?: number;
    billingInterval?: string;
    interval?: string;
    intervalCount?: number;
    monthlyAmount: number;
    currency: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId?: string | null;
    productName?: string | null;
}

interface UnmatchedSubscriber {
    id: string;
    email: string;
    name: string;
    status: string;
    rawAmount?: number;
    billingInterval?: string;
    monthlyAmount: number;
    currency: string;
    currentPeriodEnd: number | null;
    productName?: string;
}

interface RecentCharge {
    id: string;
    amount: number;
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

interface RevenueData {
    connected: boolean;
    cycleRevenue?: number;
    mrr: number;
    activeSubscribers: number;
    pastDueCount: number;
    grossThisMonth: number;
    athletes: AthleteBilling[];
    unmatchedSubscribers?: UnmatchedSubscriber[];
    recentCharges?: RecentCharge[];
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

    const formatMoney = (val: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
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

    const activeProductName = '[BPS] Coach Darath';

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
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 120px' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* KPI Cards Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '16px',
                    }}>
                        {/* Billing Cycle Volume Card */}
                        <div className="glass-panel" style={{
                            padding: '22px',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(125, 135, 210, 0.25)',
                            background: 'linear-gradient(145deg, rgba(125, 135, 210, 0.08), rgba(20, 20, 30, 0.6))',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Billing Cycle Volume
                                </span>
                                <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(125, 135, 210, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                    <DollarSign size={18} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                                    {formatMoney(data.cycleRevenue || data.mrr, data.currency)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                    Per 4-wk cycle • {formatMoney(data.mrr, data.currency)}/mo normalized MRR
                                </div>
                            </div>
                        </div>

                        {/* Active Subscribers */}
                        <div className="glass-panel" style={{
                            padding: '22px',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Active Subscribers
                                </span>
                                <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                    <Users size={18} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                                    {data.activeSubscribers}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                    Paying athletes for Coach Darath
                                </div>
                            </div>
                        </div>

                        {/* Gross Volume This Month */}
                        <div className="glass-panel" style={{
                            padding: '22px',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Collected This Month
                                </span>
                                <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                                    <TrendingUp size={18} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                                    {formatMoney(data.grossThisMonth, data.currency)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                    Gross successful payments
                                </div>
                            </div>
                        </div>

                        {/* Attention / Past Due */}
                        <div className="glass-panel" style={{
                            padding: '22px',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Payment Health
                                </span>
                                <div style={{ 
                                    width: 34, 
                                    height: 34, 
                                    borderRadius: '10px', 
                                    background: data.pastDueCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: data.pastDueCount > 0 ? '#ef4444' : '#10b981' 
                                }}>
                                    {data.pastDueCount > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                                    {data.pastDueCount === 0 ? '100%' : `${data.pastDueCount} Past Due`}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                    {data.pastDueCount === 0 ? 'All subscriptions current' : 'Failed or past-due renewals'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Athlete Subscription Roster Section */}
                    <div className="glass-panel" style={{
                        padding: '24px',
                        borderRadius: '24px',
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px',
                            marginBottom: '20px',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0' }}>
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
                                    minWidth: 220,
                                }}>
                                    <Search size={14} style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--secondary-foreground)',
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search athletes or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px 8px 34px',
                                            borderRadius: '12px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid var(--card-border)',
                                            color: 'var(--foreground)',
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                <div style={{
                                    display: 'inline-flex',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    padding: '3px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--card-border)',
                                }}>
                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: '9px',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            border: 'none',
                                            background: filterStatus === 'all' ? 'var(--primary)' : 'transparent',
                                            color: filterStatus === 'all' ? '#fff' : 'var(--secondary-foreground)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        Active ({data.athletes.length})
                                    </button>
                                    {data.pastDueCount > 0 && (
                                        <button
                                            onClick={() => setFilterStatus('past_due')}
                                            style={{
                                                padding: '5px 12px',
                                                borderRadius: '9px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                border: 'none',
                                                background: filterStatus === 'past_due' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                                color: filterStatus === 'past_due' ? '#f87171' : 'var(--secondary-foreground)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
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
                                        borderBottom: '1px solid var(--card-border)',
                                        color: 'var(--secondary-foreground)',
                                    }}>
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Athlete</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Plan / Billing</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Next Billing</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAthletes.map((athlete) => {
                                        return (
                                            <tr
                                                key={athlete.id}
                                                style={{
                                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                    transition: 'background 0.15s ease',
                                                }}
                                                className="hover:bg-white/[0.02]"
                                            >
                                                <td style={{ padding: '14px' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                                                        {athlete.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', opacity: 0.8 }}>
                                                        {athlete.email}
                                                    </div>
                                                    {athlete.customerEmail && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <span>Stripe: {athlete.customerEmail}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px' }}>
                                                    {athlete.status === 'active' ? (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '3px 9px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            <CheckCircle2 size={12} />
                                                            Active
                                                        </span>
                                                    ) : athlete.status === 'trialing' ? (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '3px 9px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(125, 135, 210, 0.15)',
                                                            color: 'var(--primary)',
                                                            border: '1px solid rgba(125, 135, 210, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            <Clock size={12} />
                                                            Trialing
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            padding: '3px 9px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#f87171',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            <AlertCircle size={12} />
                                                            Past Due
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px', fontWeight: 700 }}>
                                                    <span style={{ color: 'var(--foreground)', fontSize: '0.92rem' }}>
                                                        {athlete.billingInterval || (athlete.rawAmount ? `$${athlete.rawAmount}` : formatMoney(athlete.monthlyAmount, athlete.currency))}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px', color: 'var(--secondary-foreground)', fontSize: '0.8rem' }}>
                                                    {athlete.currentPeriodEnd ? (
                                                        <div>
                                                            <div>{formatDate(athlete.currentPeriodEnd)}</div>
                                                            {athlete.cancelAtPeriodEnd && (
                                                                <span style={{ fontSize: '0.7rem', color: '#f87171' }}>Cancels at end of cycle</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px', textAlign: 'right' }}>
                                                    <Link
                                                        href={`/dashboard/athletes/${athlete.id}`}
                                                        className="glass-button chat-press"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '4px 10px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            textDecoration: 'none',
                                                            color: 'var(--secondary-foreground)',
                                                        }}
                                                    >
                                                        <span>Profile</span>
                                                        <ArrowUpRight size={12} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredAthletes.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
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
                                {data.unmatchedSubscribers.map((unmatched) => (
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                            <span style={{ color: '#10b981', fontWeight: 700 }}>
                                                {formatMoney(unmatched.monthlyAmount, unmatched.currency)}/mo
                                            </span>
                                            <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.72rem' }}>
                                                Renews {formatDate(unmatched.currentPeriodEnd)}
                                            </span>
                                        </div>
                                        {unmatched.productName && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '4px' }}>
                                                Product: {unmatched.productName}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Charges Activity Feed */}
                    {data.recentCharges && data.recentCharges.length > 0 && (
                        <div className="glass-panel" style={{
                            padding: '24px',
                            borderRadius: '24px',
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0' }}>
                                Recent Stripe Payments {selectedProduct !== 'all' ? `(${activeProductName})` : ''}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {data.recentCharges.map((ch) => (
                                    <div
                                        key={ch.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 16px',
                                            borderRadius: '14px',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            flexWrap: 'wrap',
                                            gap: '12px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '10px',
                                                background: 'rgba(16, 185, 129, 0.12)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#10b981',
                                            }}>
                                                <DollarSign size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)' }}>
                                                    {ch.customerName || ch.customerEmail}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                                    {ch.description} • {formatDate(ch.created)}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                                                    +{formatMoney(ch.amount, ch.currency)}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                                                    Paid
                                                </div>
                                            </div>

                                            {ch.receiptUrl && (
                                                <a
                                                    href={ch.receiptUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="View Receipt"
                                                    className="glass-button chat-press"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: 0,
                                                        color: 'var(--secondary-foreground)',
                                                    }}
                                                >
                                                    <FileText size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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

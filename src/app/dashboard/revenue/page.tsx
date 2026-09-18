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
    FileText
} from 'lucide-react';

interface AthleteBilling {
    id: string;
    name: string;
    email: string;
    hasSubscription: boolean;
    status: string; // active, past_due, canceled, trialing, unpaid, none
    monthlyAmount: number;
    currency: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
}

interface UnmatchedSubscriber {
    id: string;
    email: string;
    name: string;
    status: string;
    monthlyAmount: number;
    currency: string;
    currentPeriodEnd: number | null;
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

interface RevenueData {
    connected: boolean;
    mrr: number;
    activeSubscribers: number;
    pastDueCount: number;
    grossThisMonth: number;
    athletes: AthleteBilling[];
    unmatchedSubscribers?: UnmatchedSubscriber[];
    recentCharges?: RecentCharge[];
    currency: string;
    totalAthleteRosterCount?: number;
    error?: string;
    message?: string;
    instructions?: string;
}

export default function CoachRevenuePage() {
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'unpaid' | 'past_due'>('all');

    const fetchRevenue = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await fetch('/api/coach/revenue');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                setData({
                    connected: false,
                    error: `Failed to load revenue data (HTTP ${res.status})`,
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
            const matchesQuery = 
                athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                athlete.email.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (!matchesQuery) return false;

            if (filterStatus === 'active') {
                return athlete.status === 'active' || athlete.status === 'trialing';
            }
            if (filterStatus === 'past_due') {
                return athlete.status === 'past_due' || athlete.status === 'unpaid';
            }
            if (filterStatus === 'unpaid') {
                return !athlete.hasSubscription || athlete.status === 'canceled' || athlete.status === 'none';
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                                How to provide your Stripe Key:
                            </h3>

                            <ol style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '0.88rem',
                                color: 'var(--secondary-foreground)',
                                lineHeight: 1.7,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
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
                                        <span style={codeBadge}>Customers: Read</span>
                                        <span style={codeBadge}>Charges: Read</span>
                                        <span style={codeBadge}>Balance: Read</span>
                                    </div>
                                </li>
                                <li>
                                    Copy your new key (starts with <code>rk_live_...</code>).
                                </li>
                                <li>
                                    Paste your key directly in our chat, or add it to your <code>.env.local</code> file as <code>STRIPE_SECRET_KEY=rk_live_...</code>.
                                </li>
                            </ol>
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
                        {/* MRR Card */}
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
                                    Monthly Recurring (MRR)
                                </span>
                                <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(125, 135, 210, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                    <DollarSign size={18} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                                    {formatMoney(data.mrr, data.currency)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                    Active monthly run-rate
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
                                    Paying athletes in Stripe
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
                                    Matching athlete emails to active Stripe subscriptions
                                </p>
                            </div>

                            {/* Search and Filters */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{
                                    position: 'relative',
                                    minWidth: 200,
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
                                        placeholder="Search athletes..."
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
                                    {(['all', 'active', 'unpaid', 'past_due'] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setFilterStatus(tab)}
                                            style={{
                                                padding: '5px 12px',
                                                borderRadius: '9px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                border: 'none',
                                                background: filterStatus === tab ? 'var(--primary)' : 'transparent',
                                                color: filterStatus === tab ? '#fff' : 'var(--secondary-foreground)',
                                                cursor: 'pointer',
                                                textTransform: 'capitalize',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {tab === 'past_due' ? 'Past Due' : tab}
                                        </button>
                                    ))}
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
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Plan Amount</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600 }}>Next Billing</th>
                                        <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAthletes.map((athlete) => {
                                        const isActive = athlete.status === 'active' || athlete.status === 'trialing';
                                        const isPastDue = athlete.status === 'past_due' || athlete.status === 'unpaid';

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
                                                </td>
                                                <td style={{ padding: '14px' }}>
                                                    {isActive ? (
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
                                                    ) : isPastDue ? (
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
                                                    ) : athlete.status === 'canceled' ? (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            padding: '3px 9px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            color: 'var(--secondary-foreground)',
                                                        }}>
                                                            Canceled
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 500,
                                                            padding: '3px 9px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(255, 255, 255, 0.04)',
                                                            color: 'var(--secondary-foreground)',
                                                            opacity: 0.6,
                                                        }}>
                                                            No Stripe Sub
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px', fontWeight: 600 }}>
                                                    {athlete.monthlyAmount > 0 ? (
                                                        <span style={{ color: 'var(--foreground)' }}>
                                                            {formatMoney(athlete.monthlyAmount, athlete.currency)}
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', fontWeight: 400 }}> / mo</span>
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--secondary-foreground)', opacity: 0.5 }}>—</span>
                                                    )}
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
                                                No athletes found matching this filter.
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
                                Recent Stripe Payments
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

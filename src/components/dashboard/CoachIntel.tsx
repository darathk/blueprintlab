'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle, TrendingDown, Activity, Zap, MessageSquare, BarChart3,
    ChevronDown, ChevronUp, ExternalLink, RefreshCw
} from 'lucide-react';

const ICON_MAP = {
    inactive: AlertTriangle,
    stalled: TrendingDown,
    readiness: Activity,
    high_rpe: Zap,
    unread_message: MessageSquare,
    low_compliance: BarChart3,
};

const LABEL_MAP = {
    inactive: 'Inactive',
    stalled: 'Stalled Progress',
    readiness: 'Readiness Declining',
    high_rpe: 'High RPE',
    unread_message: 'Unanswered',
    low_compliance: 'Low Compliance',
};

const COLOR_MAP = {
    inactive: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#f87171', icon: '#ef4444' },
    stalled: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)', text: '#fb923c', icon: '#f97316' },
    readiness: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', text: '#c084fc', icon: '#a855f7' },
    high_rpe: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#fbbf24', icon: '#eab308' },
    unread_message: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa', icon: '#3b82f6' },
    low_compliance: { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.35)', text: '#f472b6', icon: '#ec4899' },
};

export default function CoachIntel({ coachId }) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchIntel = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await fetch('/api/coach-intel');
            if (res.ok) {
                const data = await res.json();
                setAlerts(data.alerts || []);
            }
        } catch (e) {
            console.error('Failed to fetch coach intel:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchIntel(); }, [fetchIntel]);

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    // Group alerts by type for summary badges
    const grouped = {};
    for (const a of alerts) {
        if (!grouped[a.type]) grouped[a.type] = [];
        grouped[a.type].push(a);
    }

    const navigateToAthlete = (athleteId, tab) => {
        if (tab === 'messages') {
            router.push(`/dashboard/messages`);
        } else {
            router.push(`/dashboard/athletes/${athleteId}`);
        }
    };

    if (loading) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.6) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '24px', marginBottom: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--secondary-foreground)' }}>
                    <RefreshCw size={16} className="pulse" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 14 }}>Analyzing athlete data...</span>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 100%)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 16, padding: '20px 24px', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(16,185,129,0.15)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>✅</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>All Clear</div>
                        <div style={{ fontSize: 13, color: 'var(--secondary-foreground)' }}>No alerts — your athletes are on track</div>
                    </div>
                </div>
                <button
                    onClick={() => fetchIntel(true)}
                    disabled={refreshing}
                    style={{
                        background: 'none', border: 'none', color: 'var(--secondary-foreground)',
                        cursor: 'pointer', padding: 6, borderRadius: 8, opacity: refreshing ? 0.5 : 0.7,
                        transition: 'opacity 0.15s',
                    }}
                >
                    <RefreshCw size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
            </div>
        );
    }

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.7) 100%)',
            border: `1px solid ${criticalCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 16, marginBottom: 24, overflow: 'hidden',
            transition: 'all 0.3s ease',
        }}>
            {/* Header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', cursor: 'pointer',
                    background: criticalCount > 0
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(251,146,60,0.05) 100%)'
                        : 'rgba(255,255,255,0.02)',
                    borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: criticalCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <AlertTriangle size={18} color={criticalCount > 0 ? '#ef4444' : '#fbbf24'} />
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                            Coach Intelligence
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--secondary-foreground)', marginTop: 1 }}>
                            {criticalCount > 0 && <span style={{ color: '#f87171', fontWeight: 600 }}>{criticalCount} critical</span>}
                            {criticalCount > 0 && warningCount > 0 && ' · '}
                            {warningCount > 0 && <span style={{ color: '#fbbf24' }}>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Type badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {Object.entries(grouped).map(([type, items]) => {
                            const colors = COLOR_MAP[type] || COLOR_MAP.inactive;
                            return (
                                <div key={type} style={{
                                    background: colors.bg, border: `1px solid ${colors.border}`,
                                    borderRadius: 20, padding: '3px 10px',
                                    fontSize: 11, fontWeight: 600, color: colors.text,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {items.length} {LABEL_MAP[type] || type}
                                </div>
                            );
                        })}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); fetchIntel(true); }}
                        disabled={refreshing}
                        style={{
                            background: 'none', border: 'none', color: 'var(--secondary-foreground)',
                            cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0,
                            opacity: refreshing ? 0.5 : 0.7,
                        }}
                    >
                        <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
                    </button>
                    {collapsed
                        ? <ChevronDown size={18} color="var(--secondary-foreground)" />
                        : <ChevronUp size={18} color="var(--secondary-foreground)" />
                    }
                </div>
            </div>

            {/* Alert Cards */}
            {!collapsed && (
                <div style={{
                    padding: '12px 16px 16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 10,
                    maxHeight: 400,
                    overflowY: 'auto',
                }}>
                    {alerts.map((alert, i) => {
                        const Icon = ICON_MAP[alert.type] || AlertTriangle;
                        const colors = COLOR_MAP[alert.type] || COLOR_MAP.inactive;
                        const isCritical = alert.severity === 'critical';

                        return (
                            <div
                                key={`${alert.type}-${alert.athleteId}-${i}`}
                                onClick={() => navigateToAthlete(alert.athleteId, alert.type === 'unread_message' ? 'messages' : null)}
                                style={{
                                    background: isCritical
                                        ? `linear-gradient(135deg, ${colors.bg} 0%, rgba(239,68,68,0.04) 100%)`
                                        : colors.bg,
                                    border: `1px solid ${isCritical ? colors.border : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: 12, padding: '12px 14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    position: 'relative',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${colors.border}`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                    background: `${colors.icon}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={16} color={colors.icon} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                                            {alert.athleteName}
                                        </span>
                                        {isCritical && (
                                            <span style={{
                                                fontSize: 9, fontWeight: 800, color: '#ef4444',
                                                background: 'rgba(239,68,68,0.15)', padding: '1px 6px',
                                                borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            }}>
                                                Critical
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: 12, color: colors.text, lineHeight: 1.4,
                                        opacity: 0.9,
                                    }}>
                                        {alert.message}
                                    </div>
                                </div>
                                <ExternalLink size={12} color="var(--secondary-foreground)" style={{ opacity: 0.4, flexShrink: 0, marginTop: 2 }} />
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

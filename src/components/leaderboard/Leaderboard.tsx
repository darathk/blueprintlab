'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Trophy, Calendar, Award,
    ChevronDown, ChevronUp, History, Sparkles,
    Shield, X
} from 'lucide-react';

export interface LeaderboardEntry {
    id: string;
    name: string;
    totalLogs: number;
    totalSessions: number;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    tier: string;
    tierName?: string;
    tierIcon?: string;
    nextTierName?: string | null;
    nextTierLogs?: number | null;
    progressPercent?: number;
    firstLogDate?: string | null;
    lastLogDate?: string | null;
}

export interface CycleInfo {
    start: string;
    end: string;
    daysRemaining: number;
    monthName?: string;
    monthKey?: string;
}

export interface PastMonthStanding {
    rank: number;
    id: string;
    name: string;
    totalLogs: number;
    tier: string;
    tierName?: string;
    tierIcon?: string;
}

export interface PastMonthData {
    monthKey: string;
    monthLabel: string;
    shortLabel: string;
    year: number;
    totalLogs: number;
    activeAthletesCount: number;
    winner: { id: string; name: string; totalLogs: number } | null;
    runnerUp: { id: string; name: string; totalLogs: number } | null;
    thirdPlace: { id: string; name: string; totalLogs: number } | null;
    standings: PastMonthStanding[];
}

export interface ChartDataItem {
    monthKey: string;
    monthLabel: string;
    fullMonthLabel: string;
    winnerName: string;
    winnerLogs: number;
    runnerUpName: string;
    runnerUpLogs: number;
    thirdName: string;
    thirdLogs: number;
    totalTeamLogs: number;
    activeAthletes: number;
}

export interface HallOfFameItem {
    athleteId: string;
    name: string;
    titlesCount: number;
    monthsWon: string[];
    totalAllTimeLogs: number;
}

export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    cycle: CycleInfo;
    monthly?: {
        entries: LeaderboardEntry[];
        cycle: CycleInfo;
        totalLogs: number;
        activeAthletes: number;
    };
    allTime?: {
        entries: LeaderboardEntry[];
        totalLogs: number;
        activeAthletes: number;
    };
    history?: {
        pastMonths: PastMonthData[];
        chartData: ChartDataItem[];
        hallOfFame: HallOfFameItem[];
        totalPastMonths: number;
    };
}

export const TIER_CONFIG: Record<string, {
    color: string;
    glow: string;
    label: string;
    icon: string;
    badgeBg: string;
    borderColor: string;
    minMonthly: number;
    minAllTime: number;
    description: string;
}> = {
    challenger: {
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.5)',
        label: 'Challenger',
        icon: '👑',
        badgeBg: 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(251, 191, 36, 0.22))',
        borderColor: '#00f0ff',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Rank #1 Peak Athlete of Blueprint Lab',
    },
    grandmaster: {
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.45)',
        label: 'Grandmaster',
        icon: '🔥',
        badgeBg: 'rgba(239, 68, 68, 0.16)',
        borderColor: '#ef4444',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Podium Finishers (#2 & #3 Top Athletes)',
    },
    master: {
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.45)',
        label: 'Master',
        icon: '⚔️',
        badgeBg: 'rgba(168, 85, 247, 0.16)',
        borderColor: '#a855f7',
        minMonthly: 24,
        minAllTime: 170,
        description: 'Near-daily workout completion & exceptional dedication',
    },
    diamond: {
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.4)',
        label: 'Diamond',
        icon: '💎',
        badgeBg: 'rgba(56, 189, 248, 0.16)',
        borderColor: '#38bdf8',
        minMonthly: 20,
        minAllTime: 120,
        description: 'Consistent 5 sessions per week standard',
    },
    platinum: {
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.35)',
        label: 'Platinum',
        icon: '🛡️',
        badgeBg: 'rgba(16, 185, 129, 0.16)',
        borderColor: '#10b981',
        minMonthly: 16,
        minAllTime: 80,
        description: 'High standard of training discipline',
    },
    gold: {
        color: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.35)',
        label: 'Gold',
        icon: '🥇',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#f59e0b',
        minMonthly: 12,
        minAllTime: 50,
        description: 'Solid regular routine & habitual consistency',
    },
    silver: {
        color: '#94a3b8',
        glow: 'rgba(148, 163, 184, 0.3)',
        label: 'Silver',
        icon: '🥈',
        badgeBg: 'rgba(148, 163, 184, 0.14)',
        borderColor: '#94a3b8',
        minMonthly: 8,
        minAllTime: 25,
        description: 'Building training volume & momentum',
    },
    bronze: {
        color: '#d97706',
        glow: 'rgba(217, 119, 6, 0.3)',
        label: 'Bronze',
        icon: '🥉',
        badgeBg: 'rgba(217, 119, 6, 0.14)',
        borderColor: '#d97706',
        minMonthly: 4,
        minAllTime: 10,
        description: 'Laying down the foundational habits',
    },
    iron: {
        color: '#64748b',
        glow: 'rgba(100, 116, 139, 0.25)',
        label: 'Iron',
        icon: '⚙️',
        badgeBg: 'rgba(100, 116, 139, 0.12)',
        borderColor: '#64748b',
        minMonthly: 0,
        minAllTime: 0,
        description: 'The starting step of the training journey',
    },
    // Backwards compat aliases
    champion: {
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.5)',
        label: 'Challenger',
        icon: '👑',
        badgeBg: 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(251, 191, 36, 0.22))',
        borderColor: '#00f0ff',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Rank #1 Peak Athlete',
    },
};

function getRankBadge(rank: number): string {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
}

function getStreakEmoji(streak: number): string {
    if (streak >= 20) return '🔥🔥🔥';
    if (streak >= 10) return '🔥🔥';
    if (streak >= 3) return '🔥';
    return '';
}

const HistoryChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item: ChartDataItem = payload[0]?.payload;
    if (!item) return null;

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: 200,
        }}>
            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 13, marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                📅 {item.fullMonthLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fbbf24' }}>
                    <span>🥇 Champion: <strong>{item.winnerName}</strong></span>
                    <strong style={{ marginLeft: 8 }}>{item.winnerLogs} logs</strong>
                </div>
                {item.runnerUpName !== 'N/A' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>🥈 2nd: <strong>{item.runnerUpName}</strong></span>
                        <strong style={{ marginLeft: 8 }}>{item.runnerUpLogs} logs</strong>
                    </div>
                )}
                {item.thirdName !== 'N/A' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#cd7f32' }}>
                        <span>🥉 3rd: <strong>{item.thirdName}</strong></span>
                        <strong style={{ marginLeft: 8 }}>{item.thirdLogs} logs</strong>
                    </div>
                )}
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)', color: '#64748b', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Team Total:</span>
                    <strong>{item.totalTeamLogs} logs ({item.activeAthletes} athletes)</strong>
                </div>
            </div>
        </div>
    );
};

export default function Leaderboard({
    coachId,
    currentAthleteId,
}: {
    coachId: string;
    currentAthleteId?: string;
}) {
    const [tab, setTab] = useState<'monthly' | 'allTime' | 'history'>('monthly');
    const [data, setData] = useState<LeaderboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [showTierGuide, setShowTierGuide] = useState(false);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await fetch(`/api/leaderboard?coachId=${coachId}`);
            if (res.ok) {
                const json: LeaderboardResponse = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error('Failed to fetch leaderboard:', e);
        } finally {
            setLoading(false);
        }
    }, [coachId]);

    useEffect(() => {
        fetchLeaderboard();

        const channel = supabase
            .channel('leaderboard-logs-unified')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Log' }, () => fetchLeaderboard())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Log' }, () => fetchLeaderboard())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Athlete' }, () => fetchLeaderboard())
            .subscribe();

        const interval = setInterval(fetchLeaderboard, 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchLeaderboard]);

    const toggleMonthExpanded = (monthKey: string) => {
        setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
    };

    const monthlyEntries = data?.monthly?.entries || data?.entries || [];
    const allTimeEntries = data?.allTime?.entries || [];
    const cycle = data?.monthly?.cycle || data?.cycle || null;
    const historyData = data?.history || null;

    const activeEntries = tab === 'monthly' ? monthlyEntries : allTimeEntries;
    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return activeEntries;
        const q = searchQuery.toLowerCase().trim();
        return activeEntries.filter(e => e.name.toLowerCase().includes(q));
    }, [activeEntries, searchQuery]);

    const currentAthlete = currentAthleteId
        ? activeEntries.find(e => e.id === currentAthleteId)
        : null;

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <div className="pulse" style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏆</div>
                <p style={{ fontWeight: 600 }}>Loading leaderboard rankings...</p>
            </div>
        );
    }

    if (!data || (monthlyEntries.length === 0 && allTimeEntries.length === 0)) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                <p>No athletes on the board yet. Logs will appear as athletes complete workouts.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 650, margin: '0 auto', position: 'relative' }}>
            <div style={{ textAlign: 'center', padding: '1.25rem 1rem 0.75rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
                    <span>🏆</span> Leaderboard
                </h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.82rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    {tab === 'monthly' && "Who's putting in the work this month?"}
                    {tab === 'allTime' && "All-time workout log rankings across all history"}
                    {tab === 'history' && "Past monthly champions & workout records"}
                </p>

                {/* Tab Switcher */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    background: 'var(--glass-surface-2)',
                    borderRadius: 20,
                    padding: 3,
                    border: '1px solid var(--glass-border)',
                    margin: '1rem auto 0.5rem',
                    maxWidth: 460,
                }}>
                    <button
                        onClick={() => { setTab('monthly'); setSearchQuery(''); }}
                        className="chat-press"
                        style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 16,
                            border: tab === 'monthly' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'monthly' ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                            color: tab === 'monthly' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: tab === 'monthly' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none',
                        }}
                    >
                        <Calendar size={13} />
                        <span>This Month</span>
                    </button>

                    <button
                        onClick={() => { setTab('allTime'); setSearchQuery(''); }}
                        className="chat-press"
                        style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 16,
                            border: tab === 'allTime' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'allTime' ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                            color: tab === 'allTime' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: tab === 'allTime' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none',
                        }}
                    >
                        <Award size={13} />
                        <span>All-Time</span>
                    </button>

                    <button
                        onClick={() => { setTab('history'); setSearchQuery(''); }}
                        className="chat-press"
                        style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 16,
                            border: tab === 'history' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'history' ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                            color: tab === 'history' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: tab === 'history' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none',
                        }}
                    >
                        <History size={13} />
                        <span>Champions</span>
                    </button>
                </div>

                {/* Sub-header info badges & Tier Guide button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                        {tab === 'monthly' && cycle && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: 20,
                                background: 'rgba(125, 135, 210, 0.1)',
                                border: '1px solid rgba(125, 135, 210, 0.2)',
                                fontSize: '0.72rem',
                                color: 'var(--secondary-foreground)',
                            }}>
                                <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{cycle.monthName || 'Current Cycle'}</span>
                                <span style={{ opacity: 0.5 }}>·</span>
                                <span>Resets in <strong style={{ color: 'var(--primary)' }}>{cycle.daysRemaining} day{cycle.daysRemaining !== 1 ? 's' : ''}</strong></span>
                            </div>
                        )}

                        {tab === 'allTime' && data.allTime && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: 20,
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                fontSize: '0.72rem',
                                color: '#fbbf24',
                                fontWeight: 600,
                            }}>
                                <Sparkles size={12} />
                                <span>{data.allTime.totalLogs.toLocaleString()} Lifetime Logs</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowTierGuide(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 16,
                            padding: '4px 10px',
                            color: '#94a3b8',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Shield size={12} color="#00f0ff" />
                        <span>Rank Tiers ℹ️</span>
                    </button>
                </div>
            </div>

            {(tab === 'monthly' || tab === 'allTime') && (
                <>
                    {/* Athlete's Personal Rank Card */}
                    {currentAthlete && (() => {
                        const tierCfg = TIER_CONFIG[currentAthlete.tier] || TIER_CONFIG.iron;
                        return (
                            <div style={{
                                margin: '0 1rem 1rem',
                                padding: '1.1rem',
                                borderRadius: 18,
                                border: `1px solid ${tierCfg.borderColor}`,
                                background: `linear-gradient(135deg, ${tierCfg.color}15 0%, rgba(15,23,42,0.8) 100%)`,
                                boxShadow: `0 0 24px ${tierCfg.glow}`,
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        fontSize: '2rem',
                                        width: 52,
                                        height: 52,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 14,
                                        background: `${tierCfg.color}25`,
                                        border: `1px solid ${tierCfg.color}50`,
                                        flexShrink: 0,
                                    }}>
                                        {tierCfg.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                                color: tierCfg.color,
                                                padding: '1px 6px',
                                                borderRadius: 4,
                                                background: tierCfg.badgeBg,
                                                border: `1px solid ${tierCfg.color}40`,
                                            }}>
                                                {tierCfg.label}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 600 }}>
                                                {tab === 'monthly' ? 'Monthly Standing' : 'Lifetime Standing'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1 }}>
                                            #{currentAthlete.rank} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--secondary-foreground)' }}>of {activeEntries.length}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tierCfg.color }}>
                                            {currentAthlete.totalLogs}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 600 }}>
                                            {tab === 'monthly' ? 'Month Logs' : 'All-Time Logs'}
                                        </div>
                                    </div>
                                </div>

                                {/* League of Legends Rank Progress Bar */}
                                <div style={{
                                    marginTop: '0.85rem',
                                    paddingTop: '0.75rem',
                                    borderTop: `1px solid ${tierCfg.color}25`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginBottom: 5 }}>
                                        <span>
                                            Rank Progress: <strong style={{ color: tierCfg.color }}>{tierCfg.label}</strong>
                                            {currentAthlete.nextTierName && (
                                                <span> → <strong style={{ color: '#f8fafc' }}>{currentAthlete.nextTierName}</strong></span>
                                            )}
                                        </span>
                                        <span>
                                            {currentAthlete.nextTierLogs ? (
                                                <strong>{currentAthlete.totalLogs} / {currentAthlete.nextTierLogs} logs</strong>
                                            ) : (
                                                <strong style={{ color: tierCfg.color }}>👑 MAX TIER</strong>
                                            )}
                                        </span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: 6,
                                        borderRadius: 6,
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${currentAthlete.progressPercent || 100}%`,
                                            height: '100%',
                                            borderRadius: 6,
                                            background: `linear-gradient(90deg, ${tierCfg.color}, #00f0ff)`,
                                            boxShadow: `0 0 10px ${tierCfg.glow}`,
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: `1px solid ${tierCfg.color}15` }}>
                                    <StatPill label="Completion" value={`${currentAthlete.completionRate}%`} />
                                    <StatPill label="Current Streak" value={`${currentAthlete.currentStreak} ${getStreakEmoji(currentAthlete.currentStreak)}`} />
                                    <StatPill label="Best Streak" value={`${currentAthlete.longestStreak}`} />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Top 3 Podium */}
                    {activeEntries.length >= 3 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem 1rem',
                            marginBottom: '0.5rem',
                        }}>
                            <PodiumCard entry={activeEntries[1]} position={2} />
                            <PodiumCard entry={activeEntries[0]} position={1} />
                            <PodiumCard entry={activeEntries[2]} position={3} />
                        </div>
                    )}

                    {/* Full Ranked Lifters List with League of Legends Tier Badges */}
                    <div style={{ padding: '0 1rem 6rem' }}>
                        {filteredEntries.map((entry) => {
                            const tierCfg = TIER_CONFIG[entry.tier] || TIER_CONFIG.iron;
                            const isCurrentUser = entry.id === currentAthleteId;
                            return (
                                <div
                                    key={entry.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.75rem 1rem',
                                        borderRadius: 14,
                                        marginBottom: '0.5rem',
                                        border: isCurrentUser ? `1px solid ${tierCfg.color}` : '1px solid var(--card-border)',
                                        background: isCurrentUser ? `linear-gradient(135deg, ${tierCfg.color}15, rgba(15,23,42,0.8))` : 'var(--card-bg)',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isCurrentUser ? `0 0 16px ${tierCfg.glow}` : 'none',
                                    }}
                                >
                                    {/* Rank Number / Icon Badge */}
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: entry.rank <= 3 ? '1.25rem' : '0.85rem',
                                        background: entry.rank <= 3
                                            ? `linear-gradient(135deg, ${tierCfg.color}30, ${tierCfg.color}10)`
                                            : 'rgba(100, 116, 139, 0.1)',
                                        color: entry.rank <= 3 ? tierCfg.color : 'var(--secondary-foreground)',
                                        border: `1px solid ${entry.rank <= 3 ? tierCfg.color + '50' : 'rgba(255,255,255,0.06)'}`,
                                        flexShrink: 0,
                                    }}>
                                        {getRankBadge(entry.rank)}
                                    </div>

                                    {/* Name & Tier Badge Info */}
                                    <div style={{ flex: 1, marginLeft: '0.75rem', minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 700,
                                            fontSize: '0.925rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                        }}>
                                            <span>{entry.name}</span>
                                            {isCurrentUser && (
                                                <span style={{ fontSize: '0.68rem', color: '#00f0ff', fontWeight: 800 }}>(You)</span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                                            {/* Tier Pill Badge */}
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                padding: '1px 6px',
                                                borderRadius: 4,
                                                background: tierCfg.badgeBg,
                                                color: tierCfg.color,
                                                border: `1px solid ${tierCfg.color}35`,
                                                flexShrink: 0,
                                            }}>
                                                <span>{tierCfg.icon}</span>
                                                <span>{tierCfg.label}</span>
                                            </span>

                                            <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', whiteSpace: 'nowrap' }}>
                                                {entry.completionRate}%
                                            </span>

                                            {entry.currentStreak > 0 && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', whiteSpace: 'nowrap' }}>
                                                    · {getStreakEmoji(entry.currentStreak)} {entry.currentStreak}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Logs count */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: tierCfg.color, lineHeight: 1.1 }}>
                                            {entry.totalLogs}
                                        </div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                            logs
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Past Champions History View */}
            {tab === 'history' && historyData && (
                <div style={{ padding: '0 1rem 6rem' }}>
                    {historyData.chartData && historyData.chartData.length > 0 && (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderRadius: 16,
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '16px 12px 10px',
                            marginBottom: '1.5rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 6, paddingRight: 6 }}>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--foreground)' }}>
                                        📈 Past Monthly Winning Logs
                                    </h3>
                                    <p style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', margin: '2px 0 0' }}>
                                        Winning workout counts across past completed months
                                    </p>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart data={historyData.chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="winnerGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.4} />
                                        </linearGradient>
                                        <linearGradient id="runnerGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.7} />
                                            <stop offset="100%" stopColor="#64748b" stopOpacity={0.2} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="monthLabel"
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip content={<HistoryChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="winnerLogs" fill="url(#winnerGrad)" radius={[6, 6, 0, 0]} name="🥇 Champion" />
                                    <Bar dataKey="runnerUpLogs" fill="url(#runnerGrad)" radius={[6, 6, 0, 0]} name="🥈 2nd Place" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Hall of Fame */}
                    {historyData.hallOfFame && historyData.hallOfFame.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', paddingLeft: 4 }}>
                                <Trophy size={16} color="#fbbf24" />
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Hall of Fame
                                </h3>
                                <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                    (Most Monthly Titles Won)
                                </span>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                                gap: '0.6rem',
                            }}>
                                {historyData.hallOfFame.map((hof) => (
                                    <div
                                        key={hof.athleteId}
                                        style={{
                                            padding: '0.85rem',
                                            borderRadius: 14,
                                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(15,23,42,0.6) 100%)',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            boxShadow: '0 0 14px rgba(251, 191, 36, 0.15)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '1.25rem' }}>👑</span>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: 12,
                                                background: 'rgba(251, 191, 36, 0.2)',
                                                color: '#fbbf24',
                                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                            }}>
                                                {hof.titlesCount}x Champion
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {hof.name}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                            {hof.monthsWon.join(', ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Month-by-Month Archive */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', paddingLeft: 4 }}>
                            <Calendar size={16} color="#00f0ff" />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Month-by-Month Archive
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {historyData.pastMonths.map((m) => {
                                const isExpanded = !!expandedMonths[m.monthKey];
                                return (
                                    <div
                                        key={m.monthKey}
                                        style={{
                                            borderRadius: 14,
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            onClick={() => toggleMonthExpanded(m.monthKey)}
                                            style={{
                                                padding: '0.85rem 1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span>{m.monthLabel}</span>
                                                    {m.winner && (
                                                        <span style={{ fontSize: '0.72rem', color: '#00f0ff', fontWeight: 600 }}>
                                                            👑 {m.winner.name} ({m.winner.totalLogs})
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                                    {m.totalLogs} team logs · {m.activeAthletesCount} lifters participated
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary-foreground)' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                                    {isExpanded ? 'Hide' : 'View'}
                                                </span>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ padding: '0.5rem 1rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                                {/* Top 3 Podium for the month */}
                                                {m.winner && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', paddingTop: '0.25rem' }}>
                                                        <div style={{ flex: 1, padding: '0.5rem', borderRadius: 8, background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.25)', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#00f0ff', fontWeight: 700 }}>🥇 1st (Challenger)</div>
                                                            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{m.winner.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#00f0ff' }}>{m.winner.totalLogs} logs</div>
                                                        </div>
                                                        {m.runnerUp && (
                                                            <div style={{ flex: 1, padding: '0.5rem', borderRadius: 8, background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.2)', textAlign: 'center' }}>
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>🥈 2nd (Grandmaster)</div>
                                                                <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{m.runnerUp.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.runnerUp.totalLogs} logs</div>
                                                            </div>
                                                        )}
                                                        {m.thirdPlace && (
                                                            <div style={{ flex: 1, padding: '0.5rem', borderRadius: 8, background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)', textAlign: 'center' }}>
                                                                <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>🥉 3rd (Grandmaster)</div>
                                                                <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{m.thirdPlace.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#d97706' }}>{m.thirdPlace.totalLogs} logs</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Full month standings table */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {m.standings.map((s) => (
                                                        <div
                                                            key={s.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '4px 8px',
                                                                borderRadius: 6,
                                                                background: s.rank <= 3 ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                                fontSize: '0.78rem',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ width: 22, color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                                                    #{s.rank}
                                                                </span>
                                                                <span style={{ fontWeight: 600 }}>{s.name}</span>
                                                            </div>
                                                            <div style={{ fontWeight: 700, color: s.rank === 1 ? '#00f0ff' : 'var(--foreground)' }}>
                                                                {s.totalLogs} logs
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Rank Tier System Modal */}
            {showTierGuide && (
                <div
                    onClick={() => setShowTierGuide(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 200,
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 500,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            background: 'rgba(15, 23, 42, 0.98)',
                            border: '1px solid rgba(0, 240, 255, 0.3)',
                            borderRadius: 20,
                            padding: '1.25rem',
                            boxShadow: '0 0 40px rgba(0, 240, 255, 0.2)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={20} color="#00f0ff" />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                    Rank Tiers & Divisions
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowTierGuide(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, margin: '0 0 1rem' }}>
                            Ascend the ladder by consistently logging your workouts. Higher tiers require exponentially greater dedication and consistency!
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {Object.entries(TIER_CONFIG).filter(([k]) => k !== 'champion').map(([key, cfg]) => (
                                <div
                                    key={key}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: 12,
                                        border: `1px solid ${cfg.color}35`,
                                        background: `linear-gradient(135deg, ${cfg.color}10, rgba(0,0,0,0.2))`,
                                    }}
                                >
                                    <div style={{
                                        fontSize: '1.4rem',
                                        width: 36,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 8,
                                        background: `${cfg.color}20`,
                                        flexShrink: 0,
                                    }}>
                                        {cfg.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {cfg.label}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                                                {key === 'challenger'
                                                    ? 'Rank #1 Champion'
                                                    : key === 'grandmaster'
                                                    ? 'Podium Top 3'
                                                    : `${cfg.minMonthly}+ Month · ${cfg.minAllTime}+ Lifetime`}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                            {cfg.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowTierGuide(false)}
                            style={{
                                width: '100%',
                                marginTop: '1.25rem',
                                padding: '10px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'var(--primary)',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                            }}
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
    const heights = { 1: 135, 2: 110, 3: 95 };
    const tierCfg = TIER_CONFIG[entry.tier] || TIER_CONFIG.iron;
    const medals = { 1: '🏆', 2: '🥈', 3: '🥉' };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: position === 1 ? 120 : 100,
        }}>
            <div style={{ fontSize: position === 1 ? '2rem' : '1.4rem', marginBottom: '0.25rem' }}>
                {medals[position as 1 | 2 | 3]}
            </div>
            <div style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                marginBottom: '0.25rem',
            }}>
                {entry.name}
            </div>
            <div style={{
                width: '100%',
                height: heights[position as 1 | 2 | 3],
                borderRadius: '14px 14px 0 0',
                background: `linear-gradient(to top, ${tierCfg.color}15, ${tierCfg.color}35)`,
                border: `1px solid ${tierCfg.color}50`,
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                boxShadow: position === 1 ? `0 0 20px ${tierCfg.glow}` : 'none',
            }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: tierCfg.color, lineHeight: 1 }}>
                    {entry.totalLogs}
                </div>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                    logs
                </div>
                <div style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: tierCfg.color,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: tierCfg.badgeBg,
                    border: `1px solid ${tierCfg.color}40`,
                    marginTop: 2,
                }}>
                    {tierCfg.label}
                </div>
            </div>
        </div>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>{label}</div>
        </div>
    );
}

export function LeaderboardRankWidget({
    coachId,
    athleteId,
    athleteName,
}: {
    coachId: string;
    athleteId: string;
    athleteName: string;
}) {
    const router = useRouter();
    const [mode, setMode] = useState<'monthly' | 'allTime'>('monthly');
    const [monthlyData, setMonthlyData] = useState<LeaderboardEntry | null>(null);
    const [allTimeData, setAllTimeData] = useState<LeaderboardEntry | null>(null);
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [allTimeTotal, setAllTimeTotal] = useState(0);
    const [cycle, setCycle] = useState<CycleInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRank = useCallback(async () => {
        try {
            const res = await fetch(`/api/leaderboard?coachId=${coachId}`);
            if (res.ok) {
                const json: LeaderboardResponse = await res.json();
                const mEntries: LeaderboardEntry[] = json.monthly?.entries || json.entries || [];
                const aEntries: LeaderboardEntry[] = json.allTime?.entries || [];

                setMonthlyTotal(mEntries.length);
                setAllTimeTotal(aEntries.length);
                setCycle(json.monthly?.cycle || json.cycle || null);

                const mMe = mEntries.find(e => e.id === athleteId);
                const aMe = aEntries.find(e => e.id === athleteId);

                if (mMe) setMonthlyData(mMe);
                if (aMe) setAllTimeData(aMe);
            }
        } catch (e) {
            console.error('Failed to fetch rank:', e);
        } finally {
            setLoading(false);
        }
    }, [coachId, athleteId]);

    useEffect(() => {
        fetchRank();

        const channel = supabase
            .channel('rank-widget-logs-v3')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Log' }, () => fetchRank())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Athlete' }, () => fetchRank())
            .subscribe();

        const interval = setInterval(fetchRank, 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchRank]);

    const activeData = mode === 'monthly' ? monthlyData : allTimeData;
    const activeTotal = mode === 'monthly' ? monthlyTotal : allTimeTotal;

    if (loading || !activeData) {
        return (
            <div style={{
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.2))',
                padding: '1rem',
                animation: 'pulse 1.5s ease-in-out infinite',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }} />
                        <div>
                            <div style={{ width: 80, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 6 }} />
                            <div style={{ width: 120, height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const tierCfg = TIER_CONFIG[activeData.tier] || TIER_CONFIG.iron;

    return (
        <div
            onClick={() => router.push(`/athlete/${athleteId}/leaderboard`)}
            style={{
                borderRadius: 16,
                border: `1px solid ${tierCfg.color}50`,
                background: `linear-gradient(135deg, ${tierCfg.color}10 0%, rgba(15,23,42,0.7) 100%)`,
                padding: '1rem',
                boxShadow: `0 0 18px ${tierCfg.glow}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Widget Top Header with Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: tierCfg.color, whiteSpace: 'nowrap' }}>
                    <span>🏆</span>
                    <span>Leaderboard</span>
                </div>

                {/* Interactive pill switcher on dashboard card */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    style={{
                        display: 'flex',
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: 20,
                        padding: 2,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setMode('monthly');
                        }}
                        style={{
                            padding: '3px 9px',
                            borderRadius: 16,
                            border: 'none',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: mode === 'monthly' ? tierCfg.color : 'transparent',
                            color: mode === 'monthly' ? '#000000' : 'var(--secondary-foreground)',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        Monthly
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setMode('allTime');
                        }}
                        style={{
                            padding: '3px 9px',
                            borderRadius: 16,
                            border: 'none',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: mode === 'allTime' ? tierCfg.color : 'transparent',
                            color: mode === 'allTime' ? '#000000' : 'var(--secondary-foreground)',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        All-Time
                    </button>
                </div>
            </div>

            {/* Main Rank & Logs Stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        fontSize: '1.6rem',
                        width: 44,
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        background: `${tierCfg.color}20`,
                        border: `1px solid ${tierCfg.color}40`,
                    }}>
                        {tierCfg.icon}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: tierCfg.color,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: tierCfg.badgeBg,
                                border: `1px solid ${tierCfg.color}35`,
                            }}>
                                {tierCfg.label}
                            </span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                {mode === 'monthly' ? (
                                    <>Month{cycle ? ` · Resets in ${cycle.daysRemaining}d` : ''}</>
                                ) : (
                                    <>Lifetime</>
                                )}
                            </span>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, marginTop: 2 }}>
                            #{activeData.rank} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--secondary-foreground)' }}>of {activeTotal}</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: tierCfg.color }}>
                        {activeData.totalLogs} {getStreakEmoji(activeData.currentStreak)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {mode === 'monthly' ? 'monthly logs' : 'lifetime logs'}
                    </div>
                </div>
            </div>

            {/* Sub-stats summary */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.75rem',
                paddingTop: '0.6rem',
                borderTop: `1px solid ${tierCfg.color}20`,
                fontSize: '0.72rem',
                color: 'var(--secondary-foreground)',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span>🎯 <strong>{activeData.completionRate}%</strong></span>
                    {activeData.currentStreak > 0 && (
                        <span>🔥 <strong>{activeData.currentStreak}</strong> streak</span>
                    )}
                </div>

                <span style={{ fontSize: '0.68rem', color: tierCfg.color, fontWeight: 700 }}>
                    View Standings →
                </span>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Trophy, Calendar, Award,
    ChevronDown, ChevronUp, History, Sparkles
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

const TIER_CONFIG: Record<string, { color: string; glow: string; label: string; icon: string }> = {
    champion: { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.5)', label: 'Champion', icon: '👑' },
    gold: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', label: 'Gold', icon: '🥇' },
    silver: { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', label: 'Silver', icon: '🥈' },
    bronze: { color: '#cd7f32', glow: 'rgba(205, 127, 50, 0.4)', label: 'Bronze', icon: '🥉' },
    iron: { color: '#64748b', glow: 'rgba(100, 116, 139, 0.3)', label: 'Iron', icon: '⚔️' },
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
                <p style={{ fontWeight: 600 }}>Loading leaderboard data...</p>
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
        <div style={{ maxWidth: 650, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem 1rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span>🏆</span> Leaderboard
                </h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {tab === 'monthly' && "Who's putting in the work this month?"}
                    {tab === 'allTime' && "All-time workout log rankings across all history"}
                    {tab === 'history' && "Past monthly champions & workout records"}
                </p>

                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 14,
                    padding: 4,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    margin: '1.25rem auto 0.75rem',
                    maxWidth: 460,
                }}>
                    <button
                        onClick={() => { setTab('monthly'); setSearchQuery(''); }}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'monthly' ? 'var(--primary)' : 'transparent',
                            color: tab === 'monthly' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.2s ease',
                            boxShadow: tab === 'monthly' ? '0 2px 10px rgba(6, 182, 212, 0.3)' : 'none',
                        }}
                    >
                        <Calendar size={14} />
                        <span>This Month</span>
                    </button>

                    <button
                        onClick={() => { setTab('allTime'); setSearchQuery(''); }}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'allTime' ? 'var(--primary)' : 'transparent',
                            color: tab === 'allTime' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.2s ease',
                            boxShadow: tab === 'allTime' ? '0 2px 10px rgba(6, 182, 212, 0.3)' : 'none',
                        }}
                    >
                        <Award size={14} />
                        <span>All-Time</span>
                    </button>

                    <button
                        onClick={() => { setTab('history'); setSearchQuery(''); }}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            background: tab === 'history' ? 'var(--primary)' : 'transparent',
                            color: tab === 'history' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.2s ease',
                            boxShadow: tab === 'history' ? '0 2px 10px rgba(6, 182, 212, 0.3)' : 'none',
                        }}
                    >
                        <History size={14} />
                        <span>Past Champions</span>
                    </button>
                </div>

                {tab === 'monthly' && cycle && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginTop: '0.25rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: 20,
                        background: 'rgba(125, 135, 210, 0.1)',
                        border: '1px solid rgba(125, 135, 210, 0.2)',
                        fontSize: '0.75rem',
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
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: 20,
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        fontSize: '0.75rem',
                        color: '#fbbf24',
                        fontWeight: 600,
                    }}>
                        <Sparkles size={13} />
                        <span>{data.allTime.totalLogs.toLocaleString()} Total Lifetime Workouts Logged</span>
                    </div>
                )}
            </div>

            {(tab === 'monthly' || tab === 'allTime') && (
                <>
                    {currentAthlete && (
                        <div style={{
                            margin: '0 1rem 1rem',
                            padding: '1rem',
                            borderRadius: 16,
                            border: `1px solid ${TIER_CONFIG[currentAthlete.tier]?.color || 'var(--card-border)'}`,
                            background: `linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(0,0,0,0.3) 100%)`,
                            boxShadow: `0 0 20px ${TIER_CONFIG[currentAthlete.tier]?.glow || 'transparent'}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    fontSize: '2rem',
                                    width: 48,
                                    height: 48,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 12,
                                    background: 'rgba(125, 135, 210, 0.15)',
                                }}>
                                    {TIER_CONFIG[currentAthlete.tier]?.icon || '⚔️'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TIER_CONFIG[currentAthlete.tier]?.color }}>
                                        {tab === 'monthly' ? 'Your Monthly Rank' : 'Your All-Time Rank'}
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                                        #{currentAthlete.rank} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--secondary-foreground)' }}>of {activeEntries.length}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: TIER_CONFIG[currentAthlete.tier]?.color }}>
                                        {currentAthlete.totalLogs}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {tab === 'monthly' ? 'Month Logs' : 'All-Time Logs'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(125, 135, 210, 0.15)' }}>
                                <StatPill label="Completion" value={`${currentAthlete.completionRate}%`} />
                                <StatPill label="Streak" value={`${currentAthlete.currentStreak} ${getStreakEmoji(currentAthlete.currentStreak)}`} />
                                <StatPill label="Best Streak" value={`${currentAthlete.longestStreak}`} />
                            </div>
                        </div>
                    )}

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
                                        background: isCurrentUser ? 'rgba(125, 135, 210, 0.09)' : 'var(--card-bg)',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isCurrentUser ? `0 0 14px ${tierCfg.glow}` : 'none',
                                    }}
                                >
                                    <div style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: entry.rank <= 3 ? '1.25rem' : '0.85rem',
                                        background: entry.rank <= 3 ? `linear-gradient(135deg, ${tierCfg.color}25, ${tierCfg.color}10)` : 'rgba(100, 116, 139, 0.1)',
                                        color: entry.rank <= 3 ? tierCfg.color : 'var(--secondary-foreground)',
                                        flexShrink: 0,
                                    }}>
                                        {getRankBadge(entry.rank)}
                                    </div>

                                    <div style={{ flex: 1, marginLeft: '0.75rem', minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 700,
                                            fontSize: '0.925rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {entry.name}
                                            {isCurrentUser && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: '0.5rem' }}>(You)</span>}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', display: 'flex', gap: '0.5rem', marginTop: '2px', alignItems: 'center' }}>
                                            <span>{entry.completionRate}% complete</span>
                                            {entry.currentStreak > 0 && (
                                                <span>{getStreakEmoji(entry.currentStreak)} {entry.currentStreak} streak</span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: tierCfg.color }}>
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
                                        Winning workout counts and team participation across past months
                                    </p>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart data={historyData.chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="winnerGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
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
                                    <Tooltip content={<HistoryChartTooltip />} />
                                    <Bar dataKey="winnerLogs" name="Champion Logs" fill="url(#winnerGrad)" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="runnerUpLogs" name="Runner-Up Logs" fill="url(#runnerGrad)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: 8, fontSize: '0.72rem', color: 'var(--secondary-foreground)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fbbf24' }} /> 🥇 Champion Logs
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8' }} /> 🥈 Runner-Up Logs
                                </span>
                            </div>
                        </div>
                    )}

                    {historyData.hallOfFame && historyData.hallOfFame.length > 0 && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
                            borderRadius: 16,
                            border: '1px solid rgba(251, 191, 36, 0.25)',
                            padding: '16px',
                            marginBottom: '1.5rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <Trophy size={18} color="#fbbf24" />
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Hall of Fame (Most Monthly Titles)
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                {historyData.hallOfFame.map((hof) => (
                                    <div
                                        key={hof.athleteId}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.7)',
                                            border: '1px solid rgba(251, 191, 36, 0.2)',
                                            borderRadius: 12,
                                            padding: '10px 12px',
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {hof.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 800, marginTop: 2 }}>
                                            👑 {hof.titlesCount}x Champion
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {hof.monthsWon.join(', ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>📜</span> Month-by-Month Archive
                        </h3>

                        {historyData.pastMonths.map((m) => {
                            const isExpanded = !!expandedMonths[m.monthKey];
                            return (
                                <div
                                    key={m.monthKey}
                                    style={{
                                        background: 'var(--card-bg)',
                                        borderRadius: 14,
                                        border: '1px solid var(--card-border)',
                                        marginBottom: '0.75rem',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <div
                                        onClick={() => toggleMonthExpanded(m.monthKey)}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'rgba(255,255,255,0.02)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                                                {m.monthLabel}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                                {m.totalLogs} team logs · {m.activeAthletesCount} active lifters
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {m.winner && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    padding: '4px 10px',
                                                    borderRadius: 20,
                                                    background: 'rgba(251, 191, 36, 0.12)',
                                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                                    fontSize: '0.75rem',
                                                    color: '#fbbf24',
                                                    fontWeight: 700,
                                                }}>
                                                    <span>👑</span>
                                                    <span>{m.winner.name}</span>
                                                    <span style={{ opacity: 0.7 }}>({m.winner.totalLogs})</span>
                                                </div>
                                            )}

                                            <div style={{ color: 'var(--secondary-foreground)' }}>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '0.5rem',
                                        padding: '10px 16px',
                                        background: 'rgba(0,0,0,0.15)',
                                        borderTop: '1px solid rgba(255,255,255,0.04)',
                                        borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                                            <span>🥇</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {m.winner?.name || '—'}
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 800 }}>
                                                    {m.winner ? `${m.winner.totalLogs} logs` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                                            <span>🥈</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {m.runnerUp?.name || '—'}
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>
                                                    {m.runnerUp ? `${m.runnerUp.totalLogs} logs` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                                            <span>🥉</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {m.thirdPlace?.name || '—'}
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: '#cd7f32', fontWeight: 800 }}>
                                                    {m.thirdPlace ? `${m.thirdPlace.totalLogs} logs` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '8px 16px 12px' }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0' }}>
                                                Full Standings for {m.monthLabel}
                                            </div>
                                            {m.standings.map((s) => (
                                                <div
                                                    key={s.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '6px 0',
                                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                        fontSize: '0.8rem',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontWeight: 700, width: 24, color: s.rank <= 3 ? '#fbbf24' : 'var(--secondary-foreground)' }}>
                                                            #{s.rank}
                                                        </span>
                                                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                                                            {s.name}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontWeight: 800, color: s.rank <= 3 ? '#fbbf24' : 'var(--secondary-foreground)' }}>
                                                        {s.totalLogs} logs
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
    const heights = { 1: 125, 2: 100, 3: 84 };
    const tierCfg = TIER_CONFIG[entry.tier] || TIER_CONFIG.iron;
    const medals = { 1: '🏆', 2: '🥈', 3: '🥉' };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: position === 1 ? 115 : 95,
        }}>
            <div style={{ fontSize: position === 1 ? '1.85rem' : '1.35rem', marginBottom: '0.25rem' }}>
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
                border: `1px solid ${tierCfg.color}45`,
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
            }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: tierCfg.color }}>
                    {entry.totalLogs}
                </div>
                <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                    logs
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
    const [data, setData] = useState<LeaderboardEntry | null>(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchRank = useCallback(async () => {
        try {
            const res = await fetch(`/api/leaderboard?coachId=${coachId}`);
            if (res.ok) {
                const json = await res.json();
                const entries: LeaderboardEntry[] = json.monthly?.entries || json.entries || [];
                setTotal(entries.length);
                const me = entries.find(e => e.id === athleteId);
                if (me) setData(me);
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
            .channel('rank-widget-logs')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Log' }, () => fetchRank())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Athlete' }, () => fetchRank())
            .subscribe();

        const interval = setInterval(fetchRank, 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchRank]);

    if (loading || !data) {
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

    const tierCfg = TIER_CONFIG[data.tier] || TIER_CONFIG.iron;

    return (
        <div style={{
            borderRadius: 16,
            border: `1px solid ${tierCfg.color}50`,
            background: `linear-gradient(135deg, ${tierCfg.color}08, rgba(0,0,0,0.2))`,
            padding: '1rem',
            boxShadow: `0 0 15px ${tierCfg.glow}`,
            cursor: 'pointer',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        fontSize: '1.5rem',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        background: `${tierCfg.color}15`,
                    }}>
                        {tierCfg.icon}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: tierCfg.color }}>
                            Leaderboard
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                            Rank #{data.rank} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--secondary-foreground)' }}>/ {total}</span>
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: tierCfg.color }}>
                        {data.totalLogs} {getStreakEmoji(data.currentStreak)}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 600 }}>
                        logs filled
                    </div>
                </div>
            </div>
            {data.rank > 1 && (
                <div style={{
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: `1px solid ${tierCfg.color}20`,
                    fontSize: '0.75rem',
                    color: 'var(--secondary-foreground)',
                    textAlign: 'center',
                }}>
                    Keep logging to climb the ranks! 💪
                </div>
            )}
            {data.rank === 1 && (
                <div style={{
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: `1px solid ${tierCfg.color}20`,
                    fontSize: '0.75rem',
                    color: tierCfg.color,
                    textAlign: 'center',
                    fontWeight: 600,
                }}>
                    👑 You're the champion! Stay on top!
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface LeaderboardEntry {
    id: string;
    name: string;
    totalLogs: number;
    totalSessions: number;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    tier: string;
}

interface CycleInfo {
    start: string;
    end: string;
    daysRemaining: number;
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

export default function Leaderboard({
    coachId,
    currentAthleteId,
}: {
    coachId: string;
    currentAthleteId?: string;
}) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [cycle, setCycle] = useState<CycleInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await fetch(`/api/leaderboard?coachId=${coachId}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries);
                setCycle(data.cycle);
            }
        } catch (e) {
            console.error('Failed to fetch leaderboard:', e);
        } finally {
            setLoading(false);
        }
    }, [coachId]);

    useEffect(() => {
        fetchLeaderboard();

        // Real-time: listen for new Log inserts to auto-refresh
        const channel = supabase
            .channel('leaderboard-logs')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'Log' },
                () => {
                    fetchLeaderboard();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'Log' },
                () => {
                    fetchLeaderboard();
                }
            )
            .subscribe();

        // Polling fallback every 60 seconds (realtime handles instant updates)
        const interval = setInterval(fetchLeaderboard, 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchLeaderboard]);

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <div className="pulse" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏆</div>
                <p>Loading leaderboard...</p>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <p>No athletes on the board yet. Logs will appear as athletes complete workouts.</p>
            </div>
        );
    }

    const currentAthlete = currentAthleteId ? entries.find(e => e.id === currentAthleteId) : null;

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem 1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    🏆 Leaderboard
                </h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Who&apos;s putting in the work?
                </p>
                {cycle && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginTop: '0.5rem',
                        padding: '0.3rem 0.75rem',
                        borderRadius: 20,
                        background: 'rgba(125, 135, 210, 0.1)',
                        border: '1px solid rgba(125, 135, 210, 0.2)',
                        fontSize: '0.75rem',
                        color: 'var(--secondary-foreground)',
                    }}>
                        <span>Resets in <strong style={{ color: 'var(--foreground)' }}>{cycle.daysRemaining} day{cycle.daysRemaining !== 1 ? 's' : ''}</strong></span>
                    </div>
                )}
            </div>

            {/* Current athlete highlight card */}
            {currentAthlete && (
                <div style={{
                    margin: '0 1rem 1rem',
                    padding: '1rem',
                    borderRadius: 16,
                    border: `1px solid ${TIER_CONFIG[currentAthlete.tier]?.color || 'var(--card-border)'}`,
                    background: `linear-gradient(135deg, rgba(125, 135, 210, 0.1) 0%, rgba(0,0,0,0.2) 100%)`,
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
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TIER_CONFIG[currentAthlete.tier]?.color }}>
                                Your Rank
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                                #{currentAthlete.rank} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--secondary-foreground)' }}>of {entries.length}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{currentAthlete.totalLogs}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase' }}>Logs</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(125, 135, 210, 0.15)' }}>
                        <StatPill label="Completion" value={`${currentAthlete.completionRate}%`} />
                        <StatPill label="Streak" value={`${currentAthlete.currentStreak} ${getStreakEmoji(currentAthlete.currentStreak)}`} />
                        <StatPill label="Best Streak" value={`${currentAthlete.longestStreak}`} />
                    </div>
                </div>
            )}

            {/* Podium for top 3 */}
            {entries.length >= 3 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem 1rem',
                    marginBottom: '0.5rem',
                }}>
                    <PodiumCard entry={entries[1]} position={2} />
                    <PodiumCard entry={entries[0]} position={1} />
                    <PodiumCard entry={entries[2]} position={3} />
                </div>
            )}

            {/* Full list */}
            <div style={{ padding: '0 1rem 6rem' }}>
                {entries.map((entry) => {
                    const tierCfg = TIER_CONFIG[entry.tier] || TIER_CONFIG.iron;
                    const isCurrentUser = entry.id === currentAthleteId;
                    return (
                        <div
                            key={entry.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem',
                                borderRadius: 12,
                                marginBottom: '0.5rem',
                                border: isCurrentUser ? `1px solid ${tierCfg.color}` : '1px solid var(--card-border)',
                                background: isCurrentUser ? 'rgba(125, 135, 210, 0.08)' : 'var(--card-bg)',
                                transition: 'all 0.2s ease',
                                boxShadow: isCurrentUser ? `0 0 12px ${tierCfg.glow}` : 'none',
                            }}
                        >
                            {/* Rank */}
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: entry.rank <= 3 ? '1.2rem' : '0.85rem',
                                background: entry.rank <= 3 ? `linear-gradient(135deg, ${tierCfg.color}22, ${tierCfg.color}11)` : 'rgba(100, 116, 139, 0.1)',
                                color: entry.rank <= 3 ? tierCfg.color : 'var(--secondary-foreground)',
                                flexShrink: 0,
                            }}>
                                {getRankBadge(entry.rank)}
                            </div>

                            {/* Name + streak */}
                            <div style={{ flex: 1, marginLeft: '0.75rem', minWidth: 0 }}>
                                <div style={{
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {entry.name}
                                    {isCurrentUser && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: '0.5rem' }}>(You)</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                                    <span>{entry.completionRate}% complete</span>
                                    {entry.currentStreak > 0 && (
                                        <span>{getStreakEmoji(entry.currentStreak)} {entry.currentStreak} streak</span>
                                    )}
                                </div>
                            </div>

                            {/* Log count */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: tierCfg.color }}>
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
        </div>
    );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
    const heights = { 1: 120, 2: 96, 3: 80 };
    const tierCfg = TIER_CONFIG[entry.tier] || TIER_CONFIG.iron;
    const medals = { 1: '🏆', 2: '🥈', 3: '🥉' };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: position === 1 ? 110 : 90,
        }}>
            <div style={{ fontSize: position === 1 ? '1.75rem' : '1.25rem', marginBottom: '0.25rem' }}>
                {medals[position as 1 | 2 | 3]}
            </div>
            <div style={{
                fontSize: '0.75rem',
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
                borderRadius: '12px 12px 0 0',
                background: `linear-gradient(to top, ${tierCfg.color}15, ${tierCfg.color}30)`,
                border: `1px solid ${tierCfg.color}40`,
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
            }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tierCfg.color }}>
                    {entry.totalLogs}
                </div>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                    logs
                </div>
            </div>
        </div>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--secondary-foreground)', fontWeight: 600 }}>{label}</div>
        </div>
    );
}

/** Compact widget for athlete dashboard showing their rank */
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
                const entries: LeaderboardEntry[] = json.entries;
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
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ width: 50, height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginLeft: 'auto', marginBottom: 4 }} />
                        <div style={{ width: 60, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginLeft: 'auto' }} />
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
                    👑 You&apos;re the champion! Stay on top!
                </div>
            )}
        </div>
    );
}

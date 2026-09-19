'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    LeaderboardEntry,
    CycleInfo,
    LeaderboardResponse,
    TIER_CONFIG,
    getStreakEmoji
} from './tier-config';

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

    if (loading) {
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

    if (!activeData) {
        return null;
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

export default LeaderboardRankWidget;

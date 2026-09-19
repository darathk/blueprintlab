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
            className="chat-press"
            style={{
                borderRadius: 20,
                border: `1px solid ${tierCfg.color}45`,
                background: `linear-gradient(135deg, ${tierCfg.color}14 0%, rgba(18, 22, 34, 0.95) 100%)`,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '1.15rem 1.25rem',
                boxShadow: `0 12px 32px -6px rgba(0, 0, 0, 0.5), 0 0 24px ${tierCfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
                cursor: 'pointer',
                transition: 'all 0.2s var(--ease-out)',
            }}
        >
            {/* Widget Top Header with Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: tierCfg.color, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.95rem' }}>🏆</span>
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
                        background: 'rgba(0, 0, 0, 0.45)',
                        borderRadius: 20,
                        padding: 3,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
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
                            padding: '4px 11px',
                            borderRadius: 16,
                            border: 'none',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: mode === 'monthly' ? tierCfg.color : 'transparent',
                            color: mode === 'monthly' ? '#000000' : 'var(--secondary-foreground)',
                            boxShadow: mode === 'monthly' ? `0 2px 8px ${tierCfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.25)` : 'none',
                            transition: 'all 0.16s var(--ease-out)',
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
                            padding: '4px 11px',
                            borderRadius: 16,
                            border: 'none',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: mode === 'allTime' ? tierCfg.color : 'transparent',
                            color: mode === 'allTime' ? '#000000' : 'var(--secondary-foreground)',
                            boxShadow: mode === 'allTime' ? `0 2px 8px ${tierCfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.25)` : 'none',
                            transition: 'all 0.16s var(--ease-out)',
                        }}
                    >
                        All-Time
                    </button>
                </div>
            </div>

            {/* Main Rank & Logs Stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                        fontSize: '1.65rem',
                        width: 46,
                        height: 46,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 14,
                        background: `${tierCfg.color}22`,
                        border: `1px solid ${tierCfg.color}50`,
                        boxShadow: `0 4px 12px ${tierCfg.glow}`,
                        flexShrink: 0,
                    }}>
                        {tierCfg.icon}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: tierCfg.color,
                                padding: '2px 6px',
                                borderRadius: 6,
                                background: tierCfg.badgeBg,
                                border: `1px solid ${tierCfg.color}40`,
                            }}>
                                {tierCfg.label}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                {mode === 'monthly' ? (
                                    <>Month{cycle ? ` · Resets in ${cycle.daysRemaining}d` : ''}</>
                                ) : (
                                    <>Lifetime</>
                                )}
                            </span>
                        </div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, marginTop: 3 }}>
                            #{activeData.rank} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--secondary-foreground)' }}>of {activeTotal}</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tierCfg.color }}>
                        {activeData.totalLogs} {getStreakEmoji(activeData.currentStreak)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {mode === 'monthly' ? 'monthly logs' : 'lifetime logs'}
                    </div>
                </div>
            </div>

            {/* Sub-stats summary */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.85rem',
                paddingTop: '0.7rem',
                borderTop: `1px solid ${tierCfg.color}25`,
                fontSize: '0.74rem',
                color: 'var(--secondary-foreground)',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', gap: '0.85rem' }}>
                    <span>🎯 <strong style={{ color: '#f8fafc' }}>{activeData.completionRate}%</strong></span>
                    {activeData.currentStreak > 0 && (
                        <span>🔥 <strong style={{ color: '#f8fafc' }}>{activeData.currentStreak}</strong> streak</span>
                    )}
                </div>

                <span style={{ fontSize: '0.7rem', color: tierCfg.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    View Standings →
                </span>
            </div>
        </div>
    );
}

export default LeaderboardRankWidget;

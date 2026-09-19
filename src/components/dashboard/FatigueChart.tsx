'use client';

import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface ReadinessLog {
    id: string;
    date: string;
    scores: any;
    createdAt?: string;
}

interface Props {
    readinessLogs: ReadinessLog[];
}

const METRICS = [
    { key: 'leg_soreness', label: 'Legs', short: 'Legs', color: '#7d87d2' },
    { key: 'push_soreness', label: 'Push', short: 'Push', color: '#a855f7' },
    { key: 'pull_soreness', label: 'Pull', short: 'Pull', color: '#ec4899' },
    { key: 'tiredness', label: 'Energy', short: 'Energy', color: '#f59e0b' },
    { key: 'recovery', label: 'Recovery', short: 'Recv', color: '#10b981' },
    { key: 'motivation', label: 'Motivation', short: 'Drive', color: '#06b6d4' },
    { key: 'training_load', label: 'Load', short: 'Load', color: '#f97316' },
];

const TIMELINES: Record<string, number> = { '1W': 7, '2W': 14, '1M': 30, '3M': 90, 'ALL': Infinity };

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-panel-elevated" style={{ padding: '10px 14px', fontSize: 12, maxWidth: 220, borderRadius: 10, animation: 'popoverIn 140ms var(--ease-out)' }}>
            <p style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>{label}</p>
            {payload.filter((p: any) => p.value > 0).map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{p.name}</span>
                    <strong>{p.value.toFixed(1)}</strong>
                </p>
            ))}
        </div>
    );
};

export default function FatigueChart({ readinessLogs }: Props) {
    const [timeline, setTimeline] = useState<string>('1M');
    const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
        Object.fromEntries(METRICS.map(m => [m.key, true]))
    );
    const [showRadar, setShowRadar] = useState(false);

    const filteredData = useMemo(() => {
        if (!readinessLogs?.length) return [];

        let logs = [...readinessLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const days = TIMELINES[timeline];
        if (days !== Infinity) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            logs = logs.filter(l => new Date(l.date) >= cutoff);
        }

        return logs.map((l, idx) => {
            const scores = l.scores || {};
            const sessionKey = scores._sessionKey || '';
            const d = new Date(l.date);
            // Build label: date + session indicator for multiple per day
            const dateLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return {
                date: dateLabel,
                rawDate: l.date,
                sessionKey,
                ...Object.fromEntries(METRICS.map(m => [m.key, scores[m.key] || 0])),
                avg: METRICS.reduce((sum, m) => sum + (scores[m.key] || 0), 0) / METRICS.length,
            };
        });
    }, [readinessLogs, timeline]);

    // Latest entry for radar
    const latestScores = useMemo(() => {
        if (!filteredData.length) return null;
        const latest = filteredData[filteredData.length - 1];
        return METRICS.map(m => ({
            metric: m.label,
            value: (latest as any)[m.key] || 0,
            fullMark: 5,
        }));
    }, [filteredData]);

    // Stats
    const stats = useMemo(() => {
        if (!filteredData.length) return null;
        const latest = filteredData[filteredData.length - 1];
        const avg = filteredData.reduce((sum, d) => sum + d.avg, 0) / filteredData.length;
        const trend = filteredData.length >= 2
            ? filteredData[filteredData.length - 1].avg - filteredData[filteredData.length - 2].avg
            : 0;
        return { latestAvg: latest.avg, periodAvg: avg, trend, entries: filteredData.length };
    }, [filteredData]);

    const toggleMetric = (key: string) => setActiveMetrics(prev => ({ ...prev, [key]: !prev[key] }));

    if (!readinessLogs?.length) {
        return (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--secondary-foreground)', fontSize: 14, border: '1px dashed var(--glass-border)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: 5, color: 'var(--foreground)' }}>No readiness data yet</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Athlete readiness check-ins will appear here once submitted.</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats Summary */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                    {[
                        {
                            label: 'Latest Readiness',
                            value: stats.latestAvg.toFixed(1),
                            sub: '/ 5',
                            color: stats.latestAvg <= 2 ? '#10b981' : stats.latestAvg <= 3 ? '#fbbf24' : '#ef4444',
                        },
                        {
                            label: `${timeline} Average`,
                            value: stats.periodAvg.toFixed(1),
                            sub: '/ 5',
                            color: stats.periodAvg <= 2 ? '#10b981' : stats.periodAvg <= 3 ? '#fbbf24' : '#ef4444',
                        },
                        {
                            label: 'Trend',
                            value: `${stats.trend >= 0 ? '+' : ''}${stats.trend.toFixed(1)}`,
                            sub: 'vs prev',
                            color: stats.trend < 0 ? '#10b981' : stats.trend > 0 ? '#ef4444' : '#fbbf24',
                        },
                        {
                            label: 'Check-Ins',
                            value: stats.entries.toString(),
                            sub: 'sessions',
                            color: '#7d87d2',
                        },
                    ].map(s => (
                        <div
                            key={s.label}
                            className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl"
                            style={{
                                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.55) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderTop: `3px solid ${s.color}`,
                                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
                            }}
                        >
                            <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                                <span className="text-lg sm:text-2xl font-black leading-tight" style={{ color: s.color }}>{s.value}</span>
                                <span style={{ fontSize: 10, color: 'var(--secondary-foreground)', fontWeight: 500 }}>{s.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart Container */}
            <div className="rounded-xl sm:rounded-2xl border border-white/10 p-2 sm:p-4" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
                {/* Controls */}
                <div className="flex justify-between flex-wrap gap-2 px-1 sm:px-3 mb-3 items-center">
                    {/* View toggle */}
                    <div style={{ display: 'flex', background: 'var(--glass-surface-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)' }}>
                        <button onClick={() => setShowRadar(false)} className="chat-press" style={{
                            padding: '3px 12px', borderRadius: '16px', border: !showRadar ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            background: !showRadar ? 'rgba(125, 135, 210, 0.2)' : 'transparent', color: !showRadar ? '#fff' : 'var(--secondary-foreground)',
                            transition: 'all 0.16s var(--ease-out)'
                        }}>Trend</button>
                        <button onClick={() => setShowRadar(true)} className="chat-press" style={{
                            padding: '3px 12px', borderRadius: '16px', border: showRadar ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            background: showRadar ? 'rgba(125, 135, 210, 0.2)' : 'transparent', color: showRadar ? '#fff' : 'var(--secondary-foreground)',
                            transition: 'all 0.16s var(--ease-out)'
                        }}>Radar</button>
                    </div>

                    {/* Timeline */}
                    <div style={{ display: 'flex', background: 'var(--glass-surface-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)' }}>
                        {Object.keys(TIMELINES).map(tl => (
                            <button key={tl} onClick={() => setTimeline(tl)} className="chat-press" style={{
                                padding: '3px 8px', background: timeline === tl ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                                color: timeline === tl ? '#fff' : 'var(--foreground)', border: timeline === tl ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent', cursor: 'pointer',
                                fontSize: 10, fontWeight: 700, borderRadius: '16px', transition: 'all 0.16s var(--ease-out)',
                                boxShadow: timeline === tl ? '0 0 10px rgba(125,135,210,0.25)' : 'none',
                            }}>{tl}</button>
                        ))}
                    </div>
                </div>

                {/* Metric toggles */}
                {!showRadar && (
                    <div className="flex gap-1.5 flex-wrap px-1 sm:px-3 mb-3">
                        {METRICS.map(m => (
                            <button key={m.key} onClick={() => toggleMetric(m.key)} style={{
                                padding: '3px 8px', borderRadius: 6, border: `1px solid ${m.color}`,
                                background: activeMetrics[m.key] ? `${m.color}22` : 'transparent',
                                color: activeMetrics[m.key] ? m.color : 'rgba(255,255,255,0.3)',
                                fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                            }}>{m.label}</button>
                        ))}
                    </div>
                )}

                {/* Trend Chart */}
                {!showRadar ? (
                    <div className="h-[220px] sm:h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                                <defs>
                                    {METRICS.map(m => (
                                        <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} height={26} />
                                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={26} />
                                <Tooltip content={<CustomTooltip />} />
                                {METRICS.map(m => activeMetrics[m.key] && (
                                    <Area
                                        key={m.key}
                                        type="monotone"
                                        dataKey={m.key}
                                        name={m.label}
                                        stroke={m.color}
                                        strokeWidth={2}
                                        fill={`url(#grad-${m.key})`}
                                        dot={{ r: 3, fill: m.color }}
                                        activeDot={{ r: 5 }}
                                        connectNulls
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    /* Radar Chart */
                    latestScores && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className="h-[240px] sm:h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={latestScores} cx="50%" cy="50%" outerRadius="75%">
                                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 9 }} />
                                        <Radar
                                            name="Readiness"
                                            dataKey="value"
                                            stroke="#7d87d2"
                                            strokeWidth={2}
                                            fill="#7d87d2"
                                            fillOpacity={0.25}
                                            dot={{ r: 3, fill: '#7d87d2' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginTop: -8 }}>
                                Latest check-in: {filteredData[filteredData.length - 1]?.date}
                            </div>
                        </div>
                    )
                )}

                <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 6 }}>
                    {filteredData.length} check-in{filteredData.length !== 1 ? 's' : ''} shown
                </div>
            </div>
        </div>
    );
}

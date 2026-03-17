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
        <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, maxWidth: 220 }}>
            <p style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>{label}</p>
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
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--secondary-foreground)', fontSize: 14, background: 'rgba(15,23,42,0.3)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: 5 }}>No readiness data yet</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Athlete readiness check-ins will appear here once submitted.</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats Summary */}
            {stats && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                        <div key={s.label} style={{ flex: '1 1 110px', background: 'rgba(15,23,42,0.5)', border: `1px solid ${s.color}33`, borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
                                <span style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>{s.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart Container */}
            <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 8px 8px' }}>
                {/* Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingLeft: 12, paddingRight: 12, marginBottom: 12, alignItems: 'center' }}>
                    {/* View toggle */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowRadar(false)} style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: !showRadar ? 'var(--primary)' : 'rgba(255,255,255,0.07)', color: !showRadar ? '#fff' : 'var(--secondary-foreground)',
                        }}>Trend</button>
                        <button onClick={() => setShowRadar(true)} style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: showRadar ? 'var(--primary)' : 'rgba(255,255,255,0.07)', color: showRadar ? '#fff' : 'var(--secondary-foreground)',
                        }}>Radar</button>
                    </div>

                    {/* Timeline */}
                    <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: 8, padding: 4, border: '1px solid var(--card-border)' }}>
                        {Object.keys(TIMELINES).map(tl => (
                            <button key={tl} onClick={() => setTimeline(tl)} style={{
                                padding: '4px 10px', background: timeline === tl ? 'var(--primary)' : 'transparent',
                                color: timeline === tl ? '#fff' : 'var(--foreground)', border: 'none', cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, borderRadius: 6, transition: 'all 0.2s',
                                boxShadow: timeline === tl ? '0 0 10px rgba(125,135,210,0.3)' : 'none',
                            }}>{tl}</button>
                        ))}
                    </div>
                </div>

                {/* Metric toggles */}
                {!showRadar && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingLeft: 12, paddingRight: 12, marginBottom: 12 }}>
                        {METRICS.map(m => (
                            <button key={m.key} onClick={() => toggleMetric(m.key)} style={{
                                padding: '3px 10px', borderRadius: 6, border: `1px solid ${m.color}`,
                                background: activeMetrics[m.key] ? `${m.color}22` : 'transparent',
                                color: activeMetrics[m.key] ? m.color : 'rgba(255,255,255,0.3)',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            }}>{m.label}</button>
                        ))}
                    </div>
                )}

                {/* Trend Chart */}
                {!showRadar ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={filteredData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                {METRICS.map(m => (
                                    <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} height={35} />
                            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
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
                ) : (
                    /* Radar Chart */
                    latestScores && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={latestScores} cx="50%" cy="50%" outerRadius="75%">
                                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <Radar
                                        name="Readiness"
                                        dataKey="value"
                                        stroke="#7d87d2"
                                        strokeWidth={2}
                                        fill="#7d87d2"
                                        fillOpacity={0.25}
                                        dot={{ r: 4, fill: '#7d87d2' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
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

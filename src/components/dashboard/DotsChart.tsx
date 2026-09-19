'use client';

import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { getCompetitionDataPoints, CompetitionDataPoint, calculateDots, lbsToKg } from '@/lib/dots';

// Weight classes (kg) — male & female per Federation
const FEDERATIONS = {
    IPF: {
        male: [59, 66, 74, 83, 93, 105, 120, 'Open'],
        female: [47, 52, 57, 63, 69, 76, 84, 'Open'],
    },
    USAPL: {
        male: [52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140, 'Open'],
        female: [44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 'Open'],
    }
};

const TIMELINES: Record<string, number> = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    'ALL': Infinity,
};

interface Props {
    athleteId: string;
    logs: any[];
    programs?: any[];
    initialGender?: string | null;
    initialWeightClass?: number | null;
    initialFederation?: string | null;
}

const CHART_COLORS = {
    squat: '#7d87d2',
    bench: '#a855f7',
    deadlift: '#10b981',
    totalLbs: '#f97316',
    dots: '#f59e0b',
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const validPayload = payload.filter((p: any) => p.value != null && p.value > 0);
    if (!validPayload.length) return null;
    const session = payload[0]?.payload?.session;
    return (
        <div className="glass-panel-elevated" style={{ padding: '10px 14px', fontSize: 12, borderRadius: 10, animation: 'popoverIn 140ms var(--ease-out)' }}>
            <p style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 2 }}>{label}</p>
            {session && <p style={{ color: 'var(--secondary-foreground)', margin: '0 0 6px', fontSize: 11 }}>{session}</p>}
            {validPayload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
                    {p.name}: <strong>{p.value > 0 ? p.value : '—'}{p.dataKey === 'dots' ? '' : ' lbs'}</strong>
                </p>
            ))}
        </div>
    );
};

export default function DotsChart({ athleteId, logs, programs = [], initialGender, initialWeightClass, initialFederation }: Props) {
    const [gender, setGender] = useState<string>(initialGender ?? '');
    const [fed, setFed] = useState<'IPF' | 'USAPL'>((initialFederation as 'IPF' | 'USAPL') ?? 'IPF');
    const [weightClass, setWeightClass] = useState<string>(initialWeightClass?.toString() ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [timeline, setTimeline] = useState<string>('ALL');
    const [selectedProgramId, setSelectedProgramId] = useState<string>('ALL');
    const [activeLines, setActiveLines] = useState({ squat: true, bench: true, deadlift: true, totalLbs: true, dots: true });

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/athletes/${athleteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gender: gender || null,
                weightClass: weightClass ? parseFloat(weightClass) : null,
                federation: fed,
            }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const wc = parseFloat(weightClass) || 0;
    const genderKey = (gender === 'male' || gender === 'female') ? gender : null;
    const classes = gender && FEDERATIONS[fed][gender as 'male' | 'female'] ? FEDERATIONS[fed][gender as 'male' | 'female'] : [];

    // Filter logs by selected timeline and program before computing data points
    const filteredLogs = useMemo(() => {
        if (!logs?.length) return [];
        let result = logs;

        // Apply program filter if not 'ALL'
        if (selectedProgramId !== 'ALL') {
            result = result.filter(l => l.programId === selectedProgramId);
        }

        const days = TIMELINES[timeline];
        if (days !== Infinity) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            result = result.filter(l => l.date && new Date(l.date) >= cutoff);
        }

        return result;
    }, [logs, timeline, selectedProgramId]);

    // Compute data points — one per unique session (sessionId) with a competition lift.
    // Programs are passed so each point uses the scheduled date (program start + wN_dN offset)
    // rather than the logged date, keeping x-axis positions correct even for late-logged sessions.
    const data: CompetitionDataPoint[] = useMemo(
        () => getCompetitionDataPoints(filteredLogs, wc, genderKey, programs),
        [filteredLogs, wc, genderKey, programs]
    );

    // Compute an unfiltered set across ALL logs for the stat cards.
    // This ensures "Latest DOTs", "Latest Squat E1RM", etc. always reflect
    // the true most-recent E1RM for each lift, regardless of timeline/program filter.
    const allData: CompetitionDataPoint[] = useMemo(
        () => getCompetitionDataPoints(logs ?? [], wc, genderKey, programs),
        [logs, wc, genderKey, programs]
    );

    // Walk backwards through ALL data to find the most-recently logged value per lift.
    const latestLiftAll = (key: 'squat' | 'bench' | 'deadlift' | 'totalLbs') => {
        for (let i = allData.length - 1; i >= 0; i--) {
            const val = allData[i][key];
            if (val != null && val > 0) return val;
        }
        return 0;
    };

    // Walk forward through ALL data to find the first-ever logged value per lift.
    // Used as the baseline for the "% change since first session" delta shown on each stat card.
    const firstLiftAll = (key: 'squat' | 'bench' | 'deadlift' | 'totalLbs') => {
        for (let i = 0; i < allData.length; i++) {
            const val = allData[i][key];
            if (val != null && val > 0) return val;
        }
        return 0;
    };

    // Walk backwards through FILTERED data for the chart's own latest total
    // (kept separate so the chart still respects the active timeline filter).
    const latestLift = (key: 'squat' | 'bench' | 'deadlift' | 'totalLbs') => {
        for (let i = data.length - 1; i >= 0; i--) {
            const val = data[i][key];
            if (val != null && val > 0) return val;
        }
        return 0;
    };

    // Compute Latest DOTs from the globally-latest E1RM of each lift independently.
    // Converting each lift separately before summing avoids rounding error from
    // converting a rounded lbs-total to kg.
    const latestDots = useMemo(() => {
        if (!genderKey || wc <= 0) return 0;
        const sqLbs  = latestLiftAll('squat');
        const bnLbs  = latestLiftAll('bench');
        const dlLbs  = latestLiftAll('deadlift');
        const totalKg = lbsToKg(sqLbs) + lbsToKg(bnLbs) + lbsToKg(dlLbs);
        if (totalKg <= 0) return 0;
        return calculateDots(totalKg, wc, genderKey);
    }, [genderKey, wc, allData]);

    // Symmetric "first DOTs" — computed from each lift's earliest logged value so the
    // % change card reflects total progression since training began.
    const firstDots = useMemo(() => {
        if (!genderKey || wc <= 0) return 0;
        const sqLbs = firstLiftAll('squat');
        const bnLbs = firstLiftAll('bench');
        const dlLbs = firstLiftAll('deadlift');
        const totalKg = lbsToKg(sqLbs) + lbsToKg(bnLbs) + lbsToKg(dlLbs);
        if (totalKg <= 0) return 0;
        return calculateDots(totalKg, wc, genderKey);
    }, [genderKey, wc, allData]);

    // Percentage change helper — returns null when we don't have a valid baseline yet.
    const pctChange = (first: number, last: number): number | null => {
        if (first <= 0 || last <= 0) return null;
        return ((last - first) / first) * 100;
    };

    const toggleLine = (key: keyof typeof activeLines) =>
        setActiveLines(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Profile Assignment Panel */}
            <div className="p-3.5 sm:p-5 rounded-xl border border-white/10" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Athlete DOTs Profile
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    {/* Gender */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {['male', 'female'].map(g => (
                                <button key={g} onClick={() => { setGender(g); setWeightClass(''); }} style={{
                                    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                    background: gender === g ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                                    color: gender === g ? '#fff' : 'var(--secondary-foreground)', transition: 'all 0.15s',
                                }}>
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Federation Input */}
                    {gender && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federation</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {['IPF', 'USAPL'].map(f => (
                                    <button key={f} onClick={() => { setFed(f as any); setWeightClass(''); }} style={{
                                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                        background: fed === f ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                                        color: fed === f ? '#fff' : 'var(--secondary-foreground)', transition: 'all 0.15s',
                                    }}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weight Class */}
                    {gender && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight Class (kg)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {classes.map(c => {
                                    const val = c === 'Open' ? '140' : c.toString();
                                    return (
                                        <button key={c} onClick={() => setWeightClass(val)} style={{
                                            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                            background: weightClass === val ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                                            color: weightClass === val ? '#fff' : 'var(--secondary-foreground)', transition: 'all 0.15s',
                                        }}>
                                            {c === 'Open' ? 'Open (140)' : `${c}kg`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Save */}
                    <button onClick={handleSave} disabled={saving || !gender || !weightClass} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: gender && weightClass ? 'pointer' : 'not-allowed',
                        fontSize: 13, fontWeight: 700, background: saved ? 'var(--success)' : 'linear-gradient(135deg, #7d87d2, #a855f7)',
                        color: '#fff', opacity: (!gender || !weightClass) ? 0.4 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap',
                    }}>
                        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Profile'}
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            {allData.length > 0 && (() => {
                const squatLatest = latestLiftAll('squat');
                const benchLatest = latestLiftAll('bench');
                const deadliftLatest = latestLiftAll('deadlift');
                const squatFirst = firstLiftAll('squat');
                const benchFirst = firstLiftAll('bench');
                const deadliftFirst = firstLiftAll('deadlift');
                const totalLatest = squatLatest + benchLatest + deadliftLatest;
                const totalFirst = squatFirst + benchFirst + deadliftFirst;

                const cards = [
                    { label: 'Latest DOTs', value: latestDots > 0 ? latestDots.toFixed(1) : '—', color: CHART_COLORS.dots, pct: pctChange(firstDots, latestDots) },
                    { label: 'Total E1RM', value: totalLatest > 0 ? `${Math.round(totalLatest)} lbs` : '—', color: CHART_COLORS.totalLbs, pct: pctChange(totalFirst, totalLatest) },
                    { label: 'Latest Squat E1RM', value: squatLatest > 0 ? `${squatLatest} lbs` : '—', color: CHART_COLORS.squat, pct: pctChange(squatFirst, squatLatest) },
                    { label: 'Latest Bench E1RM', value: benchLatest > 0 ? `${benchLatest} lbs` : '—', color: CHART_COLORS.bench, pct: pctChange(benchFirst, benchLatest) },
                    { label: 'Latest Deadlift E1RM', value: deadliftLatest > 0 ? `${deadliftLatest} lbs` : '—', color: CHART_COLORS.deadlift, pct: pctChange(deadliftFirst, deadliftLatest) },
                ];

                return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 mb-4 sm:mb-5">
                        {cards.map(s => {
                            const pctColor = s.pct == null ? 'var(--secondary-foreground)'
                                : s.pct > 0 ? '#10b981'
                                : s.pct < 0 ? '#ef4444'
                                : 'var(--secondary-foreground)';
                            const arrow = s.pct == null ? '' : s.pct > 0 ? '↑' : s.pct < 0 ? '↓' : '→';
                            return (
                                <div
                                    key={s.label}
                                    className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col justify-between"
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.55) 100%)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderTop: `3px solid ${s.color}`,
                                        boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                                    <div className="text-lg sm:text-2xl font-black mt-1 leading-tight" style={{ color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: pctColor, marginTop: 4, minHeight: 14 }}>
                                        {s.pct == null ? '' : `${arrow} ${Math.abs(s.pct).toFixed(1)}%`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Chart Area */}
            <div className="rounded-xl sm:rounded-2xl border border-white/10 p-2 sm:p-4" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
                {/* Controls Row 1: Mission Filter and Timeline */}
                <div className="flex flex-col sm:flex-row justify-between mb-3 sm:mb-5 flex-wrap gap-2.5 sm:gap-4 items-start sm:items-center px-1 sm:px-2">
                    {/* Program Filter */}
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <label className="text-[11px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold shrink-0">Mission:</label>
                        <div className="relative flex-1 sm:flex-initial">
                            <select
                                className="glass-input w-full sm:w-auto text-xs sm:text-sm py-1.5 pl-3 pr-7 text-indigo-400 font-semibold"
                                style={{ appearance: 'none' }}
                                value={selectedProgramId}
                                onChange={(e) => setSelectedProgramId(e.target.value)}
                            >
                                <option value="ALL">All Missions</option>
                                {Array.isArray(programs) && [...programs].sort((a, b) => {
                                    const dateA = new Date(a.startDate || a.createdAt || 0).getTime();
                                    const dateB = new Date(b.startDate || b.createdAt || 0).getTime();
                                    return dateB - dateA;
                                }).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary)', fontSize: '0.75rem' }}>▼</div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex flex-wrap self-start sm:self-auto bg-white/[0.04] p-0.5 rounded-full border border-white/10">
                        {Object.keys(TIMELINES).map(tl => (
                            <button
                                key={tl}
                                onClick={() => setTimeline(tl)}
                                className="chat-press px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-full transition-all"
                                style={{
                                    background: timeline === tl ? 'rgba(125, 135, 210, 0.25)' : 'transparent',
                                    color: timeline === tl ? '#fff' : 'var(--secondary-foreground)',
                                    border: timeline === tl ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                    boxShadow: timeline === tl ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                                }}
                            >
                                {tl}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Controls Row 2: Line toggles */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 px-1 sm:px-2 mb-3">
                    {[
                        { key: 'squat', label: 'Squat' },
                        { key: 'bench', label: 'Bench' },
                        { key: 'deadlift', label: 'Deadlift' },
                        { key: 'totalLbs', label: 'Total E1RM' },
                        { key: 'dots', label: 'DOTs' },
                    ].map(({ key, label }) => {
                        const k = key as keyof typeof activeLines;
                        const color = CHART_COLORS[k];
                        return (
                            <button key={key} onClick={() => toggleLine(k)} style={{
                                padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}`,
                                background: activeLines[k] ? `${color}22` : 'transparent',
                                color: activeLines[k] ? color : 'rgba(255,255,255,0.3)',
                                fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                {data.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--secondary-foreground)', fontSize: 14, background: 'rgba(15,23,42,0.3)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)', margin: '0 12px 12px' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🏋️</div>
                        <div style={{ fontWeight: 600, marginBottom: 5 }}>No competition lift data {timeline !== 'ALL' ? `in the last ${timeline}` : 'yet'}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Sessions with <strong>Squat</strong>, <strong>Competition Bench</strong>, or <strong>Deadlift</strong> logged with weight &amp; reps will appear here.</div>
                    </div>
                ) : (
                    <>
                        <div className="h-[240px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
                                    <defs>
                                        {Object.entries(CHART_COLORS).map(([key, color]) => (
                                            <linearGradient key={key} id={`dots-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} height={26} />
                                    <YAxis yAxisId="lbs" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
                                    <YAxis yAxisId="total" hide={true} domain={['auto', 'auto']} />
                                    <YAxis yAxisId="dots" orientation="right" domain={['auto', 'auto']} tick={{ fill: CHART_COLORS.dots, fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                                    <Tooltip content={<CustomTooltip />} />
                                    {activeLines.squat && <Area yAxisId="lbs" type="monotone" dataKey="squat" name="Squat E1RM" stroke={CHART_COLORS.squat} strokeWidth={2} fill={`url(#dots-grad-squat)`} dot={{ r: 3, fill: CHART_COLORS.squat }} activeDot={{ r: 5 }} connectNulls />}
                                    {activeLines.bench && <Area yAxisId="lbs" type="monotone" dataKey="bench" name="Bench E1RM" stroke={CHART_COLORS.bench} strokeWidth={2} fill={`url(#dots-grad-bench)`} dot={{ r: 3, fill: CHART_COLORS.bench }} activeDot={{ r: 5 }} connectNulls />}
                                    {activeLines.deadlift && <Area yAxisId="lbs" type="monotone" dataKey="deadlift" name="Deadlift E1RM" stroke={CHART_COLORS.deadlift} strokeWidth={2} fill={`url(#dots-grad-deadlift)`} dot={{ r: 3, fill: CHART_COLORS.deadlift }} activeDot={{ r: 5 }} connectNulls />}
                                    {activeLines.totalLbs && <Area yAxisId="total" type="monotone" dataKey="totalLbs" name="Total E1RM" stroke={CHART_COLORS.totalLbs} strokeWidth={2.5} fill={`url(#dots-grad-totalLbs)`} dot={{ r: 3, fill: CHART_COLORS.totalLbs }} activeDot={{ r: 5 }} connectNulls />}
                                    {activeLines.dots && genderKey && wc > 0 && (
                                        <Area yAxisId="dots" type="monotone" dataKey="dots" name="DOTs Score" stroke={CHART_COLORS.dots} strokeWidth={2.5} fill={`url(#dots-grad-dots)`} dot={{ r: 3, fill: CHART_COLORS.dots }} activeDot={{ r: 5 }} connectNulls />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>
                            Each dot = a logged session · {data.length} session{data.length !== 1 ? 's' : ''} shown
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

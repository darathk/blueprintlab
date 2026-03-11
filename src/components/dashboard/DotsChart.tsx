'use client';

import { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { getCompetitionDataPoints, CompetitionDataPoint } from '@/lib/dots';

// IPF weight classes (kg) — male & female
const WEIGHT_CLASSES = {
    male: [59, 66, 74, 83, 93, 105, 120, 'Open'],
    female: [47, 52, 57, 63, 69, 76, 84, 'Open'],
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
    initialGender?: string | null;
    initialWeightClass?: number | null;
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
    const validPayload = payload.filter((p: any) => p.value > 0);
    if (!validPayload.length) return null;
    return (
        <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
            <p style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>{label}</p>
            {validPayload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
                    {p.name}: <strong>{p.value > 0 ? p.value : '—'}{p.dataKey === 'dots' ? '' : ' lbs'}</strong>
                </p>
            ))}
        </div>
    );
};

export default function DotsChart({ athleteId, logs, initialGender, initialWeightClass }: Props) {
    const [gender, setGender] = useState<string>(initialGender ?? '');
    const [weightClass, setWeightClass] = useState<string>(initialWeightClass?.toString() ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [timeline, setTimeline] = useState<string>('ALL');
    const [activeLines, setActiveLines] = useState({ squat: true, bench: true, deadlift: true, totalLbs: true, dots: true });

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/athletes/${athleteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gender: gender || null,
                weightClass: weightClass ? parseFloat(weightClass) : null,
            }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const wc = parseFloat(weightClass) || 0;
    const genderKey = (gender === 'male' || gender === 'female') ? gender : null;
    const classes = gender && WEIGHT_CLASSES[gender as 'male' | 'female'] ? WEIGHT_CLASSES[gender as 'male' | 'female'] : [];

    // Filter logs by selected timeline before computing data points
    const filteredLogs = useMemo(() => {
        if (!logs?.length) return [];
        const days = TIMELINES[timeline];
        if (days === Infinity) return logs;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return logs.filter(l => l.date && new Date(l.date) >= cutoff);
    }, [logs, timeline]);

    // Compute data points — one per logged session that has a competition lift
    const data: CompetitionDataPoint[] = useMemo(
        () => getCompetitionDataPoints(filteredLogs, wc, genderKey),
        [filteredLogs, wc, genderKey]
    );

    const latestDots = data.length > 0 ? data[data.length - 1].dots : 0;
    const latestTotal = data.length > 0 ? data[data.length - 1].total : 0;

    const toggleLine = (key: keyof typeof activeLines) =>
        setActiveLines(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Profile Assignment Panel */}
            <div style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
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
            {data.length > 0 && latestTotal > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Latest DOTs', value: latestDots > 0 ? latestDots.toFixed(1) : '—', color: CHART_COLORS.dots },
                        { label: 'Total E1RM', value: data[data.length - 1].totalLbs > 0 ? `${data[data.length - 1].totalLbs} lbs` : '—', color: CHART_COLORS.totalLbs },
                        { label: 'Latest Squat E1RM', value: data[data.length - 1].squat > 0 ? `${data[data.length - 1].squat} lbs` : '—', color: CHART_COLORS.squat },
                        { label: 'Latest Bench E1RM', value: data[data.length - 1].bench > 0 ? `${data[data.length - 1].bench} lbs` : '—', color: CHART_COLORS.bench },
                        { label: 'Latest Deadlift E1RM', value: data[data.length - 1].deadlift > 0 ? `${data[data.length - 1].deadlift} lbs` : '—', color: CHART_COLORS.deadlift },
                    ].map(s => (
                        <div key={s.label} style={{ flex: '1 1 110px', background: 'rgba(15,23,42,0.5)', border: `1px solid ${s.color}33`, borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart */}
            {data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--secondary-foreground)', fontSize: 14, background: 'rgba(15,23,42,0.3)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🏋️</div>
                    <div style={{ fontWeight: 600, marginBottom: 5 }}>No competition lift data {timeline !== 'ALL' ? `in the last ${timeline}` : 'yet'}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Sessions with <strong>Squat</strong>, <strong>Bench Press</strong>, or <strong>Deadlift</strong> logged with weight &amp; reps will appear here.</div>
                </div>
            ) : (
                <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 8px 8px' }}>
                    {/* Timeline + line toggles in one row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingLeft: 12, paddingRight: 12, marginBottom: 14 }}>
                        {/* Line toggles */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                                        padding: '4px 10px', borderRadius: 6, border: `1px solid ${color}`,
                                        background: activeLines[k] ? `${color}22` : 'transparent',
                                        color: activeLines[k] ? color : 'rgba(255,255,255,0.3)',
                                        fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                    }}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Timeline filter */}
                        <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
                            {Object.keys(TIMELINES).map(tl => (
                                <button key={tl} onClick={() => setTimeline(tl)} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: timeline === tl ? 'var(--primary)' : 'transparent',
                                    color: timeline === tl ? '#fff' : 'var(--secondary-foreground)',
                                    fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                                }}>
                                    {tl}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="lbs" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                            <YAxis yAxisId="dots" orientation="right" tick={{ fill: CHART_COLORS.dots, fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                            <Tooltip content={<CustomTooltip />} />
                            {activeLines.squat && <Line yAxisId="lbs" type="monotone" dataKey="squat" name="Squat E1RM" stroke={CHART_COLORS.squat} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS.squat }} activeDot={{ r: 6 }} connectNulls />}
                            {activeLines.bench && <Line yAxisId="lbs" type="monotone" dataKey="bench" name="Bench E1RM" stroke={CHART_COLORS.bench} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS.bench }} activeDot={{ r: 6 }} connectNulls />}
                            {activeLines.deadlift && <Line yAxisId="lbs" type="monotone" dataKey="deadlift" name="Deadlift E1RM" stroke={CHART_COLORS.deadlift} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS.deadlift }} activeDot={{ r: 6 }} connectNulls />}
                            {activeLines.totalLbs && <Line yAxisId="lbs" type="monotone" dataKey="totalLbs" name="Total E1RM" stroke={CHART_COLORS.totalLbs} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.totalLbs }} activeDot={{ r: 6 }} connectNulls />}
                            {activeLines.dots && genderKey && wc > 0 && (
                                <Line yAxisId="dots" type="monotone" dataKey="dots" name="DOTs Score" stroke={CHART_COLORS.dots} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.dots }} activeDot={{ r: 6 }} connectNulls />
                            )}
                        </LineChart>
                    </ResponsiveContainer>

                    <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>
                        Each dot = a logged session · {data.length} session{data.length !== 1 ? 's' : ''} shown
                    </div>
                </div>
            )}
        </div>
    );
}

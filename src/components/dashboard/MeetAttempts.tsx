'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { calculateDots } from '@/lib/calculators';

const LIFTS = [
    { key: 'squat', label: 'Squat', color: '#7d87d2' },
    { key: 'bench', label: 'Bench Press', color: '#a855f7' },
    { key: 'deadlift', label: 'Deadlift', color: '#10b981' },
] as const;

const ATTEMPTS = [
    { key: 'attempt1', label: '1st Attempt' },
    { key: 'attempt2', label: '2nd Attempt' },
    { key: 'attempt3', label: '3rd Attempt' },
] as const;

const OPTIONS = [
    { key: 'conservative', label: 'Conservative', abbr: 'CON', color: '#22d3ee' },
    { key: 'planned', label: 'Planned', abbr: 'PLN', color: '#f59e0b' },
    { key: 'reach', label: 'Reach', abbr: 'RCH', color: '#f43f5e' },
] as const;

type LiftKey = typeof LIFTS[number]['key'];
type AttemptKey = typeof ATTEMPTS[number]['key'];
type OptionKey = typeof OPTIONS[number]['key'];
type ResultType = 'pending' | 'good' | 'fail';

interface AttemptData {
    kg: string;
    lbs: string;
}

interface AttemptOptions {
    conservative: AttemptData;
    planned: AttemptData;
    reach: AttemptData;
    result?: ResultType;
    actualKg?: string;
}

interface LiftAttempts {
    attempt1: AttemptOptions;
    attempt2: AttemptOptions;
    attempt3: AttemptOptions;
    warmups?: string;
}

interface MeetDayMeta {
    meetName: string;
    meetDate: string;
    bodyweight: string;
    federation: string;
}

interface MeetData {
    squat: LiftAttempts;
    bench: LiftAttempts;
    deadlift: LiftAttempts;
    meetDay?: MeetDayMeta;
}

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

function round2(n: number) {
    return Math.round(n * 100) / 100;
}

function emptyAttempt(): AttemptData {
    return { kg: '', lbs: '' };
}

function emptyAttemptOptions(): AttemptOptions {
    return {
        conservative: emptyAttempt(),
        planned: emptyAttempt(),
        reach: emptyAttempt(),
        result: 'pending',
        actualKg: '',
    };
}

function emptyLift(): LiftAttempts {
    return { attempt1: emptyAttemptOptions(), attempt2: emptyAttemptOptions(), attempt3: emptyAttemptOptions(), warmups: '' };
}

function migrateAttemptOptions(rawAttempt: any): AttemptOptions {
    if (!rawAttempt) return emptyAttemptOptions();
    if (rawAttempt.conservative !== undefined) {
        return {
            ...rawAttempt,
            result: rawAttempt.result || 'pending',
            actualKg: rawAttempt.actualKg || '',
        };
    }
    // Migrate intermediate format (where attempt was just {kg, lbs})
    if (rawAttempt.kg !== undefined || rawAttempt.lbs !== undefined) {
        return {
            conservative: emptyAttempt(),
            planned: rawAttempt,
            reach: emptyAttempt(),
            result: 'pending',
            actualKg: '',
        };
    }
    return emptyAttemptOptions();
}

function migrateData(raw: any): MeetData {
    const defaultData: MeetData = {
        squat: emptyLift(),
        bench: emptyLift(),
        deadlift: emptyLift(),
    };
    if (!raw) return defaultData;

    if (raw.squat || raw.bench || raw.deadlift) {
        return {
            squat: {
                attempt1: migrateAttemptOptions(raw.squat?.attempt1),
                attempt2: migrateAttemptOptions(raw.squat?.attempt2),
                attempt3: migrateAttemptOptions(raw.squat?.attempt3),
                warmups: raw.squat?.warmups || ''
            },
            bench: {
                attempt1: migrateAttemptOptions(raw.bench?.attempt1),
                attempt2: migrateAttemptOptions(raw.bench?.attempt2),
                attempt3: migrateAttemptOptions(raw.bench?.attempt3),
                warmups: raw.bench?.warmups || ''
            },
            deadlift: {
                attempt1: migrateAttemptOptions(raw.deadlift?.attempt1),
                attempt2: migrateAttemptOptions(raw.deadlift?.attempt2),
                attempt3: migrateAttemptOptions(raw.deadlift?.attempt3),
                warmups: raw.deadlift?.warmups || ''
            },
            meetDay: raw.meetDay || undefined,
        };
    }

    return defaultData;
}

// Get best successful attempt weight (kg) for a lift
function getBestGoodAttempt(lift: LiftAttempts): number {
    let best = 0;
    for (const aKey of ['attempt3', 'attempt2', 'attempt1'] as AttemptKey[]) {
        const attempt = lift[aKey];
        if (attempt.result === 'good') {
            const w = parseFloat(attempt.actualKg || attempt.planned.kg || '0');
            if (w > best) best = w;
        }
    }
    return best;
}

// Get the "planned" 3rd attempt weight for a given option tier
function get3rdAttemptKg(lift: LiftAttempts, option: OptionKey): number {
    return parseFloat(lift.attempt3[option]?.kg || '0') || 0;
}

interface PreviousBest {
    meetName: string;
    date: string;
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
    dots: number;
}

function getLatestPastMeet(pastMeets: any[]): PreviousBest | null {
    if (!pastMeets || pastMeets.length === 0) return null;
    // Sort by date descending, pick most recent
    const sorted = [...pastMeets].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const m = sorted[0];
    if (!m) return null;

    // Handle both MeetDataTable format and HistoricalPerformance format
    let sq = 0, bp = 0, dl = 0;
    if (m._meetDataEntry) {
        const e = m._meetDataEntry;
        const bestLift = (attempts: number[], results: boolean[]) => {
            let best = 0;
            attempts?.forEach((v: number, i: number) => { if (results?.[i] && v > best) best = v; });
            return best;
        };
        sq = bestLift(e.squat, e.squatResults);
        bp = bestLift(e.bench, e.benchResults);
        dl = bestLift(e.deadlift, e.deadliftResults);
    } else {
        sq = parseFloat(m.squat) || 0;
        bp = parseFloat(m.bench) || 0;
        dl = parseFloat(m.deadlift) || 0;
    }

    return {
        meetName: m.meetName || m.name || '—',
        date: m.date || '',
        squat: sq,
        bench: bp,
        deadlift: dl,
        total: sq + bp + dl,
        dots: parseFloat(m.dots) || 0,
    };
}

export default function MeetAttempts({
    athlete,
    isReadOnly = false,
    meetDayMode = false,
}: {
    athlete: any;
    isReadOnly?: boolean;
    meetDayMode?: boolean;
}) {
    const router = useRouter();
    const [data, setData] = useState<MeetData>(() => migrateData(athlete.meetAttempts));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [savingHistory, setSavingHistory] = useState(false);
    const [savedHistory, setSavedHistory] = useState(false);

    // Meet day meta
    const [meetMeta, setMeetMeta] = useState<MeetDayMeta>(() => ({
        meetName: data.meetDay?.meetName || athlete.nextMeetName || '',
        meetDate: data.meetDay?.meetDate || athlete.nextMeetDate || '',
        bodyweight: data.meetDay?.bodyweight || '',
        federation: data.meetDay?.federation || athlete.federation || 'IPF',
    }));

    // Previous best
    const previousBest = useMemo(() => getLatestPastMeet(athlete.pastMeets), [athlete.pastMeets]);

    const isMale = athlete.gender !== 'female';
    const bwKg = parseFloat(meetMeta.bodyweight) || athlete.weightClass || 0;

    // Save to backend
    const save = useCallback(async (newData: MeetData) => {
        setSaving(true);
        setSaved(false);
        const payload = { ...newData, meetDay: meetMeta };
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: athlete.id, meetAttempts: payload }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [athlete.id, meetMeta]);

    const handleKgChange = (lift: LiftKey, attempt: AttemptKey, option: OptionKey, value: string) => {
        const parsed = parseFloat(value);
        const lbs = !isNaN(parsed) && value !== '' ? String(round2(parsed * KG_TO_LBS)) : '';
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: {
                    ...data[lift][attempt],
                    [option]: { kg: value, lbs }
                },
            },
        };
        setData(updated);
    };

    const handleLbsChange = (lift: LiftKey, attempt: AttemptKey, option: OptionKey, value: string) => {
        const parsed = parseFloat(value);
        const kg = !isNaN(parsed) && value !== '' ? String(round2(parsed * LBS_TO_KG)) : '';
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: {
                    ...data[lift][attempt],
                    [option]: { lbs: value, kg }
                },
            },
        };
        setData(updated);
    };

    const handleWarmupChange = (lift: LiftKey, value: string) => {
        const updated = {
            ...data,
            [lift]: { ...data[lift], warmups: value },
        };
        setData(updated);
    };

    const handleResultToggle = (lift: LiftKey, attempt: AttemptKey) => {
        const current = data[lift][attempt].result || 'pending';
        const next: ResultType = current === 'pending' ? 'good' : current === 'good' ? 'fail' : 'pending';
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: { ...data[lift][attempt], result: next },
            },
        };
        setData(updated);
        if (!isReadOnly) save(updated);
    };

    const handleActualKgChange = (lift: LiftKey, attempt: AttemptKey, value: string) => {
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: { ...data[lift][attempt], actualKg: value },
            },
        };
        setData(updated);
    };

    const handleBlur = () => {
        if (!isReadOnly) save(data);
    };

    const handleMetaChange = (field: keyof MeetDayMeta, value: string) => {
        setMeetMeta(prev => ({ ...prev, [field]: value }));
    };

    const handleMetaBlur = () => {
        if (!isReadOnly) save(data);
    };

    // Projected totals for 9/9 scenarios
    const projections = useMemo(() => {
        return OPTIONS.map(({ key: optionKey, label, color }) => {
            const sq = get3rdAttemptKg(data.squat, optionKey);
            const bp = get3rdAttemptKg(data.bench, optionKey);
            const dl = get3rdAttemptKg(data.deadlift, optionKey);
            const total = sq + bp + dl;
            const dots = total > 0 && bwKg > 0 ? calculateDots(total, bwKg, isMale) : 0;

            const sqPR = previousBest ? sq - previousBest.squat : 0;
            const bpPR = previousBest ? bp - previousBest.bench : 0;
            const dlPR = previousBest ? dl - previousBest.deadlift : 0;
            const totalPR = previousBest ? total - previousBest.total : 0;
            const dotsPR = previousBest && previousBest.dots > 0 ? dots - previousBest.dots : 0;

            return { key: optionKey, label, color, sq, bp, dl, total, dots, sqPR, bpPR, dlPR, totalPR, dotsPR };
        });
    }, [data, bwKg, isMale, previousBest]);

    // Live running total from successful attempts
    const liveTotal = useMemo(() => {
        const sq = getBestGoodAttempt(data.squat);
        const bp = getBestGoodAttempt(data.bench);
        const dl = getBestGoodAttempt(data.deadlift);
        const total = (sq > 0 && bp > 0 && dl > 0) ? sq + bp + dl : 0;
        const dots = total > 0 && bwKg > 0 ? calculateDots(total, bwKg, isMale) : 0;
        return { sq, bp, dl, total, dots };
    }, [data, bwKg, isMale]);

    // Save to Meet History
    const saveToMeetHistory = async () => {
        if (!meetMeta.meetName) {
            alert('Please enter a meet name before saving.');
            return;
        }

        const sq = getBestGoodAttempt(data.squat);
        const bp = getBestGoodAttempt(data.bench);
        const dl = getBestGoodAttempt(data.deadlift);
        const total = (sq > 0 && bp > 0 && dl > 0) ? sq + bp + dl : 0;
        const dots = total > 0 && bwKg > 0 ? calculateDots(total, bwKg, isMale) : 0;

        // Build _meetDataEntry for compatibility with MeetDataTable
        const getAttemptWeight = (lift: LiftAttempts, aKey: AttemptKey): number => {
            const a = lift[aKey];
            return parseFloat(a.actualKg || a.planned.kg || '0') || 0;
        };
        const getAttemptResult = (lift: LiftAttempts, aKey: AttemptKey): boolean => {
            return lift[aKey].result === 'good';
        };

        const meetDataEntry = {
            id: `meet_${Date.now()}`,
            athleteId: athlete.id,
            athleteName: athlete.name,
            category: '',
            weightClass: athlete.weightClass || 0,
            bodyweight: bwKg,
            meetDate: meetMeta.meetDate,
            meetName: meetMeta.meetName,
            gender: athlete.gender || 'male',
            squat: [getAttemptWeight(data.squat, 'attempt1'), getAttemptWeight(data.squat, 'attempt2'), getAttemptWeight(data.squat, 'attempt3')] as [number, number, number],
            squatResults: [getAttemptResult(data.squat, 'attempt1'), getAttemptResult(data.squat, 'attempt2'), getAttemptResult(data.squat, 'attempt3')] as [boolean, boolean, boolean],
            bench: [getAttemptWeight(data.bench, 'attempt1'), getAttemptWeight(data.bench, 'attempt2'), getAttemptWeight(data.bench, 'attempt3')] as [number, number, number],
            benchResults: [getAttemptResult(data.bench, 'attempt1'), getAttemptResult(data.bench, 'attempt2'), getAttemptResult(data.bench, 'attempt3')] as [boolean, boolean, boolean],
            deadlift: [getAttemptWeight(data.deadlift, 'attempt1'), getAttemptWeight(data.deadlift, 'attempt2'), getAttemptWeight(data.deadlift, 'attempt3')] as [number, number, number],
            deadliftResults: [getAttemptResult(data.deadlift, 'attempt1'), getAttemptResult(data.deadlift, 'attempt2'), getAttemptResult(data.deadlift, 'attempt3')] as [boolean, boolean, boolean],
        };

        const newMeetEntry = {
            id: meetDataEntry.id,
            date: meetMeta.meetDate,
            meetName: meetMeta.meetName,
            bodyweight: bwKg,
            squat: sq,
            bench: bp,
            deadlift: dl,
            total,
            dots: Math.round(dots * 100) / 100,
            _meetDataEntry: meetDataEntry,
        };

        const existingMeets = athlete.pastMeets || [];
        const updatedMeets = [...existingMeets, newMeetEntry];

        setSavingHistory(true);
        setSavedHistory(false);
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: athlete.id, pastMeets: updatedMeets }),
        });
        setSavingHistory(false);
        setSavedHistory(true);
        setTimeout(() => setSavedHistory(false), 4000);
        router.refresh();
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 10px',
        color: 'var(--foreground)',
        fontSize: 15,
        fontWeight: 600,
        textAlign: 'center',
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s',
    };

    const metaInputStyle: React.CSSProperties = {
        ...inputStyle,
        textAlign: 'left',
        padding: '8px 12px',
        fontSize: 14,
    };

    const prBadge = (diff: number, unit = 'kg') => {
        if (diff === 0) return null;
        const positive = diff > 0;
        return (
            <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: positive ? '#4ade80' : '#f87171',
                marginLeft: 4,
            }}>
                {positive ? '+' : ''}{diff.toFixed(1)}{unit}
            </span>
        );
    };

    const resultButton = (lift: LiftKey, attempt: AttemptKey) => {
        const result = data[lift][attempt].result || 'pending';
        const styles: Record<ResultType, { bg: string; border: string; color: string; label: string }> = {
            pending: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: 'var(--secondary-foreground)', label: '—' },
            good: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.5)', color: '#4ade80', label: '✓' },
            fail: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)', color: '#f87171', label: '✗' },
        };
        const s = styles[result];
        return (
            <button
                type="button"
                onClick={() => handleResultToggle(lift, attempt)}
                disabled={isReadOnly}
                style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: s.bg, border: `2px solid ${s.border}`,
                    color: s.color, fontSize: 18, fontWeight: 800,
                    cursor: isReadOnly ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                }}
            >
                {s.label}
            </button>
        );
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        {meetDayMode ? 'Meet Day' : 'Attempt Selection'}
                    </h2>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        Enter weights in either unit — they auto-convert
                    </p>
                </div>
                {!isReadOnly && (
                    <div style={{ fontSize: 12, color: saving ? 'var(--secondary-foreground)' : saved ? '#4ade80' : 'transparent', fontWeight: 500, transition: 'color 0.2s' }}>
                        {saving ? 'Saving…' : saved ? '✓ Saved' : '·'}
                    </div>
                )}
            </div>

            {/* Meet Info Fields */}
            {(meetDayMode || true) && (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    marginBottom: '1rem',
                }}>
                    <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-foreground)', margin: '0 0 0.75rem', opacity: 0.7 }}>
                        Meet Information
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', marginBottom: 4 }}>Meet Name</label>
                            <input
                                placeholder="e.g. USAPL Nationals"
                                value={meetMeta.meetName}
                                readOnly={isReadOnly}
                                style={metaInputStyle}
                                onChange={e => handleMetaChange('meetName', e.target.value)}
                                onBlur={handleMetaBlur}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', marginBottom: 4 }}>Meet Date</label>
                            <input
                                type="date"
                                value={meetMeta.meetDate}
                                readOnly={isReadOnly}
                                style={{ ...metaInputStyle, colorScheme: 'dark' }}
                                onChange={e => handleMetaChange('meetDate', e.target.value)}
                                onBlur={handleMetaBlur}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', marginBottom: 4 }}>Bodyweight (kg)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                placeholder="e.g. 82.5"
                                value={meetMeta.bodyweight}
                                readOnly={isReadOnly}
                                style={metaInputStyle}
                                onChange={e => handleMetaChange('bodyweight', e.target.value)}
                                onBlur={handleMetaBlur}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', marginBottom: 4 }}>Federation</label>
                            <input
                                placeholder="IPF"
                                value={meetMeta.federation}
                                readOnly={isReadOnly}
                                style={metaInputStyle}
                                onChange={e => handleMetaChange('federation', e.target.value)}
                                onBlur={handleMetaBlur}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Previous Best Reference */}
            {previousBest && (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    marginBottom: '1rem',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-foreground)', margin: 0, opacity: 0.7 }}>
                            Previous Best
                        </h3>
                        <span style={{ fontSize: 11, color: 'var(--secondary-foreground)', opacity: 0.6 }}>
                            {previousBest.meetName} {previousBest.date ? `· ${previousBest.date}` : ''}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {[
                            { label: 'Squat', value: previousBest.squat, color: '#7d87d2' },
                            { label: 'Bench', value: previousBest.bench, color: '#a855f7' },
                            { label: 'Deadlift', value: previousBest.deadlift, color: '#10b981' },
                            { label: 'Total', value: previousBest.total, color: 'var(--primary)' },
                            { label: 'DOTS', value: previousBest.dots, color: '#f59e0b' },
                        ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value > 0 ? item.value.toFixed(item.label === 'DOTS' ? 2 : 1) : '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Projected 9/9 Totals & DOTS */}
            {projections.some(p => p.total > 0) && (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    marginBottom: '1rem',
                }}>
                    <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-foreground)', margin: '0 0 0.75rem', opacity: 0.7 }}>
                        Projected 9/9 Totals
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {projections.filter(p => p.total > 0).map(p => (
                            <div key={p.key} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${p.color}22`,
                                borderRadius: 12,
                                padding: '12px 10px',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: 8 }}>
                                    {p.label}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                                    <div style={{ color: 'var(--secondary-foreground)' }}>SQ</div>
                                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{p.sq > 0 ? p.sq : '—'}{p.sq > 0 && prBadge(p.sqPR)}</div>
                                    <div style={{ color: 'var(--secondary-foreground)' }}>BP</div>
                                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{p.bp > 0 ? p.bp : '—'}{p.bp > 0 && prBadge(p.bpPR)}</div>
                                    <div style={{ color: 'var(--secondary-foreground)' }}>DL</div>
                                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{p.dl > 0 ? p.dl : '—'}{p.dl > 0 && prBadge(p.dlPR)}</div>
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--secondary-foreground)' }}>Total</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: p.color }}>{p.total}{prBadge(p.totalPR)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 10, color: 'var(--secondary-foreground)' }}>DOTS</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{p.dots > 0 ? p.dots.toFixed(2) : '—'}{p.dots > 0 && prBadge(p.dotsPR, '')}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Live Running Total (only when results are being tracked) */}
            {(liveTotal.sq > 0 || liveTotal.bp > 0 || liveTotal.dl > 0) && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(34,197,94,0.08))',
                    border: '1px solid rgba(6,182,212,0.25)',
                    borderRadius: 16,
                    padding: '1rem 1.25rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--secondary-foreground)', marginBottom: 2 }}>Live Total</div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                            {liveTotal.sq > 0 && <span>SQ <strong style={{ color: '#7d87d2' }}>{liveTotal.sq}</strong></span>}
                            {liveTotal.bp > 0 && <span>BP <strong style={{ color: '#a855f7' }}>{liveTotal.bp}</strong></span>}
                            {liveTotal.dl > 0 && <span>DL <strong style={{ color: '#10b981' }}>{liveTotal.dl}</strong></span>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
                            {liveTotal.total > 0 ? `${liveTotal.total} kg` : '—'}
                        </div>
                        {liveTotal.dots > 0 && (
                            <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                                DOTS: {liveTotal.dots.toFixed(2)}
                                {previousBest && previousBest.dots > 0 && prBadge(liveTotal.dots - previousBest.dots, '')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* One card per lift */}
            {LIFTS.map(({ key: liftKey, label, color: liftColor }) => (
                <div key={liftKey} style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    marginBottom: '1rem',
                }}>
                    <h3 style={{
                        fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: liftColor,
                        margin: '0 0 1rem', opacity: 0.9,
                    }}>
                        {label}
                    </h3>

                    {/* Three attempt boxes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {ATTEMPTS.map(({ key: attemptKey, label: attemptLabel }) => {
                            const attemptData = data[liftKey][attemptKey];
                            return (
                                <div key={attemptKey} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 12,
                                    padding: '12px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                }}>
                                    {/* Attempt label + result button */}
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            fontSize: 12, fontWeight: 700, textAlign: 'center',
                                            color: 'var(--primary)', textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                        }}>
                                            {attemptLabel}
                                        </div>
                                        {resultButton(liftKey, attemptKey)}
                                    </div>

                                    {/* Actual weight field (meet day) */}
                                    {(meetDayMode || attemptData.result !== 'pending') && (
                                        <div>
                                            <label style={{ fontSize: 9, color: 'var(--secondary-foreground)', display: 'block', textAlign: 'center', marginBottom: 3, textTransform: 'uppercase' }}>Actual KG</label>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="—"
                                                value={attemptData.actualKg || ''}
                                                readOnly={isReadOnly}
                                                style={{
                                                    ...inputStyle, padding: '6px 4px', fontSize: 14, fontWeight: 700,
                                                    borderColor: attemptData.result === 'good' ? 'rgba(34,197,94,0.5)' :
                                                        attemptData.result === 'fail' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)',
                                                    background: attemptData.result === 'good' ? 'rgba(34,197,94,0.08)' :
                                                        attemptData.result === 'fail' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)',
                                                }}
                                                onChange={e => handleActualKgChange(liftKey, attemptKey, e.target.value)}
                                                onBlur={handleBlur}
                                            />
                                        </div>
                                    )}

                                    {/* Options (conservative/planned/reach) */}
                                    {OPTIONS.map(({ key: optionKey, label: optionLabel }) => {
                                        const val = data[liftKey][attemptKey][optionKey];
                                        return (
                                            <div key={optionKey} style={{
                                                background: 'rgba(0,0,0,0.1)',
                                                border: '1px solid rgba(255,255,255,0.04)',
                                                borderRadius: 8,
                                                padding: '8px',
                                            }}>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>
                                                    {optionLabel}
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            placeholder="KG"
                                                            value={val.kg}
                                                            readOnly={isReadOnly}
                                                            style={{ ...inputStyle, padding: '6px 4px', fontSize: 13, borderColor: val.kg ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)' }}
                                                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)'}
                                                            onBlur={e => {
                                                                e.currentTarget.style.borderColor = val.kg ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)';
                                                                handleBlur();
                                                            }}
                                                            onChange={e => handleKgChange(liftKey, attemptKey, optionKey, e.target.value)}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            placeholder="LBS"
                                                            value={val.lbs}
                                                            readOnly={isReadOnly}
                                                            style={{ ...inputStyle, padding: '6px 4px', fontSize: 13, borderColor: val.lbs ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)' }}
                                                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,0.7)'}
                                                            onBlur={e => {
                                                                e.currentTarget.style.borderColor = val.lbs ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)';
                                                                handleBlur();
                                                            }}
                                                            onChange={e => handleLbsChange(liftKey, attemptKey, optionKey, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* Warm-ups section */}
                    <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                            Warm-ups
                        </label>
                        <textarea
                            placeholder="e.g., Bar x 10, 135 x 5, 225 x 3..."
                            value={data[liftKey].warmups || ''}
                            readOnly={isReadOnly}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 12,
                                padding: '12px',
                                color: 'var(--foreground)',
                                fontSize: 14,
                                minHeight: '60px',
                                resize: 'vertical',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                fontFamily: 'inherit'
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                                handleBlur();
                            }}
                            onChange={e => handleWarmupChange(liftKey, e.target.value)}
                        />
                    </div>
                </div>
            ))}

            {/* Save to Meet History Button */}
            {!isReadOnly && (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    alignItems: 'center',
                }}>
                    <button
                        onClick={saveToMeetHistory}
                        disabled={savingHistory}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: 15,
                            fontWeight: 700,
                            borderRadius: 12,
                            cursor: savingHistory ? 'wait' : 'pointer',
                        }}
                    >
                        {savingHistory ? 'Saving to Meet History…' : savedHistory ? '✓ Saved to Meet History!' : '📋 Save to Meet History'}
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--secondary-foreground)', textAlign: 'center', margin: 0, opacity: 0.6 }}>
                        Saves all marked attempts and results to this athlete&apos;s past meet records
                    </p>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const LIFTS = [
    { key: 'squat', label: 'Squat' },
    { key: 'bench', label: 'Bench Press' },
    { key: 'deadlift', label: 'Deadlift' },
] as const;

const ATTEMPTS = [
    { key: 'attempt1', label: '1st Attempt' },
    { key: 'attempt2', label: '2nd Attempt' },
    { key: 'attempt3', label: '3rd Attempt' },
] as const;

const OPTIONS = [
    { key: 'conservative', label: 'Conservative' },
    { key: 'planned', label: 'Planned' },
    { key: 'reach', label: 'Reach' }
] as const;

type LiftKey = typeof LIFTS[number]['key'];
type AttemptKey = typeof ATTEMPTS[number]['key'];
type OptionKey = typeof OPTIONS[number]['key'];

interface AttemptData {
    kg: string;
    lbs: string;
}

interface AttemptOptions {
    conservative: AttemptData;
    planned: AttemptData;
    reach: AttemptData;
}

interface LiftAttempts {
    attempt1: AttemptOptions;
    attempt2: AttemptOptions;
    attempt3: AttemptOptions;
    warmups?: string;
}

interface MeetData {
    squat: LiftAttempts;
    bench: LiftAttempts;
    deadlift: LiftAttempts;
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
        reach: emptyAttempt()
    };
}

function emptyLift(): LiftAttempts {
    return { attempt1: emptyAttemptOptions(), attempt2: emptyAttemptOptions(), attempt3: emptyAttemptOptions(), warmups: '' };
}

function migrateAttemptOptions(rawAttempt: any): AttemptOptions {
    if (!rawAttempt) return emptyAttemptOptions();
    if (rawAttempt.conservative !== undefined) return rawAttempt as AttemptOptions;
    // Migrate intermediate format (where attempt was just {kg, lbs})
    if (rawAttempt.kg !== undefined || rawAttempt.lbs !== undefined) {
        return {
            conservative: emptyAttempt(),
            planned: rawAttempt,
            reach: emptyAttempt()
        };
    }
    return emptyAttemptOptions();
}

/** Convert legacy meetAttempts format (with conservative/planned/reach) to new simple format */
function migrateData(raw: any): MeetData {
    const defaultData: MeetData = {
        squat: emptyLift(),
        bench: emptyLift(),
        deadlift: emptyLift(),
    };
    if (!raw) return defaultData;
    
    // Detect if we have ANY data
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
            }
        };
    }

    return defaultData;
}

export default function MeetAttempts({ athlete, isReadOnly = false }: { athlete: any; isReadOnly?: boolean }) {
    const router = useRouter();
    const [data, setData] = useState<MeetData>(() => migrateData(athlete.meetAttempts));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const save = useCallback(async (newData: MeetData) => {
        setSaving(true);
        setSaved(false);
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: athlete.id, meetAttempts: newData }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
    }, [athlete.id, router]);

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
            [lift]: {
                ...data[lift],
                warmups: value,
            },
        };
        setData(updated);
    };

    const handleBlur = () => {
        if (!isReadOnly) save(data);
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

    return (
        <div style={{ marginBottom: '2rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '1.5rem',
            }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Attempt Selection
                    </h2>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', marginTop: 4, margin: '4px 0 0' }}>
                        Enter weights in either unit — they auto-convert
                    </p>
                </div>
                {!isReadOnly && (
                    <div style={{ fontSize: 12, color: 'var(--secondary-foreground)', fontWeight: 500 }}>
                        {saving ? 'Saving…' : saved ? '✓ Saved' : ''}
                    </div>
                )}
            </div>

            {/* One card per lift */}
            {LIFTS.map(({ key: liftKey, label }) => (
                <div key={liftKey} style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    marginBottom: '1rem',
                }}>
                    <h3 style={{
                        fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--primary)',
                        margin: '0 0 1rem', opacity: 0.8,
                    }}>
                        {label}
                    </h3>

                    {/* Three attempt boxes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {ATTEMPTS.map(({ key: attemptKey, label: attemptLabel }) => {
                            return (
                                <div key={attemptKey} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 12,
                                    padding: '12px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                }}>
                                    {/* Attempt label */}
                                    <div style={{
                                        fontSize: 12, fontWeight: 700, textAlign: 'center',
                                        color: 'var(--primary)', textTransform: 'uppercase',
                                        letterSpacing: '0.06em', marginBottom: 4,
                                    }}>
                                        {attemptLabel}
                                    </div>

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
        </div>
    );
}

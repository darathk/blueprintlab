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

type LiftKey = typeof LIFTS[number]['key'];
type AttemptKey = typeof ATTEMPTS[number]['key'];

interface AttemptData {
    kg: string;
    lbs: string;
}

interface LiftAttempts {
    attempt1: AttemptData;
    attempt2: AttemptData;
    attempt3: AttemptData;
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

function emptyLift(): LiftAttempts {
    return { attempt1: emptyAttempt(), attempt2: emptyAttempt(), attempt3: emptyAttempt() };
}

/** Convert legacy meetAttempts format (with conservative/planned/reach) to new simple format */
function migrateData(raw: any): MeetData {
    const defaultData: MeetData = {
        squat: emptyLift(),
        bench: emptyLift(),
        deadlift: emptyLift(),
    };
    if (!raw) return defaultData;
    // Already new format
    if (raw.squat?.attempt1 !== undefined) return raw as MeetData;
    // Legacy: try to import the "planned" 3rd attempt as the basis
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

    const handleKgChange = (lift: LiftKey, attempt: AttemptKey, value: string) => {
        const parsed = parseFloat(value);
        const lbs = !isNaN(parsed) && value !== '' ? String(round2(parsed * KG_TO_LBS)) : '';
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: { kg: value, lbs },
            },
        };
        setData(updated);
    };

    const handleLbsChange = (lift: LiftKey, attempt: AttemptKey, value: string) => {
        const parsed = parseFloat(value);
        const kg = !isNaN(parsed) && value !== '' ? String(round2(parsed * LBS_TO_KG)) : '';
        const updated = {
            ...data,
            [lift]: {
                ...data[lift],
                [attempt]: { lbs: value, kg },
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
                            const val = data[liftKey][attemptKey];
                            return (
                                <div key={attemptKey} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 12,
                                    padding: '12px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                }}>
                                    {/* Attempt label */}
                                    <div style={{
                                        fontSize: 11, fontWeight: 700, textAlign: 'center',
                                        color: 'var(--secondary-foreground)', textTransform: 'uppercase',
                                        letterSpacing: '0.06em', marginBottom: 2,
                                    }}>
                                        {attemptLabel}
                                    </div>

                                    {/* KG input */}
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', textAlign: 'center', marginBottom: 4, opacity: 0.7 }}>
                                            KG
                                        </label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="—"
                                            value={val.kg}
                                            readOnly={isReadOnly}
                                            style={{
                                                ...inputStyle,
                                                borderColor: val.kg ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)'}
                                            onBlur={e => {
                                                e.currentTarget.style.borderColor = val.kg ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)';
                                                handleBlur();
                                            }}
                                            onChange={e => handleKgChange(liftKey, attemptKey, e.target.value)}
                                        />
                                    </div>

                                    {/* Divider with conversion arrow */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>⇅</span>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                    </div>

                                    {/* LBS input */}
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--secondary-foreground)', display: 'block', textAlign: 'center', marginBottom: 4, opacity: 0.7 }}>
                                            LBS
                                        </label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="—"
                                            value={val.lbs}
                                            readOnly={isReadOnly}
                                            style={{
                                                ...inputStyle,
                                                borderColor: val.lbs ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,0.7)'}
                                            onBlur={e => {
                                                e.currentTarget.style.borderColor = val.lbs ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)';
                                                handleBlur();
                                            }}
                                            onChange={e => handleLbsChange(liftKey, attemptKey, e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

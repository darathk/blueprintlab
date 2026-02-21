'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';
import { getExerciseCategory } from '@/lib/exercise-db';
import Link from 'next/link';

export default function WorkoutLogger({ athleteId, programId, sessionId, exercises, initialLog }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(Date.now());

    // Initialize logs
    const [exerciseLogs, setExerciseLogs] = useState(() => {
        return exercises.map(ex => {
            // Find saved data for this exercise if available
            const savedEx = initialLog?.exercises?.find(l => l.exerciseId === ex.id || l.name === ex.name);

            // Handle both old (flat) and new (granular) data structures
            const isGranular = Array.isArray(ex.sets);

            let mappedSets = [];
            if (isGranular) {
                mappedSets = ex.sets.map((s, i) => {
                    const savedSet = savedEx?.sets?.[i];
                    return {
                        setNumber: i + 1,
                        target: {
                            weight: s.weight || '',
                            reps: s.reps || '',
                            rpe: s.rpe || ''
                        },
                        actual: {
                            weight: savedSet?.weight || s.weight || '',
                            reps: savedSet?.reps || '',
                            rpe: savedSet?.rpe || ''
                        }
                    };
                });
            } else {
                // Fallback for legacy data/structure
                const setCount = typeof ex.sets === 'number' ? ex.sets : 3;
                mappedSets = Array.from({ length: setCount }).map((_, i) => {
                    const savedSet = savedEx?.sets?.[i];
                    return {
                        setNumber: i + 1,
                        target: {
                            weight: '',
                            reps: ex.reps || '',
                            rpe: ex.rpeTarget || 8
                        },
                        actual: {
                            weight: savedSet?.weight || '',
                            reps: savedSet?.reps || '',
                            rpe: savedSet?.rpe || ''
                        }
                    };
                });
            }

            return {
                exerciseId: ex.id,
                name: ex.name,
                category: getExerciseCategory(ex.name),
                sets: mappedSets,
                notes: savedEx?.notes || ex.notes || '',
                isCollapsed: false
            };
        });
    });

    // Auto-Save Effect
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSave(false);
        }, 1000); // Debounce 1s

        return () => clearTimeout(timer);
    }, [exerciseLogs]);

    // Calculate Completion for Progress Bar
    const validationStats = useMemo(() => {
        let totalSets = 0;
        let completedSets = 0;

        exerciseLogs.forEach(ex => {
            ex.sets.forEach(set => {
                totalSets++;
                // Check if filled (weight and reps are minimum needed)
                if (set.actual.weight && set.actual.reps) {
                    completedSets++;
                }
            });
        });

        return { total: totalSets, completed: completedSets, percentage: totalSets > 0 ? (completedSets / totalSets) * 100 : 0 };
    }, [exerciseLogs]);


    // Real-time stats
    const sessionStats = useMemo(() => {
        let total = 0;
        let central = 0;
        let peripheral = 0;

        exerciseLogs.forEach(ex => {
            ex.sets.forEach(set => {
                const r = parseFloat(set.actual.reps) || 0;
                const rpe = parseFloat(set.actual.rpe) || 0;
                if (r > 0 && rpe > 0) {
                    const stress = calculateStress(r, rpe);
                    total += stress.total;
                    central += stress.central;
                    peripheral += stress.peripheral;
                }
            });
        });
        return {
            total: total.toFixed(1),
            central: central.toFixed(1),
            peripheral: peripheral.toFixed(1)
        };
    }, [exerciseLogs]);

    // Format Date: "Friday, Feb 27th, 2026"
    const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    });

    const updateSet = (exIndex, setIndex, field, value) => {
        const newLogs = [...exerciseLogs];
        newLogs[exIndex].sets[setIndex].actual[field] = value;
        setExerciseLogs(newLogs);
    };

    const toggleCollapse = (exIndex) => {
        const newLogs = [...exerciseLogs];
        newLogs[exIndex].isCollapsed = !newLogs[exIndex].isCollapsed;
        setExerciseLogs(newLogs);
    };

    const copyTargetToActual = (exIndex, setIndex) => {
        const newLogs = [...exerciseLogs];
        const set = newLogs[exIndex].sets[setIndex];
        const targetReps = set.target.reps.toString();
        const cleanReps = targetReps.includes('-') ? targetReps.split('-')[0] : targetReps;

        set.actual.weight = set.target.weight;
        set.actual.reps = cleanReps;
        set.actual.rpe = set.target.rpe;
        setExerciseLogs(newLogs);
    };

    const copyPreviousSet = (exIndex, setIndex) => {
        if (setIndex === 0) return;
        const newLogs = [...exerciseLogs];
        const prevSet = newLogs[exIndex].sets[setIndex - 1];
        newLogs[exIndex].sets[setIndex].actual = { ...prevSet.actual };
        setExerciseLogs(newLogs);
    };

    const updateSetsCount = (exIndex, newCount) => {
        const count = parseInt(newCount);
        if (isNaN(count) || count < 0) return;

        const newLogs = [...exerciseLogs];
        const currentSets = newLogs[exIndex].sets;

        if (count > currentSets.length) {
            // Add sets
            for (let i = currentSets.length; i < count; i++) {
                currentSets.push({
                    setNumber: i + 1,
                    target: { ...currentSets[0].target },
                    actual: { weight: '', reps: '', rpe: '' }
                });
            }
        } else if (count < currentSets.length) {
            // Remove sets
            newLogs[exIndex].sets = currentSets.slice(0, count);
        }
        setExerciseLogs(newLogs);
    };

    const handleSave = async (redirect = true) => {
        setIsSaving(true);
        try {
            const cleanLogs = exerciseLogs.map(ex => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                sets: ex.sets.map(s => ({
                    weight: s.actual.weight,
                    reps: s.actual.reps,
                    rpe: s.actual.rpe
                })),
                notes: ex.notes
            }));

            const res = await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athleteId,
                    programId,
                    sessionId,
                    date: new Date().toISOString(),
                    exercises: cleanLogs
                }),
            });

            if (res.ok) {
                setLastSaved(Date.now());
                if (redirect) {
                    router.push(`/athlete/${athleteId}/dashboard`);
                    router.refresh();
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ paddingBottom: '100px' }}>
            {/* Header Bar */}
            <div style={{
                background: 'var(--card-bg)',
                borderBottom: '1px solid var(--card-border)',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {formattedDate} 📝
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                        {isSaving ? 'Saving...' : 'All Changes Saved'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--background)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${validationStats.percentage}%`,
                        height: '100%',
                        background: 'var(--success)',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>

            {/* Session Name & Stats */}
            <div style={{
                background: 'var(--primary)',
                color: 'white',
                padding: '0.5rem 1rem',
                marginBottom: '1rem',
                borderRadius: 'var(--radius)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Session {sessionId}</h2>
                <div style={{ fontSize: '0.8rem', opacity: 0.9, textAlign: 'right' }}>
                    <div>Stress: {sessionStats.total}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>C: {sessionStats.central} | P: {sessionStats.peripheral}</div>
                </div>
            </div>

            {/* Exercise Cards */}
            <div style={{ display: 'grid', gap: '2rem' }}>
                {exerciseLogs.map((ex, exIndex) => {
                    // Max E1RM calc
                    const validSets = ex.sets.filter(s => s.actual.weight && s.actual.reps && s.actual.rpe);
                    const e1rms = validSets.map(s => calculateSimpleE1RM(s.actual.weight, s.actual.reps, s.actual.rpe));
                    const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                    // Stress for this exercise
                    let exStress = { total: 0, central: 0, peripheral: 0 };
                    ex.sets.forEach(s => {
                        if (s.actual.reps && s.actual.rpe) {
                            const res = calculateStress(s.actual.reps, s.actual.rpe);
                            exStress.total += res.total;
                            exStress.central += res.central;
                            exStress.peripheral += res.peripheral;
                        }
                    });

                    return (
                        <div key={ex.exerciseId} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', background: 'var(--card-bg)', overflow: 'hidden' }}>
                            {/* Exercise Header */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '0.5rem 1rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--card-border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => toggleCollapse(exIndex)}
                                        style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--foreground)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                        {ex.isCollapsed ? '+' : '-'}
                                    </button>
                                    <h3 style={{ fontSize: '1rem', color: 'var(--accent)', margin: 0 }}>{ex.name}</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Sets</label>
                                    <input
                                        type="number"
                                        value={ex.sets.length}
                                        onChange={(e) => updateSetsCount(exIndex, e.target.value)}
                                        style={{ width: '40px', padding: '2px', textAlign: 'center', background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}
                                    />
                                </div>
                            </div>

                            {!ex.isCollapsed && (
                                <div style={{ padding: '0.5rem' }}>
                                    {/* Table Headers */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>Target</div>
                                        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--primary)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>Actual</div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                            <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                            <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                            <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                            <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                            <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                            <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                        </div>
                                    </div>

                                    {/* Set Rows */}
                                    {ex.sets.map((set, sIndex) => (
                                        <div key={sIndex} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '1rem',
                                            alignItems: 'center',
                                            marginBottom: '0.5rem',
                                            paddingBottom: '0.5rem',
                                            borderBottom: '1px dashed var(--card-border)'
                                        }}>
                                            {/* Target Side */}
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <input className="input" disabled value={set.target.weight} placeholder="Work" style={{ flex: 1, textAlign: 'center', opacity: 0.7 }} />
                                                <input className="input" disabled value={set.target.reps} placeholder="Target" style={{ flex: 1, textAlign: 'center', opacity: 0.7 }} />
                                                <input className="input" disabled value={set.target.rpe} placeholder="@" style={{ flex: 1, textAlign: 'center', opacity: 0.7 }} />
                                                <div style={{ width: '20px' }}>➜</div>
                                            </div>

                                            {/* Actual Side */}
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={set.actual.weight}
                                                    onChange={(e) => updateSet(exIndex, sIndex, 'weight', e.target.value)}
                                                    placeholder="lbs"
                                                    style={{ flex: 1, textAlign: 'center', borderColor: set.actual.weight ? 'var(--success)' : '' }}
                                                />
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={set.actual.reps}
                                                    onChange={(e) => updateSet(exIndex, sIndex, 'reps', e.target.value)}
                                                    placeholder="Reps"
                                                    style={{ flex: 1, textAlign: 'center', borderColor: set.actual.reps ? 'var(--success)' : '' }}
                                                />
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={set.actual.rpe}
                                                    onChange={(e) => updateSet(exIndex, sIndex, 'rpe', e.target.value)}
                                                    step="0.5"
                                                    placeholder="RPE"
                                                    style={{ flex: 1, textAlign: 'center', borderColor: set.actual.rpe ? 'var(--success)' : '' }}
                                                />

                                                {/* Tools */}
                                                <button
                                                    onClick={() => copyPreviousSet(exIndex, sIndex)}
                                                    title="Copy Previous"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '1rem'
                                                    }}
                                                >
                                                    📄
                                                </button>
                                                <span style={{ color: 'var(--success)' }}>⬆</span>
                                                <span style={{ color: 'var(--error)' }}>✕</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Footer / Notes */}
                                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginBottom: '0.5rem', color: 'var(--secondary-foreground)' }}>
                                            <span><strong>E1RM:</strong> {maxE1RM} lbs</span>
                                            <span><strong>Stress:</strong> {exStress.total.toFixed(1)} <span style={{ opacity: 0.7 }}>(C:{exStress.central.toFixed(1)} P:{exStress.peripheral.toFixed(1)})</span></span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>Notes:</label>
                                            <textarea
                                                value={ex.notes}
                                                onChange={(e) => {
                                                    const newLogs = [...exerciseLogs];
                                                    newLogs[exIndex].notes = e.target.value;
                                                    setExerciseLogs(newLogs);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--card-border)',
                                                    color: 'var(--foreground)',
                                                    borderRadius: '4px',
                                                    padding: '0.5rem',
                                                    fontSize: '0.9rem',
                                                    resize: 'vertical',
                                                    minHeight: '40px'
                                                }}
                                                placeholder="Exercise notes..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Buttons */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                background: 'var(--card-bg)',
                borderTop: '1px solid var(--card-border)',
                padding: '1rem',
                zIndex: 100
            }}>
                <button
                    onClick={() => router.push(`/athlete/${athleteId}/dashboard`)}
                    style={{
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        padding: '1rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        width: '100%',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    Finish Session
                </button>
            </div>
        </div>
    );
}

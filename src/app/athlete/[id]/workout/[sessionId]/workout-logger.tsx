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
        <div style={{ paddingBottom: '100px', background: '#e2e8f0', minHeight: '100vh' }}>
            {/* Header Bar */}
            <div style={{
                background: '#fff',
                borderBottom: '1px solid #cbd5e1',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                        {formattedDate} 📝
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSaving ? '#d97706' : '#10b981' }}>
                        {isSaving ? 'Saving...' : '✓ All Changes Saved'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${validationStats.percentage}%`,
                        height: '100%',
                        background: validationStats.percentage === 100 ? '#10b981' : '#3b82f6',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>

            <div style={{ padding: '0 1rem' }}>
                {/* Session Name & Stats */}
                <div style={{
                    background: '#1e3a8a',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>Session {sessionId.split('_')[2]?.substring(1)}</h2>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9, textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>Stress: {sessionStats.total}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>C: {sessionStats.central} | P: {sessionStats.peripheral}</div>
                    </div>
                </div>

                {/* Exercise Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                    {exerciseLogs.map((ex, exIndex) => {
                        // Max E1RM calc
                        const validSets = ex.sets.filter(s => s.actual.weight && s.actual.reps && s.actual.rpe);
                        const e1rms = validSets.map(s => calculateSimpleE1RM(s.actual.weight, s.actual.reps, s.actual.rpe));
                        const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                        // Stats for this exercise
                        let exStress = { total: 0, central: 0, peripheral: 0 };
                        let tonnage = 0;
                        let totalNL = 0;
                        ex.sets.forEach(s => {
                            const w = parseFloat(s.actual.weight) || 0;
                            const r = parseFloat(s.actual.reps) || 0;
                            const rpe = parseFloat(s.actual.rpe) || 0;
                            tonnage += w * r;
                            totalNL += r;
                            if (r > 0 && rpe > 0) {
                                const res = calculateStress(r, rpe);
                                exStress.total += res.total;
                                exStress.central += res.central;
                                exStress.peripheral += res.peripheral;
                            }
                        });

                        return (
                            <div key={ex.exerciseId} style={{ borderBottom: exIndex < exerciseLogs.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                                {/* Exercise Header */}
                                <div style={{
                                    background: '#f8fafc',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                            onClick={() => toggleCollapse(exIndex)}
                                            style={{
                                                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: '2px solid #64748b', background: '#fff', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', padding: 0
                                            }}
                                        >
                                            {ex.isCollapsed ? '+' : '−'}
                                        </button>
                                        <h3 style={{ fontSize: '1rem', color: '#2563eb', fontWeight: 500, margin: 0 }}>{ex.name}</h3>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                                        Sets
                                        <input
                                            type="number"
                                            value={ex.sets.length}
                                            onChange={(e) => updateSetsCount(exIndex, e.target.value)}
                                            style={{ width: '40px', padding: '4px', textAlign: 'center', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                        />
                                        <span style={{ fontSize: '1.2rem', color: '#475569', marginLeft: 4 }}>...</span>
                                    </div>
                                </div>

                                {!ex.isCollapsed && (
                                    <div style={{ padding: '0 8px 16px 8px' }}>
                                        {/* Target / Actual Header */}
                                        <div style={{ display: 'flex', borderBottom: '1px dashed #cbd5e1', marginBottom: 8 }}>
                                            <div style={{ width: '130px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e3a8a', padding: '8px 0 4px 0' }}>Target</div>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: '#cbd5e1' }}></div>
                                                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e3a8a', padding: '8px 0 4px 0', background: '#f1f5f9' }}>Actual</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, color: '#1e3a8a' }}>
                                            <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                            </div>
                                            <div style={{ position: 'relative', width: 1, background: '#cbd5e1', margin: '0 8px' }}></div>
                                            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}>
                                                <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                <div style={{ width: 24 }}></div>
                                            </div>
                                        </div>

                                        {/* Set Rows */}
                                        {ex.sets.map((set, sIndex) => {
                                            const repsStr = String(set.target.reps);
                                            const cleanReps = repsStr.includes('-') ? repsStr.split('-')[0] : repsStr;

                                            return (
                                                <div key={sIndex} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                    {/* Target Side */}
                                                    <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                        <div style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#475569' }}>
                                                            {set.target.weight || '\u00A0'}
                                                        </div>
                                                        <div style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#475569' }}>
                                                            {cleanReps || '\u00A0'}
                                                        </div>
                                                        <div style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#475569' }}>
                                                            {set.target.rpe || '\u00A0'}
                                                        </div>
                                                    </div>

                                                    {/* Green Arrow Tool */}
                                                    <button
                                                        onClick={() => sIndex > 0 ? copyPreviousSet(exIndex, sIndex) : copyTargetToActual(exIndex, sIndex)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        <span style={{ color: '#10b981', fontSize: '1.4rem' }}>➞</span>
                                                    </button>

                                                    {/* Actual Side */}
                                                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            value={set.actual.weight}
                                                            onChange={(e) => updateSet(exIndex, sIndex, 'weight', e.target.value)}
                                                            style={{ flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#0f172a', width: '100%', outlineColor: '#3b82f6' }}
                                                        />
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            value={set.actual.reps}
                                                            onChange={(e) => updateSet(exIndex, sIndex, 'reps', e.target.value)}
                                                            style={{ flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#0f172a', width: '100%', outlineColor: '#3b82f6' }}
                                                        />
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            step="0.5"
                                                            value={set.actual.rpe}
                                                            onChange={(e) => updateSet(exIndex, sIndex, 'rpe', e.target.value)}
                                                            style={{ flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#0f172a', width: '100%', outlineColor: '#3b82f6' }}
                                                        />
                                                        <span style={{ color: '#475569', fontSize: '1.2rem', padding: '0 4px', fontWeight: 'bold' }}>...</span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Stats row */}
                                        <div style={{ padding: '12px 0 8px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#334155' }}>
                                            <div style={{ display: 'flex', gap: '16px', fontWeight: 600 }}>
                                                <span>E1RM: {maxE1RM} lbs</span>
                                                <span>NL: {totalNL}</span>
                                                <span>Tonnage: {tonnage.toLocaleString()} lbs</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: 4 }}>
                                                <span>Total: <span style={{ fontWeight: 'normal' }}>{exStress.total.toFixed(2)}</span></span>
                                                <span>Peripheral: <span style={{ fontWeight: 'normal' }}>{exStress.peripheral.toFixed(2)}</span></span>
                                                <span>Central: <span style={{ fontWeight: 'normal' }}>{exStress.central.toFixed(2)}</span></span>
                                            </div>
                                        </div>

                                        {/* Notes field */}
                                        <div style={{ marginTop: '12px' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Notes</label>
                                            <textarea
                                                value={ex.notes}
                                                onChange={(e) => {
                                                    const newLogs = [...exerciseLogs];
                                                    newLogs[exIndex].notes = e.target.value;
                                                    setExerciseLogs(newLogs);
                                                }}
                                                placeholder="Add exercise notes here..."
                                                style={{
                                                    width: '100%',
                                                    minHeight: '60px',
                                                    padding: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem',
                                                    color: '#0f172a',
                                                    resize: 'vertical',
                                                    outlineColor: '#3b82f6'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Buttons */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                background: '#fff',
                borderTop: '1px solid #cbd5e1',
                padding: '1rem',
                zIndex: 100
            }}>
                <button
                    onClick={() => router.push(`/athlete/${athleteId}/dashboard`)}
                    style={{
                        background: '#1e3a8a',
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

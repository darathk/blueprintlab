'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';

/* ─────────── helpers ─────────── */
function sessionKey(programId: string, weekNum: number, day: number) {
    return `${programId}_w${weekNum}_d${day}`;
}

function sessionProgress(exercises: any[], log: any): number {
    const totalSets = exercises.reduce((s: number, ex: any) => s + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
    if (!totalSets || !log) return 0;
    let filled = 0;
    (log.exercises || []).forEach((logEx: any) => {
        (logEx.sets || []).forEach((s: any) => { if (s.weight || s.reps) filled++; });
    });
    return Math.min(100, Math.round((filled / totalSets) * 100));
}

/* ─────────── component ─────────── */
export default function ScheduleView({ programs, athleteId, logs }: {
    programs: any[];
    athleteId: string;
    logs: any[];
}) {
    const router = useRouter();

    // Toggle states
    const [openBlocks, setOpenBlocks] = useState<Set<string>>(() => {
        // auto-open first program
        const s = new Set<string>();
        if (programs?.length) s.add(programs[0].id);
        return s;
    });
    const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
    const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());
    const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());

    // Workout edit state: keyed by session key
    const [editState, setEditState] = useState<Record<string, any[]>>({});
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

    const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };

    // Initialize edit state when a session is opened
    const initEdit = useCallback((sKey: string, exercises: any[], log: any) => {
        if (editState[sKey]) return;
        const state = (exercises || []).map((ex: any) => {
            const logEx = log?.exercises?.find((l: any) => l.exerciseId === ex.id || l.name === ex.name);
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            return {
                exerciseId: ex.id,
                name: ex.name,
                notes: logEx?.notes || ex.notes || '',
                sets: sets.map((s: any, i: number) => {
                    const saved = logEx?.sets?.[i];
                    return {
                        target: { weight: s.weight || '', reps: s.reps || '', rpe: s.rpe || '' },
                        actual: { weight: saved?.weight || '', reps: saved?.reps || '', rpe: saved?.rpe || '' }
                    };
                })
            };
        });
        setEditState(prev => ({ ...prev, [sKey]: state }));
    }, [editState]);

    const updateSet = (sKey: string, exIdx: number, setIdx: number, field: string, value: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (copy[sKey]?.[exIdx]?.sets?.[setIdx]?.actual) {
                copy[sKey][exIdx].sets[setIdx].actual[field] = value;
            }
            return copy;
        });
    };

    const updateNotes = (sKey: string, exIdx: number, value: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (copy[sKey]?.[exIdx]) copy[sKey][exIdx].notes = value;
            return copy;
        });
    };

    const copyPrevSet = (sKey: string, exIdx: number, setIdx: number) => {
        if (setIdx === 0) return;
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            const prevActual = copy[sKey]?.[exIdx]?.sets?.[setIdx - 1]?.actual;
            if (prevActual && copy[sKey][exIdx].sets[setIdx]) {
                copy[sKey][exIdx].sets[setIdx].actual = { ...prevActual };
            }
            return copy;
        });
    };

    const copyTargetToActual = (sKey: string, exIdx: number, setIdx: number) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            const target = copy[sKey]?.[exIdx]?.sets?.[setIdx]?.target;
            if (target && copy[sKey][exIdx].sets[setIdx]) {
                const reps = String(target.reps);
                const cleanReps = reps.includes('-') ? reps.split('-')[0] : reps;
                copy[sKey][exIdx].sets[setIdx].actual = {
                    weight: target.weight, reps: cleanReps, rpe: target.rpe
                };
            }
            return copy;
        });
    };

    const handleSave = async (sKey: string, programId: string) => {
        const exLogs = editState[sKey];
        if (!exLogs) return;
        setSaving(prev => new Set(prev).add(sKey));
        try {
            const cleanLogs = exLogs.map((ex: any) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                notes: ex.notes || '',
                sets: ex.sets.map((s: any) => ({ weight: s.actual.weight, reps: s.actual.reps, rpe: s.actual.rpe }))
            }));
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, programId, sessionId: sKey, date: new Date().toISOString(), exercises: cleanLogs })
            });
            setSavedKeys(prev => new Set(prev).add(sKey));
            setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(sKey); return n; }), 2500);
            router.refresh();
        } catch (e) { console.error(e); }
        finally { setSaving(prev => { const n = new Set(prev); n.delete(sKey); return n; }); }
    };

    if (!Array.isArray(programs) || !programs.length) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No training blocks found.</p>
                <p style={{ fontSize: '0.85rem' }}>Ask your coach to assign a program.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {programs.map(program => {
                const blockOpen = openBlocks.has(program.id);
                const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
                const totalWeeks = weeks.length;
                const totalSessions = weeks.reduce((s: number, w: any) => s + (Array.isArray(w.sessions) ? w.sessions.length : 0), 0);

                return (
                    <div key={program.id}>
                        {/* ═══ Block Header ═══ */}
                        <button
                            onClick={() => toggle(openBlocks, program.id, setOpenBlocks)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 16px', background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(16,185,129,0.12))',
                                border: 'none', borderBottom: '1px solid var(--card-border)',
                                color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{program.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                    {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} • {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', transition: 'transform 200ms', transform: blockOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </button>

                        {/* ═══ Weeks ═══ */}
                        {blockOpen && weeks.map((week: any) => {
                            if (!week) return null;
                            const weekNum = week.weekNumber || 1;
                            const weekKey = `${program.id}-w${weekNum}`;
                            const weekOpen = openWeeks.has(weekKey);
                            const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];

                            return (
                                <div key={weekKey}>
                                    <button
                                        onClick={() => toggle(openWeeks, weekKey, setOpenWeeks)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '12px 16px 12px 28px', background: 'rgba(255,255,255,0.02)',
                                            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
                                        }}
                                    >
                                        <span>Week {weekNum} <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '0.8rem' }}>• {sessions.length} session{sessions.length !== 1 ? 's' : ''}</span></span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: weekOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                    </button>

                                    {/* ═══ Sessions (Days) ═══ */}
                                    {weekOpen && sessions.map((session: any) => {
                                        if (!session) return null;
                                        const day = session.day || 1;
                                        const sKey = sessionKey(program.id, weekNum, day);
                                        const sessionOpen = openSessions.has(sKey);
                                        const exercises: any[] = Array.isArray(session.exercises) ? session.exercises : [];
                                        const log = Array.isArray(logs) ? logs.find(l => l.sessionId === sKey && l.programId === program.id) : undefined;
                                        const progress = sessionProgress(exercises, log);

                                        return (
                                            <div key={sKey}>
                                                {/* Session row */}
                                                <button
                                                    onClick={() => {
                                                        toggle(openSessions, sKey, setOpenSessions);
                                                        if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                                    }}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '12px 16px 12px 44px', background: 'transparent',
                                                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                        color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: sessionOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                            Day {day} — {session.name || 'Workout'}
                                                            <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '0.75rem', marginLeft: 8 }}>
                                                                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                                                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 2, transition: 'width 300ms',
                                                                    width: `${progress}%`,
                                                                    background: progress === 100 ? '#10b981' : progress > 0 ? 'linear-gradient(90deg, #06b6d4, #10b981)' : 'transparent'
                                                                }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.65rem', color: progress === 100 ? '#10b981' : 'rgba(255,255,255,0.3)', fontWeight: 600, flexShrink: 0 }}>
                                                                {progress}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* ═══ Expanded Session: Exercise Cards ═══ */}
                                                {sessionOpen && (
                                                    <div style={{ padding: '8px 12px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.12)' }}>
                                                        {(editState[sKey] || exercises).map((ex: any, exIdx: number) => {
                                                            const isEdit = !!editState[sKey];
                                                            const exerciseData = isEdit ? editState[sKey][exIdx] : ex;
                                                            if (!exerciseData) return null;
                                                            const sets = isEdit ? exerciseData.sets : (Array.isArray(ex.sets) ? ex.sets : []);
                                                            const exKey = `${sKey}-ex${exIdx}`;
                                                            const exOpen = openExercises.has(exKey);

                                                            // Compute per-exercise stats from actual data
                                                            const validSets = sets.filter((s: any) => {
                                                                const a = isEdit ? s.actual : { weight: '', reps: '', rpe: '' };
                                                                return a.weight && a.reps && a.rpe;
                                                            });
                                                            const e1rms = validSets.map((s: any) => {
                                                                const a = isEdit ? s.actual : { weight: '', reps: '', rpe: '' };
                                                                return calculateSimpleE1RM(a.weight, a.reps, a.rpe);
                                                            });
                                                            const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                                                            let exStress = { total: 0, central: 0, peripheral: 0 };
                                                            let tonnage = 0;
                                                            let totalNL = 0;
                                                            sets.forEach((s: any) => {
                                                                const a = isEdit ? s.actual : { weight: '', reps: '', rpe: '' };
                                                                const w = parseFloat(a.weight) || 0;
                                                                const r = parseFloat(a.reps) || 0;
                                                                const rpe = parseFloat(a.rpe) || 0;
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
                                                                <div key={exIdx} style={{ border: '1px solid var(--card-border)', borderRadius: 10, background: 'var(--card-bg)', overflow: 'hidden', marginBottom: 8 }}>
                                                                    {/* Exercise header — toggleable */}
                                                                    <button
                                                                        onClick={() => {
                                                                            toggle(openExercises, exKey, setOpenExercises);
                                                                            if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                        }}
                                                                        style={{
                                                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                            padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                                                                            border: 'none', borderBottom: exOpen ? '1px solid var(--card-border)' : 'none',
                                                                            color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: exOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>{exerciseData.name || ex.name}</span>
                                                                        </div>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>{sets.length} set{sets.length !== 1 ? 's' : ''}</span>
                                                                    </button>

                                                                    {/* Exercise body */}
                                                                    {exOpen && (
                                                                        <div style={{ padding: '8px 8px 10px' }}>
                                                                            {/* Prescribed / Actual headers */}
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                                                                                <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--accent)', paddingBottom: 3 }}>Prescribed</div>
                                                                                <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid var(--primary)', paddingBottom: 3 }}>Actual</div>
                                                                            </div>
                                                                            {/* Sub-headers */}
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                                                                                <div style={{ display: 'flex', gap: 4, fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: 4, fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    <span style={{ width: 28 }}></span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Set rows */}
                                                                            {sets.map((set: any, setIdx: number) => {
                                                                                const target = isEdit ? set.target : set;
                                                                                const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                                return (
                                                                                    <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                                                                                        {/* Prescribed side */}
                                                                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                                            {['weight', 'reps', 'rpe'].map(f => (
                                                                                                <input key={f} disabled value={target[f] || ''} placeholder="—"
                                                                                                    style={{
                                                                                                        flex: 1, padding: '6px 4px', borderRadius: 6, textAlign: 'center', fontSize: '0.8rem', minWidth: 0,
                                                                                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                                                                                        color: 'var(--foreground)', opacity: 0.6
                                                                                                    }}
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                        {/* Actual side */}
                                                                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                                            {['weight', 'reps', 'rpe'].map(f => (
                                                                                                <input key={f} type="text" inputMode="decimal"
                                                                                                    value={actual[f]} placeholder={target[f] ? String(target[f]) : '—'}
                                                                                                    onChange={e => updateSet(sKey, exIdx, setIdx, f, e.target.value)}
                                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                    style={{
                                                                                                        flex: 1, padding: '6px 4px', borderRadius: 6, textAlign: 'center', fontSize: '0.8rem', minWidth: 0,
                                                                                                        background: actual[f] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                                                                                                        border: `1px solid ${actual[f] ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                                                                                                        color: 'var(--foreground)', outline: 'none'
                                                                                                    }}
                                                                                                />
                                                                                            ))}
                                                                                            {/* Copy tools */}
                                                                                            <button
                                                                                                onClick={() => setIdx > 0 ? copyPrevSet(sKey, exIdx, setIdx) : copyTargetToActual(sKey, exIdx, setIdx)}
                                                                                                title={setIdx > 0 ? 'Copy previous set' : 'Copy prescribed'}
                                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--accent)', padding: '0 2px', flexShrink: 0, width: 28, textAlign: 'center' }}
                                                                                            >➜</button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {/* Stats row */}
                                                                            {validSets.length > 0 && (
                                                                                <div style={{
                                                                                    marginTop: 8, padding: '8px 10px', borderRadius: 8,
                                                                                    background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)',
                                                                                    fontSize: '0.72rem', color: 'var(--secondary-foreground)', lineHeight: 1.6
                                                                                }}>
                                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                                                                                        <span><b style={{ color: 'var(--accent)' }}>E1RM:</b> {maxE1RM} lbs</span>
                                                                                        <span><b style={{ color: 'var(--accent)' }}>NL:</b> {totalNL}</span>
                                                                                        <span><b style={{ color: 'var(--accent)' }}>Tonnage:</b> {tonnage.toLocaleString()} lbs</span>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 2 }}>
                                                                                        <span><b style={{ color: 'var(--primary)' }}>SI Total:</b> {exStress.total.toFixed(2)}</span>
                                                                                        <span><b style={{ color: 'var(--primary)' }}>Peripheral:</b> {exStress.peripheral.toFixed(2)}</span>
                                                                                        <span><b style={{ color: 'var(--primary)' }}>Central:</b> {exStress.central.toFixed(2)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Notes */}
                                                                            <div style={{ marginTop: 8 }}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={exerciseData.notes || ''}
                                                                                    onChange={e => updateNotes(sKey, exIdx, e.target.value)}
                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                    placeholder="Exercise notes…"
                                                                                    style={{
                                                                                        width: '100%', padding: '7px 10px', borderRadius: 6,
                                                                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                                                                        color: 'var(--foreground)', fontSize: '0.78rem', outline: 'none'
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Save button */}
                                                        <div style={{ marginTop: 8 }}>
                                                            <button
                                                                onClick={() => handleSave(sKey, program.id)}
                                                                disabled={saving.has(sKey)}
                                                                style={{
                                                                    width: '100%', padding: '11px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.85rem',
                                                                    background: savedKeys.has(sKey) ? '#10b981' : 'linear-gradient(135deg, #06b6d4, #10b981)',
                                                                    color: '#000', cursor: saving.has(sKey) ? 'not-allowed' : 'pointer', opacity: saving.has(sKey) ? 0.6 : 1,
                                                                    transition: 'all 200ms'
                                                                }}
                                                            >
                                                                {saving.has(sKey) ? 'Saving…' : savedKeys.has(sKey) ? '✓ Saved' : '💾 Save Workout'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

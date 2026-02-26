'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

    // Auto-save debounced effect
    const latestEditStateRef = useRef(editState);
    useEffect(() => {
        latestEditStateRef.current = editState;
    }, [editState]);

    const handleSaveRef = useRef<((sKey: string, programId: string) => Promise<void>) | null>(null);

    handleSaveRef.current = async (sKey: string, programId: string) => {
        const state = latestEditStateRef.current[sKey];
        if (!state) return;

        setSaving(prev => new Set(prev).add(sKey));
        try {
            const cleanLogs = state.map((ex: any) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                notes: ex.notes || '',
                sets: ex.sets.map((s: any) => ({ weight: s.actual.weight, reps: s.actual.reps, rpe: s.actual.rpe }))
            }));

            const res = await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, programId, sessionId: sKey, date: new Date().toISOString(), exercises: cleanLogs })
            });

            if (res.ok) {
                setSavedKeys(prev => new Set(prev).add(sKey));
                setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(sKey); return n; }), 2000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(sKey); return n; });
        }
    };

    // Auto-save throttle logic
    const saveTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    const triggerAutoSave = useCallback((sKey: string, programId: string) => {
        if (saveTimersRef.current[sKey]) {
            clearTimeout(saveTimersRef.current[sKey]);
        }
        saveTimersRef.current[sKey] = setTimeout(() => {
            if (handleSaveRef.current) {
                handleSaveRef.current(sKey, programId);
            }
        }, 1000); // Save 1 second after last edit
    }, []);

    const updateSet = (sKey: string, exIdx: number, setIdx: number, field: string, value: string, programId: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (copy[sKey]?.[exIdx]?.sets?.[setIdx]?.actual) {
                copy[sKey][exIdx].sets[setIdx].actual[field] = value;
            }
            return copy;
        });
        triggerAutoSave(sKey, programId);
    };

    const updateNotes = (sKey: string, exIdx: number, value: string, programId: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (copy[sKey]?.[exIdx]) copy[sKey][exIdx].notes = value;
            return copy;
        });
        // triggerAutoSave(sKey, programId); // Optional: if we want to save on every keystroke in notes
    };

    const copyPrevSet = (sKey: string, exIdx: number, setIdx: number, programId: string) => {
        if (setIdx === 0) return;
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            const prevActual = copy[sKey]?.[exIdx]?.sets?.[setIdx - 1]?.actual;
            if (prevActual && copy[sKey][exIdx].sets[setIdx]) {
                copy[sKey][exIdx].sets[setIdx].actual = { ...prevActual };
            }
            return copy;
        });
        triggerAutoSave(sKey, programId);
    };

    const copyTargetToActual = (sKey: string, exIdx: number, setIdx: number, programId: string) => {
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
        triggerAutoSave(sKey, programId);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: '3rem' }}>
            {programs.map(program => {
                const blockOpen = openBlocks.has(program.id);
                const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
                const totalWeeks = weeks.length;
                const totalSessions = weeks.reduce((s: number, w: any) => s + (Array.isArray(w.sessions) ? w.sessions.length : 0), 0);

                return (
                    <div key={program.id} style={{ marginBottom: 16 }}>
                        {/* ═══ Block Header ═══ */}
                        <button
                            onClick={() => toggle(openBlocks, program.id, setOpenBlocks)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px', background: 'var(--brand-dark-blue, #1e3a8a)', // Dark blue like RTS
                                border: 'none', borderBottom: '1px solid var(--card-border)',
                                color: '#ffffff', cursor: 'pointer', textAlign: 'left'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{program.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                    {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} • {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', transition: 'transform 200ms', transform: blockOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </button>

                        {/* ═══ Weeks ═══ */}
                        {blockOpen && weeks.map((week: any) => {
                            if (!week) return null;
                            const weekNum = week.weekNumber || 1;
                            const weekKey = `${program.id}-w${weekNum}`;
                            const weekOpen = openWeeks.has(weekKey);
                            const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];

                            return (
                                <div key={weekKey} style={{ background: '#f8fafc', color: '#0f172a' }}> {/* Light grey background for RTS style */}
                                    <button
                                        onClick={() => toggle(openWeeks, weekKey, setOpenWeeks)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '12px 16px', background: '#e2e8f0', // Slightly darker grey for week header
                                            border: 'none', borderBottom: '1px solid #cbd5e1',
                                            color: '#0f172a', cursor: 'pointer', fontSize: '1rem', fontWeight: 600
                                        }}
                                    >
                                        <span>Week {weekNum} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}>• {sessions.length} session{sessions.length !== 1 ? 's' : ''}</span></span>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', transition: 'transform 200ms', transform: weekOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
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
                                            <div key={sKey} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                {/* Session header */}
                                                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: sessionOpen ? '#1e3a8a' : '#f8fafc', color: sessionOpen ? '#fff' : '#0f172a', transition: 'all 0.2s' }}>
                                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                                                        toggle(openSessions, sKey, setOpenSessions);
                                                        if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            {sessionOpen ? (
                                                                <span style={{ color: '#fff' }}>▼</span>
                                                            ) : (
                                                                <span style={{ color: '#64748b' }}>▶</span>
                                                            )}
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                                                Session {day}
                                                                {session.name && <span style={{ fontWeight: 400, fontSize: '0.9rem', color: sessionOpen ? 'rgba(255,255,255,0.7)' : '#64748b', marginLeft: 8 }}>— {session.name}</span>}
                                                            </div>
                                                        </div>

                                                        {/* Progress bar (only show when closed) */}
                                                        {!sessionOpen && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 24 }}>
                                                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#cbd5e1', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: 3, transition: 'width 300ms',
                                                                        width: `${progress}%`,
                                                                        background: progress === 100 ? '#10b981' : '#3b82f6'
                                                                    }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, width: 30 }}>
                                                                    {progress}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Auto-save status indicator */}
                                                    {sessionOpen && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                                            {saving.has(sKey) ? (
                                                                <span style={{ color: '#fbbf24' }}>Saving...</span> /* Yellow */
                                                            ) : savedKeys.has(sKey) ? (
                                                                <span style={{ color: '#34d399' }}>✓ Saved</span> /* Green */
                                                            ) : (
                                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>📝 Edit</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ═══ Expanded Session: Exercise Cards ═══ */}
                                                {sessionOpen && (
                                                    <div style={{ padding: '0', background: '#e2e8f0' }}> {/* Light grey backdrop for cards */}
                                                        {/* "All Changes Saved" header like RTS */}
                                                        <div style={{ padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1' }}>
                                                            <span style={{ color: saving.has(sKey) ? '#d97706' : '#10b981' }}>{saving.has(sKey) ? 'Saving changes...' : 'All Changes Saved.'}</span>
                                                            <span style={{ fontWeight: 'normal', color: '#64748b' }}>Edit Mode</span>
                                                        </div>

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
                                                                <div key={exIdx} style={{ background: '#fff', borderBottom: '1px solid #cbd5e1' }}>
                                                                    {/* Exercise header */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                            <button
                                                                                onClick={() => {
                                                                                    toggle(openExercises, exKey, setOpenExercises);
                                                                                    if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                }}
                                                                                style={{
                                                                                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    border: '2px solid #64748b', background: '#fff', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', padding: 0
                                                                                }}
                                                                            >
                                                                                {exOpen ? '−' : '+'}
                                                                            </button>
                                                                            <span style={{ fontSize: '1rem', color: '#2563eb', fontWeight: 500 }}>{exerciseData.name || ex.name}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                                                                            Sets <div style={{ minWidth: 40, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center', background: '#fff' }}>{sets.length}</div>
                                                                            <span style={{ fontSize: '1.2rem', color: '#475569', marginLeft: 4 }}>...</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Exercise body / Input rows */}
                                                                    {exOpen && (
                                                                        <div style={{ padding: '0 8px 16px 8px' }}>
                                                                            {/* Target / Actual Header */}
                                                                            <div style={{ display: 'flex', borderBottom: '1px dashed #cbd5e1', marginBottom: 8 }}>
                                                                                <div style={{ width: '130px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e3a8a', padding: '4px 0' }}>Target</div>
                                                                                <div style={{ flex: 1, position: 'relative' }}>
                                                                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: '#cbd5e1' }}></div>
                                                                                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: '#1e3a8a', padding: '4px 0', background: '#f1f5f9' }}>Actual</div>
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
                                                                                    <div style={{ width: 24 }}></div> {/* Space for the trailing dots */}
                                                                                </div>
                                                                            </div>

                                                                            {/* Set rows */}
                                                                            {sets.map((set: any, setIdx: number) => {
                                                                                const target = isEdit ? set.target : set;
                                                                                const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                                return (
                                                                                    <div key={setIdx} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                                                        {/* Target side */}
                                                                                        <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                                                            {['weight', 'reps', 'rpe'].map(f => (
                                                                                                <div key={f} style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#475569' }}>
                                                                                                    {target[f] || '\u00A0'}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>

                                                                                        {/* Green Arrow */}
                                                                                        <button
                                                                                            onClick={() => setIdx > 0 ? copyPrevSet(sKey, exIdx, setIdx, program.id) : copyTargetToActual(sKey, exIdx, setIdx, program.id)}
                                                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                                                                                        >
                                                                                            <span style={{ color: '#10b981', fontSize: '1.4rem' }}>➞</span>
                                                                                        </button>

                                                                                        {/* Actual side */}
                                                                                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}>
                                                                                            {['weight', 'reps', 'rpe'].map(f => (
                                                                                                <input key={f} type="number" inputMode="decimal"
                                                                                                    value={actual[f]}
                                                                                                    onChange={e => updateSet(sKey, exIdx, setIdx, f, e.target.value, program.id)}
                                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                    style={{
                                                                                                        flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: 4, background: '#fff', textAlign: 'center', fontSize: '0.9rem', color: '#0f172a', width: '100%', outlineColor: '#3b82f6'
                                                                                                    }}
                                                                                                />
                                                                                            ))}
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
                                                                            <div style={{ display: 'flex', padding: '12px 0', alignItems: 'flex-start' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginRight: 12, marginTop: 4 }}>Notes:</span>
                                                                                <textarea
                                                                                    value={exerciseData.notes || ''}
                                                                                    onChange={e => updateNotes(sKey, exIdx, e.target.value, program.id)}
                                                                                    onBlur={() => triggerAutoSave(sKey, program.id)}
                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                    placeholder="Exercise Notes"
                                                                                    style={{
                                                                                        flex: 1, minHeight: 60, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.9rem', color: '#0f172a', resize: 'vertical', outlineColor: '#3b82f6'
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
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

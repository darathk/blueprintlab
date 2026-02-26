'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/* ─────────── types ─────────── */
interface SetDef { weight?: string; reps?: string; rpe?: string; }
interface Exercise { id: string; name: string; sets: SetDef[]; }
interface Session { id: string; name: string; day: number; exercises: Exercise[]; scheduledDate?: string; }
interface Week { weekNumber: number; sessions: Session[]; }
interface Program { id: string; name: string; startDate?: string; weeks: Week[]; }
interface Log { programId: string; sessionId: string; date: string; exercises: { exerciseId: string; name: string; sets: { weight: string; reps: string; rpe: string; }[]; }[]; }

/* ─────────── helpers ─────────── */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function sessionKey(programId: string, weekNum: number, day: number) {
    return `${programId}_w${weekNum}_d${day}`;
}

/** Compute how many sets have actual data filled in */
function sessionProgress(session: Session, log: Log | undefined): number {
    const totalSets = session.exercises.reduce((s, ex) => s + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
    if (!totalSets) return 0;
    if (!log) return 0;
    let filled = 0;
    log.exercises.forEach(logEx => {
        logEx.sets.forEach(s => {
            if (s.weight || s.reps) filled++;
        });
    });
    return Math.min(100, Math.round((filled / totalSets) * 100));
}

/* ─────────── component ─────────── */
export default function ScheduleView({ programs, athleteId, logs }: {
    programs: Program[];
    athleteId: string;
    logs: Log[];
}) {
    const router = useRouter();

    // Collect ALL months that have sessions
    const monthData = useCallback(() => {
        const result: Map<string, { monthKey: string; label: string; year: number; month: number; weeks: { weekNumber: number; program: Program; sessions: { session: Session; date?: Date; log?: Log }[] }[] }> = new Map();

        if (!Array.isArray(programs)) return [];

        programs.forEach(program => {
            const weeks = Array.isArray(program.weeks) ? program.weeks : [];
            if (!weeks.length) return;
            const startDate = program.startDate ? new Date(program.startDate) : null;

            weeks.forEach((week: any) => {
                if (!week || !Array.isArray(week.sessions)) return;
                const weekNumber = week.weekNumber || 1;

                week.sessions.forEach((session: any) => {
                    if (!session) return;
                    let sessionDate: Date | undefined;

                    if (session.scheduledDate) {
                        sessionDate = new Date(session.scheduledDate + 'T00:00:00');
                    } else if (startDate) {
                        const offset = (weekNumber - 1) * 7 + ((session.day || 1) - 1);
                        sessionDate = new Date(startDate);
                        sessionDate.setDate(sessionDate.getDate() + offset);
                    }

                    if (!sessionDate || isNaN(sessionDate.getTime())) return;

                    const y = sessionDate.getFullYear();
                    const m = sessionDate.getMonth();
                    const monthKey = `${y}-${String(m).padStart(2, '0')}`;

                    if (!result.has(monthKey)) {
                        result.set(monthKey, { monthKey, label: `${MONTHS[m]} ${y}`, year: y, month: m, weeks: [] });
                    }

                    const monthEntry = result.get(monthKey)!;
                    let weekEntry = monthEntry.weeks.find(w => w.weekNumber === weekNumber && w.program.id === program.id);
                    if (!weekEntry) {
                        weekEntry = { weekNumber, program, sessions: [] };
                        monthEntry.weeks.push(weekEntry);
                    }

                    const sKey = sessionKey(program.id, weekNumber, session.day || 1);
                    const log = Array.isArray(logs) ? logs.find(l => l.sessionId === sKey && l.programId === program.id) : undefined;

                    weekEntry.sessions.push({ session: { ...session, exercises: Array.isArray(session.exercises) ? session.exercises : [] }, date: sessionDate, log });
                });
            });
        });

        // Sort months, weeks, sessions
        const sorted = [...result.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        sorted.forEach(m => {
            m.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
            m.weeks.forEach(w => w.sessions.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0)));
        });

        return sorted;
    }, [programs, logs]);

    const months = monthData();

    // Auto-expand current month/week
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentMonthKey]));
    const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => {
        // Find which week the current date falls in
        const keys = new Set<string>();
        months.forEach(m => {
            if (m.monthKey === currentMonthKey) {
                m.weeks.forEach(w => {
                    w.sessions.forEach(s => {
                        if (s.date) {
                            const diff = Math.abs(now.getTime() - s.date.getTime());
                            if (diff < 7 * 24 * 60 * 60 * 1000) {
                                keys.add(`${m.monthKey}-w${w.weekNumber}-${w.program.id}`);
                            }
                        }
                    });
                });
            }
        });
        return keys;
    });
    const [openDays, setOpenDays] = useState<Set<string>>(new Set());
    const [editState, setEditState] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

    const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };

    // Initialize edit state for a day
    const initEdit = (sKey: string, session: Session, log: Log | undefined) => {
        if (editState[sKey]) return; // already initialized
        const state = session.exercises.map(ex => {
            const logEx = log?.exercises?.find(l => l.exerciseId === ex.id || l.name === ex.name);
            return {
                exerciseId: ex.id,
                name: ex.name,
                sets: (Array.isArray(ex.sets) ? ex.sets : []).map((s, i) => {
                    const saved = logEx?.sets?.[i];
                    return {
                        target: { weight: s.weight || '', reps: s.reps || '', rpe: s.rpe || '' },
                        actual: { weight: saved?.weight || '', reps: saved?.reps || '', rpe: saved?.rpe || '' }
                    };
                })
            };
        });
        setEditState(prev => ({ ...prev, [sKey]: state }));
    };

    const updateSet = (sKey: string, exIdx: number, setIdx: number, field: string, value: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            copy[sKey][exIdx].sets[setIdx].actual[field] = value;
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
                sets: ex.sets.map((s: any) => ({ weight: s.actual.weight, reps: s.actual.reps, rpe: s.actual.rpe }))
            }));
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, programId, sessionId: sKey, date: new Date().toISOString(), exercises: cleanLogs })
            });
            setSavedKeys(prev => new Set(prev).add(sKey));
            setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(sKey); return n; }), 2000);
            router.refresh();
        } catch (e) { console.error(e); }
        finally { setSaving(prev => { const n = new Set(prev); n.delete(sKey); return n; }); }
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const formatDayLabel = (date: Date) => {
        return `${dayNames[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
    };

    if (!months.length) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No training schedule found.</p>
                <p style={{ fontSize: '0.85rem' }}>Ask your coach to assign a program.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {months.map(m => {
                const monthOpen = openMonths.has(m.monthKey);
                return (
                    <div key={m.monthKey}>
                        {/* ── Month Header ── */}
                        <button
                            onClick={() => toggle(openMonths, m.monthKey, setOpenMonths)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 16px', background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.1))',
                                border: 'none', borderBottom: '1px solid var(--card-border)',
                                color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 700
                            }}
                        >
                            <span>{m.label}</span>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', transition: 'transform 200ms', transform: monthOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </button>

                        {/* ── Weeks ── */}
                        {monthOpen && m.weeks.map(w => {
                            const weekKey = `${m.monthKey}-w${w.weekNumber}-${w.program.id}`;
                            const weekOpen = openWeeks.has(weekKey);
                            const weekSessions = w.sessions.length;

                            return (
                                <div key={weekKey}>
                                    <button
                                        onClick={() => toggle(openWeeks, weekKey, setOpenWeeks)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '11px 16px 11px 28px', background: 'rgba(255,255,255,0.02)',
                                            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
                                        }}
                                    >
                                        <span>Week {w.weekNumber} <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '0.8rem' }}>• {weekSessions} session{weekSessions !== 1 ? 's' : ''}</span></span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: weekOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                    </button>

                                    {/* ── Days ── */}
                                    {weekOpen && w.sessions.map(({ session, date, log }) => {
                                        const sKey = sessionKey(w.program.id, w.weekNumber, session.day);
                                        const dayKey = `${weekKey}-d${session.day}`;
                                        const dayOpen = openDays.has(dayKey);
                                        const progress = sessionProgress(session, log);
                                        const isToday = date ? date.toDateString() === now.toDateString() : false;

                                        return (
                                            <div key={dayKey}>
                                                {/* Day row */}
                                                <button
                                                    onClick={() => {
                                                        toggle(openDays, dayKey, setOpenDays);
                                                        if (!openDays.has(dayKey)) initEdit(sKey, session, log);
                                                    }}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '12px 16px 12px 44px',
                                                        background: isToday ? 'rgba(6,182,212,0.06)' : 'transparent',
                                                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                        color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', transition: 'transform 200ms', transform: dayOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                            {isToday && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#000', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>TODAY</span>}
                                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{date ? formatDayLabel(date) : `Day ${session.day}`}</span>
                                                            <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.8rem' }}>— {session.name}</span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
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

                                                {/* Expanded: exercise list + inline editing */}
                                                {dayOpen && (
                                                    <div style={{ padding: '8px 16px 16px 56px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
                                                        {(editState[sKey] || session.exercises).map((ex: any, exIdx: number) => {
                                                            const isEdit = !!editState[sKey];
                                                            const exerciseData = isEdit ? editState[sKey][exIdx] : ex;
                                                            const sets = isEdit ? exerciseData.sets : (Array.isArray(ex.sets) ? ex.sets : []);

                                                            return (
                                                                <div key={exIdx} style={{ marginBottom: 12 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, color: 'rgba(6,182,212,0.9)' }}>
                                                                        {exerciseData.name || ex.name}
                                                                    </div>

                                                                    {/* Set headers */}
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr', gap: 4, fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600, marginBottom: 2, padding: '0 2px' }}>
                                                                        <span>Set</span><span>Weight</span><span>Reps</span><span>RPE</span>
                                                                    </div>

                                                                    {sets.map((set: any, setIdx: number) => {
                                                                        const target = isEdit ? set.target : set;
                                                                        const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };

                                                                        return (
                                                                            <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr', gap: 4, marginBottom: 3 }}>
                                                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }}>{setIdx + 1}</div>
                                                                                {['weight', 'reps', 'rpe'].map(field => (
                                                                                    <input
                                                                                        key={field}
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        placeholder={target[field] ? String(target[field]) : '—'}
                                                                                        value={actual[field]}
                                                                                        onChange={e => updateSet(sKey, exIdx, setIdx, field, e.target.value)}
                                                                                        onFocus={() => { if (!editState[sKey]) initEdit(sKey, session, log); }}
                                                                                        style={{
                                                                                            width: '100%', padding: '6px 8px', borderRadius: 6,
                                                                                            background: actual[field] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                                                                                            border: `1px solid ${actual[field] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                                                                            color: 'var(--foreground)', fontSize: '0.8rem', outline: 'none',
                                                                                            textAlign: 'center', minWidth: 0
                                                                                        }}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Save button */}
                                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                            <button
                                                                onClick={() => handleSave(sKey, w.program.id)}
                                                                disabled={saving.has(sKey)}
                                                                style={{
                                                                    flex: 1, padding: '10px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.85rem',
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

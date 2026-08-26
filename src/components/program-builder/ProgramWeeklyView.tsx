'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { getExerciseCategory } from '@/lib/exercise-db';
import { Plus, Trash2, GripVertical, Copy, ChevronLeft, ChevronRight, MoreHorizontal, CopyPlus, X } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

const CATEGORY_COLORS: Record<string, string> = {
    'Knee': '#EAB308',
    'Hip': '#EC4899',
    'Horizontal Push': '#0EA5E9',
    'Vertical Push': '#14B8A6',
    'Horizontal Pull': '#6366F1',
    'Vertical Pull': '#8B5CF6',
    'Isolation (Upper)': '#A78BFA',
    'Isolation (Lower)': '#F472B6',
    'Isolation/Accessory': '#64748B',
};

const DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatSetsSummary(sets: any[]) {
    if (!Array.isArray(sets) || sets.length === 0) return '';
    const parts: string[] = [];
    let i = 0;
    while (i < sets.length) {
        const s = sets[i];
        const reps = s.reps || '';
        const rpe = s.rpe || '';
        let count = 1;
        while (i + count < sets.length) {
            const next = sets[i + count];
            if (String(next.reps) === String(reps) && String(next.rpe) === String(rpe)) {
                count++;
            } else break;
        }
        let part = count > 1 ? `${count}x${reps}` : `x${reps}`;
        if (rpe) part += ` @${rpe}`;
        parts.push(part);
        i += count;
    }
    return parts.join(', ');
}

interface WeeklyViewProps {
    weeks: any[];
    setWeeks: (fn: any) => void;
    startDate: string;
    initialExercises?: any;
    liftTargets?: Record<string, { timeToPeak: string; stressTarget: string }>;
}

export default function ProgramWeeklyView({
    weeks,
    setWeeks,
    startDate,
    initialExercises,
    liftTargets,
}: WeeklyViewProps) {
    // Which week number we are viewing
    const [currentWeekNum, setCurrentWeekNum] = useState(() => {
        // Default to the first week with sessions, or week 1
        const first = weeks.find(w => w.sessions && w.sessions.length > 0);
        return first ? first.weekNumber : 1;
    });

    // Drag state for exercises between days
    const [dragSource, setDragSource] = useState<{ weekIdx: number; sessionIdx: number; exerciseIdx: number } | null>(null);
    const [dropTargetDay, setDropTargetDay] = useState<number | null>(null);
    const [dropTargetExIdx, setDropTargetExIdx] = useState<number | null>(null);
    // Context menu
    const [contextMenu, setContextMenu] = useState<{ exerciseIdx: number; dayNum: number; x: number; y: number } | null>(null);

    // Current week object
    const currentWeek = useMemo(() => weeks.find(w => w.weekNumber === currentWeekNum), [weeks, currentWeekNum]);
    const currentWeekIdx = useMemo(() => weeks.findIndex(w => w.weekNumber === currentWeekNum), [weeks, currentWeekNum]);

    const maxWeekNum = useMemo(() => weeks.reduce((m, w) => Math.max(m, w.weekNumber || 0), 0), [weeks]);

    // Build sessions by day (1=Mon, 2=Tue, ... 7=Sun in the Monday-start data model)
    const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 7]; // dayNum values in Mon-Sun order
    const DISPLAY_DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    const sessionsByDay = useMemo(() => {
        const map: Record<number, any> = {};
        if (!currentWeek) return map;
        currentWeek.sessions.forEach((s: any) => {
            map[s.day] = s;
        });
        return map;
    }, [currentWeek]);

    // Week date range string
    const weekDateRange = useMemo(() => {
        if (!startDate) return `Week ${currentWeekNum}`;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (currentWeekNum - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
        return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
    }, [startDate, currentWeekNum]);

    // Get date string for a given day number in the current week
    const getDateForDay = useCallback((dayNum: number) => {
        if (!startDate) return '';
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const d = new Date(start);
        d.setDate(d.getDate() + (currentWeekNum - 1) * 7 + (dayNum - 1));
        return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    }, [startDate, currentWeekNum]);

    // ──── Stress Metrics Computation ────
    const stressMetrics = useMemo(() => {
        const categories = ['Horizontal Push', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull', 'Knee', 'Hip'];
        const stats: Record<string, { total: number; central: number; peripheral: number; reps: number }> = {};
        categories.forEach(c => stats[c] = { total: 0, central: 0, peripheral: 0, reps: 0 });

        if (!currentWeek) return { stats, grandTotal: 0, grandCentral: 0, grandPeripheral: 0, grandReps: 0 };

        currentWeek.sessions.forEach((session: any) => {
            (session.exercises || []).forEach((ex: any) => {
                const category = ex.category || getExerciseCategory(ex.name || '');
                const setsList = Array.isArray(ex.sets) ? ex.sets : [];

                setsList.forEach((s: any) => {
                    let reps = 0;
                    if (typeof s.reps === 'string' && s.reps.includes('-')) {
                        const [min, max] = s.reps.split('-').map(Number);
                        reps = (min + max) / 2;
                    } else {
                        reps = parseFloat(s.reps) || 0;
                    }
                    const rpe = parseFloat(s.rpe) || 0;
                    if (reps > 0 && rpe > 0) {
                        const { total, central, peripheral } = calculateStress(reps, rpe);
                        if (stats[category]) {
                            stats[category].total += total;
                            stats[category].central += central;
                            stats[category].peripheral += peripheral;
                            stats[category].reps += reps;
                        }
                    }
                });
            });
        });

        const grandTotal = Object.values(stats).reduce((s, v) => s + v.total, 0);
        const grandCentral = Object.values(stats).reduce((s, v) => s + v.central, 0);
        const grandPeripheral = Object.values(stats).reduce((s, v) => s + v.peripheral, 0);
        const grandReps = Object.values(stats).reduce((s, v) => s + v.reps, 0);

        return { stats, grandTotal, grandCentral, grandPeripheral, grandReps };
    }, [currentWeek]);

    // ──── Handlers ────

    const ensureWeekExists = (weekNum: number) => {
        setWeeks((prev: any[]) => {
            if (prev.find(w => w.weekNumber === weekNum)) return prev;
            const maxW = prev.reduce((m, w) => Math.max(m, w.weekNumber), 0);
            const newWeeks = [...prev];
            for (let i = maxW + 1; i <= weekNum; i++) {
                if (!newWeeks.find(w => w.weekNumber === i)) {
                    newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
                }
            }
            return newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        });
    };

    const addExerciseToDay = useCallback((dayNum: number, exerciseOrName: any) => {
        const exerciseName = typeof exerciseOrName === 'string' ? exerciseOrName : exerciseOrName.name;
        const exerciseCategory = (typeof exerciseOrName === 'object' && exerciseOrName.category)
            ? exerciseOrName.category
            : getExerciseCategory(exerciseName);

        const sets = [
            { id: generateId(), reps: '5', rpe: '6', weight: '' },
            { id: generateId(), reps: '5', rpe: '7', weight: '' },
            { id: generateId(), reps: '5', rpe: '8', weight: '' },
        ];

        const newExercise = {
            id: generateId(),
            name: exerciseName,
            category: exerciseCategory,
            sets,
            notes: '',
        };

        setWeeks((prev: any[]) => {
            let wIdx = prev.findIndex(w => w.weekNumber === currentWeekNum);
            if (wIdx === -1) {
                // Create the week
                const newWeeks = [...prev, { id: generateId(), weekNumber: currentWeekNum, sessions: [] }];
                newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
                wIdx = newWeeks.findIndex(w => w.weekNumber === currentWeekNum);
                return newWeeks.map((w, wi) => {
                    if (wi !== wIdx) return w;
                    return {
                        ...w,
                        sessions: [{
                            id: generateId(),
                            day: dayNum,
                            name: `Session`,
                            exercises: [newExercise],
                            scheduledDate: '',
                        }],
                    };
                });
            }

            return prev.map((w, wi) => {
                if (wi !== wIdx) return w;
                const sIdx = w.sessions.findIndex((s: any) => s.day === dayNum);
                if (sIdx === -1) {
                    return {
                        ...w,
                        sessions: [...w.sessions, {
                            id: generateId(),
                            day: dayNum,
                            name: `Session`,
                            exercises: [newExercise],
                            scheduledDate: '',
                        }],
                    };
                }
                return {
                    ...w,
                    sessions: w.sessions.map((s: any, si: number) =>
                        si !== sIdx ? s : { ...s, exercises: [...s.exercises, newExercise] }
                    ),
                };
            });
        });
    }, [currentWeekNum, setWeeks]);

    const updateSet = useCallback((dayNum: number, exerciseIdx: number, setIdx: number, field: string, value: string) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (s.day !== dayNum) return s;
                    return {
                        ...s,
                        exercises: s.exercises.map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            return {
                                ...ex,
                                sets: ex.sets.map((set: any, si: number) =>
                                    si !== setIdx ? set : { ...set, [field]: value }
                                ),
                            };
                        }),
                    };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const addSet = useCallback((dayNum: number, exerciseIdx: number) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (s.day !== dayNum) return s;
                    return {
                        ...s,
                        exercises: s.exercises.map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            const lastSet = ex.sets[ex.sets.length - 1];
                            return {
                                ...ex,
                                sets: [...ex.sets, {
                                    id: generateId(),
                                    reps: lastSet?.reps || '5',
                                    rpe: lastSet?.rpe || '7',
                                    weight: lastSet?.weight || '',
                                }],
                            };
                        }),
                    };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const removeSet = useCallback((dayNum: number, exerciseIdx: number, setIdx: number) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (s.day !== dayNum) return s;
                    return {
                        ...s,
                        exercises: s.exercises.map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            return { ...ex, sets: ex.sets.filter((_: any, si: number) => si !== setIdx) };
                        }),
                    };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const removeExercise = useCallback((dayNum: number, exerciseIdx: number) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (s.day !== dayNum) return s;
                    const newExercises = s.exercises.filter((_: any, ei: number) => ei !== exerciseIdx);
                    return { ...s, exercises: newExercises };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const duplicateExercise = useCallback((dayNum: number, exerciseIdx: number) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (s.day !== dayNum) return s;
                    const original = s.exercises[exerciseIdx];
                    if (!original) return s;
                    const clone = {
                        ...original,
                        id: generateId(),
                        sets: original.sets.map((set: any) => ({ ...set, id: generateId() })),
                    };
                    const newExercises = [...s.exercises];
                    newExercises.splice(exerciseIdx + 1, 0, clone);
                    return { ...s, exercises: newExercises };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const updateSessionName = useCallback((dayNum: number, name: string) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) =>
                    s.day !== dayNum ? s : { ...s, name }
                ),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const clearDay = useCallback((dayNum: number) => {
        if (!confirm('Clear all exercises from this day?')) return;
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.filter((s: any) => s.day !== dayNum),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const duplicateWeekToNext = useCallback(() => {
        setWeeks((prev: any[]) => {
            const srcWeek = prev.find(w => w.weekNumber === currentWeekNum);
            if (!srcWeek || srcWeek.sessions.length === 0) return prev;
            const targetNum = currentWeekNum + 1;
            const existing = prev.find(w => w.weekNumber === targetNum);
            if (existing && existing.sessions.length > 0) {
                if (!confirm(`Week ${targetNum} already has sessions. Replace?`)) return prev;
            }
            const clonedSessions = srcWeek.sessions.map((s: any) => ({
                ...s,
                id: generateId(),
                exercises: s.exercises.map((e: any) => ({
                    ...e,
                    id: generateId(),
                    sets: (e.sets || []).map((set: any) => ({ ...set, id: generateId() })),
                })),
            }));
            if (existing) {
                return prev.map(w => w.weekNumber === targetNum ? { ...w, sessions: clonedSessions } : w);
            }
            const newWeeks = [...prev, { id: generateId(), weekNumber: targetNum, sessions: clonedSessions }];
            return newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        });
    }, [currentWeekNum, setWeeks]);

    // ──── Drag & Drop ────

    const handleExDragStart = (e: React.DragEvent, dayNum: number, exerciseIdx: number) => {
        const wIdx = weeks.findIndex(w => w.weekNumber === currentWeekNum);
        const sIdx = weeks[wIdx]?.sessions.findIndex((s: any) => s.day === dayNum);
        if (wIdx === -1 || sIdx === -1) return;
        setDragSource({ weekIdx: wIdx, sessionIdx: sIdx, exerciseIdx });
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'weekly-exercise', dayNum, exerciseIdx }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDayDragOver = (e: React.DragEvent, dayNum: number, exIdx?: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTargetDay(dayNum);
        setDropTargetExIdx(exIdx ?? null);
    };

    const handleDayDrop = (e: React.DragEvent, targetDayNum: number, targetExIdx?: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTargetDay(null);
        setDropTargetExIdx(null);

        // Try to parse the drag data
        let data: any = null;
        try {
            const raw = e.dataTransfer.getData('text/plain');
            data = JSON.parse(raw);
        } catch { /* fallback below */ }

        if (!data) return;

        // Handle drag from ExercisePicker (library)
        if (data.type === 'exercise-library' || data.type === 'exercise') {
            addExerciseToDay(targetDayNum, data);
            return;
        }

        // Handle drag between day columns (move exercise)
        if (data.type === 'weekly-exercise' && dragSource) {
            const { weekIdx: srcW, sessionIdx: srcS, exerciseIdx: srcE } = dragSource;

            setWeeks((prev: any[]) => {
                const newWeeks = prev.map(w => ({
                    ...w,
                    sessions: w.sessions.map((s: any) => ({
                        ...s,
                        exercises: [...s.exercises],
                    })),
                }));

                const srcSession = newWeeks[srcW]?.sessions[srcS];
                if (!srcSession) return prev;
                const [movedExercise] = srcSession.exercises.splice(srcE, 1);
                if (!movedExercise) return prev;

                // Find or create target session
                const tgtWIdx = newWeeks.findIndex(w => w.weekNumber === currentWeekNum);
                if (tgtWIdx === -1) return prev;

                let tgtSIdx = newWeeks[tgtWIdx].sessions.findIndex((s: any) => s.day === targetDayNum);
                if (tgtSIdx === -1) {
                    // Create session for this day
                    newWeeks[tgtWIdx].sessions.push({
                        id: generateId(),
                        day: targetDayNum,
                        name: `Session`,
                        exercises: [],
                        scheduledDate: '',
                    });
                    tgtSIdx = newWeeks[tgtWIdx].sessions.length - 1;
                }

                const tgtSession = newWeeks[tgtWIdx].sessions[tgtSIdx];
                if (targetExIdx !== undefined && targetExIdx !== null) {
                    tgtSession.exercises.splice(targetExIdx, 0, movedExercise);
                } else {
                    tgtSession.exercises.push(movedExercise);
                }

                return newWeeks;
            });
            setDragSource(null);
        }
    };

    const handleDragEnd = () => {
        setDragSource(null);
        setDropTargetDay(null);
        setDropTargetExIdx(null);
    };

    const prevWeek = () => {
        if (currentWeekNum > 1) setCurrentWeekNum(currentWeekNum - 1);
    };
    const nextWeek = () => {
        setCurrentWeekNum(currentWeekNum + 1);
        ensureWeekExists(currentWeekNum + 1);
    };

    const addWeek = () => {
        const newNum = maxWeekNum + 1;
        ensureWeekExists(newNum);
        setCurrentWeekNum(newNum);
    };

    // ──── RENDER ────

    const METRIC_CATS = ['Horizontal Push', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull', 'Knee', 'Hip'];
    const METRIC_SHORT: Record<string, string> = {
        'Horizontal Push': 'HPush',
        'Vertical Push': 'VPush',
        'Horizontal Pull': 'HPull',
        'Vertical Pull': 'VPull',
        'Knee': 'Knee',
        'Hip': 'Hip',
    };

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            {/* ── Week Navigation Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1rem', padding: '0.25rem 0', gap: '1rem', flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={prevWeek} disabled={currentWeekNum <= 1} style={{
                        background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)',
                        borderRadius: '6px', padding: '6px 12px', cursor: currentWeekNum <= 1 ? 'not-allowed' : 'pointer',
                        opacity: currentWeekNum <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center',
                    }}>
                        <ChevronLeft size={16} />
                    </button>
                    <div>
                        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--foreground)' }}>
                            Week {currentWeekNum}
                        </span>
                        <span style={{ marginLeft: '0.6rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', fontWeight: 500 }}>
                            ({weekDateRange})
                        </span>
                    </div>
                    <button onClick={nextWeek} style={{
                        background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)',
                        borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {/* Quick week tabs */}
                    {weeks.filter(w => w.sessions && w.sessions.length > 0).slice(0, 8).map(w => (
                        <button
                            key={w.weekNumber}
                            onClick={() => setCurrentWeekNum(w.weekNumber)}
                            style={{
                                background: w.weekNumber === currentWeekNum ? 'var(--primary)' : 'var(--card-bg)',
                                color: w.weekNumber === currentWeekNum ? '#000' : 'var(--secondary-foreground)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                transition: 'all 0.15s',
                            }}
                        >
                            W{w.weekNumber}
                        </button>
                    ))}
                    <button onClick={addWeek} style={{
                        background: 'transparent', border: '1px dashed var(--card-border)',
                        color: 'var(--primary)', borderRadius: '6px', padding: '5px 12px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}>
                        +
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={duplicateWeekToNext} title="Duplicate this week to next" style={{
                        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                        color: 'var(--secondary-foreground)', borderRadius: '6px', padding: '6px 14px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <CopyPlus size={15} /> Duplicate Week
                    </button>
                </div>
            </div>

            {/* ── Stress Metrics Table ── */}
            <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius)', marginBottom: '1.25rem', overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 1rem', borderBottom: '1px solid var(--card-border)',
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Stress Metrics
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                        Calculate for: <strong style={{ color: 'var(--foreground)' }}>Entire week</strong>
                    </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--secondary-foreground)', fontWeight: 600 }}>Metric</th>
                                <th style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--foreground)', fontWeight: 800 }}>Total</th>
                                {METRIC_CATS.map(c => (
                                    <th key={c} style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                        {METRIC_SHORT[c]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '6px 14px', fontWeight: 800, color: 'var(--foreground)' }}>Total</td>
                                <td style={{ textAlign: 'center', padding: '6px 14px', fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>
                                    {stressMetrics.grandTotal.toFixed(1)}
                                </td>
                                {METRIC_CATS.map(c => (
                                    <td key={c} style={{ textAlign: 'center', padding: '6px 14px', color: 'var(--foreground)', fontWeight: 600 }}>
                                        {stressMetrics.stats[c]?.total.toFixed(1) || '0.0'}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td style={{ padding: '5px 14px', color: 'var(--secondary-foreground)' }}>Peripheral</td>
                                <td style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                    {stressMetrics.grandPeripheral.toFixed(1)}
                                </td>
                                {METRIC_CATS.map(c => (
                                    <td key={c} style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                        {stressMetrics.stats[c]?.peripheral.toFixed(1) || '0.0'}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td style={{ padding: '5px 14px', color: 'var(--secondary-foreground)' }}>Central</td>
                                <td style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                    {stressMetrics.grandCentral.toFixed(1)}
                                </td>
                                {METRIC_CATS.map(c => (
                                    <td key={c} style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                        {stressMetrics.stats[c]?.central.toFixed(1) || '0.0'}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td style={{ padding: '5px 14px', color: 'var(--secondary-foreground)' }}>CS Balance</td>
                                <td style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                    {stressMetrics.grandTotal > 0 ? `${Math.round((stressMetrics.grandCentral / stressMetrics.grandTotal) * 100)}%` : '—'}
                                </td>
                                {METRIC_CATS.map(c => {
                                    const s = stressMetrics.stats[c];
                                    return (
                                        <td key={c} style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)' }}>
                                            {s && s.total > 0 ? `${Math.round((s.central / s.total) * 100)}%` : '—'}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr style={{ borderTop: '1px solid var(--card-border)' }}>
                                <td style={{ padding: '6px 14px', color: 'var(--secondary-foreground)' }}>Reps</td>
                                <td style={{ textAlign: 'center', padding: '6px 14px', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                    {Math.round(stressMetrics.grandReps)}
                                </td>
                                {METRIC_CATS.map(c => (
                                    <td key={c} style={{ textAlign: 'center', padding: '6px 14px', color: 'var(--secondary-foreground)' }}>
                                        {Math.round(stressMetrics.stats[c]?.reps || 0)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── 7-Day Column Grid ── */}
            {/* Using minmax(180px, 1fr) so each day has generous breathing room and numbers are crystal clear */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
                gap: '10px',
                minHeight: '65vh',
                paddingBottom: '2rem',
            }}>
                {DISPLAY_ORDER.map((dayNum, colIdx) => {
                    const session = sessionsByDay[dayNum];
                    const exercises = session?.exercises || [];
                    const isDragOverThis = dropTargetDay === dayNum;
                    const dayLabel = DISPLAY_DAY_NAMES[colIdx];
                    const dateLabel = getDateForDay(dayNum);

                    return (
                        <div
                            key={dayNum}
                            onDragOver={(e) => handleDayDragOver(e, dayNum)}
                            onDrop={(e) => handleDayDrop(e, dayNum)}
                            onDragLeave={() => { if (dropTargetDay === dayNum) { setDropTargetDay(null); setDropTargetExIdx(null); } }}
                            style={{
                                background: isDragOverThis ? 'rgba(6,182,212,0.12)' : 'var(--card-bg)',
                                border: isDragOverThis ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                                borderRadius: '10px',
                                display: 'flex', flexDirection: 'column',
                                overflow: 'hidden',
                                transition: 'border 0.15s, background 0.15s',
                                minHeight: '350px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            }}
                        >
                            {/* Day Column Header */}
                            <div style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--card-border)',
                                background: 'rgba(255,255,255,0.03)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div>
                                    <div style={{
                                        fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em',
                                        color: (dayNum === 6 || dayNum === 7) ? 'var(--secondary-foreground)' : 'var(--primary)',
                                    }}>
                                        {dayLabel}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: 2, fontWeight: 500 }}>
                                        {dateLabel}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {session && (
                                        <button
                                            onClick={() => clearDay(dayNum)}
                                            title="Clear day"
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: 'var(--secondary-foreground)', cursor: 'pointer',
                                                padding: '4px', fontSize: '0.7rem', opacity: 0.6,
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Session Name (editable) */}
                            {session && (
                                <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)' }}>
                                    <input
                                        value={session.name}
                                        onChange={e => updateSessionName(dayNum, e.target.value)}
                                        placeholder="Session Name"
                                        style={{
                                            background: 'transparent', border: 'none', color: 'var(--foreground)',
                                            fontWeight: 700, fontSize: '0.85rem', width: '100%', outline: 'none',
                                            padding: '2px 0',
                                        }}
                                    />
                                </div>
                            )}

                            {/* + Add exercise button */}
                            <div style={{ padding: '6px 8px' }}>
                                <button
                                    onClick={() => addExerciseToDay(dayNum, { name: 'New Exercise', category: 'Isolation/Accessory' })}
                                    style={{
                                        width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.2)',
                                        color: 'var(--secondary-foreground)', borderRadius: '6px', padding: '8px',
                                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.color = 'var(--primary)';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.color = 'var(--secondary-foreground)';
                                    }}
                                >
                                    <Plus size={14} /> Add exercise
                                </button>
                            </div>

                            {/* Exercise Cards */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {exercises.length === 0 && (
                                    <div
                                        onDragOver={(e) => handleDayDragOver(e, dayNum)}
                                        onDrop={(e) => handleDayDrop(e, dayNum)}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', textAlign: 'center',
                                            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px',
                                            minHeight: '100px', margin: '4px 0', padding: '12px',
                                        }}
                                    >
                                        Drop an exercise here or add a new one.
                                    </div>
                                )}

                                {exercises.map((ex: any, exIdx: number) => {
                                    const catColor = CATEGORY_COLORS[ex.category || getExerciseCategory(ex.name || '')] || '#64748B';
                                    const isDragOverExercise = dropTargetDay === dayNum && dropTargetExIdx === exIdx;
                                    const protocol = formatSetsSummary(ex.sets || []);

                                    return (
                                        <div
                                            key={ex.id}
                                            draggable
                                            onDragStart={(e) => handleExDragStart(e, dayNum, exIdx)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => handleDayDragOver(e, dayNum, exIdx)}
                                            onDrop={(e) => handleDayDrop(e, dayNum, exIdx)}
                                            style={{
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: isDragOverExercise ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(20, 20, 26, 0.95)',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                                transition: 'border 0.1s, transform 0.1s',
                                            }}
                                        >
                                            {/* Exercise Name Banner - Full text with word wrap (NO CUTOFF!) */}
                                            <div style={{
                                                background: catColor,
                                                padding: '8px 10px',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                                cursor: 'grab', gap: '6px',
                                            }}>
                                                <div style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.82rem',
                                                    color: '#ffffff',
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                                    lineHeight: 1.25,
                                                    wordBreak: 'break-word',
                                                    whiteSpace: 'normal',
                                                    flex: 1,
                                                }}>
                                                    {ex.name}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setContextMenu(contextMenu?.exerciseIdx === exIdx && contextMenu?.dayNum === dayNum
                                                            ? null : { exerciseIdx: exIdx, dayNum, x: e.clientX, y: e.clientY });
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff',
                                                        cursor: 'pointer', padding: '3px 5px', borderRadius: '4px',
                                                        display: 'flex', alignItems: 'center', flexShrink: 0,
                                                    }}
                                                >
                                                    <MoreHorizontal size={13} />
                                                </button>
                                            </div>

                                            {/* Context Menu */}
                                            {contextMenu && contextMenu.exerciseIdx === exIdx && contextMenu.dayNum === dayNum && (
                                                <div style={{
                                                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                                    borderRadius: '6px', padding: '4px', fontSize: '0.75rem',
                                                    display: 'flex', gap: '4px', margin: '4px',
                                                }}>
                                                    <button
                                                        onClick={() => { duplicateExercise(dayNum, exIdx); setContextMenu(null); }}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)',
                                                            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
                                                            fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                                                        }}
                                                    >
                                                        <Copy size={11} /> Copy
                                                    </button>
                                                    <button
                                                        onClick={() => { removeExercise(dayNum, exIdx); setContextMenu(null); }}
                                                        style={{
                                                            background: 'rgba(239,68,68,0.1)', border: 'none',
                                                            color: '#ef4444', cursor: 'pointer', padding: '4px 8px',
                                                            borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                                                        }}
                                                    >
                                                        <Trash2 size={11} /> Delete
                                                    </button>
                                                </div>
                                            )}

                                            {/* Set Rows */}
                                            <div style={{ padding: '6px 8px' }}>
                                                {/* Header labels for sets */}
                                                {(ex.sets || []).length > 0 && (
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '20px 1fr 1fr 1.2fr 20px',
                                                        gap: '5px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        color: 'var(--secondary-foreground)',
                                                        textAlign: 'center',
                                                        paddingBottom: '4px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                    }}>
                                                        <div>#</div>
                                                        <div>Reps</div>
                                                        <div>RPE</div>
                                                        <div>% / Wt</div>
                                                        <div></div>
                                                    </div>
                                                )}

                                                {(ex.sets || []).map((set: any, si: number) => {
                                                    return (
                                                        <div key={set.id || si} style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '20px 1fr 1fr 1.2fr 20px',
                                                            gap: '5px', alignItems: 'center',
                                                            padding: '3px 0',
                                                        }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-foreground)', textAlign: 'center' }}>
                                                                {si + 1}
                                                            </span>
                                                            <input
                                                                value={set.reps || ''}
                                                                onChange={e => updateSet(dayNum, exIdx, si, 'reps', e.target.value)}
                                                                placeholder="5"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: '5px', color: 'var(--foreground)',
                                                                    textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
                                                                    height: '30px', width: '100%', outline: 'none', padding: '0 4px',
                                                                }}
                                                            />
                                                            <input
                                                                value={set.rpe || ''}
                                                                onChange={e => updateSet(dayNum, exIdx, si, 'rpe', e.target.value)}
                                                                placeholder="7"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: '5px', color: 'var(--foreground)',
                                                                    textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
                                                                    height: '30px', width: '100%', outline: 'none', padding: '0 4px',
                                                                }}
                                                            />
                                                            <input
                                                                value={set.weight || ''}
                                                                onChange={e => updateSet(dayNum, exIdx, si, 'weight', e.target.value)}
                                                                placeholder="%"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: '5px', color: 'var(--foreground)',
                                                                    textAlign: 'center', fontSize: '0.82rem', fontWeight: 600,
                                                                    height: '30px', width: '100%', outline: 'none', padding: '0 4px',
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => removeSet(dayNum, exIdx, si)}
                                                                title="Remove set"
                                                                style={{
                                                                    background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.7)',
                                                                    cursor: 'pointer', padding: '0 2px', fontSize: '1rem', lineHeight: 1,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    );
                                                })}

                                                {/* Add Set Row */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'center',
                                                    padding: '4px 0 2px', marginTop: '2px',
                                                }}>
                                                    <button
                                                        onClick={() => addSet(dayNum, exIdx)}
                                                        style={{
                                                            background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                                                            color: 'var(--primary)', cursor: 'pointer',
                                                            fontSize: '0.72rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px',
                                                            display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'center',
                                                        }}
                                                    >
                                                        <Plus size={11} /> Add Set
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Protocol Summary */}
                                            {protocol && (
                                                <div style={{
                                                    padding: '5px 10px 7px', fontSize: '0.7rem',
                                                    color: 'var(--secondary-foreground)', fontStyle: 'italic',
                                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                                }}>
                                                    Protocol: {protocol}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Close context menu on click outside */}
            {contextMenu && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                    onClick={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}

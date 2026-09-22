'use client';

import { useState, useMemo, useCallback } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { getExerciseCategory } from '@/lib/exercise-db';
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, CopyPlus, CheckCircle2, StickyNote, Activity, Calendar, GripVertical, ClipboardPaste, Shuffle } from 'lucide-react';
import PivotRandomizerModal from './PivotRandomizerModal';

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
    setStartDate?: (dateStr: string) => void;
    existingPrograms?: any[];
    initialExercises?: any;
    liftTargets?: Record<string, { timeToPeak: string; stressTarget: string }>;
    selectedDay?: number;
    onSelectDay?: (dayNum: number) => void;
    currentWeekNum?: number;
    setCurrentWeekNum?: (weekNum: number) => void;
    sessionClipboard?: any;
    onCopySession?: (session: any) => void;
}

export default function ProgramWeeklyView({
    weeks,
    setWeeks,
    startDate,
    setStartDate,
    existingPrograms = [],
    initialExercises,
    liftTargets,
    selectedDay: controlledSelectedDay,
    onSelectDay: controlledOnSelectDay,
    currentWeekNum: controlledWeekNum,
    setCurrentWeekNum: controlledSetWeekNum,
    sessionClipboard,
    onCopySession,
}: WeeklyViewProps) {
    // Week number state (controlled or internal)
    const [internalWeekNum, setInternalWeekNum] = useState(() => {
        const first = weeks.find(w => w.sessions && w.sessions.length > 0);
        return first ? first.weekNumber : 1;
    });
    const currentWeekNum = controlledWeekNum !== undefined ? controlledWeekNum : internalWeekNum;
    const setCurrentWeekNum = controlledSetWeekNum !== undefined ? controlledSetWeekNum : setInternalWeekNum;

    // Selected day state (controlled or internal)
    const [internalSelectedDay, setInternalSelectedDay] = useState<number>(1);
    const selectedDay = controlledSelectedDay !== undefined ? controlledSelectedDay : internalSelectedDay;
    const onSelectDay = controlledOnSelectDay !== undefined ? controlledOnSelectDay : setInternalSelectedDay;

    // Drag state for exercises and whole sessions between days
    const [dragSource, setDragSource] = useState<{ weekIdx: number; sessionIdx: number; exerciseIdx: number } | null>(null);
    const [dragSessionSource, setDragSessionSource] = useState<{ weekIdx: number; sessionIdx: number; dayNum: number } | null>(null);
    const [dropTargetDay, setDropTargetDay] = useState<number | null>(null);
    const [dropTargetExIdx, setDropTargetExIdx] = useState<number | null>(null);

    // Toast feedback state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    }, []);

    // Pivot Randomizer modal state
    const [showPivotModal, setShowPivotModal] = useState<boolean>(false);

    const handleApplyPivot = useCallback((newSessions: any[], targetWeekNum: number, replaceExisting: boolean) => {
        setWeeks((prev: any[]) => {
            const exists = prev.find(w => w.weekNumber === targetWeekNum);
            let updatedWeeks: any[];
            if (exists) {
                updatedWeeks = prev.map(w => w.weekNumber === targetWeekNum ? { ...w, sessions: newSessions } : w);
            } else {
                updatedWeeks = [...prev, { id: generateId(), weekNumber: targetWeekNum, sessions: newSessions }];
            }
            return updatedWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        });
        setCurrentWeekNum(targetWeekNum);
        showToast(`Generated & applied Pivot Week (Week ${targetWeekNum})`);
    }, [setCurrentWeekNum, setWeeks, showToast]);

    // Session clipboard state (internal or controlled via props)
    const [internalClipboard, setInternalClipboard] = useState<any>(null);
    const activeClipboard = sessionClipboard !== undefined ? sessionClipboard : internalClipboard;

    // Current week object
    const currentWeek = useMemo(() => weeks.find(w => w.weekNumber === currentWeekNum), [weeks, currentWeekNum]);
    const maxWeekNum = useMemo(() => weeks.reduce((m, w) => Math.max(m, w.weekNumber || 0), 0), [weeks]);

    // Check if the program was configured to start on Sunday (0=Sun, 1=Mon)
    const isSundayStart = useMemo(() => {
        if (!startDate) return false;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const dt = new Date(sy, sm - 1, sd);
        return dt.getDay() === 0;
    }, [startDate]);

    // Columns are always displayed in Monday-Sunday order
    const DISPLAY_DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    // Map column index (0=Mon, 1=Tue, ..., 6=Sun) to session.day
    // In Sunday-start data model: Sunday=1, Monday=2, Tuesday=3, Wednesday=4, Thursday=5, Friday=6, Saturday=7
    // In Monday-start data model: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=7
    const colToDayNum = useCallback((colIdx: number) => {
        if (isSundayStart) {
            return colIdx === 6 ? 1 : colIdx + 2;
        }
        return colIdx + 1;
    }, [isSundayStart]);

    // Reverse: map session.day to column index (0..6)
    const dayNumToCol = useCallback((dayNum: number) => {
        if (isSundayStart) {
            return dayNum === 1 ? 6 : dayNum - 2;
        }
        return dayNum - 1;
    }, [isSundayStart]);

    const DISPLAY_ORDER = useMemo(() => {
        return [0, 1, 2, 3, 4, 5, 6].map(colIdx => colToDayNum(colIdx));
    }, [colToDayNum]);

    const sessionsByDay = useMemo(() => {
        const map: Record<number, any> = {};
        if (!currentWeek) return map;
        (currentWeek.sessions || []).forEach((s: any) => {
            const dayKey = Number(s.day);
            if (!map[dayKey] || ((s.exercises || []).length > 0 && (map[dayKey].exercises || []).length === 0)) {
                map[dayKey] = s;
            }
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
        weekStart.setDate(weekStart.getDate() + (currentWeekNum - 1) * 7 + (isSundayStart ? 1 : 0));
        const weekEnd = new Date(start);
        weekEnd.setDate(weekEnd.getDate() + (currentWeekNum - 1) * 7 + (isSundayStart ? 7 : 6));
        const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
        return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
    }, [startDate, currentWeekNum, isSundayStart]);

    // Build a lookup of existing program sessions by date string to detect overlaps
    const existingSessionsByDate = useMemo(() => {
        const map: Record<string, { programName: string; sessionName: string; exerciseCount: number; status: string }[]> = {};
        if (!Array.isArray(existingPrograms)) return map;

        existingPrograms.forEach((prog: any) => {
            if (!prog.startDate) return;
            const startStr = String(prog.startDate).split('T')[0];
            const [sy, sm, sd] = startStr.split('-').map(Number);
            const progStart = new Date(sy, sm - 1, sd);
            progStart.setHours(0, 0, 0, 0);

            let parsedWeeks = prog.weeks;
            if (typeof parsedWeeks === 'string') {
                try { parsedWeeks = JSON.parse(parsedWeeks); } catch { parsedWeeks = []; }
            }
            const programWeeks: any[] = Array.isArray(parsedWeeks) ? parsedWeeks : [];
            programWeeks.forEach((week: any) => {
                const wn = week.weekNumber || 1;
                const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];
                sessions.forEach((session: any) => {
                    if (!Array.isArray(session.exercises) || session.exercises.length === 0) return;
                    const day = session.day || 1;
                    const d = new Date(progStart);
                    d.setDate(d.getDate() + (wn - 1) * 7 + (day - 1));
                    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    if (!map[ds]) map[ds] = [];
                    map[ds].push({
                        programName: prog.name || 'Untitled',
                        sessionName: session.name || `Session ${day}`,
                        exerciseCount: Array.isArray(session.exercises) ? session.exercises.length : 0,
                        status: prog.status || 'active'
                    });
                });
            });
        });
        return map;
    }, [existingPrograms]);

    // Get formatted date string for a given day number in the current week (e.g. "Aug 25")
    const getDateForDay = useCallback((dayNum: number) => {
        if (!startDate) return '';
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const d = new Date(start);
        d.setDate(d.getDate() + (currentWeekNum - 1) * 7 + (dayNum - 1));
        return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    }, [startDate, currentWeekNum]);

    // Get YYYY-MM-DD date string for a given day number in current week
    const getDateStringForDay = useCallback((dayNum: number) => {
        if (!startDate) return '';
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const d = new Date(start);
        d.setDate(d.getDate() + (currentWeekNum - 1) * 7 + (dayNum - 1));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, [startDate, currentWeekNum]);

    // ──── Category Targets from Athlete Lift Targets ────
    const categoryTargets = useMemo(() => {
        if (!liftTargets) return {};
        const result: Record<string, number> = {};
        Object.entries(liftTargets).forEach(([lift, { stressTarget }]) => {
            const target = parseFloat(stressTarget);
            if (!target || isNaN(target)) return;
            const category = getExerciseCategory(lift);
            if (category) {
                result[category] = (result[category] || 0) + target;
            }
        });
        return result;
    }, [liftTargets]);

    const totalTarget = useMemo(() => {
        return Object.values(categoryTargets).reduce((s, v) => s + v, 0);
    }, [categoryTargets]);

    // ──── Stress Metrics Computation ────
    const METRIC_CATS = ['Knee', 'Horizontal Push', 'Hip', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull'];
    const METRIC_SHORT: Record<string, string> = {
        'Knee': 'Knee',
        'Horizontal Push': 'HPush',
        'Hip': 'Hip',
        'Vertical Push': 'VPush',
        'Horizontal Pull': 'HPull',
        'Vertical Pull': 'VPull',
    };

    const stressMetrics = useMemo(() => {
        const stats: Record<string, { total: number; central: number; peripheral: number; reps: number }> = {};
        METRIC_CATS.forEach(c => stats[c] = { total: 0, central: 0, peripheral: 0, reps: 0 });

        if (!currentWeek) return { stats, grandTotal: 0, grandCentral: 0, grandPeripheral: 0, grandReps: 0 };

        (currentWeek.sessions || []).forEach((session: any) => {
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
        // Also highlight this day
        onSelectDay(dayNum);

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
                const sIdx = w.sessions.findIndex((s: any) => Number(s.day) === Number(dayNum));
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
                        si !== sIdx ? s : { ...s, exercises: [...(s.exercises || []), newExercise] }
                    ),
                };
            });
        });
    }, [currentWeekNum, setWeeks, onSelectDay]);

    const updateSet = useCallback((dayNum: number, exerciseIdx: number, setIdx: number, field: string, value: string) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (Number(s.day) !== Number(dayNum)) return s;
                    return {
                        ...s,
                        exercises: (s.exercises || []).map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            return {
                                ...ex,
                                sets: (ex.sets || []).map((set: any, si: number) =>
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
                    if (Number(s.day) !== Number(dayNum)) return s;
                    return {
                        ...s,
                        exercises: (s.exercises || []).map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            const lastSet = ex.sets?.[ex.sets.length - 1];
                            return {
                                ...ex,
                                sets: [...(ex.sets || []), {
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
                    if (Number(s.day) !== Number(dayNum)) return s;
                    return {
                        ...s,
                        exercises: (s.exercises || []).map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            return { ...ex, sets: (ex.sets || []).filter((_: any, si: number) => si !== setIdx) };
                        }),
                    };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    // Robust exercise removal by exercise ID or index
    const removeExercise = useCallback((dayNum: number, exerciseIdOrIdx: string | number) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (Number(s.day) !== Number(dayNum)) return s;
                    const exercises = s.exercises || [];
                    let newExercises;
                    if (typeof exerciseIdOrIdx === 'string') {
                        newExercises = exercises.filter((ex: any) => ex.id !== exerciseIdOrIdx);
                    } else {
                        newExercises = exercises.filter((_: any, ei: number) => ei !== exerciseIdOrIdx);
                    }
                    return { ...s, exercises: newExercises };
                }),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const updateExerciseNotes = useCallback((dayNum: number, exerciseIdx: number, notes: string) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: w.sessions.map((s: any) => {
                    if (Number(s.day) !== Number(dayNum)) return s;
                    return {
                        ...s,
                        exercises: (s.exercises || []).map((ex: any, ei: number) => {
                            if (ei !== exerciseIdx) return ex;
                            return { ...ex, notes };
                        }),
                    };
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
                    if (Number(s.day) !== Number(dayNum)) return s;
                    const original = s.exercises?.[exerciseIdx];
                    if (!original) return s;
                    const clone = {
                        ...original,
                        id: generateId(),
                        sets: (original.sets || []).map((set: any) => ({ ...set, id: generateId() })),
                    };
                    const newExercises = [...(s.exercises || [])];
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
                    Number(s.day) !== Number(dayNum) ? s : { ...s, name }
                ),
            };
        }));
    }, [currentWeekNum, setWeeks]);

    const setDayWarmupDrills = useCallback((dayNum: number, warmupDrills: string) => {
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            const exists = w.sessions.some((s: any) => Number(s.day) === Number(dayNum));
            if (exists) {
                return {
                    ...w,
                    sessions: w.sessions.map((s: any) =>
                        Number(s.day) !== Number(dayNum) ? s : { ...s, warmupDrills }
                    ),
                };
            } else {
                return {
                    ...w,
                    sessions: [...w.sessions, {
                        id: generateId(),
                        name: `Session ${w.sessions.length + 1}`,
                        day: dayNum,
                        warmupDrills,
                        exercises: [],
                    }],
                };
            }
        }));
    }, [currentWeekNum, setWeeks]);

    const applyWarmupToAllSessions = useCallback((warmupDrills: string) => {
        if (!warmupDrills?.trim()) return;
        if (confirm('Apply these warm-up drills to EVERY session in the entire block? This will overwrite existing warm-ups elsewhere.')) {
            setWeeks((prev: any[]) => prev.map(w => ({
                ...w,
                sessions: (w.sessions || []).map((s: any) => ({ ...s, warmupDrills })),
            })));
        }
    }, [setWeeks]);

    const deleteSession = useCallback((dayNum: number, sessionName?: string) => {
        const displayName = sessionName?.trim() || `Session on Day ${dayNum}`;
        if (!confirm(`Are you sure you want to delete "${displayName}"? This will remove the session and all its exercises.`)) return;
        setWeeks((prev: any[]) => prev.map(w => {
            if (w.weekNumber !== currentWeekNum) return w;
            return {
                ...w,
                sessions: (w.sessions || []).filter((s: any) => Number(s.day) !== Number(dayNum)),
            };
        }));
        showToast(`Deleted "${displayName}"`);
    }, [currentWeekNum, setWeeks, showToast]);

    const clearDay = deleteSession;

    const handleCopySession = useCallback((sessionToCopy: any, dayLabel: string) => {
        if (!sessionToCopy) return;
        const payload = {
            ...sessionToCopy,
            exercises: (sessionToCopy.exercises || []).map((ex: any) => ({
                ...ex,
                id: generateId(),
                sets: (ex.sets || []).map((set: any) => ({ ...set, id: generateId() }))
            }))
        };
        setInternalClipboard(payload);
        if (onCopySession) {
            onCopySession(payload);
        }
        showToast(`Copied "${sessionToCopy.name || 'Session'}" (${dayLabel})`);
    }, [onCopySession, showToast]);

    const handlePasteSession = useCallback((targetDayNum: number, dayLabel: string) => {
        if (!activeClipboard) return;
        const currentWeekSessions = currentWeek?.sessions || [];
        const existingSession = currentWeekSessions.find((s: any) => Number(s.day) === Number(targetDayNum));
        if (existingSession && (existingSession.exercises || []).length > 0) {
            if (!confirm(`Replace session on ${dayLabel} with "${activeClipboard.name || 'copied session'}"?`)) {
                return;
            }
        }

        const cloned: any = {
            ...activeClipboard,
            id: generateId(),
            day: targetDayNum,
            scheduledDate: getDateStringForDay(targetDayNum),
            exercises: (activeClipboard.exercises || []).map((ex: any) => ({
                ...ex,
                id: generateId(),
                sets: (ex.sets || []).map((st: any) => ({
                    ...st,
                    id: generateId(),
                }))
            }))
        };

        setWeeks((prev: any[]) => {
            return prev.map(w => {
                if (w.weekNumber !== currentWeekNum) return w;
                const filtered = (w.sessions || []).filter((s: any) => Number(s.day) !== Number(targetDayNum));
                return {
                    ...w,
                    sessions: [...filtered, cloned].sort((a: any, b: any) => (a.day || 0) - (b.day || 0))
                };
            });
        });

        onSelectDay(targetDayNum);
        showToast(`Pasted session into ${dayLabel}`);
    }, [activeClipboard, currentWeek, currentWeekNum, getDateStringForDay, onSelectDay, setWeeks, showToast]);

    const duplicateWeekToNext = useCallback(() => {
        setWeeks((prev: any[]) => {
            const srcWeek = prev.find(w => w.weekNumber === currentWeekNum);
            if (!srcWeek || (srcWeek.sessions || []).length === 0) return prev;
            const targetNum = currentWeekNum + 1;
            const existing = prev.find(w => w.weekNumber === targetNum);
            if (existing && (existing.sessions || []).length > 0) {
                if (!confirm(`Week ${targetNum} already has sessions. Replace?`)) return prev;
            }
            const weekOffset = targetNum - currentWeekNum;
            const clonedSessions = (srcWeek.sessions || []).map((s: any) => {
                let newScheduledDate = '';
                const dayNum = Number(s.day || 1);
                if (startDate) {
                    const [sy, sm, sd] = startDate.split('-').map(Number);
                    const start = new Date(sy, sm - 1, sd);
                    start.setHours(0, 0, 0, 0);
                    const d = new Date(start);
                    d.setDate(d.getDate() + (targetNum - 1) * 7 + (dayNum - 1));
                    newScheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                } else if (s.scheduledDate) {
                    const [y, m, d] = String(s.scheduledDate).split('T')[0].split('-').map(Number);
                    const date = new Date(y, m - 1, d);
                    date.setDate(date.getDate() + weekOffset * 7);
                    newScheduledDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                }

                return {
                    ...s,
                    id: generateId(),
                    scheduledDate: newScheduledDate,
                    exercises: (s.exercises || []).map((e: any) => ({
                        ...e,
                        id: generateId(),
                        sets: (e.sets || []).map((set: any) => ({ ...set, id: generateId() })),
                    })),
                };
            });
            if (existing) {
                return prev.map(w => w.weekNumber === targetNum ? { ...w, sessions: clonedSessions } : w);
            }
            const newWeeks = [...prev, { id: generateId(), weekNumber: targetNum, sessions: clonedSessions }];
            return newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        });
    }, [currentWeekNum, setWeeks, startDate]);

    const deleteCurrentWeek = useCallback(() => {
        if (!confirm(`Are you sure you want to delete Week ${currentWeekNum}? This will remove all its sessions.`)) {
            return;
        }
        setWeeks((prev: any[]) => {
            const remaining = prev.filter(w => w.weekNumber !== currentWeekNum);
            if (remaining.length === 0) {
                return [{ id: generateId(), weekNumber: 1, sessions: [] }];
            }
            return remaining
                .sort((a, b) => a.weekNumber - b.weekNumber)
                .map((w, idx) => ({ ...w, weekNumber: idx + 1 }));
        });
        setCurrentWeekNum(Math.max(1, currentWeekNum - 1));
    }, [currentWeekNum, setWeeks, setCurrentWeekNum]);

    // ──── Drag & Drop ────

    const handleSessionDragStart = (e: React.DragEvent, dayNum: number) => {
        const wIdx = weeks.findIndex(w => w.weekNumber === currentWeekNum);
        const sIdx = weeks[wIdx]?.sessions.findIndex((s: any) => Number(s.day) === Number(dayNum));
        if (wIdx === -1 || sIdx === -1) return;
        setDragSource(null);
        setDragSessionSource({ weekIdx: wIdx, sessionIdx: sIdx, dayNum });
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'weekly-session', sourceDayNum: dayNum }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleExDragStart = (e: React.DragEvent, dayNum: number, exerciseIdx: number) => {
        const wIdx = weeks.findIndex(w => w.weekNumber === currentWeekNum);
        const sIdx = weeks[wIdx]?.sessions.findIndex((s: any) => Number(s.day) === Number(dayNum));
        if (wIdx === -1 || sIdx === -1) return;
        setDragSessionSource(null);
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
        onSelectDay(targetDayNum);

        let data: any = null;
        try {
            const raw = e.dataTransfer.getData('text/plain');
            data = JSON.parse(raw);
        } catch { /* fallback */ }

        if (!data) return;

        // Handle drag of whole session between days
        if (data.type === 'weekly-session') {
            const sourceDayNum = Number(data.sourceDayNum);
            if (sourceDayNum === targetDayNum) {
                setDragSessionSource(null);
                return;
            }

            setWeeks((prev: any[]) => {
                const newWeeks = prev.map(w => ({
                    ...w,
                    sessions: (w.sessions || []).map((s: any) => ({
                        ...s,
                        exercises: [...(s.exercises || [])],
                    })),
                }));

                const currentWIdx = newWeeks.findIndex(w => w.weekNumber === currentWeekNum);
                if (currentWIdx === -1) return prev;

                const currentWeekSessions = newWeeks[currentWIdx].sessions;
                const srcSessionIdx = currentWeekSessions.findIndex((s: any) => Number(s.day) === Number(sourceDayNum));
                if (srcSessionIdx === -1) return prev;

                const srcSession = currentWeekSessions[srcSessionIdx];
                const tgtSessionIdx = currentWeekSessions.findIndex((s: any) => Number(s.day) === Number(targetDayNum));

                const targetDateStr = getDateStringForDay(targetDayNum);
                const sourceDateStr = getDateStringForDay(sourceDayNum);

                if (tgtSessionIdx === -1) {
                    // Target day has no session: move srcSession to targetDayNum
                    srcSession.day = targetDayNum;
                    if (targetDateStr) srcSession.scheduledDate = targetDateStr;
                } else {
                    const tgtSession = currentWeekSessions[tgtSessionIdx];
                    const tgtHasContent = (Array.isArray(tgtSession.exercises) && tgtSession.exercises.length > 0) || Boolean(tgtSession.warmupDrills?.trim());

                    if (!tgtHasContent) {
                        // Target day has an empty placeholder session: remove it and place srcSession on targetDayNum
                        currentWeekSessions.splice(tgtSessionIdx, 1);
                        srcSession.day = targetDayNum;
                        if (targetDateStr) srcSession.scheduledDate = targetDateStr;
                    } else {
                        // Both days have workouts: swap their day numbers and dates!
                        srcSession.day = targetDayNum;
                        tgtSession.day = sourceDayNum;
                        if (targetDateStr) srcSession.scheduledDate = targetDateStr;
                        if (sourceDateStr) tgtSession.scheduledDate = sourceDateStr;

                        // Auto change session names so the session moved to sourceDayNum takes sourceDayNum's name
                        // and the session moved to targetDayNum takes targetDayNum's name
                        const prevSrcName = srcSession.name;
                        const prevTgtName = tgtSession.name;
                        srcSession.name = prevTgtName;
                        tgtSession.name = prevSrcName;
                    }
                }

                // Auto-normalize session numbering in chronological day order (e.g. Session 1, Session 2, Session 3...)
                const sessionNumRegex = /^Session(\s+\d+)?$/i;
                const blockDRegex = /^(Block\s+\d+\s*\/\s*D)\d+$/i;
                const bDRegex = /^(B\d+D)\d+$/i;

                const populated = currentWeekSessions.filter((s: any) =>
                    (Array.isArray(s.exercises) && s.exercises.length > 0) || Boolean(s.warmupDrills?.trim())
                );

                if (populated.length > 0) {
                    if (populated.every((s: any) => !s.name || sessionNumRegex.test(String(s.name).trim()))) {
                        const sorted = [...currentWeekSessions].sort((a: any, b: any) => Number(a.day || 0) - Number(b.day || 0));
                        sorted.forEach((s: any, idx: number) => {
                            s.name = `Session ${idx + 1}`;
                        });
                    } else if (populated.every((s: any) => blockDRegex.test(String(s.name || '').trim()))) {
                        const match = populated[0].name.match(blockDRegex);
                        if (match) {
                            const prefix = match[1];
                            const sorted = [...currentWeekSessions].sort((a: any, b: any) => Number(a.day || 0) - Number(b.day || 0));
                            sorted.forEach((s: any, idx: number) => {
                                s.name = `${prefix}${idx + 1}`;
                            });
                        }
                    } else if (populated.every((s: any) => bDRegex.test(String(s.name || '').trim()))) {
                        const match = populated[0].name.match(bDRegex);
                        if (match) {
                            const prefix = match[1];
                            const sorted = [...currentWeekSessions].sort((a: any, b: any) => Number(a.day || 0) - Number(b.day || 0));
                            sorted.forEach((s: any, idx: number) => {
                                s.name = `${prefix}${idx + 1}`;
                            });
                        }
                    }
                }

                return newWeeks;
            });
            setDragSessionSource(null);
            onSelectDay(targetDayNum);
            return;
        }

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
                    sessions: (w.sessions || []).map((s: any) => ({
                        ...s,
                        exercises: [...(s.exercises || [])],
                    })),
                }));

                const srcSession = newWeeks[srcW]?.sessions[srcS];
                if (!srcSession) return prev;
                const [movedExercise] = srcSession.exercises.splice(srcE, 1);
                if (!movedExercise) return prev;

                const tgtWIdx = newWeeks.findIndex(w => w.weekNumber === currentWeekNum);
                if (tgtWIdx === -1) return prev;

                let tgtSIdx = newWeeks[tgtWIdx].sessions.findIndex((s: any) => Number(s.day) === Number(targetDayNum));
                if (tgtSIdx === -1) {
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
        setDragSessionSource(null);
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

    // ──── Helpers for Delta Display ────
    const grandDelta = totalTarget > 0 ? stressMetrics.grandTotal - totalTarget : null;

    const renderDeltaCell = (delta: number | null, target?: number, actual?: number) => {
        if (delta === null) return <span style={{ opacity: 0.3 }}>—</span>;
        
        let color = '#22c55e';
        let deltaStr = '✓ 0.0';
        if (delta > 0.05) {
            color = '#ef4444';
            deltaStr = `+${delta.toFixed(1)}`;
        } else if (delta < -0.05) {
            color = '#06b6d4';
            deltaStr = delta.toFixed(1);
        }

        const actualVal = actual !== undefined ? actual : (target && delta !== null ? target + delta : 0);
        const pct = (target && target > 0) ? Math.round((actualVal / target) * 100) : null;

        const titleText = (target && target > 0)
            ? `Target: ${target.toFixed(1)} | Actual: ${actualVal.toFixed(1)} | Delta: ${deltaStr} | ${pct}% of target`
            : undefined;

        return (
            <span style={{ color, fontWeight: 800, whiteSpace: 'nowrap' }} title={titleText}>
                {deltaStr}
                {pct !== null && (
                    <span style={{ opacity: 0.75, fontWeight: 600, fontSize: '0.82em', marginLeft: '3px' }}>
                        / {pct}%
                    </span>
                )}
            </span>
        );
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

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {setStartDate && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                            borderRadius: '6px', padding: '4px 10px',
                        }}>
                            <Calendar size={13} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Start
                            </span>
                            <input
                                type="date"
                                value={startDate || ''}
                                onChange={e => {
                                    if (e.target.value && setStartDate) {
                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                        const dt = new Date(y, m - 1, d);
                                        const dayOfWeek = dt.getDay();
                                        const offset = (dayOfWeek + 6) % 7;
                                        dt.setDate(dt.getDate() - offset);
                                        const snapped = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        if (isSundayStart) {
                                            // Program was previously Sunday-start; convert sessions to Monday-start
                                            setWeeks((prevWeeks: any[]) => prevWeeks.map(w => ({
                                                ...w,
                                                sessions: (w.sessions || []).map((s: any) => ({
                                                    ...s,
                                                    day: Number(s.day) === 1 ? 7 : Number(s.day) - 1,
                                                }))
                                            })));
                                        }
                                        setStartDate(snapped);
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--foreground)',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                                title="Program Start Date (Snapped to Monday)"
                            />
                        </div>
                    )}

                    <button
                        onClick={() => setShowPivotModal(true)}
                        title="Generate Pivot / Deload Week (50% Stress Index)"
                        style={{
                            background: 'rgba(168, 85, 247, 0.12)',
                            border: '1px solid rgba(168, 85, 247, 0.35)',
                            color: '#c084fc',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(168, 85, 247, 0.22)';
                            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.35)';
                        }}
                    >
                        <Shuffle size={15} /> Pivot Randomizer
                    </button>

                    <button onClick={duplicateWeekToNext} title="Duplicate this week to next" style={{
                        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                        color: 'var(--secondary-foreground)', borderRadius: '6px', padding: '6px 14px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <CopyPlus size={15} /> Duplicate Week
                    </button>

                    <button onClick={deleteCurrentWeek} title="Delete this week" style={{
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444', borderRadius: '6px', padding: '6px 14px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.15s',
                    }}>
                        <Trash2 size={15} /> Delete Week
                    </button>
                </div>
            </div>

            {/* ── Stress Metrics Table (With Target SI & Delta Over/Under) ── */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                        {totalTarget > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></span>
                                Targets Active ({totalTarget.toFixed(1)} total)
                            </span>
                        )}
                        <span>
                            Calculate for: <strong style={{ color: 'var(--foreground)' }}>Entire week</strong>
                        </span>
                    </div>
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
                            {/* Actual Total SI */}
                            <tr style={{ background: totalTarget > 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '6px 14px', fontWeight: 800, color: 'var(--foreground)' }}>Total SI</td>
                                <td style={{ textAlign: 'center', padding: '6px 14px', fontWeight: 800, color: 'var(--primary)', fontSize: '0.88rem' }}>
                                    {stressMetrics.grandTotal.toFixed(1)}
                                </td>
                                {METRIC_CATS.map(c => {
                                    const val = stressMetrics.stats[c]?.total || 0;
                                    const target = categoryTargets[c];
                                    const isOver = target && val > target;
                                    const isAt = target && Math.abs(val - target) <= 0.2;
                                    return (
                                        <td key={c} style={{
                                            textAlign: 'center', padding: '6px 14px', fontWeight: 700,
                                            color: isOver ? '#ef4444' : isAt ? '#22c55e' : 'var(--foreground)',
                                        }}>
                                            {val.toFixed(1)}
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* Target SI Row (shown if targets configured) */}
                            {totalTarget > 0 && (
                                <tr style={{ background: 'rgba(6, 182, 212, 0.03)' }}>
                                    <td style={{ padding: '5px 14px', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                        Target SI
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)', fontWeight: 700 }}>
                                        {totalTarget.toFixed(1)}
                                    </td>
                                    {METRIC_CATS.map(c => (
                                        <td key={c} style={{ textAlign: 'center', padding: '5px 14px', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                            {categoryTargets[c] !== undefined ? categoryTargets[c].toFixed(1) : <span style={{ opacity: 0.3 }}>—</span>}
                                        </td>
                                    ))}
                                </tr>
                            )}

                            {/* Delta / Diff (Over / Under) Row */}
                            {totalTarget > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '5px 14px', fontWeight: 700, color: 'var(--foreground)' }}>
                                        Delta (Diff)
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '5px 14px' }}>
                                        {renderDeltaCell(grandDelta, totalTarget, stressMetrics.grandTotal)}
                                    </td>
                                    {METRIC_CATS.map(c => {
                                        const actual = stressMetrics.stats[c]?.total || 0;
                                        const target = categoryTargets[c];
                                        const delta = target !== undefined ? actual - target : null;
                                        return (
                                            <td key={c} style={{ textAlign: 'center', padding: '5px 14px' }}>
                                                {renderDeltaCell(delta, target, actual)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}

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
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(190px, 1fr))',
                gap: '10px',
                minHeight: '65vh',
                paddingBottom: '2rem',
                width: '100%',
            }}>
                {DISPLAY_ORDER.map((dayNum, colIdx) => {
                    const session = sessionsByDay[dayNum];
                    const exercises = session?.exercises || [];
                    const isDragOverThis = dropTargetDay === dayNum;
                    const isSelected = selectedDay === dayNum;
                    const dayLabel = DISPLAY_DAY_NAMES[colIdx];
                    const dateLabel = getDateForDay(dayNum);
                    const dayDateStr = getDateStringForDay(dayNum);
                    const existingGhostSessions = dayDateStr ? (existingSessionsByDate[dayDateStr] || []) : [];
                    const isDraggingThisSession = dragSessionSource?.dayNum === dayNum;
                    const isTargetOfSessionDrag = isDragOverThis && dragSessionSource && !isDraggingThisSession;

                    return (
                        <div
                            key={dayNum}
                            onClick={() => onSelectDay(dayNum)}
                            onDragOver={(e) => handleDayDragOver(e, dayNum)}
                            onDrop={(e) => handleDayDrop(e, dayNum)}
                            onDragLeave={() => { if (dropTargetDay === dayNum) { setDropTargetDay(null); setDropTargetExIdx(null); } }}
                            style={{
                                opacity: isDraggingThisSession ? 0.45 : 1,
                                background: isTargetOfSessionDrag
                                    ? 'rgba(6,182,212,0.18)'
                                    : isDragOverThis
                                        ? 'rgba(6,182,212,0.14)'
                                        : isSelected
                                            ? 'rgba(6,182,212,0.06)'
                                            : 'var(--card-bg)',
                                border: isTargetOfSessionDrag
                                    ? '2px dashed var(--primary)'
                                    : isDraggingThisSession
                                        ? '2px dashed var(--secondary-foreground)'
                                        : isDragOverThis
                                            ? '2px solid var(--primary)'
                                            : isSelected
                                                ? '2px solid var(--primary)'
                                                : '1px solid var(--card-border)',
                                borderRadius: '10px',
                                display: 'flex', flexDirection: 'column',
                                overflow: 'hidden',
                                transition: 'all 0.15s ease',
                                minHeight: '350px',
                                boxShadow: isTargetOfSessionDrag
                                    ? '0 0 24px rgba(6, 182, 212, 0.4), 0 2px 8px rgba(0,0,0,0.3)'
                                    : isSelected
                                        ? '0 0 16px rgba(6, 182, 212, 0.22), 0 2px 8px rgba(0,0,0,0.3)'
                                        : '0 2px 8px rgba(0,0,0,0.15)',
                                cursor: 'pointer',
                            }}
                        >
                            {/* Session Drop Preview Banner */}
                            {isTargetOfSessionDrag && (
                                <div style={{
                                    background: 'var(--primary)',
                                    color: '#000',
                                    fontWeight: 800,
                                    fontSize: '0.68rem',
                                    padding: '5px 8px',
                                    textAlign: 'center',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}>
                                    <GripVertical size={12} />
                                    {session ? `Swap with ${dayLabel}` : `Move Session to ${dayLabel}`}
                                </div>
                            )}

                            {/* Day Column Header */}
                            <div
                                draggable={Boolean(session)}
                                onDragStart={(e) => {
                                    if (session) handleSessionDragStart(e, dayNum);
                                }}
                                onDragEnd={handleDragEnd}
                                title={session ? "Drag whole session to another day" : undefined}
                                style={{
                                    padding: '10px 12px',
                                    borderBottom: isSelected ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--card-border)',
                                    background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.03)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    cursor: session ? 'grab' : 'pointer',
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {session && (
                                            <div
                                                draggable
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    handleSessionDragStart(e, dayNum);
                                                }}
                                                onDragEnd={handleDragEnd}
                                                title="Drag whole session to another day"
                                                style={{
                                                    cursor: 'grab',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '1px 3px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(6, 182, 212, 0.12)',
                                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                                    color: 'var(--primary)',
                                                }}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        )}
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em',
                                            color: isSelected
                                                ? 'var(--primary)'
                                                : (dayNum === 6 || dayNum === 7) ? 'var(--secondary-foreground)' : 'var(--primary)',
                                        }}>
                                            {dayLabel}
                                        </span>
                                        {isSelected && (
                                            <span style={{
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                background: 'var(--primary)',
                                                color: '#000',
                                                padding: '1px 5px',
                                                borderRadius: '8px',
                                                letterSpacing: '0.04em',
                                            }}>
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: 2, fontWeight: 500 }}>
                                        {dateLabel}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                                    {session && (
                                        <button
                                            onClick={() => handleCopySession(session, dayLabel)}
                                            title={`Copy ${session.name || 'Session'} to clipboard`}
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: 'var(--secondary-foreground)', cursor: 'pointer',
                                                padding: '4px', fontSize: '0.7rem', opacity: 0.7,
                                                display: 'flex', alignItems: 'center',
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.opacity = '1'; }}
                                            onMouseOut={e => { e.currentTarget.style.color = 'var(--secondary-foreground)'; e.currentTarget.style.opacity = '0.7'; }}
                                        >
                                            <Copy size={13} />
                                        </button>
                                    )}
                                    {activeClipboard && (
                                        <button
                                            onClick={() => handlePasteSession(dayNum, dayLabel)}
                                            title={session ? `Replace session on ${dayLabel} with "${activeClipboard.name || 'Session'}"` : `Paste "${activeClipboard.name || 'Session'}" onto ${dayLabel}`}
                                            style={{
                                                background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.4)',
                                                color: 'var(--primary)', cursor: 'pointer',
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: 700,
                                                display: 'flex', alignItems: 'center', gap: 3,
                                            }}
                                        >
                                            <ClipboardPaste size={11} /> {session ? 'Replace' : 'Paste'}
                                        </button>
                                    )}
                                    {session && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(dayNum, session.name);
                                            }}
                                            title="Delete Session"
                                            aria-label="Delete Session"
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: 'var(--secondary-foreground)', cursor: 'pointer',
                                                padding: '4px', fontSize: '0.7rem', opacity: 0.6,
                                                borderRadius: '4px', display: 'flex', alignItems: 'center',
                                                transition: 'all 0.15s ease',
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                            onMouseOut={e => { e.currentTarget.style.color = 'var(--secondary-foreground)'; e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Existing Session Overlap Indicator */}
                            {existingGhostSessions.length > 0 && (
                                <div style={{
                                    margin: '6px 8px 2px',
                                    padding: '5px 8px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '6px',
                                    fontSize: '0.68rem',
                                    color: '#ef4444',
                                }} onClick={e => e.stopPropagation()}>
                                    <div style={{ fontWeight: 800, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                                        Existing Program:
                                    </div>
                                    {existingGhostSessions.map((ghost, gi) => (
                                        <div key={gi} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                            {ghost.programName} ({ghost.sessionName})
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Session Name (editable) */}
                            {session && (
                                <div
                                    style={{
                                        padding: '6px 10px 6px 8px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        background: 'rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <div
                                        draggable
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            handleSessionDragStart(e, dayNum);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        title="Drag whole session to another day"
                                        style={{
                                            cursor: 'grab',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'var(--secondary-foreground)',
                                            opacity: 0.6,
                                            padding: '2px',
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--primary)'; }}
                                        onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--secondary-foreground)'; }}
                                    >
                                        <GripVertical size={14} />
                                    </div>
                                    <input
                                        value={session.name}
                                        onChange={e => updateSessionName(dayNum, e.target.value)}
                                        onFocus={() => onSelectDay(dayNum)}
                                        onClick={e => e.stopPropagation()}
                                        onMouseDown={e => e.stopPropagation()}
                                        placeholder="Session Name"
                                        style={{
                                            background: 'transparent', border: 'none', color: 'var(--foreground)',
                                            fontWeight: 700, fontSize: '0.85rem', width: '100%', outline: 'none',
                                            padding: '2px 0',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSession(dayNum, session.name);
                                        }}
                                        title="Delete Session"
                                        aria-label="Delete Session"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--secondary-foreground)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: 0.6,
                                            borderRadius: '4px',
                                            transition: 'all 0.15s ease',
                                            flexShrink: 0,
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.color = '#ef4444';
                                            e.currentTarget.style.opacity = '1';
                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.color = 'var(--secondary-foreground)';
                                            e.currentTarget.style.opacity = '0.6';
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Warm-Up Drills Section */}
                            <div
                                onClick={e => e.stopPropagation()}
                                style={{
                                    padding: '6px 10px 8px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Activity size={11} style={{ color: 'var(--primary)', opacity: 0.85 }} />
                                        <span style={{
                                            fontSize: '0.62rem',
                                            fontWeight: 700,
                                            color: 'var(--secondary-foreground)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}>
                                            Warm-Up Drills
                                        </span>
                                    </div>
                                    {session?.warmupDrills?.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => applyWarmupToAllSessions(session.warmupDrills)}
                                            title="Apply these drills to all sessions in the program"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--primary)',
                                                fontSize: '0.62rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                padding: '0 2px',
                                                opacity: 0.85,
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                            onMouseOut={e => e.currentTarget.style.opacity = '0.85'}
                                        >
                                            Apply All
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={session?.warmupDrills || ''}
                                    onChange={e => setDayWarmupDrills(dayNum, e.target.value)}
                                    placeholder="Warm-up drills & prep notes..."
                                    rows={session?.warmupDrills ? 2 : 1}
                                    style={{
                                        width: '100%',
                                        minHeight: session?.warmupDrills ? '40px' : '26px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px dashed rgba(255,255,255,0.12)',
                                        borderRadius: '4px',
                                        padding: '4px 6px',
                                        fontSize: '0.74rem',
                                        color: 'var(--foreground)',
                                        resize: 'vertical',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        lineHeight: 1.3,
                                        transition: 'border-color 0.15s, min-height 0.15s',
                                    }}
                                    onFocus={e => {
                                        onSelectDay(dayNum);
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        if (!session?.warmupDrills) e.currentTarget.style.minHeight = '46px';
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                                        if (!session?.warmupDrills) e.currentTarget.style.minHeight = '26px';
                                    }}
                                />
                            </div>

                            {/* + Add exercise button */}
                            <div style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => addExerciseToDay(dayNum, { name: 'New Exercise', category: 'Isolation/Accessory' })}
                                    style={{
                                        width: '100%', background: isSelected ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.02)',
                                        border: isSelected ? '1px dashed var(--primary)' : '1px dashed rgba(255,255,255,0.2)',
                                        color: isSelected ? 'var(--primary)' : 'var(--secondary-foreground)',
                                        borderRadius: '6px', padding: '8px',
                                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.color = 'var(--primary)';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.color = isSelected ? 'var(--primary)' : 'var(--secondary-foreground)';
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
                                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', textAlign: 'center',
                                            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px',
                                            minHeight: '100px', margin: '4px 0', padding: '12px', gap: '8px',
                                        }}
                                    >
                                        <div>Drop an exercise here or click to select this session.</div>
                                        {activeClipboard && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePasteSession(dayNum, dayLabel);
                                                }}
                                                style={{
                                                    background: 'rgba(6, 182, 212, 0.15)',
                                                    border: '1px solid var(--primary)',
                                                    color: 'var(--primary)',
                                                    padding: '5px 10px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.74rem',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)',
                                                    marginTop: '4px',
                                                }}
                                            >
                                                <ClipboardPaste size={13} /> Paste &quot;{activeClipboard.name || 'Session'}&quot;
                                            </button>
                                        )}
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
                                            onClick={e => {
                                                e.stopPropagation();
                                                onSelectDay(dayNum);
                                            }}
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
                                            {/* Exercise Name Banner - Full text with word wrap & direct action buttons */}
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => duplicateExercise(dayNum, exIdx)}
                                                        title="Duplicate Exercise"
                                                        style={{
                                                            background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff',
                                                            cursor: 'pointer', padding: '4px 6px', borderRadius: '4px',
                                                            display: 'flex', alignItems: 'center',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeExercise(dayNum, ex.id || exIdx)}
                                                        title="Delete Exercise"
                                                        style={{
                                                            background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff',
                                                            cursor: 'pointer', padding: '4px 6px', borderRadius: '4px',
                                                            display: 'flex', alignItems: 'center',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

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
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeSet(dayNum, exIdx, si);
                                                                }}
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
                                                }} onClick={e => e.stopPropagation()}>
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

                                                {/* Exercise Note / Instructions */}
                                                <div style={{
                                                    padding: '6px 0 2px',
                                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                                    marginTop: '4px',
                                                }} onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                                        <StickyNote size={10} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            Note / Cue
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        value={ex.notes || ''}
                                                        onChange={e => updateExerciseNotes(dayNum, exIdx, e.target.value)}
                                                        placeholder="Add exercise cues or notes for athlete..."
                                                        rows={ex.notes ? 2 : 1}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: ex.notes ? '38px' : '26px',
                                                            background: 'rgba(0,0,0,0.3)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            borderRadius: '4px',
                                                            padding: '4px 6px',
                                                            fontSize: '0.74rem',
                                                            color: 'var(--foreground)',
                                                            resize: 'vertical',
                                                            outline: 'none',
                                                            fontFamily: 'inherit',
                                                            lineHeight: 1.3,
                                                        }}
                                                        onFocus={e => {
                                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                                            if (!ex.notes) e.currentTarget.style.minHeight = '42px';
                                                        }}
                                                        onBlur={e => {
                                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                            if (!ex.notes) e.currentTarget.style.minHeight = '26px';
                                                        }}
                                                    />
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
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    backgroundColor: 'rgba(16, 185, 129, 0.95)',
                    color: '#fff',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                    <span style={{ fontSize: '1rem' }}>✓</span>
                    <span>{toastMessage}</span>
                </div>
            )}
            {showPivotModal && (
                <PivotRandomizerModal
                    isOpen={showPivotModal}
                    onClose={() => setShowPivotModal(false)}
                    weeks={weeks}
                    currentWeekNum={currentWeekNum}
                    exerciseDB={initialExercises}
                    liftTargets={liftTargets}
                    onApplyPivot={handleApplyPivot}
                />
            )}
        </div>
    );
}

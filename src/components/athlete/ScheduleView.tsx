'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';
import WeightInput from '@/components/athlete/WeightInput';
import { ArrowRight, Search, ChevronDown, Dumbbell, Calendar, Check, ChevronsUpDown, Sparkles } from 'lucide-react';
import { getExerciseCategory } from '@/lib/exercise-db';

const ExerciseFeedback = dynamic(() => import('@/components/athlete/ExerciseFeedback'), { ssr: false });
const ReadinessCheckin = dynamic(() => import('@/components/athlete/ReadinessCheckin'), { ssr: false });
const CelebrationScreen = dynamic(() => import('@/components/athlete/CelebrationScreen'), { ssr: false });
const PRToggle = dynamic(() => import('@/components/athlete/PRToggle'), { ssr: false });
const PlannedTopSetInput = dynamic(() => import('@/components/athlete/PlannedTopSetInput'), { ssr: false });

/* ─────────── constants ─────────── */
const CATEGORY_COLORS: Record<string, string> = {
    'Knee': '#EAB308',
    'Hip': '#EF4444',
    'Horizontal Push': '#22C55E',
    'Vertical Push': '#F59E0B',
    'Horizontal Pull': '#06B6D4',
    'Vertical Pull': '#3B82F6',
    'Isolation (Upper)': '#A78BFA',
    'Isolation (Lower)': '#F472B6',
    'Isolation/Accessory': '#8B5CF6'
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSetsSummary(sets: any[]) {
    if (!Array.isArray(sets) || sets.length === 0) return '';
    const parts: string[] = [];
    let i = 0;
    while (i < sets.length) {
        const s = sets[i];
        const reps = s.reps || '';
        const rpe = s.rpe || '';
        const weight = s.weight || '';
        let count = 1;
        while (i + count < sets.length) {
            const next = sets[i + count];
            if (String(next.reps) === String(reps) && String(next.rpe) === String(rpe) && String(next.weight) === String(weight)) {
                count++;
            } else break;
        }
        let part = count > 1 ? `${count}x${reps}` : `x${reps}`;
        if (rpe) part += ` @${rpe}`;
        if (weight && String(weight).includes('%')) part += ` @${weight}`;
        parts.push(part);
        i += count;
    }
    return parts.join(', ');
}

/* ─────────── helpers ─────────── */
function linkify(text: string | null | undefined) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
}

/** Parse a date string as local time to avoid UTC timezone shift */
function parseLocalDate(dateStr: any): Date {
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
}

function sessionKey(programId: string, weekNum: number, day: number) {
    return `${programId}_w${weekNum}_d${day}`;
}

/** Compute the date range for a given program week */
function weekDateRangeFromDate(programStartDate: any, weekNumber: number): string {
    if (!programStartDate) return '';
    const start = parseLocalDate(programStartDate);
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

/** Safely resolves a session's date, falling back to weekNumber + day if scheduledDate is outside the week's boundaries */
function resolveSessionDate(programStartDate: any, weekNumber: number, day: number, scheduledDate?: string): string {
    if (!programStartDate) {
        if (scheduledDate) return String(scheduledDate).split('T')[0];
        return toDateStr(new Date());
    }

    const start = parseLocalDate(programStartDate);
    const expected = new Date(start);
    expected.setDate(expected.getDate() + (weekNumber - 1) * 7 + (day - 1));
    const expectedStr = toDateStr(expected);

    if (!scheduledDate) return expectedStr;

    const candStr = String(scheduledDate).split('T')[0];
    const candParts = candStr.split('-').map(Number);
    if (candParts.length !== 3 || candParts.some(isNaN)) return expectedStr;

    const candDate = new Date(candParts[0], candParts[1] - 1, candParts[2]);
    candDate.setHours(0, 0, 0, 0);

    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // If candidate date is within this week's window, use it
    if (candDate >= weekStart && candDate <= weekEnd) {
        return candStr;
    }

    // scheduledDate is outside this week's bounds (e.g. stale from duplicating week or shifted start date)
    return expectedStr;
}

function sessionProgress(exercises: any[], log: any, editStateData?: any[]): number {
    const totalSets = exercises.reduce((s: number, ex: any) => s + (Array.isArray(ex?.sets) ? ex?.sets.length : 0), 0);
    if (!totalSets) return 0;
    let filled = 0;
    if (editStateData) {
        editStateData.forEach((ex: any) => {
            (ex?.sets || []).forEach((s: any) => {
                const a = s.actual || {};
                if (a.weight || a.reps) filled++;
            });
        });
    } else if (log) {
        (log.exercises || []).forEach((logEx: any) => {
            (logEx.sets || []).forEach((s: any) => { if (s.weight || s.reps) filled++; });
        });
    }
    return Math.min(100, Math.round((filled / totalSets) * 100));
}

/* ─────────── component ─────────── */
export default function ScheduleView({ programs, athleteId, coachId, logs, isCoachView = false, nextMeetDate = null, disableReadiness = false, athleteEmail = '' }: {
    programs: any[];
    athleteId: string;
    coachId?: string;
    logs: any[];
    isCoachView?: boolean;
    nextMeetDate?: string | null;
    disableReadiness?: boolean;
    athleteEmail?: string;
}) {
    const router = useRouter();

    // Check if athlete is specifically exempt from readiness quiz (jayseng123@gmail.com)
    const isReadinessExempt = Boolean(
        disableReadiness ||
        athleteEmail?.toLowerCase().trim() === 'jayseng123@gmail.com'
    );

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

    const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
    const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
    const [searchQuery, setSearchQuery] = useState('');

    // Celebration screen state
    const [celebration, setCelebration] = useState<{ sessionName: string } | null>(null);
    const celebratedSessionsRef = useRef<Set<string>>(new Set());
    const sessionMetaRef = useRef<Record<string, { exercises: any[]; sessionName: string; scheduledDate?: string; legacyKey?: string }>>({});

    // Robust session log lookup: checks both session.id and legacyKey, preferring the populated record
    const findSessionLog = useCallback((sId?: string, legKey?: string, progId?: string) => {
        if (!Array.isArray(logs) || !progId) return undefined;
        const l1 = sId ? logs.find(l => l.sessionId === sId && l.programId === progId) : undefined;
        const l2 = legKey && legKey !== sId ? logs.find(l => l.sessionId === legKey && l.programId === progId) : undefined;
        if (l1 && l2) {
            const countSets = (lg: any) => (lg?.exercises || []).reduce((acc: number, ex: any) => acc + (ex?.sets || []).filter((st: any) => st?.weight || st?.reps).length, 0);
            return countSets(l1) >= countSets(l2) ? l1 : l2;
        }
        return l1 || l2;
    }, [logs]);

    // Readiness gating: track which sessions have completed readiness
    // Coach view bypasses readiness entirely
    const [readySessions, setReadySessions] = useState<Set<string>>(new Set());
    const [readinessPopup, setReadinessPopup] = useState<string | null>(null); // session key of popup
    const [shakeKey, setShakeKey] = useState<string | null>(null); // exercise key to shake
    const [activeTabs, setActiveTabs] = useState<Record<string, 'previous' | 'prescribed' | 'actual'>>({});
    const [plannedTopSets, setPlannedTopSets] = useState<Record<string, Record<string, any>>>({});

    const fetchPlannedTopSetsForSession = useCallback(async (sKey: string, legacyKey?: string, progId?: string, wn?: number, dn?: number) => {
        if (!athleteId || !sKey) return;
        try {
            let url = `/api/top-sets?athleteId=${athleteId}&sessionId=${encodeURIComponent(sKey)}`;
            if (legacyKey && legacyKey !== sKey) url += `&legacyKey=${encodeURIComponent(legacyKey)}`;
            if (progId) url += `&programId=${encodeURIComponent(progId)}`;
            if (wn) url += `&weekNum=${wn}`;
            if (dn) url += `&dayNum=${dn}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const mapping: Record<string, any> = {};
                (data || []).forEach((ts: any) => {
                    if (ts.exerciseName) {
                        mapping[ts.exerciseName] = ts;
                    }
                });
                setPlannedTopSets(prev => ({
                    ...prev,
                    [sKey]: mapping,
                    ...(legacyKey ? { [legacyKey]: mapping } : {})
                }));
            }
        } catch (e) {
            console.error('Failed to fetch planned top sets for session', sKey, e);
        }
    }, [athleteId]);

    const markSessionReady = useCallback((sKey: string) => {
        setReadySessions(prev => {
            const next = new Set(prev);
            next.add(sKey);
            return next;
        });
    }, []);

    const handleLockedExerciseClick = useCallback((sKey: string, exKey: string) => {
        setShakeKey(exKey);
        setReadinessPopup(sKey);
        setTimeout(() => setShakeKey(null), 500);
        setTimeout(() => setReadinessPopup(null), 3000);
    }, []);

    // Week overview drawer state
    const [weekDrawer, setWeekDrawer] = useState<{ open: boolean; programId: string; programName: string; weekNum: number; sessions: any[]; startDate: string } | null>(null);

    const openWeekDrawer = (program: any, week: any) => {
        const wn = week.weekNumber || 1;
        const dateRange = weekDateRangeFromDate(program.startDate, wn);
        setWeekDrawer({
            open: true,
            programId: program.id,
            programName: program.name,
            weekNum: wn,
            sessions: (Array.isArray(week.sessions) ? week.sessions : []).filter((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0),
            startDate: dateRange
        });
    };

    useEffect(() => {
        const saved = localStorage.getItem('athlete-unit-pref');
        if (saved === 'kg' || saved === 'lbs') setUnit(saved);
    }, []);

    const toggleUnit = (u: 'kg' | 'lbs') => {
        if (u === unit) return;
        setUnit(u);
        localStorage.setItem('athlete-unit-pref', u);
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            for (const k in copy) {
                copy[k].forEach((ex: any) => {
                    if (ex) ex.unit = u;
                    ex?.sets.forEach((s: any) => {
                        if (s.actual?.weight) {
                            const num = parseFloat(s.actual.weight);
                            if (!isNaN(num)) {
                                if (u === 'kg') s.actual.weight = (num * 0.45359237).toFixed(1).replace(/\.0$/, '');
                                else s.actual.weight = (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
                            }
                        }
                        if (s.target?.weight) {
                            const num = parseFloat(s.target.weight);
                            if (!isNaN(num)) {
                                if (u === 'kg') s.target.weight = (num * 0.45359237).toFixed(1).replace(/\.0$/, '');
                                else s.target.weight = (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
                            }
                        }
                    });
                });
            }
            return copy;
        });
    };

    // Filter and sort programs
    const filteredPrograms = useMemo(() => {
        let result = [...(programs || [])];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.name?.toLowerCase().includes(q));
        }

        // Sort — programs already come newest-first from DB
        // If user picks oldest, reverse the order
        if (sortOrder === 'oldest') {
            result.reverse();
        }

        return result;
    }, [programs, sortOrder, searchQuery]);

    const toDisplay = (val: any) => {
        if (val === undefined || val === null || val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        return val.toString();
    };

    const toInternal = (val: any) => {
        if (val === undefined || val === null || val === '') return '';
        return val.toString();
    };

    const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };

    const toggleSessionExercises = (sKey: string, exercises: any[], forceOpen: boolean) => {
        setOpenExercises(prev => {
            const next = new Set(prev);
            exercises.forEach((_, idx) => {
                const exKey = `${sKey}-ex${idx}`;
                if (forceOpen) next.add(exKey);
                else next.delete(exKey);
            });
            return next;
        });
    };

    // Initialize edit state when a session is opened
    const initEdit = useCallback((sKey: string, exercises: any[], log: any) => {
        if (editState[sKey]) return;
        const savedPref = (typeof window !== 'undefined' ? localStorage.getItem('athlete-unit-pref') : null) as 'kg' | 'lbs' | null;
        const effectiveUnit = savedPref || unit || 'lbs';
        const state = (exercises || []).map((ex: any) => {
            const logEx = log?.exercises?.find((l: any) => l.exerciseId === ex?.id || l.name === ex?.name);
            const sets = Array.isArray(ex?.sets) ? ex?.sets : [];
            const savedUnit = logEx?.unit || logEx?.sets?.[0]?.unit || effectiveUnit;
            return {
                exerciseId: ex?.id,
                name: ex?.name,
                notes: logEx?.notes || '',
                unit: savedUnit,
                sets: sets.map((s: any, i: number) => {
                    const saved = logEx?.sets?.[i];
                    return {
                        target: { weight: s.weight ? String(s.weight) : '', reps: s.reps || '', rpe: s.rpe || '' },
                        actual: { weight: saved?.weight ? String(saved.weight) : '', reps: saved?.reps || '', rpe: saved?.rpe || '' }
                    };
                })
            };
        });
        setEditState(prev => ({ ...prev, [sKey]: state }));
    }, [editState, unit]);

    // Auto-save debounced effect
    const latestEditStateRef = useRef(editState);
    useEffect(() => {
        latestEditStateRef.current = editState;
    }, [editState]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Flush all pending saves immediately
                Object.entries(saveTimersRef.current).forEach(([sKey, data]) => {
                    clearTimeout(data.timer);
                    if (handleSaveRef.current) {
                        handleSaveRef.current(sKey, data.programId);
                    }
                    delete saveTimersRef.current[sKey];
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handleVisibilityChange);
        };
    }, []);

    // Track per-session in-flight saves to prevent concurrent requests
    const savingInFlightRef = useRef<Set<string>>(new Set());
    const pendingSavesRef = useRef<Map<string, string>>(new Map()); // sKey -> programId

    const handleSaveRef = useRef<((sKey: string, programId: string) => Promise<void>) | null>(null);

    handleSaveRef.current = async (sKey: string, programId: string) => {
        // If a save is already in-flight for this session, queue it for retry
        if (savingInFlightRef.current.has(sKey)) {
            pendingSavesRef.current.set(sKey, programId);
            return;
        }

        const state = latestEditStateRef.current[sKey];
        if (!state) return;

        savingInFlightRef.current.add(sKey);
        pendingSavesRef.current.delete(sKey);
        setSaving(prev => new Set(prev).add(sKey));
        try {
            const cleanLogs = state.map((ex: any) => ({
                exerciseId: ex.exerciseId,
                name: ex?.name,
                notes: ex.notes || '',
                unit: ex?.unit || unit,
                sets: ex?.sets?.map((s: any) => ({ weight: s.actual.weight || '', reps: s.actual.reps, rpe: s.actual.rpe, unit: ex?.unit || unit }))
            }));

            const meta = sessionMetaRef.current[sKey];
            const existingLog = findSessionLog(sKey, meta?.legacyKey, programId);
            const logDate = existingLog?.date || meta?.scheduledDate || new Date().toISOString();

            const res = await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({ athleteId, programId, sessionId: sKey, date: logDate, exercises: cleanLogs })
            });

            if (res.ok) {
                setSavedKeys(prev => new Set(prev).add(sKey));
                setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(sKey); return n; }), 2000);

                // Check if session just reached 100% — trigger celebration
                const meta = sessionMetaRef.current[sKey];
                if (meta && !celebratedSessionsRef.current.has(sKey)) {
                    const progress = sessionProgress(meta.exercises, null, latestEditStateRef.current[sKey]);
                    if (progress === 100) {
                        celebratedSessionsRef.current.add(sKey);
                        setCelebration({ sessionName: meta.sessionName });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            savingInFlightRef.current.delete(sKey);
            setSaving(prev => { const n = new Set(prev); n.delete(sKey); return n; });
            // If another save was queued while in-flight, fire it now
            if (pendingSavesRef.current.has(sKey)) {
                const pid = pendingSavesRef.current.get(sKey)!;
                pendingSavesRef.current.delete(sKey);
                handleSaveRef.current?.(sKey, pid);
            }
        }
    };

    // Auto-save throttle logic
    const saveTimersRef = useRef<Record<string, { timer: NodeJS.Timeout, programId: string }>>({});

    useEffect(() => {
        return () => {
            // Flush all pending saves immediately on unmount
            Object.entries(saveTimersRef.current).forEach(([sKey, data]) => {
                clearTimeout(data.timer);
                if (handleSaveRef.current) {
                    handleSaveRef.current(sKey, data.programId);
                }
            });
        };
    }, []);

    const triggerAutoSave = useCallback((sKey: string, programId: string) => {
        if (saveTimersRef.current[sKey]) {
            clearTimeout(saveTimersRef.current[sKey].timer);
        }
        saveTimersRef.current[sKey] = {
            programId,
            timer: setTimeout(() => {
                if (handleSaveRef.current) {
                    handleSaveRef.current(sKey, programId);
                }
                delete saveTimersRef.current[sKey];
            }, 1500)
        };
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

    const updateExerciseUnit = (sKey: string, exIdx: number, value: 'lbs' | 'kg', programId: string) => {
        setUnit(value);
        localStorage.setItem('athlete-unit-pref', value);
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (copy[sKey]?.[exIdx]) copy[sKey][exIdx].unit = value;
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
        triggerAutoSave(sKey, programId);
    };

    const copyPrevSet = (sKey: string, exIdx: number, setIdx: number, programId: string) => {
        if (setIdx === 0) return;
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (!copy[sKey]) return prev;
            const prevActual = copy[sKey]?.[exIdx]?.sets?.[setIdx - 1]?.actual;
            if (prevActual && copy[sKey]?.[exIdx]?.sets?.[setIdx]) {
                copy[sKey][exIdx].sets[setIdx].actual = { ...prevActual };
            }
            return copy;
        });
        triggerAutoSave(sKey, programId);
    };

    const copyTargetToActual = (sKey: string, exIdx: number, setIdx: number, programId: string) => {
        setEditState(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            if (!copy[sKey]) return prev;
            const target = copy[sKey]?.[exIdx]?.sets?.[setIdx]?.target;
            const exName = copy[sKey]?.[exIdx]?.name;
            const planned = setIdx === 0 && exName ? plannedTopSets[sKey]?.[exName] : null;

            if (copy[sKey]?.[exIdx]?.sets?.[setIdx]) {
                const rawReps = String(target?.reps || (setIdx === 0 && planned?.reps ? planned.reps : ''));
                const cleanReps = rawReps.includes('-') ? rawReps.split('-')[0] : rawReps;
                const rawWeight = target?.weight || (setIdx === 0 && planned?.weight ? planned.weight : '');
                const cleanWeight = rawWeight ? String(rawWeight).replace(/[^0-9.]/g, '') : '';
                const cleanRpe = target?.rpe || (setIdx === 0 && planned?.rpe ? planned.rpe : '');

                copy[sKey][exIdx].sets[setIdx].actual = {
                    weight: cleanWeight, reps: cleanReps, rpe: cleanRpe || ''
                };
            }
            return copy;
        });
        triggerAutoSave(sKey, programId);
    };

    /** Returns the most recently logged sets for an exercise, excluding the current session */
    const getPrevSets = useCallback((exerciseName: string, currentSKey: string) => {
        if (!Array.isArray(logs) || logs.length === 0) return null;
        const key = (exerciseName || '').toLowerCase().trim();
        const sorted = [...logs]
            .filter(l => l.sessionId !== currentSKey)
            .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
        for (const log of sorted) {
            const logExercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
            const found = logExercises.find((le: any) => (le.name || '').toLowerCase().trim() === key);
            if (found) {
                const sets = (Array.isArray(found.sets) ? found.sets : [])
                    .map((s: any) => ({ weight: s.weight || '', reps: s.reps || '', rpe: s.rpe || '' }))
                    .filter((s: any) => s.weight || s.reps);
                if (sets.length > 0) return { sets, date: log.date || '' };
            }
        }
        return null;
    }, [logs]);

    // ─── Date strip state ───
    const [selectedDate, setSelectedDate] = useState<string>(() => toDateStr(new Date()));
    const [viewMode, setViewMode] = useState<'date' | 'blocks'>('date');
    const dateStripRef = useRef<HTMLDivElement>(null);

    // Build sessionsByDate map: dateStr -> [{ program, weekNum, session, sKey, isActive }]
    // Uses same logic as MasterProgramCalendar: Day 1 = program startDate,
    // Day 2 = startDate+1, etc. Week boundaries every 7 days from startDate.
    const sessionsByDate = useMemo(() => {
        const map: Record<string, { program: any; weekNum: number; weekDisplayNum: number; session: any; sKey: string; legacyKey?: string; isActive: boolean; isCurrent: boolean; sessionNum: number }[]> = {};
        if (!Array.isArray(programs)) return map;

        programs.forEach(program => {
            if (!program.startDate) return;
            const start = parseLocalDate(program.startDate);
            const isActive = program.status === 'active';

            // Date-based check: a program whose date range hasn't fully passed
            // should never show as "past", regardless of its DB status.
            const weeksArr: any[] = Array.isArray(program.weeks) ? program.weeks : [];
            const programEnd = new Date(start);
            programEnd.setDate(programEnd.getDate() + Math.max(weeksArr.length, 1) * 7);
            const todayCheck = new Date();
            todayCheck.setHours(0, 0, 0, 0);
            const isCurrent = isActive || todayCheck < programEnd;

            const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
            // Collect all sessions with their computed dates to determine sequential week display
            const allSessionDates: { wn: number; date: Date }[] = [];
            weeks.forEach((week: any) => {
                const wn = week.weekNumber || 1;
                const sessions: any[] = (Array.isArray(week.sessions) ? week.sessions : [])
                    .filter((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0);
                sessions.forEach((session: any) => {
                    const day = session.day || 1;
                    const ds = resolveSessionDate(program.startDate, wn, day, session.scheduledDate);
                    const [sy, sm, sd] = ds.split('-').map(Number);
                    const sessionDateObj = new Date(sy, sm - 1, sd);
                    sessionDateObj.setHours(0, 0, 0, 0);
                    allSessionDates.push({ wn, date: sessionDateObj });
                });
            });
            // Get unique calendar weeks (Mon-Sun) that have sessions, sorted chronologically
            const calendarWeekMondays = [...new Set(allSessionDates.map(s => {
                const mon = new Date(s.date);
                const off = (mon.getDay() + 6) % 7;
                mon.setDate(mon.getDate() - off);
                return mon.getTime();
            }))].sort((a, b) => a - b);

            weeks.forEach((week: any) => {
                const wn = week.weekNumber || 1;
                const sessions: any[] = (Array.isArray(week.sessions) ? week.sessions : [])
                    .filter((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0);
                // Sort sessions by day to determine sequential session number
                const sortedSessions = [...sessions].sort((a: any, b: any) => (a?.day || 1) - (b?.day || 1));
                sessions.forEach((session: any) => {
                    const day = session.day || 1;
                    const ds = resolveSessionDate(program.startDate, wn, day, session.scheduledDate);
                    const legacyKey = sessionKey(program.id, wn, day);
                    const sKey = session.id || legacyKey;
                    // Compute calendar-week display number (1-based, only counting weeks with sessions)
                    const [sy, sm, sd] = ds.split('-').map(Number);
                    const sessionMonday = new Date(sy, sm - 1, sd);
                    const off = (sessionMonday.getDay() + 6) % 7;
                    sessionMonday.setDate(sessionMonday.getDate() - off);
                    const weekDisplayNum = calendarWeekMondays.indexOf(sessionMonday.getTime()) + 1;
                    // sessionNum is the 1-based position of this session in the week (sorted by day)
                    const sessionNum = sortedSessions.findIndex((s: any) => (s?.day || 1) === day) + 1;
                    if (!map[ds]) map[ds] = [];
                    map[ds].push({ program, weekNum: wn, weekDisplayNum: weekDisplayNum || 1, session, sKey, legacyKey, isActive, isCurrent, sessionNum });
                });
            });
        });
        return map;
    }, [programs]);

    // Generate date strip: 60 days centered on today (30 before, 30 after)
    const dateStrip = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days: { date: Date; dateStr: string; isToday: boolean; hasSession: boolean; hasActiveSession: boolean, isMeet: boolean }[] = [];
        for (let i = -30; i <= 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const sessions = sessionsByDate[ds] || [];
            days.push({
                date: d,
                dateStr: ds,
                isToday: i === 0,
                hasSession: sessions.length > 0,
                hasActiveSession: sessions.some(s => s.isCurrent),
                isMeet: ds === nextMeetDate,
            });
        }
        return days;
    }, [sessionsByDate, nextMeetDate]);

    // Scroll to today on mount
    useEffect(() => {
        if (dateStripRef.current) {
            const todayEl = dateStripRef.current.querySelector('[data-today="true"]') as HTMLElement;
            if (todayEl) {
                todayEl.scrollIntoView({ inline: 'center', block: 'nearest' });
            }
        }
    }, []);

    // Automatically fetch planned top sets for sessions on selected date and open sessions
    useEffect(() => {
        const sessionsOnDate = sessionsByDate[selectedDate] || [];
        sessionsOnDate.forEach(({ sKey, legacyKey, program, weekNum, session }: any) => {
            if (!plannedTopSets[sKey] && (!legacyKey || !plannedTopSets[legacyKey])) {
                fetchPlannedTopSetsForSession(sKey, legacyKey, program?.id, weekNum, session?.day || 1);
            }
        });
        openSessions.forEach(sKey => {
            if (!plannedTopSets[sKey]) {
                fetchPlannedTopSetsForSession(sKey);
            }
        });
    }, [selectedDate, sessionsByDate, openSessions, fetchPlannedTopSetsForSession, plannedTopSets]);

    // Sessions for the currently selected date
    const selectedDateSessions = sessionsByDate[selectedDate] || [];

    if (!Array.isArray(programs) || !programs.length) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No training blocks found.</p>
                <p style={{ fontSize: '0.85rem' }}>Ask your coach to assign a program.</p>
            </div>
        );
    }

    // Format selected date for display
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const todayStr = toDateStr(new Date());
    const isSelectedToday = selectedDate === todayStr;
    const selectedDateLabel = isSelectedToday ? 'Today' :
        selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: '3rem' }}>

            {/* Shake animation for locked exercises */}
            <style>{`
                @keyframes readiness-shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 50%, 90% { transform: translateX(-4px); }
                    30%, 70% { transform: translateX(4px); }
                }
                .readiness-shake { animation: readiness-shake 0.4s ease-in-out; }
            `}</style>

            {/* ═══ DATE HEADER ═══ */}
            <div style={{ padding: '20px 16px 0' }}>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    margin: 0,
                    letterSpacing: '-0.02em',
                }}>
                    {selectedDateLabel}
                </h1>
                {!isSelectedToday && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                        {selectedDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                )}
            </div>

            {/* ═══ SCROLLABLE DATE STRIP ═══ */}
            <div
                ref={dateStripRef}
                style={{
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                    padding: '16px 16px 12px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {dateStrip.map(d => {
                    const isSelected = d.dateStr === selectedDate;
                    return (
                        <div
                            key={d.dateStr}
                            data-today={d.isToday ? 'true' : undefined}
                            onClick={() => setSelectedDate(d.dateStr)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                minWidth: 46,
                                padding: '9px 7px 7px',
                                borderRadius: 16,
                                cursor: 'pointer',
                                transition: 'all 0.16s var(--ease-out)',
                                background: isSelected
                                    ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.32) 0%, rgba(168, 85, 247, 0.22) 100%)'
                                    : d.isToday
                                        ? 'rgba(125, 135, 210, 0.14)'
                                        : 'rgba(255, 255, 255, 0.035)',
                                border: isSelected
                                    ? '1px solid rgba(125, 135, 210, 0.55)'
                                    : d.isToday
                                        ? '1px solid rgba(125, 135, 210, 0.35)'
                                        : '1px solid rgba(255, 255, 255, 0.08)',
                                boxShadow: isSelected
                                    ? '0 4px 16px rgba(125, 135, 210, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                    : 'none',
                            }}
                            className="chat-press"
                        >
                            <span style={{
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: isSelected ? 'white' : 'var(--secondary-foreground)',
                            }}>
                                {SHORT_DAYS[d.date.getDay()]}
                            </span>
                            <span style={{
                                fontSize: '1.08rem',
                                fontWeight: 800,
                                color: isSelected ? 'white' : d.isToday ? 'var(--primary)' : 'var(--foreground)',
                                lineHeight: 1.1,
                            }}>
                                {d.date.getDate()}
                            </span>
                            {/* Session/Meet indicators */}
                            <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '14px' }}>
                                {d.isMeet && <span style={{ fontSize: '0.65rem', lineHeight: 1, display: 'block', textAlign: 'center' }}>🏆</span>}
                                {!d.isMeet && <div style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: d.hasSession
                                        ? isSelected ? 'white'
                                            : d.hasActiveSession ? 'var(--accent)' : 'rgba(148, 163, 184, 0.4)'
                                        : 'transparent',
                                    transition: 'background 0.2s',
                                }} />}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Hide scrollbar via inline style tag */}
            <style>{`
                [data-today] { scroll-margin-inline: 50%; }
                div::-webkit-scrollbar { display: none; }
            `}</style>

            {/* ═══ VIEW MODE TOGGLE ═══ */}
            <div style={{ padding: '0 16px 14px', display: 'flex', width: '100%' }}>
                <div style={{
                    display: 'flex', width: '100%',
                    background: 'rgba(14, 18, 28, 0.75)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: 22,
                    padding: 4,
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.25)',
                }}>
                    {([['date', 'Schedule'], ['blocks', 'All Blocks']] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode as 'date' | 'blocks')}
                            className="chat-press"
                            style={{
                                flex: 1,
                                padding: '8px 16px',
                                border: viewMode === mode ? '1px solid rgba(125, 135, 210, 0.45)' : '1px solid transparent',
                                cursor: 'pointer',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                borderRadius: 18,
                                transition: 'all 0.16s var(--ease-out)',
                                background: viewMode === mode
                                    ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.28) 0%, rgba(168, 85, 247, 0.2) 100%)'
                                    : 'transparent',
                                color: viewMode === mode ? 'white' : 'var(--secondary-foreground)',
                                boxShadow: viewMode === mode ? '0 2px 10px rgba(125, 135, 210, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ SCHEDULE VIEW (Date-based) ═══ */}
            {viewMode === 'date' && (
                <div style={{ padding: '0 16px' }}>
                    {selectedDateSessions.length === 0 ? (
                        <div style={{
                            padding: '2.5rem 1.5rem',
                            textAlign: 'center',
                            background: 'linear-gradient(180deg, rgba(22, 27, 38, 0.6) 0%, rgba(13, 16, 24, 0.7) 100%)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 20,
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>
                                {isSelectedToday ? '---' : '---'}
                            </div>
                            <p style={{ fontSize: '0.95rem', color: 'var(--secondary-foreground)', margin: 0 }}>
                                {isSelectedToday ? 'No sessions scheduled for today' : 'No sessions on this date'}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', margin: '6px 0 0', opacity: 0.7 }}>
                                Rest day
                            </p>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button 
                                    onClick={() => setViewMode('blocks')}
                                    className="glass-button chat-press"
                                    style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: 12 }}
                                >
                                    View Full Block
                                </button>
                                {(() => {
                                    const nextDates = Object.keys(sessionsByDate).filter(d => d > selectedDate).sort();
                                    if (nextDates.length > 0) {
                                        return (
                                            <button 
                                                onClick={() => setSelectedDate(nextDates[0])}
                                                className="glass-button glass-button-primary chat-press"
                                                style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: 12, fontWeight: 700 }}
                                            >
                                                Next Session
                                            </button>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {selectedDateSessions.map(({ program, weekNum, weekDisplayNum, session, sKey, legacyKey, isActive, isCurrent, sessionNum }) => {
                                const exercises: any[] = Array.isArray(session.exercises) ? session.exercises : [];
                                const log = findSessionLog(sKey, legacyKey, program.id);
                                const progress = sessionProgress(exercises, log, editState[sKey]);
                                const sessionOpen = openSessions.has(sKey);

                                // Register session metadata for celebration detection
                                sessionMetaRef.current[sKey] = { exercises, sessionName: session.name || `Session ${session.day}`, scheduledDate: selectedDate, legacyKey };

                                return (
                                    <div key={sKey} id={`session-${sKey}`} className="glass-panel" style={{
                                        background: sessionOpen
                                            ? 'linear-gradient(180deg, rgba(22, 27, 40, 0.9) 0%, rgba(14, 17, 26, 0.95) 100%)'
                                            : 'linear-gradient(180deg, rgba(22, 27, 38, 0.75) 0%, rgba(13, 16, 24, 0.8) 100%)',
                                        backdropFilter: 'blur(16px)',
                                        WebkitBackdropFilter: 'blur(16px)',
                                        border: sessionOpen
                                            ? '1px solid rgba(125, 135, 210, 0.45)'
                                            : '1px solid rgba(255, 255, 255, 0.09)',
                                        borderRadius: 20,
                                        overflow: 'hidden',
                                        transition: 'all 0.25s var(--ease-out)',
                                        boxShadow: sessionOpen
                                            ? '0 12px 36px -4px rgba(0, 0, 0, 0.5), 0 0 24px rgba(125, 135, 210, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                            : '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                    }}>
                                        {/* Past program label */}
                                        {!isCurrent && (
                                            <div style={{
                                                padding: '6px 18px',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                color: 'var(--secondary-foreground)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary-foreground)', opacity: 0.6 }} />
                                                Past Program
                                            </div>
                                        )}

                                        {/* Session Card Header */}
                                        <div
                                            onClick={() => {
                                                toggle(openSessions, sKey, setOpenSessions);
                                                if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                            }}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '16px 18px',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                borderBottom: sessionOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                                                transition: 'background 0.2s ease',
                                            }}
                                        >
                                            {/* Top Row: Left Icon Squircle, Center Title & Subtitle, Right Controls */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                                                    {/* Session Icon Squircle */}
                                                    <div style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 14,
                                                        background: progress === 100
                                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)'
                                                            : sessionOpen
                                                                ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.25) 0%, rgba(168, 85, 247, 0.18) 100%)'
                                                                : 'linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%)',
                                                        border: progress === 100
                                                            ? '1px solid rgba(16, 185, 129, 0.45)'
                                                            : sessionOpen
                                                                ? '1px solid rgba(125, 135, 210, 0.45)'
                                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                                        boxShadow: progress === 100
                                                            ? '0 0 16px rgba(16, 185, 129, 0.25)'
                                                            : sessionOpen
                                                                ? '0 0 16px rgba(125, 135, 210, 0.2)'
                                                                : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        color: progress === 100 ? '#34d399' : sessionOpen ? 'var(--primary)' : 'var(--foreground)',
                                                        transition: 'all 0.2s var(--ease-out)',
                                                    }}>
                                                        {progress === 100 ? (
                                                            <Check size={20} strokeWidth={2.5} />
                                                        ) : (
                                                            <Dumbbell size={20} strokeWidth={2} />
                                                        )}
                                                    </div>

                                                    {/* Title & Metadata Block */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <span style={{
                                                                fontSize: '1.2rem',
                                                                fontWeight: 700,
                                                                letterSpacing: '-0.01em',
                                                                color: '#ffffff',
                                                                lineHeight: 1.25,
                                                            }}>
                                                                {session.name || `Session ${session.day}`}
                                                            </span>

                                                            {/* Status Tag */}
                                                            {progress === 100 ? (
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 9999,
                                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                                    color: '#34d399',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                }}>
                                                                    ✓ Done
                                                                </span>
                                                            ) : progress > 0 ? (
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 9999,
                                                                    background: 'rgba(125, 135, 210, 0.15)',
                                                                    color: 'var(--primary)',
                                                                    border: '1px solid rgba(125, 135, 210, 0.3)',
                                                                }}>
                                                                    In Progress
                                                                </span>
                                                            ) : null}

                                                            {/* Planned Top Set Indicator Badge */}
                                                            {(() => {
                                                                const sessionPlanned = plannedTopSets[sKey] || plannedTopSets[legacyKey] || {};
                                                                const plannedExNames = Object.keys(sessionPlanned).filter(k => sessionPlanned[k]?.weight || sessionPlanned[k]?.reps);
                                                                if (plannedExNames.length === 0) return null;
                                                                return (
                                                                    <span style={{
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 700,
                                                                        padding: '2px 9px',
                                                                        borderRadius: 9999,
                                                                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(99, 102, 241, 0.18) 100%)',
                                                                        color: '#38bdf8',
                                                                        border: '1px solid rgba(56, 189, 248, 0.5)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4,
                                                                        boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
                                                                    }}>
                                                                        🎯 {plannedExNames.length === 1
                                                                            ? `Planned: ${plannedExNames[0]} ${sessionPlanned[plannedExNames[0]].weight ? sessionPlanned[plannedExNames[0]].weight + (sessionPlanned[plannedExNames[0]].unit || unit) : ''}`
                                                                            : `${plannedExNames.length} Planned Top Sets`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Metadata Row */}
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontSize: '0.8rem',
                                                            color: 'var(--secondary-foreground)',
                                                            flexWrap: 'wrap',
                                                            lineHeight: 1.35,
                                                        }}>
                                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                                {program.name}
                                                            </span>
                                                            <span style={{ opacity: 0.35 }}>•</span>
                                                            <span>Week {weekNum}</span>
                                                            <span style={{ opacity: 0.35 }}>•</span>
                                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                                {weekDateRangeFromDate(program.startDate, weekNum)}
                                                            </span>

                                                            {/* Week Overview Button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const weekObj = program.weeks?.find((w: any) => w.weekNumber === weekNum) || { weekNumber: weekNum, sessions: [] };
                                                                    openWeekDrawer(program, weekObj);
                                                                }}
                                                                title="View week overview"
                                                                className="chat-press"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                    color: 'var(--foreground)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: 6,
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.16s ease',
                                                                }}
                                                            >
                                                                <Calendar size={11} strokeWidth={2} />
                                                                <span>Week</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Expand/Collapse All (if open) & Rotating Chevron */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    {sessionOpen && (
                                                        <div 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isCoachView && !isReadinessExempt && !readySessions.has(sKey)) {
                                                                    handleLockedExerciseClick(sKey, `${sKey}-expand-all`);
                                                                    return;
                                                                }
                                                                const anyOpen = exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`));
                                                                toggleSessionExercises(sKey, exercises, !anyOpen);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                                padding: '4px 8px',
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: 8,
                                                                color: 'var(--secondary-foreground)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.72rem',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            <ChevronsUpDown size={13} />
                                                            <span className="hidden sm:inline">
                                                                {exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`)) ? 'Collapse' : 'Expand'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Chevron Circle */}
                                                    <div style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        background: sessionOpen ? 'rgba(125, 135, 210, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                        border: sessionOpen ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: sessionOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                        transition: 'all 0.2s var(--ease-out)',
                                                        transform: sessionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    }}>
                                                        <ChevronDown size={17} strokeWidth={2.5} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar & Stats Section */}
                                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                                    <span style={{ color: 'var(--secondary-foreground)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                                                        {progress > 0 && progress < 100 && (
                                                            <>
                                                                <span style={{ opacity: 0.35 }}>•</span>
                                                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>In progress</span>
                                                            </>
                                                        )}
                                                    </span>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: progress === 100 ? '#34d399' : progress > 0 ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}>
                                                        {progress}%
                                                    </span>
                                                </div>

                                                {/* Modern Progress Track */}
                                                <div style={{
                                                    width: '100%',
                                                    height: 6,
                                                    borderRadius: 9999,
                                                    background: 'rgba(255, 255, 255, 0.07)',
                                                    overflow: 'hidden',
                                                    position: 'relative',
                                                }}>
                                                    <div style={{
                                                        height: '100%',
                                                        borderRadius: 9999,
                                                        transition: 'width 350ms var(--ease-out)',
                                                        width: `${progress}%`,
                                                        background: progress === 100
                                                            ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                                                            : 'linear-gradient(90deg, #7d87d2 0%, #a855f7 100%)',
                                                        boxShadow: progress === 100
                                                            ? '0 0 12px rgba(16, 185, 129, 0.7)'
                                                            : progress > 0
                                                                ? '0 0 10px rgba(125, 135, 210, 0.5)'
                                                                : 'none',
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Save Status Row (when open) */}
                                            {sessionOpen && (
                                                <div style={{
                                                    marginTop: 12,
                                                    paddingTop: 10,
                                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                    fontSize: '0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    {saving.has(sKey) ? (
                                                        <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />
                                                            Saving changes...
                                                        </span>
                                                    ) : savedKeys.has(sKey) ? (
                                                        <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                                                            All Changes Saved
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--secondary-foreground)', opacity: 0.6, fontSize: '0.76rem' }}>
                                                            Tap an exercise to log sets
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded: Readiness + Exercise Cards */}
                                        {sessionOpen && (
                                            <div style={{ background: 'rgba(10, 12, 18, 0.4)', position: 'relative' }}>
                                                {!isCoachView && !isReadinessExempt && <ReadinessCheckin athleteId={athleteId} sessionKey={sKey} programId={program.id} onReadinessSubmit={() => markSessionReady(sKey)} />}

                                                {/* Warmup Drills Display */}
                                                {(session.warmupDrills || log?.warmupDrills) && (
                                                    <div style={{
                                                        margin: '12px 14px',
                                                        padding: '14px 18px',
                                                        background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(168, 85, 247, 0.06) 100%)',
                                                        border: '1px solid rgba(125, 135, 210, 0.3)',
                                                        borderRadius: 16,
                                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                                                    }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(125, 135, 210, 0.2)', border: '1px solid rgba(125, 135, 210, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                                <Sparkles size={14} />
                                                            </div>
                                                            Warm-Up & Prep Drills
                                                        </div>
                                                        <div style={{ fontSize: '0.88rem', color: 'var(--foreground)', whiteSpace: 'pre-wrap', lineHeight: '1.45', paddingLeft: 34 }}>
                                                            {linkify(session.warmupDrills || log?.warmupDrills)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Readiness gate popup */}
                                                {!isCoachView && !isReadinessExempt && readinessPopup === sKey && (
                                                    <div style={{
                                                        position: 'sticky', top: 0, zIndex: 50,
                                                        display: 'flex', justifyContent: 'center', padding: '0 16px',
                                                        animation: 'readiness-shake 0.4s ease-in-out',
                                                    }}>
                                                        <div style={{
                                                            background: 'linear-gradient(135deg, #7d87d2, #a855f7)',
                                                            color: '#fff', padding: '10px 18px', borderRadius: 10,
                                                            fontSize: 13, fontWeight: 700, textAlign: 'center',
                                                            boxShadow: '0 4px 20px rgba(125,135,210,0.5)',
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                        }}>
                                                            <span style={{ fontSize: 18 }}>📋</span>
                                                            Complete your Pre-Session Readiness check-in first!
                                                        </div>
                                                    </div>
                                                )}

                                                {(editState[sKey] || exercises).map((ex: any, exIdx: number) => {
                                                    const isEdit = !!editState[sKey];
                                                    const exerciseData = isEdit ? editState[sKey][exIdx] : ex;
                                                    if (!exerciseData) return null;
                                                    const sets = isEdit ? (exerciseData?.sets || []) : (Array.isArray(ex?.sets) ? ex?.sets : []);
                                                    const exKey = `${sKey}-ex${exIdx}`;
                                                    const exOpen = openExercises.has(exKey);

                                                    const validSets = sets.filter((s: any) => {
                                                        const a = isEdit ? s.actual : { weight: '', reps: '', rpe: '' };
                                                        return a.weight && a.reps && a.rpe;
                                                    });
                                                    const e1rms = validSets.map((s: any) => {
                                                        const a = isEdit ? s.actual : { weight: '', reps: '', rpe: '' };
                                                        return calculateSimpleE1RM(a.weight, a.reps, a.rpe);
                                                    });
                                                    const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                                                    const exStress = { total: 0, central: 0, peripheral: 0 };
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

                                                    const category = exerciseData?.category || ex?.category || getExerciseCategory(exerciseData?.name || ex?.name);
                                                    const catColor = CATEGORY_COLORS[category] || '#94A3B8';

                                                    const exName = (exerciseData?.name || ex?.name || '').toLowerCase();
                                                    const isWarmup = category === 'Warm Up' || category === 'Drills' || exName.includes('warm up') || exName.includes('warmup') || exName.includes('drill');

                                                    const hasExistingLogData = Boolean(
                                                        (log?.exercises && log.exercises.length > 0) ||
                                                        (editState[sKey]?.some((e: any) => e.sets?.some((s: any) => s.actual?.weight || s.actual?.reps)))
                                                    );
                                                    const isLocked = !isCoachView && !isReadinessExempt && !readySessions.has(sKey) && !isWarmup && !hasExistingLogData;

                                                    return (
                                                        <div
                                                            key={exIdx}
                                                            className={shakeKey === exKey ? 'readiness-shake' : ''}
                                                            style={{
                                                                margin: '10px 14px',
                                                                background: exOpen
                                                                    ? 'linear-gradient(180deg, rgba(24, 29, 44, 0.85) 0%, rgba(15, 18, 28, 0.9) 100%)'
                                                                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
                                                                border: exOpen
                                                                    ? '1px solid rgba(125, 135, 210, 0.35)'
                                                                    : '1px solid rgba(255, 255, 255, 0.07)',
                                                                borderRadius: 16,
                                                                overflow: 'hidden',
                                                                opacity: isLocked ? 0.5 : 1,
                                                                boxShadow: exOpen
                                                                    ? '0 8px 24px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                                                                    : '0 2px 8px rgba(0, 0, 0, 0.2)',
                                                                transition: 'all 0.22s var(--ease-out)',
                                                            }}
                                                        >
                                                            <div 
                                                                onClick={() => {
                                                                    if (isLocked) {
                                                                        handleLockedExerciseClick(sKey, exKey);
                                                                        return;
                                                                    }
                                                                    toggle(openExercises, exKey, setOpenExercises);
                                                                    if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '14px 18px',
                                                                    background: exOpen ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    borderBottom: exOpen ? '1px solid rgba(255, 255, 255, 0.07)' : 'none',
                                                                    transition: 'background 0.16s ease'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, paddingRight: 8 }}>
                                                                    <div style={{
                                                                        width: 4,
                                                                        height: 24,
                                                                        borderRadius: 2,
                                                                        background: catColor,
                                                                        boxShadow: `0 0 10px ${catColor}55`,
                                                                        flexShrink: 0,
                                                                        alignSelf: 'center',
                                                                    }} />
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                                                                            <span style={{
                                                                                fontSize: '0.98rem',
                                                                                color: '#ffffff',
                                                                                fontWeight: 600,
                                                                                letterSpacing: '-0.01em',
                                                                                lineHeight: 1.35,
                                                                                wordBreak: 'break-word',
                                                                            }}>
                                                                                {exerciseData?.name || ex?.name}
                                                                            </span>
                                                                            {isLocked && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>🔒</span>}
                                                                        </div>
                                                                        {(() => {
                                                                            const planned = plannedTopSets[sKey]?.[exerciseData?.name || ex?.name];
                                                                            if (!planned || (!planned.weight && !planned.reps)) return null;
                                                                            return (
                                                                                <div style={{
                                                                                    fontSize: '0.72rem',
                                                                                    padding: '3px 10px',
                                                                                    borderRadius: 8,
                                                                                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2))',
                                                                                    border: '1px solid rgba(56, 189, 248, 0.45)',
                                                                                    color: '#38bdf8',
                                                                                    fontWeight: 600,
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 5,
                                                                                    width: 'fit-content',
                                                                                    boxShadow: '0 2px 8px rgba(56, 189, 248, 0.2)'
                                                                                }}>
                                                                                    🎯 Planned: {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                <div style={{
                                                                    width: 30,
                                                                    height: 30,
                                                                    borderRadius: 8,
                                                                    background: exOpen ? 'rgba(125, 135, 210, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                                                    border: exOpen ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
                                                                    color: exOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transform: exOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    transition: 'all 0.2s var(--ease-out)',
                                                                    flexShrink: 0
                                                                }}>
                                                                    <ChevronDown size={16} strokeWidth={2.2} />
                                                                </div>
                                                            </div>

                                                            {exOpen && (
                                                                <div style={{ padding: '14px 16px 18px 16px' }}>
                                                                    {/* Planned top set banner */}
                                                                    {(() => {
                                                                        const planned = plannedTopSets[sKey]?.[exerciseData?.name || ex?.name];
                                                                        if (!planned || (!planned.weight && !planned.reps)) return null;
                                                                        return (
                                                                            <div style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '10px 14px',
                                                                                marginBottom: 12,
                                                                                borderRadius: 12,
                                                                                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
                                                                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                                                                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                                                                                fontSize: '0.84rem',
                                                                            }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 600 }}>
                                                                                    <span>🎯 Planned Top Set:</span>
                                                                                    <span style={{ color: '#ffffff', fontWeight: 700 }}>
                                                                                        {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                                                    </span>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                        setEditState(prev => {
                                                                                            const copy = JSON.parse(JSON.stringify(prev));
                                                                                            if (!copy[sKey]?.[exIdx]?.sets?.[0]) return prev;
                                                                                            copy[sKey][exIdx].sets[0].actual = {
                                                                                                weight: planned.weight ? String(planned.weight) : '',
                                                                                                reps: planned.reps ? String(planned.reps) : '',
                                                                                                rpe: planned.rpe ? String(planned.rpe) : ''
                                                                                            };
                                                                                            return copy;
                                                                                        });
                                                                                        triggerAutoSave(sKey, program.id);
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '5px 12px',
                                                                                        fontSize: '0.74rem',
                                                                                        borderRadius: 8,
                                                                                        border: '1px solid rgba(56, 189, 248, 0.5)',
                                                                                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99, 102, 241, 0.2))',
                                                                                        color: '#38bdf8',
                                                                                        cursor: 'pointer',
                                                                                        fontWeight: 700,
                                                                                        boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)',
                                                                                        transition: 'all 0.18s ease'
                                                                                    }}
                                                                                >
                                                                                    Fill Set 1
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4, padding: '0 2px' }}>
                                                                        <div style={{ fontSize: '0.84rem', color: '#818cf8', fontWeight: 500 }}>
                                                                            <span style={{ color: 'var(--foreground)' }}>Session: </span>
                                                                            {(() => {
                                                                                const prevForHeader = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                                const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                                return prevDateLabel ? `${prevDateLabel} - Prev` : 'New - Prev';
                                                                            })()}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--foreground)', fontWeight: 500 }}>
                                                                            <span>Sets:</span>
                                                                            <div style={{ padding: '2px 8px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontWeight: 600, fontSize: '0.8rem' }}>
                                                                                {sets.length}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Coach's notes banner */}
                                                                    {(ex?.notes || exerciseData?.coachNotes) && (
                                                                        <div style={{
                                                                            padding: '12px 14px',
                                                                            marginBottom: 12,
                                                                            borderRadius: 12,
                                                                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(125, 135, 210, 0.06) 100%)',
                                                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                                                            borderLeft: '4px solid #6366f1',
                                                                            fontSize: '0.85rem',
                                                                            color: 'var(--foreground)',
                                                                            lineHeight: 1.4,
                                                                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                                                        }}>
                                                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', marginBottom: 4 }}>
                                                                                Coach Notes
                                                                            </div>
                                                                            <div>{linkify(ex?.notes || exerciseData?.coachNotes)}</div>
                                                                        </div>
                                                                    )}

                                                                    {/* Athlete notes input */}
                                                                    <div style={{ display: 'flex', padding: '0 0 12px 0', alignItems: 'flex-start' }}>
                                                                        <textarea
                                                                            value={exerciseData?.notes || ''}
                                                                            onChange={e => updateNotes(sKey, exIdx, e.target.value, program.id)}
                                                                            onBlur={() => triggerAutoSave(sKey, program.id)}
                                                                            onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                            placeholder="Add notes / feedback for this exercise..."
                                                                            style={{
                                                                                flex: 1, minHeight: 48, padding: '10px 14px',
                                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                                borderRadius: 12,
                                                                                background: 'rgba(0, 0, 0, 0.35)',
                                                                                fontSize: '0.86rem',
                                                                                color: 'var(--foreground)',
                                                                                resize: 'vertical',
                                                                                outline: 'none',
                                                                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                                                                                transition: 'border-color 0.2s',
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Tab Switcher */}
                                                                    {(() => {
                                                                        const prevForHeader = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                        const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                        const hasPrev = !!prevForHeader;
                                                                        const currentTab = activeTabs[exKey] || 'actual';
                                                                        
                                                                        return (
                                                                            <div style={{
                                                                                display: 'flex',
                                                                                background: 'rgba(0, 0, 0, 0.35)',
                                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                borderRadius: 14,
                                                                                padding: 4,
                                                                                gap: 4,
                                                                                marginBottom: 14,
                                                                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                                                                            }}>
                                                                                <button
                                                                                    onClick={() => { if (hasPrev) setActiveTabs(prev => ({ ...prev, [exKey]: 'previous' })); }}
                                                                                    style={{
                                                                                        flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                        background: currentTab === 'previous' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                        color: currentTab === 'previous' ? '#ffffff' : (hasPrev ? 'var(--secondary-foreground)' : 'rgba(255, 255, 255, 0.25)'),
                                                                                        opacity: hasPrev ? 1 : 0.5, cursor: hasPrev ? 'pointer' : 'not-allowed',
                                                                                        fontWeight: currentTab === 'previous' ? 700 : 500, fontSize: '0.8rem',
                                                                                        boxShadow: currentTab === 'previous' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                        transition: 'all 0.18s ease'
                                                                                    }}
                                                                                >
                                                                                    {prevDateLabel ? `Prev: ${prevDateLabel}` : 'Previous'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setActiveTabs(prev => ({ ...prev, [exKey]: 'prescribed' }))}
                                                                                    style={{
                                                                                        flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                        background: currentTab === 'prescribed' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                        color: currentTab === 'prescribed' ? '#ffffff' : 'var(--secondary-foreground)',
                                                                                        cursor: 'pointer', fontWeight: currentTab === 'prescribed' ? 700 : 500, fontSize: '0.8rem',
                                                                                        boxShadow: currentTab === 'prescribed' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                        transition: 'all 0.18s ease'
                                                                                    }}
                                                                                >
                                                                                    Prescribed
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setActiveTabs(prev => ({ ...prev, [exKey]: 'actual' }))}
                                                                                    style={{
                                                                                        flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                        background: currentTab === 'actual' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                        color: currentTab === 'actual' ? '#ffffff' : 'var(--secondary-foreground)',
                                                                                        cursor: 'pointer', fontWeight: currentTab === 'actual' ? 700 : 500, fontSize: '0.8rem',
                                                                                        boxShadow: currentTab === 'actual' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                        transition: 'all 0.18s ease'
                                                                                    }}
                                                                                >
                                                                                    Actual
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* Column Headers */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                                                        <span style={{ width: '20px', textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                                                                            #
                                                                        </span>
                                                                        <span style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                            Weight
                                                                            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 2, cursor: 'pointer' }}>
                                                                                <div 
                                                                                    onClick={() => {
                                                                                        if (!editState[sKey]) {
                                                                                            initEdit(sKey, exercises, log);
                                                                                            setTimeout(() => updateExerciseUnit(sKey, exIdx, 'lbs', program.id), 50);
                                                                                        } else updateExerciseUnit(sKey, exIdx, 'lbs', program.id);
                                                                                    }}
                                                                                    style={{ padding: '2px 7px', fontSize: '0.65rem', borderRadius: 8, background: (exerciseData?.unit || unit) === 'lbs' ? 'var(--primary)' : 'transparent', color: (exerciseData?.unit || unit) === 'lbs' ? '#000' : 'var(--secondary-foreground)', fontWeight: (exerciseData?.unit || unit) === 'lbs' ? 700 : 500, transition: 'all 0.18s' }}
                                                                                >
                                                                                    lbs
                                                                                </div>
                                                                                <div 
                                                                                    onClick={() => {
                                                                                        if (!editState[sKey]) {
                                                                                            initEdit(sKey, exercises, log);
                                                                                            setTimeout(() => updateExerciseUnit(sKey, exIdx, 'kg', program.id), 50);
                                                                                        } else updateExerciseUnit(sKey, exIdx, 'kg', program.id);
                                                                                    }}
                                                                                    style={{ padding: '2px 7px', fontSize: '0.65rem', borderRadius: 8, background: (exerciseData?.unit || unit) === 'kg' ? 'var(--primary)' : 'transparent', color: (exerciseData?.unit || unit) === 'kg' ? '#000' : 'var(--secondary-foreground)', fontWeight: (exerciseData?.unit || unit) === 'kg' ? 700 : 500, transition: 'all 0.18s' }}
                                                                                >
                                                                                    kg
                                                                                </div>
                                                                            </div>
                                                                        </span>
                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                        <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                        <div style={{ width: '36px' }} />
                                                                    </div>

                                                                    {/* Set Rows */}
                                                                    {sets.map((set: any, setIdx: number) => {
                                                                        const target = isEdit ? set.target : set;
                                                                        const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                        const prev = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                        const prevSet = prev?.sets?.[setIdx];
                                                                        const currentTab = activeTabs[exKey] || 'actual';
                                                                        const curUnit = exerciseData?.unit || unit;
                                                                        const planned = setIdx === 0 ? (plannedTopSets[sKey]?.[exerciseData?.name || ex?.name] || plannedTopSets[legacyKey]?.[exerciseData?.name || ex?.name]) : null;
                                                                        const isPlannedTopSet = !!(planned && (planned.weight || planned.reps || planned.rpe));

                                                                        return (
                                                                            <div key={setIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                                                {currentTab === 'previous' ? (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <span style={{ width: '20px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', flexShrink: 0 }}>
                                                                                            {setIdx + 1}
                                                                                        </span>
                                                                                        <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
                                                                                            {(['weight', 'reps', 'rpe'] as const).map(f => (
                                                                                                <div key={f} style={{ flex: 1, padding: '8px 10px', border: '1px solid rgba(125,135,210,0.3)', borderRadius: '10px', background: 'rgba(125,135,210,0.08)', textAlign: 'center', color: '#c4b5fd', fontWeight: 600, fontSize: '0.95rem' }}>
                                                                                                    {prevSet ? (prevSet[f] || '-') : '-'}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                        <div style={{ width: '36px' }} />
                                                                                    </div>
                                                                                ) : currentTab === 'prescribed' ? (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <span style={{ width: '20px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', flexShrink: 0 }}>
                                                                                            {setIdx + 1}
                                                                                        </span>
                                                                                        <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
                                                                                            {(['weight', 'reps', 'rpe'] as const).map(f => (
                                                                                                <div key={f} style={{ flex: 1, padding: '8px 10px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', textAlign: 'center', color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                                                                                                    {target[f] || '-'}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                        <div style={{ width: '36px' }} />
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        {/* Stacked Prescribed Target Header */}
                                                                                        <div style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            padding: '0 44px 0 28px',
                                                                                            gap: '8px',
                                                                                        }}>
                                                                                            <div style={{
                                                                                                flex: 1,
                                                                                                textAlign: 'center',
                                                                                                fontSize: '0.72rem',
                                                                                                fontWeight: isPlannedTopSet && planned?.weight ? 700 : 600,
                                                                                                color: isPlannedTopSet && planned?.weight ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                letterSpacing: '0.01em',
                                                                                                whiteSpace: 'nowrap',
                                                                                                overflow: 'hidden',
                                                                                                textOverflow: 'ellipsis',
                                                                                            }}>
                                                                                                {isPlannedTopSet && planned?.weight
                                                                                                    ? `🎯 ${planned.weight} ${planned.unit || curUnit} (Planned)`
                                                                                                    : (target.weight ? `Rx: ${target.weight} ${curUnit}` : 'Rx: —')}
                                                                                            </div>
                                                                                            <div style={{
                                                                                                flex: 1,
                                                                                                textAlign: 'center',
                                                                                                fontSize: '0.72rem',
                                                                                                fontWeight: isPlannedTopSet && planned?.reps ? 700 : 600,
                                                                                                color: isPlannedTopSet && planned?.reps ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                letterSpacing: '0.01em',
                                                                                            }}>
                                                                                                {isPlannedTopSet && planned?.reps
                                                                                                    ? `🎯 ${planned.reps} reps`
                                                                                                    : (target.reps ? `Rx: ${target.reps}` : 'Rx: —')}
                                                                                            </div>
                                                                                            <div style={{
                                                                                                flex: 1,
                                                                                                textAlign: 'center',
                                                                                                fontSize: '0.72rem',
                                                                                                fontWeight: isPlannedTopSet && planned?.rpe ? 700 : 600,
                                                                                                color: isPlannedTopSet && planned?.rpe ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                letterSpacing: '0.01em',
                                                                                            }}>
                                                                                                {isPlannedTopSet && planned?.rpe
                                                                                                    ? `🎯 @ ${planned.rpe}`
                                                                                                    : (target.rpe ? `Rx: @ ${target.rpe}` : 'Rx: —')}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Inputs Row */}
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                                                            <span style={{
                                                                                                width: '20px',
                                                                                                fontSize: '0.75rem',
                                                                                                fontWeight: 700,
                                                                                                color: 'rgba(255, 255, 255, 0.4)',
                                                                                                textAlign: 'center',
                                                                                                flexShrink: 0,
                                                                                            }}>
                                                                                                {setIdx + 1}
                                                                                            </span>

                                                                                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                                                <input
                                                                                                    type="number"
                                                                                                    inputMode="decimal"
                                                                                                    step="any"
                                                                                                    value={actual.weight}
                                                                                                    onChange={e => updateSet(sKey, exIdx, setIdx, 'weight', e.target.value, program.id)}
                                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                    placeholder={isPlannedTopSet && planned?.weight ? String(planned.weight) : (target.weight ? String(target.weight) : '—')}
                                                                                                    style={{
                                                                                                        flex: 1,
                                                                                                        width: '100%',
                                                                                                        minWidth: 0,
                                                                                                        padding: '9px 6px',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                        borderRadius: '10px',
                                                                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                                                                        textAlign: 'center',
                                                                                                        fontSize: '0.98rem',
                                                                                                        fontWeight: 600,
                                                                                                        color: '#ffffff',
                                                                                                        outline: 'none',
                                                                                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                        fontVariantNumeric: 'tabular-nums',
                                                                                                        transition: 'border-color 0.2s',
                                                                                                    }}
                                                                                                />
                                                                                                <input
                                                                                                    type="number"
                                                                                                    inputMode="decimal"
                                                                                                    step="any"
                                                                                                    value={actual.reps}
                                                                                                    onChange={e => updateSet(sKey, exIdx, setIdx, 'reps', e.target.value, program.id)}
                                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                    placeholder={isPlannedTopSet && planned?.reps ? String(planned.reps) : (target.reps ? String(target.reps) : '—')}
                                                                                                    style={{
                                                                                                        flex: 1,
                                                                                                        width: '100%',
                                                                                                        minWidth: 0,
                                                                                                        padding: '9px 6px',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                        borderRadius: '10px',
                                                                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                                                                        textAlign: 'center',
                                                                                                        fontSize: '0.98rem',
                                                                                                        fontWeight: 600,
                                                                                                        color: '#ffffff',
                                                                                                        outline: 'none',
                                                                                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                        fontVariantNumeric: 'tabular-nums',
                                                                                                        transition: 'border-color 0.2s',
                                                                                                    }}
                                                                                                />
                                                                                                <input
                                                                                                    type="number"
                                                                                                    inputMode="decimal"
                                                                                                    step="0.5"
                                                                                                    value={actual.rpe}
                                                                                                    onChange={e => updateSet(sKey, exIdx, setIdx, 'rpe', e.target.value, program.id)}
                                                                                                    onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                    placeholder={isPlannedTopSet && planned?.rpe ? String(planned.rpe) : (target.rpe ? String(target.rpe) : '—')}
                                                                                                    style={{
                                                                                                        flex: 1,
                                                                                                        width: '100%',
                                                                                                        minWidth: 0,
                                                                                                        padding: '9px 6px',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                        borderRadius: '10px',
                                                                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                                                                        textAlign: 'center',
                                                                                                        fontSize: '0.98rem',
                                                                                                        fontWeight: 600,
                                                                                                        color: '#ffffff',
                                                                                                        outline: 'none',
                                                                                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                        fontVariantNumeric: 'tabular-nums',
                                                                                                        transition: 'border-color 0.2s',
                                                                                                    }}
                                                                                                />
                                                                                            </div>

                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '36px', flexShrink: 0 }}>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    title="Copy prescribed target to actual"
                                                                                                    onClick={() => {
                                                                                                        if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                                        copyTargetToActual(sKey, exIdx, setIdx, program.id);
                                                                                                    }}
                                                                                                    style={{
                                                                                                        padding: '3px 0',
                                                                                                        fontSize: '0.68rem',
                                                                                                        fontWeight: 700,
                                                                                                        borderRadius: '6px',
                                                                                                        border: '1px solid rgba(125,135,210,0.4)',
                                                                                                        background: 'linear-gradient(135deg, rgba(125,135,210,0.25), rgba(168,85,247,0.18))',
                                                                                                        color: '#c4b5fd',
                                                                                                        cursor: 'pointer',
                                                                                                        textAlign: 'center',
                                                                                                        lineHeight: 1.2,
                                                                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                                                                                    }}
                                                                                                >
                                                                                                    Rx
                                                                                                </button>
                                                                                                {setIdx > 0 && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title="Copy previous set"
                                                                                                        onClick={() => {
                                                                                                            if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                                            copyPrevSet(sKey, exIdx, setIdx, program.id);
                                                                                                        }}
                                                                                                        style={{
                                                                                                            padding: '3px 0',
                                                                                                            fontSize: '0.68rem',
                                                                                                            fontWeight: 600,
                                                                                                            borderRadius: '6px',
                                                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                                                            background: 'rgba(255,255,255,0.05)',
                                                                                                            color: 'var(--secondary-foreground)',
                                                                                                            cursor: 'pointer',
                                                                                                            textAlign: 'center',
                                                                                                            lineHeight: 1.2
                                                                                                        }}
                                                                                                    >
                                                                                                        Prev
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    {/* Actions & Stats Sub-Cards */}
                                                                    {(() => {
                                                                        const effectiveSets = (editState[sKey]?.[exIdx]?.sets || []).length > 0
                                                                            ? (editState[sKey]?.[exIdx]?.sets || [])
                                                                            : (log?.exercises?.find((l: any) => l.exerciseId === ex?.id || l.name === ex?.name)?.sets || []).map((s: any) => ({
                                                                                actual: { weight: s.weight ? String(s.weight) : '', reps: s.reps || '', rpe: s.rpe || '' }
                                                                            }));
                                                                        const prDate = log?.date ? String(log.date).split('T')[0] : (sessionMetaRef.current[sKey]?.scheduledDate || selectedDate);

                                                                        return (
                                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', padding: '16px 0 6px 0', marginTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                                                {/* Actions Panel */}
                                                                                <div style={{
                                                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                    borderRadius: 16,
                                                                                    padding: '14px',
                                                                                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                                                                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                                                                                }}>
                                                                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', letterSpacing: '-0.01em' }}>Exercise Actions</div>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                        <ExerciseFeedback
                                                                                            athleteId={athleteId}
                                                                                            coachId={coachId || ''}
                                                                                            exerciseName={exerciseData?.name || ex?.name}
                                                                                            weekNum={weekDisplayNum}
                                                                                            dayNum={sessionNum}
                                                                                            blockName={program.name}
                                                                                            sessionId={sKey}
                                                                                            unit={exerciseData?.unit || unit}
                                                                                            sets={effectiveSets.map((s: any, i: number) => ({ setNumber: i + 1, actual: s.actual || { weight: '', reps: '', rpe: '' } }))}
                                                                                        />
                                                                                        {!isCoachView && (
                                                                                            <PRToggle
                                                                                                athleteId={athleteId}
                                                                                                exerciseName={exerciseData?.name || ex?.name}
                                                                                                sets={effectiveSets.map((s: any) => (s.actual || { weight: '', reps: '', rpe: '' }))}
                                                                                                unit={exerciseData?.unit || unit}
                                                                                                sessionId={sKey}
                                                                                                programName={program.name}
                                                                                                weekNum={weekDisplayNum}
                                                                                                dayNum={sessionNum}
                                                                                                date={prDate}
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Stats Panel */}
                                                                                <div style={{
                                                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                    borderRadius: 16,
                                                                                    padding: '14px',
                                                                                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                                                                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                                                                                }}>
                                                                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', letterSpacing: '-0.01em' }}>Performance Stats</div>
                                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                                                                        <div style={{
                                                                                            background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.16) 0%, rgba(168, 85, 247, 0.1) 100%)',
                                                                                            border: '1px solid rgba(125, 135, 210, 0.35)',
                                                                                            padding: '9px 12px',
                                                                                            borderRadius: 12,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            gap: 2,
                                                                                        }}>
                                                                                            <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Estimated 1RM</span>
                                                                                            <span style={{ fontSize: '0.96rem', color: '#c4b5fd', fontWeight: 800 }}>{toDisplay(maxE1RM)} {exerciseData?.unit || unit}</span>
                                                                                        </div>
                                                                                        <div style={{
                                                                                            background: 'rgba(255, 255, 255, 0.035)',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                            padding: '9px 12px',
                                                                                            borderRadius: 12,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            gap: 2,
                                                                                        }}>
                                                                                            <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Total SI</span>
                                                                                            <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.total.toFixed(2)}</span>
                                                                                        </div>
                                                                                        <div style={{
                                                                                            background: 'rgba(255, 255, 255, 0.035)',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                            padding: '9px 12px',
                                                                                            borderRadius: 12,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            gap: 2,
                                                                                        }}>
                                                                                            <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Peripheral SI</span>
                                                                                            <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.peripheral.toFixed(2)}</span>
                                                                                        </div>
                                                                                        <div style={{
                                                                                            background: 'rgba(255, 255, 255, 0.035)',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                            padding: '9px 12px',
                                                                                            borderRadius: 12,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            gap: 2,
                                                                                        }}>
                                                                                            <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Central SI</span>
                                                                                            <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.central.toFixed(2)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}


                                                {/* Plan Next Week's Top Sets — shown at the bottom of the open session */}
                                                {!isCoachView && sessionOpen && exercises.length > 0 && (
                                                    <div style={{ padding: '8px 12px' }}>
                                                        <PlannedTopSetInput
                                                            athleteId={athleteId}
                                                            sessionId={sKey}
                                                            programId={program.id}
                                                            weekNum={weekNum}
                                                            dayNum={session.day || 1}
                                                            exercises={exercises.map((e: any) => ({ name: e.name }))}
                                                            unit={unit}
                                                            targetNextWeek={true}
                                                            totalWeeks={program.weeks?.length || 0}
                                                            onSaved={() => fetchPlannedTopSetsForSession(sKey)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ BLOCKS VIEW (All Programs) ═══ */}
            {viewMode === 'blocks' && (
                <>
            {/* Toolbar: Search + Sort */}
            <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(20, 24, 36, 0.7)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: 14, padding: '0 14px', height: 44,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                }}>
                    <Search size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search blocks..."
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: '#ffffff', fontSize: '0.88rem',
                            outline: 'none', padding: '8px 0',
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                        display: 'flex',
                        background: 'rgba(16, 20, 30, 0.75)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        borderRadius: 12,
                        padding: 3,
                        border: '1px solid rgba(255, 255, 255, 0.09)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        gap: 2
                    }}>
                        {(['latest', 'oldest'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortOrder(s)}
                                style={{
                                    padding: '6px 14px',
                                    border: sortOrder === s ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: sortOrder === s ? 700 : 500,
                                    borderRadius: 9,
                                    transition: 'all 0.18s ease',
                                    background: sortOrder === s ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                    color: sortOrder === s ? '#ffffff' : 'var(--secondary-foreground)',
                                    boxShadow: sortOrder === s ? '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)' : 'none',
                                }}
                            >
                                {s === 'latest' ? 'Latest' : 'Oldest'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {filteredPrograms.length === 0 && searchQuery && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                    No blocks match &quot;{searchQuery}&quot;
                </div>
            )}
                </>
            )}

            {viewMode === 'blocks' && (
                <div style={{ padding: '0 16px' }}>
                    {filteredPrograms.map(program => {
                        const blockOpen = openBlocks.has(program.id);
                        const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
                        const totalWeeks = weeks.length;
                        const totalSessions = weeks.reduce((s: number, w: any) => s + (Array.isArray(w.sessions) ? w.sessions.filter((sess: any) => Array.isArray(sess?.exercises) && sess.exercises.length > 0).length : 0), 0);

                        // Calculate Block Progress
                        let bTotalSets = 0;
                        let bFilledSets = 0;
                        weeks.forEach((w: any) => {
                            const wSessions: any[] = (Array.isArray(w.sessions) ? w.sessions : []).filter((s: any) => Array.isArray(s?.exercises) && s.exercises.length > 0);
                            wSessions.forEach((s: any) => {
                                const sKey = sessionKey(program.id, w.weekNumber || 1, s.day || 1);
                                const exData: any[] = Array.isArray(s.exercises) ? s.exercises : [];
                                const log = findSessionLog(s.id, sKey, program.id);
                                const esData = editState[sKey];

                                exData.forEach((ex: any) => {
                                    bTotalSets += Array.isArray(ex?.sets) ? ex?.sets.length : 0;
                                });

                                if (esData) {
                                    esData.forEach((ex: any) => {
                                        (ex?.sets || []).forEach((set: any) => {
                                            const a = set.actual || {};
                                            if (a.weight || a.reps) bFilledSets++;
                                        });
                                    });
                                } else if (log) {
                                    (log.exercises || []).forEach((logEx: any) => {
                                        (logEx.sets || []).forEach((set: any) => {
                                            if (set.weight || set.reps) bFilledSets++;
                                        });
                                    });
                                }
                            });
                        });
                        const blockProgressPct = bTotalSets > 0 ? Math.min(100, Math.round((bFilledSets / bTotalSets) * 100)) : 0;

                        return (
                            <div key={program.id} style={{
                                marginBottom: 16,
                                borderRadius: 20,
                                overflow: 'hidden',
                                border: blockOpen ? '1px solid rgba(125, 135, 210, 0.45)' : '1px solid rgba(255, 255, 255, 0.09)',
                                boxShadow: blockOpen ? '0 12px 36px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                background: blockOpen ? 'linear-gradient(180deg, rgba(24, 29, 44, 0.9) 0%, rgba(15, 18, 28, 0.95) 100%)' : 'linear-gradient(180deg, rgba(22, 27, 40, 0.75) 0%, rgba(14, 18, 28, 0.8) 100%)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                transition: 'all 0.25s var(--ease-out)'
                            }}>
                                {/* ═══ Block Header ═══ */}
                                <button
                                    onClick={() => toggle(openBlocks, program.id, setOpenBlocks)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '18px 20px', background: 'transparent',
                                        border: 'none',
                                        borderBottom: blockOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                                        color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box'
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '1.22rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>{program.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: 4 }}>
                                            {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingRight: 24 }}>
                                            <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'rgba(255, 255, 255, 0.07)', overflow: 'hidden' }}>
                                                <div style={{
                                                     height: '100%', borderRadius: 9999, transition: 'width 300ms',
                                                     width: `${blockProgressPct}%`,
                                                     background: blockProgressPct === 100 ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(90deg, #7d87d2 0%, #a855f7 100%)',
                                                     boxShadow: blockProgressPct > 0 ? (blockProgressPct === 100 ? '0 0 10px rgba(16, 185, 129, 0.6)' : '0 0 10px rgba(125, 135, 210, 0.5)') : 'none'
                                                 }} />
                                            </div>
                                            <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, width: 32, fontVariantNumeric: 'tabular-nums' }}>
                                                {blockProgressPct}%
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: '50%',
                                        background: blockOpen ? 'rgba(125, 135, 210, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        border: blockOpen ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: blockOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                        transform: blockOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'all 0.2s var(--ease-out)',
                                        flexShrink: 0,
                                        marginLeft: 12
                                    }}>
                                        <ChevronDown size={18} strokeWidth={2.5} />
                                    </div>
                                </button>

                        {/* ═══ Weeks ═══ */}
                        {blockOpen && (() => {
                            // Sort weeks with sessions for sequential display numbering (skip empty weeks)
                            const sortedWeeksForDisplay = [...weeks].filter((w: any) => Array.isArray(w?.sessions) && w.sessions.some((s: any) => Array.isArray(s?.exercises) && s.exercises.length > 0)).sort((a: any, b: any) => (a?.weekNumber || 1) - (b?.weekNumber || 1));
                            return weeks.map((week: any) => {
                            if (!week) return null;
                            const sessions: any[] = (Array.isArray(week.sessions) ? week.sessions : []).filter((s: any) => Array.isArray(s?.exercises) && s.exercises.length > 0);
                            if (sessions.length === 0) return null;
                            const weekNum = week.weekNumber || 1;
                            const weekDisplayNum = sortedWeeksForDisplay.findIndex((w: any) => (w?.weekNumber || 1) === weekNum) + 1;

                            // Skip weeks that fall outside the program's date range
                            if (program.startDate) {
                                const ps = parseLocalDate(program.startDate);
                                const wStart = new Date(ps);
                                wStart.setDate(wStart.getDate() + (weekNum - 1) * 7);
                                if (program.endDate) {
                                    const pe = parseLocalDate(program.endDate);
                                    pe.setHours(23, 59, 59, 999);
                                    if (wStart > pe) return null;
                                }
                            }
                            const weekKey = `${program.id}-w${weekNum}`;
                            const weekOpen = openWeeks.has(weekKey);

                            return (
                                <div key={weekKey} style={{
                                    background: 'rgba(12, 15, 24, 0.5)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                    padding: '10px 14px',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        background: weekOpen ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                                        border: weekOpen ? '1px solid rgba(125, 135, 210, 0.3)' : '1px solid rgba(255, 255, 255, 0.07)',
                                        borderRadius: 14,
                                        padding: '4px 6px',
                                        transition: 'all 0.2s ease',
                                        marginBottom: weekOpen ? 12 : 0,
                                    }}>
                                        <button
                                            onClick={() => toggle(openWeeks, weekKey, setOpenWeeks)}
                                            style={{
                                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 12px', background: 'transparent',
                                                border: 'none',
                                                color: '#ffffff', cursor: 'pointer', fontSize: '0.96rem', fontWeight: 600,
                                                minWidth: 0
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Week {weekNum} — {weekDateRangeFromDate(program.startDate, weekNum)}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 9999,
                                                    background: 'rgba(125, 135, 210, 0.15)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid rgba(125, 135, 210, 0.3)',
                                                    flexShrink: 0
                                                }}>
                                                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div style={{
                                                color: 'var(--secondary-foreground)',
                                                transform: weekOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 200ms',
                                                marginRight: 8,
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                                <ChevronDown size={16} />
                                            </div>
                                        </button>
                                        {/* Week Overview Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openWeekDrawer(program, week);
                                            }}
                                            title="View week overview"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.18) 100%)',
                                                color: '#38bdf8',
                                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: '6px',
                                                flexShrink: 0,
                                                boxShadow: '0 2px 8px rgba(56, 189, 248, 0.2)',
                                                transition: 'all 0.18s ease'
                                            }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="18 15 12 9 6 15" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* ═══ Sessions (Days) ═══ */}
                                    {weekOpen && [...sessions].sort((a: any, b: any) => (a?.day || 1) - (b?.day || 1)).map((session: any, sessionIndex: number) => {
                                        if (!session) return null;
                                        const day = session.day || 1;
                                        const sessionNum = sessionIndex + 1; // 1-based sequential session number
                                        const legacyKey = sessionKey(program.id, weekNum, day);
                                        const sKey = session.id || legacyKey;
                                        const sessionOpen = openSessions.has(sKey);
                                        const exercises: any[] = Array.isArray(session.exercises) ? session.exercises : [];
                                        const log = findSessionLog(session.id, legacyKey, program.id);
                                        const progress = sessionProgress(exercises, log, editState[sKey]);

                                        // Register session metadata for celebration detection and saving
                                        const sessDateStr = resolveSessionDate(program.startDate, weekNum, day, session.scheduledDate);
                                        sessionMetaRef.current[sKey] = { exercises, sessionName: session.name || `Session ${day}`, scheduledDate: sessDateStr, legacyKey };

                                        return (
                                                <div key={sKey} id={`session-${sKey}`} className="glass-panel" style={{
                                                    background: sessionOpen
                                                        ? 'linear-gradient(180deg, rgba(22, 27, 40, 0.9) 0%, rgba(14, 17, 26, 0.95) 100%)'
                                                        : 'linear-gradient(180deg, rgba(22, 27, 38, 0.75) 0%, rgba(13, 16, 24, 0.8) 100%)',
                                                    backdropFilter: 'blur(16px)',
                                                    WebkitBackdropFilter: 'blur(16px)',
                                                    border: sessionOpen
                                                        ? '1px solid rgba(125, 135, 210, 0.45)'
                                                        : '1px solid rgba(255, 255, 255, 0.09)',
                                                    borderRadius: 20,
                                                    overflow: 'hidden',
                                                    marginBottom: sessionOpen ? 16 : 10,
                                                    transition: 'all 0.25s var(--ease-out)',
                                                    boxShadow: sessionOpen
                                                        ? '0 12px 36px -4px rgba(0, 0, 0, 0.5), 0 0 24px rgba(125, 135, 210, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                                        : '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                                }}>
                                                    {/* Session header */}
                                                    <div
                                                        onClick={() => {
                                                            toggle(openSessions, sKey, setOpenSessions);
                                                            if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            padding: '16px 18px',
                                                            cursor: 'pointer',
                                                            userSelect: 'none',
                                                            borderBottom: sessionOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                                                            transition: 'background 0.2s ease',
                                                        }}
                                                    >
                                                        {/* Top Row: Left Icon, Center Title & Subtitle, Right Controls */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                                                                {/* Session Icon Squircle */}
                                                                <div style={{
                                                                    width: 44,
                                                                    height: 44,
                                                                    borderRadius: 14,
                                                                    background: progress === 100
                                                                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)'
                                                                        : sessionOpen
                                                                            ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.25) 0%, rgba(168, 85, 247, 0.18) 100%)'
                                                                            : 'linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%)',
                                                                    border: progress === 100
                                                                        ? '1px solid rgba(16, 185, 129, 0.45)'
                                                                        : sessionOpen
                                                                            ? '1px solid rgba(125, 135, 210, 0.45)'
                                                                            : '1px solid rgba(255, 255, 255, 0.1)',
                                                                    boxShadow: progress === 100
                                                                        ? '0 0 16px rgba(16, 185, 129, 0.25)'
                                                                        : sessionOpen
                                                                            ? '0 0 16px rgba(125, 135, 210, 0.2)'
                                                                            : 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexShrink: 0,
                                                                    color: progress === 100 ? '#34d399' : sessionOpen ? 'var(--primary)' : 'var(--foreground)',
                                                                    transition: 'all 0.2s var(--ease-out)',
                                                                }}>
                                                                    {progress === 100 ? (
                                                                        <Check size={20} strokeWidth={2.5} />
                                                                    ) : (
                                                                        <Dumbbell size={20} strokeWidth={2} />
                                                                    )}
                                                                </div>

                                                                {/* Title & Metadata Block */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                        <span style={{
                                                                            fontSize: '1.2rem',
                                                                            fontWeight: 700,
                                                                            letterSpacing: '-0.01em',
                                                                            color: '#ffffff',
                                                                            lineHeight: 1.25,
                                                                        }}>
                                                                            {session.name || `Session ${day}`}
                                                                        </span>

                                                                        {/* Status Tag */}
                                                                        {progress === 100 ? (
                                                                            <span style={{
                                                                                fontSize: '0.68rem',
                                                                                fontWeight: 700,
                                                                                padding: '2px 8px',
                                                                                borderRadius: 9999,
                                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                                color: '#34d399',
                                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: 4,
                                                                            }}>
                                                                                ✓ Done
                                                                            </span>
                                                                        ) : progress > 0 ? (
                                                                            <span style={{
                                                                                fontSize: '0.68rem',
                                                                                fontWeight: 700,
                                                                                padding: '2px 8px',
                                                                                borderRadius: 9999,
                                                                                background: 'rgba(125, 135, 210, 0.15)',
                                                                                color: 'var(--primary)',
                                                                                border: '1px solid rgba(125, 135, 210, 0.3)',
                                                                            }}>
                                                                                In Progress
                                                                            </span>
                                                                        ) : null}

                                                                        {/* Planned Top Set Indicator Badge */}
                                                                        {(() => {
                                                                            const sessionPlanned = plannedTopSets[sKey] || plannedTopSets[legacyKey] || {};
                                                                            const plannedExNames = Object.keys(sessionPlanned).filter(k => sessionPlanned[k]?.weight || sessionPlanned[k]?.reps);
                                                                            if (plannedExNames.length === 0) return null;
                                                                            return (
                                                                                <span style={{
                                                                                    fontSize: '0.68rem',
                                                                                    fontWeight: 700,
                                                                                    padding: '2px 9px',
                                                                                    borderRadius: 9999,
                                                                                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(99, 102, 241, 0.18) 100%)',
                                                                                    color: '#38bdf8',
                                                                                    border: '1px solid rgba(56, 189, 248, 0.5)',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 4,
                                                                                    boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
                                                                                }}>
                                                                                    🎯 {plannedExNames.length === 1
                                                                                        ? `Planned: ${plannedExNames[0]} ${sessionPlanned[plannedExNames[0]].weight ? sessionPlanned[plannedExNames[0]].weight + (sessionPlanned[plannedExNames[0]].unit || unit) : ''}`
                                                                                        : `${plannedExNames.length} Planned Top Sets`}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {/* Metadata Row */}
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        fontSize: '0.8rem',
                                                                        color: 'var(--secondary-foreground)',
                                                                        flexWrap: 'wrap',
                                                                        lineHeight: 1.35,
                                                                    }}>
                                                                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                                            Day {day}
                                                                        </span>
                                                                        <span style={{ opacity: 0.35 }}>•</span>
                                                                        <span style={{ whiteSpace: 'nowrap' }}>
                                                                            {sessDateStr || weekDateRangeFromDate(program.startDate, weekNum)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Right: Expand/Collapse All (if open) & Rotating Chevron */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                                {sessionOpen && (
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!isCoachView && !isReadinessExempt && !readySessions.has(sKey)) {
                                                                                handleLockedExerciseClick(sKey, `${sKey}-expand-all`);
                                                                                return;
                                                                            }
                                                                            const anyOpen = exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`));
                                                                            toggleSessionExercises(sKey, exercises, !anyOpen);
                                                                        }}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 4,
                                                                            padding: '4px 8px',
                                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                            borderRadius: 8,
                                                                            color: 'var(--secondary-foreground)',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.72rem',
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        <ChevronsUpDown size={13} />
                                                                        <span className="hidden sm:inline">
                                                                            {exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`)) ? 'Collapse' : 'Expand'}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Chevron Circle */}
                                                                <div style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '50%',
                                                                    background: sessionOpen ? 'rgba(125, 135, 210, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: sessionOpen ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: sessionOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                    transition: 'all 0.2s var(--ease-out)',
                                                                    transform: sessionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                }}>
                                                                    <ChevronDown size={17} strokeWidth={2.5} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar & Stats Section */}
                                                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                                                <span style={{ color: 'var(--secondary-foreground)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                                                                    {progress > 0 && progress < 100 && (
                                                                        <>
                                                                            <span style={{ opacity: 0.35 }}>•</span>
                                                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>In progress</span>
                                                                        </>
                                                                    )}
                                                                </span>
                                                                <span style={{
                                                                    fontWeight: 700,
                                                                    color: progress === 100 ? '#34d399' : progress > 0 ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                    fontVariantNumeric: 'tabular-nums',
                                                                }}>
                                                                    {progress}%
                                                                </span>
                                                            </div>

                                                            {/* Modern Progress Track */}
                                                            <div style={{
                                                                width: '100%',
                                                                height: 6,
                                                                borderRadius: 9999,
                                                                background: 'rgba(255, 255, 255, 0.07)',
                                                                overflow: 'hidden',
                                                                position: 'relative',
                                                            }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    borderRadius: 9999,
                                                                    transition: 'width 350ms var(--ease-out)',
                                                                    width: `${progress}%`,
                                                                    background: progress === 100
                                                                        ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                                                                        : 'linear-gradient(90deg, #7d87d2 0%, #a855f7 100%)',
                                                                    boxShadow: progress === 100
                                                                        ? '0 0 12px rgba(16, 185, 129, 0.7)'
                                                                        : progress > 0
                                                                            ? '0 0 10px rgba(125, 135, 210, 0.5)'
                                                                            : 'none',
                                                                }} />
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Save Status Row (when open) */}
                                                        {sessionOpen && (
                                                            <div style={{
                                                                marginTop: 12,
                                                                paddingTop: 10,
                                                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                                fontSize: '0.8rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                {saving.has(sKey) ? (
                                                                    <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />
                                                                        Saving changes...
                                                                    </span>
                                                                ) : savedKeys.has(sKey) ? (
                                                                    <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                                                                        All Changes Saved
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--secondary-foreground)', opacity: 0.6, fontSize: '0.76rem' }}>
                                                                        Tap an exercise to log sets
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                {/* ═══ Expanded Session: Exercise Cards ═══ */}
                                                {
                                                    sessionOpen && (
                                                        <div style={{ padding: '0', background: 'rgba(10, 12, 18, 0.4)' }}>
                                                            {/* Readiness Check-In */}
                                                            {!isCoachView && !isReadinessExempt && <ReadinessCheckin athleteId={athleteId} sessionKey={sKey} programId={program.id} onReadinessSubmit={() => markSessionReady(sKey)} />}

                                                            {/* Warmup Drills Display */}
                                                            {(session.warmupDrills || log?.warmupDrills) && (
                                                                <div style={{
                                                                    margin: '12px 14px',
                                                                    padding: '14px 18px',
                                                                    background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(168, 85, 247, 0.06) 100%)',
                                                                    border: '1px solid rgba(125, 135, 210, 0.3)',
                                                                    borderRadius: 16,
                                                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                                                                }}>
                                                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(125, 135, 210, 0.2)', border: '1px solid rgba(125, 135, 210, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                                            <Sparkles size={14} />
                                                                        </div>
                                                                        Warm-Up & Prep Drills
                                                                    </div>
                                                                    <div style={{ fontSize: '0.88rem', color: 'var(--foreground)', whiteSpace: 'pre-wrap', lineHeight: '1.45', paddingLeft: 34 }}>
                                                                        {linkify(session.warmupDrills || log?.warmupDrills)}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Readiness gate popup */}
                                                            {!isCoachView && !isReadinessExempt && readinessPopup === sKey && (
                                                                <div style={{
                                                                    position: 'sticky', top: 0, zIndex: 50,
                                                                    display: 'flex', justifyContent: 'center', padding: '0 16px',
                                                                    animation: 'readiness-shake 0.4s ease-in-out',
                                                                }}>
                                                                    <div style={{
                                                                        background: 'linear-gradient(135deg, #7d87d2, #a855f7)',
                                                                        color: '#fff', padding: '10px 18px', borderRadius: 10,
                                                                        fontSize: 13, fontWeight: 700, textAlign: 'center',
                                                                        boxShadow: '0 4px 20px rgba(125,135,210,0.5)',
                                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                                    }}>
                                                                        <span style={{ fontSize: 18 }}>📋</span>
                                                                        Complete your Pre-Session Readiness check-in first!
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {(editState[sKey] || exercises).map((ex: any, exIdx: number) => {
                                                                const isEdit = !!editState[sKey];
                                                                const exerciseData = isEdit ? editState[sKey][exIdx] : ex;
                                                                if (!exerciseData) return null;
                                                                const sets = isEdit ? (exerciseData?.sets || []) : (Array.isArray(ex?.sets) ? ex?.sets : []);
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

                                                                const exStress = { total: 0, central: 0, peripheral: 0 };
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

                                                                const category = exerciseData?.category || ex?.category || getExerciseCategory(exerciseData?.name || ex?.name);
                                                                const catColor = CATEGORY_COLORS[category] || '#94A3B8';
                                                                const exName = (exerciseData?.name || ex?.name || '').toLowerCase();
                                                                const isWarmup = category === 'Warm Up' || category === 'Drills' || exName.includes('warm up') || exName.includes('warmup') || exName.includes('drill');
                                                                
                                                                const hasExistingLogData = Boolean(
                                                                    (log?.exercises && log.exercises.length > 0) ||
                                                                    (editState[sKey]?.some((e: any) => e.sets?.some((s: any) => s.actual?.weight || s.actual?.reps)))
                                                                );
                                                                const isLocked = !isCoachView && !isReadinessExempt && !readySessions.has(sKey) && !isWarmup && !hasExistingLogData;

                                                                return (
                                                                    <div
                                                                        key={exIdx}
                                                                        className={shakeKey === exKey ? 'readiness-shake' : ''}
                                                                        style={{
                                                                            margin: '10px 14px',
                                                                            background: exOpen
                                                                                ? 'linear-gradient(180deg, rgba(24, 29, 44, 0.85) 0%, rgba(15, 18, 28, 0.9) 100%)'
                                                                                : 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
                                                                            border: exOpen
                                                                                ? '1px solid rgba(125, 135, 210, 0.35)'
                                                                                : '1px solid rgba(255, 255, 255, 0.07)',
                                                                            borderRadius: 16,
                                                                            overflow: 'hidden',
                                                                            opacity: isLocked ? 0.5 : 1,
                                                                            boxShadow: exOpen
                                                                                ? '0 8px 24px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                                                                                : '0 2px 8px rgba(0, 0, 0, 0.2)',
                                                                            transition: 'all 0.22s var(--ease-out)',
                                                                        }}
                                                                    >
                                                                        {/* Exercise header */}
                                                                        <div 
                                                                            onClick={() => {
                                                                                if (isLocked) {
                                                                                    handleLockedExerciseClick(sKey, exKey);
                                                                                    return;
                                                                                }
                                                                                toggle(openExercises, exKey, setOpenExercises);
                                                                                if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                            }}
                                                                            style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '14px 18px',
                                                                                background: exOpen ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                                                                cursor: 'pointer',
                                                                                userSelect: 'none',
                                                                                borderBottom: exOpen ? '1px solid rgba(255, 255, 255, 0.07)' : 'none',
                                                                                transition: 'background 0.16s ease'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, paddingRight: 8 }}>
                                                                                <div style={{
                                                                                    width: 4,
                                                                                    height: 24,
                                                                                    borderRadius: 2,
                                                                                    background: catColor,
                                                                                    boxShadow: `0 0 10px ${catColor}55`,
                                                                                    flexShrink: 0,
                                                                                    alignSelf: 'center',
                                                                                }} />
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                                                                                        <span style={{
                                                                                            fontSize: '0.98rem',
                                                                                            color: '#ffffff',
                                                                                            fontWeight: 600,
                                                                                            letterSpacing: '-0.01em',
                                                                                            lineHeight: 1.35,
                                                                                            wordBreak: 'break-word',
                                                                                        }}>
                                                                                            {exerciseData?.name || ex?.name}
                                                                                        </span>
                                                                                        {isLocked && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>🔒</span>}
                                                                                    </div>
                                                                                    {(() => {
                                                                                        const planned = plannedTopSets[sKey]?.[exerciseData?.name || ex?.name];
                                                                                        if (!planned || (!planned.weight && !planned.reps)) return null;
                                                                                        return (
                                                                                            <div style={{
                                                                                                fontSize: '0.72rem',
                                                                                                padding: '3px 10px',
                                                                                                borderRadius: 8,
                                                                                                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2))',
                                                                                                border: '1px solid rgba(56, 189, 248, 0.45)',
                                                                                                color: '#38bdf8',
                                                                                                fontWeight: 600,
                                                                                                display: 'inline-flex',
                                                                                                alignItems: 'center',
                                                                                                gap: 5,
                                                                                                width: 'fit-content',
                                                                                                boxShadow: '0 2px 8px rgba(56, 189, 248, 0.2)'
                                                                                            }}>
                                                                                                🎯 Planned: {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{
                                                                                width: 30,
                                                                                height: 30,
                                                                                borderRadius: 8,
                                                                                background: exOpen ? 'rgba(125, 135, 210, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                                                                border: exOpen ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
                                                                                color: exOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                transform: exOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                                transition: 'all 0.2s var(--ease-out)',
                                                                                flexShrink: 0
                                                                            }}>
                                                                                <ChevronDown size={16} strokeWidth={2.2} />
                                                                            </div>
                                                                        </div>

                                                                        {/* Exercise body / Input rows */}
                                                                        {exOpen && (
                                                                            <div style={{ padding: '14px 16px 18px 16px' }}>
                                                                                {/* Planned top set banner */}
                                                                                {(() => {
                                                                                    const planned = plannedTopSets[sKey]?.[exerciseData?.name || ex?.name] || plannedTopSets[legacyKey]?.[exerciseData?.name || ex?.name];
                                                                                    if (!planned || (!planned.weight && !planned.reps)) return null;
                                                                                    return (
                                                                                        <div style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'space-between',
                                                                                            padding: '10px 14px',
                                                                                            marginBottom: 12,
                                                                                            borderRadius: 12,
                                                                                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
                                                                                            border: '1px solid rgba(56, 189, 248, 0.35)',
                                                                                            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                                                                                            fontSize: '0.84rem',
                                                                                        }}>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 600 }}>
                                                                                                <span>🎯 Planned Top Set:</span>
                                                                                                <span style={{ color: '#ffffff', fontWeight: 700 }}>
                                                                                                    {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                                                                </span>
                                                                                            </div>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                                    setEditState(prev => {
                                                                                                        const copy = JSON.parse(JSON.stringify(prev));
                                                                                                        if (!copy[sKey]?.[exIdx]?.sets?.[0]) return prev;
                                                                                                        copy[sKey][exIdx].sets[0].actual = {
                                                                                                            weight: planned.weight ? String(planned.weight) : '',
                                                                                                            reps: planned.reps ? String(planned.reps) : '',
                                                                                                            rpe: planned.rpe ? String(planned.rpe) : ''
                                                                                                        };
                                                                                                        return copy;
                                                                                                    });
                                                                                                    triggerAutoSave(sKey, program.id);
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: '5px 12px',
                                                                                                    fontSize: '0.74rem',
                                                                                                    borderRadius: 8,
                                                                                                    border: '1px solid rgba(56, 189, 248, 0.5)',
                                                                                                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99, 102, 241, 0.2))',
                                                                                                    color: '#38bdf8',
                                                                                                    cursor: 'pointer',
                                                                                                    fontWeight: 700,
                                                                                                    boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)',
                                                                                                    transition: 'all 0.18s ease'
                                                                                                }}
                                                                                            >
                                                                                                Fill Set 1
                                                                                            </button>
                                                                                        </div>
                                                                                    );
                                                                                })()}

                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4, padding: '0 2px' }}>
                                                                                    <div style={{ fontSize: '0.84rem', color: '#818cf8', fontWeight: 500 }}>
                                                                                        <span style={{ color: 'var(--foreground)' }}>Session: </span>
                                                                                        {(() => {
                                                                                            const prevForHeader = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                                            const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                                            return prevDateLabel ? `${prevDateLabel} - Prev` : 'New - Prev';
                                                                                        })()}
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--foreground)', fontWeight: 500 }}>
                                                                                        <span>Sets:</span>
                                                                                        <div style={{ padding: '2px 8px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontWeight: 600, fontSize: '0.8rem' }}>
                                                                                            {sets.length}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Coach's notes banner */}
                                                                                {(ex?.notes || exerciseData?.coachNotes) && (
                                                                                    <div style={{
                                                                                        padding: '12px 14px',
                                                                                        marginBottom: 12,
                                                                                        borderRadius: 12,
                                                                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(125, 135, 210, 0.06) 100%)',
                                                                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                                                                        borderLeft: '4px solid #6366f1',
                                                                                        fontSize: '0.85rem',
                                                                                        color: 'var(--foreground)',
                                                                                        lineHeight: 1.4,
                                                                                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                                                                    }}>
                                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', marginBottom: 4 }}>
                                                                                            Coach Notes
                                                                                        </div>
                                                                                        <div>{linkify(ex?.notes || exerciseData?.coachNotes)}</div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Athlete notes input */}
                                                                                <div style={{ display: 'flex', padding: '0 0 12px 0', alignItems: 'flex-start' }}>
                                                                                    <textarea
                                                                                        value={exerciseData?.notes || ''}
                                                                                        onChange={e => updateNotes(sKey, exIdx, e.target.value, program.id)}
                                                                                        onBlur={() => triggerAutoSave(sKey, program.id)}
                                                                                        onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                        placeholder="Add notes / feedback for this exercise..."
                                                                                        style={{
                                                                                            flex: 1, minHeight: 48, padding: '10px 14px',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                                            borderRadius: 12,
                                                                                            background: 'rgba(0, 0, 0, 0.35)',
                                                                                            fontSize: '0.86rem',
                                                                                            color: 'var(--foreground)',
                                                                                            resize: 'vertical',
                                                                                            outline: 'none',
                                                                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                                                                                            transition: 'border-color 0.2s',
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                {/* TAB BAR */}
                                                                                {(() => {
                                                                                    const prevForHeader = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                                    const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                                    const hasPrev = !!prevForHeader;
                                                                                    const currentTab = activeTabs[exKey] || 'actual';
                                                                                    
                                                                                    return (
                                                                                        <div style={{
                                                                                            display: 'flex',
                                                                                            background: 'rgba(0, 0, 0, 0.35)',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                            borderRadius: 14,
                                                                                            padding: 4,
                                                                                            gap: 4,
                                                                                            marginBottom: 14,
                                                                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                                                                                        }}>
                                                                                            <button
                                                                                                onClick={() => { if (hasPrev) setActiveTabs(prev => ({ ...prev, [exKey]: 'previous' })); }}
                                                                                                style={{
                                                                                                    flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                                    background: currentTab === 'previous' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                                    color: currentTab === 'previous' ? '#ffffff' : (hasPrev ? 'var(--secondary-foreground)' : 'rgba(255, 255, 255, 0.25)'),
                                                                                                    opacity: hasPrev ? 1 : 0.5, cursor: hasPrev ? 'pointer' : 'not-allowed',
                                                                                                    fontWeight: currentTab === 'previous' ? 700 : 500, fontSize: '0.8rem',
                                                                                                    boxShadow: currentTab === 'previous' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                                    transition: 'all 0.18s ease'
                                                                                                }}
                                                                                            >
                                                                                                {prevDateLabel ? `Prev: ${prevDateLabel}` : 'Previous'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => setActiveTabs(prev => ({ ...prev, [exKey]: 'prescribed' }))}
                                                                                                style={{
                                                                                                    flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                                    background: currentTab === 'prescribed' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                                    color: currentTab === 'prescribed' ? '#ffffff' : 'var(--secondary-foreground)',
                                                                                                    cursor: 'pointer', fontWeight: currentTab === 'prescribed' ? 700 : 500, fontSize: '0.8rem',
                                                                                                    boxShadow: currentTab === 'prescribed' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                                    transition: 'all 0.18s ease'
                                                                                                }}
                                                                                            >
                                                                                                Prescribed
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => setActiveTabs(prev => ({ ...prev, [exKey]: 'actual' }))}
                                                                                                style={{
                                                                                                    flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none',
                                                                                                    background: currentTab === 'actual' ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                                                                                                    color: currentTab === 'actual' ? '#ffffff' : 'var(--secondary-foreground)',
                                                                                                    cursor: 'pointer', fontWeight: currentTab === 'actual' ? 700 : 500, fontSize: '0.8rem',
                                                                                                    boxShadow: currentTab === 'actual' ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                                                                                    transition: 'all 0.18s ease'
                                                                                                }}
                                                                                            >
                                                                                                Actual
                                                                                            </button>
                                                                                        </div>
                                                                                    );
                                                                                })()}

                                                                                {/* Column header */}
                                                                                <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0 8px 0', fontSize: '0.72rem', color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                                    <span style={{ width: '20px', textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                                                                                        #
                                                                                    </span>
                                                                                    <span style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                                        Weight
                                                                                        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 2, cursor: 'pointer' }}>
                                                                                            <div 
                                                                                                onClick={() => {
                                                                                                    if (!editState[sKey]) {
                                                                                                        initEdit(sKey, exercises, log);
                                                                                                        setTimeout(() => updateExerciseUnit(sKey, exIdx, 'lbs', program.id), 50);
                                                                                                    } else updateExerciseUnit(sKey, exIdx, 'lbs', program.id);
                                                                                                }}
                                                                                                style={{ padding: '2px 7px', fontSize: '0.65rem', borderRadius: 8, background: (exerciseData?.unit || unit) === 'lbs' ? 'var(--primary)' : 'transparent', color: (exerciseData?.unit || unit) === 'lbs' ? '#000' : 'var(--secondary-foreground)', fontWeight: (exerciseData?.unit || unit) === 'lbs' ? 700 : 500, transition: 'all 0.18s' }}
                                                                                            >
                                                                                                lbs
                                                                                            </div>
                                                                                            <div 
                                                                                                onClick={() => {
                                                                                                    if (!editState[sKey]) {
                                                                                                        initEdit(sKey, exercises, log);
                                                                                                        setTimeout(() => updateExerciseUnit(sKey, exIdx, 'kg', program.id), 50);
                                                                                                    } else updateExerciseUnit(sKey, exIdx, 'kg', program.id);
                                                                                                }}
                                                                                                style={{ padding: '2px 7px', fontSize: '0.65rem', borderRadius: 8, background: (exerciseData?.unit || unit) === 'kg' ? 'var(--primary)' : 'transparent', color: (exerciseData?.unit || unit) === 'kg' ? '#000' : 'var(--secondary-foreground)', fontWeight: (exerciseData?.unit || unit) === 'kg' ? 700 : 500, transition: 'all 0.18s' }}
                                                                                            >
                                                                                                kg
                                                                                            </div>
                                                                                        </div>
                                                                                    </span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                    <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    <div style={{ width: '36px' }} />
                                                                                </div>

                                                                                {/* Set rows */}
                                                                                {sets.map((set: any, setIdx: number) => {
                                                                                    const target = isEdit ? set.target : set;
                                                                                    const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                                    const prev = getPrevSets(exerciseData?.name || ex?.name, sKey);
                                                                                    const prevSet = prev?.sets?.[setIdx];
                                                                                    const currentTab = activeTabs[exKey] || 'actual';
                                                                                    const curUnit = exerciseData?.unit || unit;
                                                                                    const planned = setIdx === 0 ? (plannedTopSets[sKey]?.[exerciseData?.name || ex?.name] || plannedTopSets[legacyKey]?.[exerciseData?.name || ex?.name]) : null;
                                                                                    const isPlannedTopSet = !!(planned && (planned.weight || planned.reps || planned.rpe));

                                                                                    return (
                                                                                        <div key={setIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                                                            {currentTab === 'previous' ? (
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                                    <span style={{ width: '20px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', flexShrink: 0 }}>
                                                                                                        {setIdx + 1}
                                                                                                    </span>
                                                                                                    <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
                                                                                                        {(['weight', 'reps', 'rpe'] as const).map(f => (
                                                                                                            <div key={f} style={{ flex: 1, padding: '8px 10px', border: '1px solid rgba(125,135,210,0.3)', borderRadius: '10px', background: 'rgba(125,135,210,0.08)', textAlign: 'center', color: '#c4b5fd', fontWeight: 600, fontSize: '0.95rem' }}>
                                                                                                                {prevSet ? (prevSet[f] || '-') : '-'}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <div style={{ width: '36px' }} />
                                                                                                </div>
                                                                                            ) : currentTab === 'prescribed' ? (
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                                    <span style={{ width: '20px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', flexShrink: 0 }}>
                                                                                                        {setIdx + 1}
                                                                                                    </span>
                                                                                                    <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
                                                                                                        {(['weight', 'reps', 'rpe'] as const).map(f => (
                                                                                                            <div key={f} style={{ flex: 1, padding: '8px 10px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', textAlign: 'center', color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                                                                                                                {target[f] || '-'}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <div style={{ width: '36px' }} />
                                                                                                </div>
                                                                                            ) : (
                                                                                                <>
                                                                                                    {/* Stacked Prescribed Target Header */}
                                                                                                    <div style={{
                                                                                                        display: 'flex',
                                                                                                        alignItems: 'center',
                                                                                                        padding: '0 44px 0 28px',
                                                                                                        gap: '8px',
                                                                                                    }}>
                                                                                                        <div style={{
                                                                                                            flex: 1,
                                                                                                            textAlign: 'center',
                                                                                                            fontSize: '0.72rem',
                                                                                                            fontWeight: isPlannedTopSet && planned?.weight ? 700 : 600,
                                                                                                            color: isPlannedTopSet && planned?.weight ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                            letterSpacing: '0.01em',
                                                                                                            whiteSpace: 'nowrap',
                                                                                                            overflow: 'hidden',
                                                                                                            textOverflow: 'ellipsis',
                                                                                                        }}>
                                                                                                            {isPlannedTopSet && planned?.weight
                                                                                                                ? `🎯 ${planned.weight} ${planned.unit || curUnit} (Planned)`
                                                                                                                : (target.weight ? `Rx: ${target.weight} ${curUnit}` : 'Rx: —')}
                                                                                                        </div>
                                                                                                        <div style={{
                                                                                                            flex: 1,
                                                                                                            textAlign: 'center',
                                                                                                            fontSize: '0.72rem',
                                                                                                            fontWeight: isPlannedTopSet && planned?.reps ? 700 : 600,
                                                                                                            color: isPlannedTopSet && planned?.reps ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                            letterSpacing: '0.01em',
                                                                                                        }}>
                                                                                                            {isPlannedTopSet && planned?.reps
                                                                                                                ? `🎯 ${planned.reps} reps`
                                                                                                                : (target.reps ? `Rx: ${target.reps}` : 'Rx: —')}
                                                                                                        </div>
                                                                                                        <div style={{
                                                                                                            flex: 1,
                                                                                                            textAlign: 'center',
                                                                                                            fontSize: '0.72rem',
                                                                                                            fontWeight: isPlannedTopSet && planned?.rpe ? 700 : 600,
                                                                                                            color: isPlannedTopSet && planned?.rpe ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                                                                                                            letterSpacing: '0.01em',
                                                                                                        }}>
                                                                                                            {isPlannedTopSet && planned?.rpe
                                                                                                                ? `🎯 @ ${planned.rpe}`
                                                                                                                : (target.rpe ? `Rx: @ ${target.rpe}` : 'Rx: —')}
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    {/* Inputs Row */}
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                                                                        <span style={{
                                                                                                            width: '20px',
                                                                                                            fontSize: '0.75rem',
                                                                                                            fontWeight: 700,
                                                                                                            color: 'rgba(255, 255, 255, 0.4)',
                                                                                                            textAlign: 'center',
                                                                                                            flexShrink: 0,
                                                                                                        }}>
                                                                                                            {setIdx + 1}
                                                                                                        </span>

                                                                                                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                inputMode="decimal"
                                                                                                                step="any"
                                                                                                                value={actual.weight}
                                                                                                                onChange={e => updateSet(sKey, exIdx, setIdx, 'weight', e.target.value, program.id)}
                                                                                                                onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                                placeholder={isPlannedTopSet && planned?.weight ? String(planned.weight) : (target.weight ? String(target.weight) : '—')}
                                                                                                                style={{
                                                                                                                    flex: 1,
                                                                                                                    width: '100%',
                                                                                                                    minWidth: 0,
                                                                                                                    padding: '9px 6px',
                                                                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                                    borderRadius: '10px',
                                                                                                                    background: 'rgba(0, 0, 0, 0.35)',
                                                                                                                    textAlign: 'center',
                                                                                                                    fontSize: '0.98rem',
                                                                                                                    fontWeight: 600,
                                                                                                                    color: '#ffffff',
                                                                                                                    outline: 'none',
                                                                                                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                                    fontVariantNumeric: 'tabular-nums',
                                                                                                                    transition: 'border-color 0.2s',
                                                                                                                }}
                                                                                                            />
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                inputMode="decimal"
                                                                                                                step="any"
                                                                                                                value={actual.reps}
                                                                                                                onChange={e => updateSet(sKey, exIdx, setIdx, 'reps', e.target.value, program.id)}
                                                                                                                onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                                placeholder={isPlannedTopSet && planned?.reps ? String(planned.reps) : (target.reps ? String(target.reps) : '—')}
                                                                                                                style={{
                                                                                                                    flex: 1,
                                                                                                                    width: '100%',
                                                                                                                    minWidth: 0,
                                                                                                                    padding: '9px 6px',
                                                                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                                    borderRadius: '10px',
                                                                                                                    background: 'rgba(0, 0, 0, 0.35)',
                                                                                                                    textAlign: 'center',
                                                                                                                    fontSize: '0.98rem',
                                                                                                                    fontWeight: 600,
                                                                                                                    color: '#ffffff',
                                                                                                                    outline: 'none',
                                                                                                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                                    fontVariantNumeric: 'tabular-nums',
                                                                                                                    transition: 'border-color 0.2s',
                                                                                                                }}
                                                                                                            />
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                inputMode="decimal"
                                                                                                                step="0.5"
                                                                                                                value={actual.rpe}
                                                                                                                onChange={e => updateSet(sKey, exIdx, setIdx, 'rpe', e.target.value, program.id)}
                                                                                                                onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                                placeholder={isPlannedTopSet && planned?.rpe ? String(planned.rpe) : (target.rpe ? String(target.rpe) : '—')}
                                                                                                                style={{
                                                                                                                    flex: 1,
                                                                                                                    width: '100%',
                                                                                                                    minWidth: 0,
                                                                                                                    padding: '9px 6px',
                                                                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                                                    borderRadius: '10px',
                                                                                                                    background: 'rgba(0, 0, 0, 0.35)',
                                                                                                                    textAlign: 'center',
                                                                                                                    fontSize: '0.98rem',
                                                                                                                    fontWeight: 600,
                                                                                                                    color: '#ffffff',
                                                                                                                    outline: 'none',
                                                                                                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                                                                                                    fontVariantNumeric: 'tabular-nums',
                                                                                                                    transition: 'border-color 0.2s',
                                                                                                                }}
                                                                                                            />
                                                                                                        </div>

                                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '36px', flexShrink: 0 }}>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                title="Copy prescribed target to actual"
                                                                                                                onClick={() => {
                                                                                                                    if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                                                    copyTargetToActual(sKey, exIdx, setIdx, program.id);
                                                                                                                }}
                                                                                                                style={{
                                                                                                                    padding: '3px 0',
                                                                                                                    fontSize: '0.68rem',
                                                                                                                    fontWeight: 700,
                                                                                                                    borderRadius: '6px',
                                                                                                                    border: '1px solid rgba(125,135,210,0.4)',
                                                                                                                    background: 'linear-gradient(135deg, rgba(125,135,210,0.25), rgba(168,85,247,0.18))',
                                                                                                                    color: '#c4b5fd',
                                                                                                                    cursor: 'pointer',
                                                                                                                    textAlign: 'center',
                                                                                                                    lineHeight: 1.2,
                                                                                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                                                                                                }}
                                                                                                            >
                                                                                                                Rx
                                                                                                            </button>
                                                                                                            {setIdx > 0 && (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    title="Copy previous set"
                                                                                                                    onClick={() => {
                                                                                                                        if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                                                                        copyPrevSet(sKey, exIdx, setIdx, program.id);
                                                                                                                    }}
                                                                                                                    style={{
                                                                                                                        padding: '3px 0',
                                                                                                                        fontSize: '0.68rem',
                                                                                                                        fontWeight: 600,
                                                                                                                        borderRadius: '6px',
                                                                                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                                                                                        background: 'rgba(255,255,255,0.05)',
                                                                                                                        color: 'var(--secondary-foreground)',
                                                                                                                        cursor: 'pointer',
                                                                                                                        textAlign: 'center',
                                                                                                                        lineHeight: 1.2
                                                                                                                    }}
                                                                                                                >
                                                                                                                    Prev
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}

                                                                                {/* Stats and Actions Sub-Cards */}
                                                                                {(() => {
                                                                                    const effectiveSets = (editState[sKey]?.[exIdx]?.sets || []).length > 0
                                                                                        ? (editState[sKey]?.[exIdx]?.sets || [])
                                                                                        : (log?.exercises?.find((l: any) => l.exerciseId === ex?.id || l.name === ex?.name)?.sets || []).map((s: any) => ({
                                                                                            actual: { weight: s.weight ? String(s.weight) : '', reps: s.reps || '', rpe: s.rpe || '' }
                                                                                        }));
                                                                                    const prDate = log?.date ? String(log.date).split('T')[0] : (sessionMetaRef.current[sKey]?.scheduledDate || new Date().toISOString().split('T')[0]);

                                                                                    return (
                                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', padding: '16px 0 6px 0', marginTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                                                            {/* Actions Panel */}
                                                                                            <div style={{
                                                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                                borderRadius: 16,
                                                                                                padding: '14px',
                                                                                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                                                                                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                                                                                            }}>
                                                                                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', letterSpacing: '-0.01em' }}>Exercise Actions</div>
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                                    <ExerciseFeedback
                                                                                                        athleteId={athleteId}
                                                                                                        coachId={coachId || ''}
                                                                                                        exerciseName={exerciseData?.name || ex?.name}
                                                                                                        weekNum={weekDisplayNum}
                                                                                                        dayNum={sessionNum}
                                                                                                        blockName={program.name}
                                                                                                        sessionId={sKey}
                                                                                                        unit={exerciseData?.unit || unit}
                                                                                                        sets={effectiveSets.map((s: any, i: number) => ({ setNumber: i + 1, actual: s.actual || { weight: '', reps: '', rpe: '' } }))}
                                                                                                    />
                                                                                                    {!isCoachView && (
                                                                                                        <PRToggle
                                                                                                            athleteId={athleteId}
                                                                                                            exerciseName={exerciseData?.name || ex?.name}
                                                                                                            sets={effectiveSets.map((s: any) => (s.actual || { weight: '', reps: '', rpe: '' }))}
                                                                                                            unit={exerciseData?.unit || unit}
                                                                                                            sessionId={sKey}
                                                                                                            programName={program.name}
                                                                                                            weekNum={weekDisplayNum}
                                                                                                            dayNum={sessionNum}
                                                                                                            date={prDate}
                                                                                                        />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Stats Panel */}
                                                                                            <div style={{
                                                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                                borderRadius: 16,
                                                                                                padding: '14px',
                                                                                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                                                                                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                                                                                            }}>
                                                                                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', letterSpacing: '-0.01em' }}>Performance Stats</div>
                                                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                                                                                    <div style={{
                                                                                                        background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.16) 0%, rgba(168, 85, 247, 0.1) 100%)',
                                                                                                        border: '1px solid rgba(125, 135, 210, 0.35)',
                                                                                                        padding: '9px 12px',
                                                                                                        borderRadius: 12,
                                                                                                        display: 'flex',
                                                                                                        flexDirection: 'column',
                                                                                                        gap: 2,
                                                                                                    }}>
                                                                                                        <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Estimated 1RM</span>
                                                                                                        <span style={{ fontSize: '0.96rem', color: '#c4b5fd', fontWeight: 800 }}>{toDisplay(maxE1RM)} {exerciseData?.unit || unit}</span>
                                                                                                    </div>
                                                                                                    <div style={{
                                                                                                        background: 'rgba(255, 255, 255, 0.035)',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                                        padding: '9px 12px',
                                                                                                        borderRadius: 12,
                                                                                                        display: 'flex',
                                                                                                        flexDirection: 'column',
                                                                                                        gap: 2,
                                                                                                    }}>
                                                                                                        <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Total SI</span>
                                                                                                        <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.total.toFixed(2)}</span>
                                                                                                    </div>
                                                                                                    <div style={{
                                                                                                        background: 'rgba(255, 255, 255, 0.035)',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                                        padding: '9px 12px',
                                                                                                        borderRadius: 12,
                                                                                                        display: 'flex',
                                                                                                        flexDirection: 'column',
                                                                                                        gap: 2,
                                                                                                    }}>
                                                                                                        <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Peripheral SI</span>
                                                                                                        <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.peripheral.toFixed(2)}</span>
                                                                                                    </div>
                                                                                                    <div style={{
                                                                                                        background: 'rgba(255, 255, 255, 0.035)',
                                                                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                                                        padding: '9px 12px',
                                                                                                        borderRadius: 12,
                                                                                                        display: 'flex',
                                                                                                        flexDirection: 'column',
                                                                                                        gap: 2,
                                                                                                    }}>
                                                                                                        <span style={{ fontSize: '0.66rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Central SI</span>
                                                                                                        <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 800 }}>{exStress.central.toFixed(2)}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Plan Next Week's Top Sets — shown at the bottom of the open session */}
                                                            {!isCoachView && sessionOpen && exercises.length > 0 && (
                                                                <div style={{ padding: '8px 12px' }}>
                                                                    <PlannedTopSetInput
                                                                        athleteId={athleteId}
                                                                        sessionId={sKey}
                                                                        programId={program.id}
                                                                        weekNum={weekNum}
                                                                        dayNum={session.day || 1}
                                                                        exercises={exercises.map((e: any) => ({ name: e.name }))}
                                                                        unit={unit}
                                                                        targetNextWeek={true}
                                                                        totalWeeks={program.weeks?.length || 0}
                                                                        onSaved={(targetSessionId) => {
                                                                            fetchPlannedTopSetsForSession(sKey);
                                                                            if (targetSessionId) fetchPlannedTopSetsForSession(targetSessionId);
                                                                            const targetWeekNum = (weekNum || 1) + 1;
                                                                            const nextLegacyKey = sessionKey(program.id, targetWeekNum, session.day || 1);
                                                                            fetchPlannedTopSetsForSession(nextLegacyKey);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}

                                                        </div>
                                                    )
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        });
                        })()}
                    </div>
                );
            })}
                </div>
            )}
            {/* ═══ Week Overview Drawer ═══ */}
            {weekDrawer && (
                <>
                    {/* Backdrop */}
                    {weekDrawer.open && (
                        <div
                            onClick={() => setWeekDrawer(null)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0, 0, 0, 0.7)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                zIndex: 200,
                            }}
                        />
                    )}

                    {/* Drawer */}
                    <div style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 201,
                        transform: weekDrawer.open ? 'translateY(0)' : 'translateY(100%)',
                        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        background: 'linear-gradient(180deg, rgba(22, 27, 40, 0.97) 0%, rgba(14, 17, 26, 0.99) 100%)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        borderTop: '1px solid rgba(125, 135, 210, 0.4)',
                        borderRadius: '24px 24px 0 0',
                        boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        padding: '0 0 2rem 0'
                    }}>
                        {/* Drag Handle */}
                        <div
                            onClick={() => setWeekDrawer(null)}
                            style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 10px 0', cursor: 'pointer' }}
                        >
                            <div style={{ width: 44, height: 5, borderRadius: 9999, background: 'rgba(255, 255, 255, 0.2)' }} />
                        </div>

                        {/* Header */}
                        <div style={{ textAlign: 'center', padding: '0 1.25rem 1.25rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                                    {weekDrawer.programName || 'Training Program'}
                                </h2>
                                <Calendar size={18} color="var(--primary)" strokeWidth={2.2} />
                            </div>
                            <p style={{ fontSize: '0.88rem', color: 'var(--secondary-foreground)', margin: '6px 0 0 0' }}>
                                {weekDrawer.startDate || `Week ${weekDrawer.weekNum}`}
                            </p>
                        </div>

                        {/* Sessions by Day */}
                        <div style={{ padding: '1.25rem 1rem' }}>
                            {(weekDrawer.sessions || [])
                                .filter((sess: any) => Array.isArray(sess.exercises) && sess.exercises.length > 0)
                                .sort((a: any, b: any) => (a.day || 1) - (b.day || 1))
                                .map((sess: any) => {
                                    const prog = (programs || []).find((p: any) => p.id === weekDrawer.programId);
                                    const sessDateStr = resolveSessionDate(prog?.startDate, weekDrawer.weekNum, sess.day || 1, sess.scheduledDate);
                                    const sDate = parseLocalDate(sessDateStr);
                                    const dayName = sDate.toLocaleDateString('en-US', { weekday: 'long' });
                                    const fullLabel = sess.name ? `${dayName} — ${sess.name}` : dayName;
                                    return (
                                        <div key={sess.day} style={{ marginBottom: '1.25rem' }}>
                                            {/* Day Label */}
                                            <div style={{
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.06em',
                                                textTransform: 'uppercase',
                                                color: '#c4b5fd',
                                                marginBottom: '0.6rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                                                {fullLabel}
                                            </div>

                                            {/* Exercise Cards */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {(sess.exercises || []).map((ex: any, exIdx: number) => {
                                                    const category = ex?.category || getExerciseCategory(ex?.name);
                                                    const color = CATEGORY_COLORS[category] || '#94A3B8';
                                                    const setsSummary = formatSetsSummary(ex?.sets);

                                                    return (
                                                        <div
                                                            key={ex?.id || exIdx}
                                                            onClick={() => {
                                                                setWeekDrawer(null);
                                                                // Open the session in ScheduleView
                                                                const sKey = sessionKey(weekDrawer.programId, weekDrawer.weekNum, sess.day);
                                                                const weekKey = `${weekDrawer.programId}-w${weekDrawer.weekNum}`;
                                                                setOpenBlocks(prev => new Set(prev).add(weekDrawer.programId));
                                                                setOpenWeeks(prev => new Set(prev).add(weekKey));
                                                                setOpenSessions(prev => new Set(prev).add(sKey));
                                                                // Scroll to it after state updates
                                                                setTimeout(() => {
                                                                    const el = document.getElementById(`session-${sKey}`);
                                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                }, 100);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: '12px 16px',
                                                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%)',
                                                                border: `1px solid ${color}45`,
                                                                borderLeft: `4px solid ${color}`,
                                                                borderRadius: 14,
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                                                transition: 'all 0.18s ease'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontSize: '0.96rem',
                                                                    fontWeight: 600,
                                                                    color: '#ffffff',
                                                                    marginBottom: '3px',
                                                                    letterSpacing: '-0.01em'
                                                                }}>
                                                                    {ex?.name}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '0.8rem',
                                                                    color: 'var(--secondary-foreground)',
                                                                    opacity: 0.85
                                                                }}>
                                                                    {setsSummary}
                                                                </div>
                                                            </div>
                                                            <div style={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: 8,
                                                                background: `${color}18`,
                                                                border: `1px solid ${color}40`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: color,
                                                                fontSize: '1.1rem',
                                                                fontWeight: 700,
                                                                marginLeft: '0.75rem',
                                                                flexShrink: 0
                                                            }}>
                                                                +
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}
            {/* ═══ CELEBRATION SCREEN ═══ */}
            {celebration && (
                <CelebrationScreen
                    onClose={() => setCelebration(null)}
                    coachId={coachId}
                    athleteId={athleteId}
                    sessionName={celebration.sessionName}
                />
            )}
        </div >
    );
}

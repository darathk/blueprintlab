'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';
import { ArrowRight, Search, ChevronDown } from 'lucide-react';
import { getExerciseCategory } from '@/lib/exercise-db';

const ExerciseFeedback = dynamic(() => import('@/components/athlete/ExerciseFeedback'), { ssr: false });
const ReadinessCheckin = dynamic(() => import('@/components/athlete/ReadinessCheckin'), { ssr: false });
const CelebrationScreen = dynamic(() => import('@/components/athlete/CelebrationScreen'), { ssr: false });

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

/** Compute the Sun-Sat date range for the calendar week containing a given date */
function weekDateRangeFromDate(programStartDate: any, weekNumber: number): string {
    if (!programStartDate) return '';
    const start = parseLocalDate(programStartDate);
    // Compute the actual session date anchor: start + (weekNumber-1)*7
    const anchor = new Date(start);
    anchor.setDate(anchor.getDate() + (weekNumber - 1) * 7);
    // Snap to the Sunday of that week
    const sunday = new Date(anchor);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() + 6);
    const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return `${fmt(sunday)} – ${fmt(saturday)}`;
}

function sessionProgress(exercises: any[], log: any, editStateData?: any[]): number {
    const totalSets = exercises.reduce((s: number, ex: any) => s + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
    if (!totalSets) return 0;
    let filled = 0;
    if (editStateData) {
        editStateData.forEach((ex: any) => {
            (ex.sets || []).forEach((s: any) => {
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
export default function ScheduleView({ programs, athleteId, coachId, logs, isCoachView = false, nextMeetDate = null }: {
    programs: any[];
    athleteId: string;
    coachId?: string;
    logs: any[];
    isCoachView?: boolean;
    nextMeetDate?: string | null;
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

    const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
    const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
    const [searchQuery, setSearchQuery] = useState('');

    // Celebration screen state
    const [celebration, setCelebration] = useState<{ sessionName: string } | null>(null);
    const celebratedSessionsRef = useRef<Set<string>>(new Set());
    const sessionMetaRef = useRef<Record<string, { exercises: any[]; sessionName: string }>>({});

    // Readiness gating: track which sessions have completed readiness
    // Coach view bypasses readiness entirely
    const [readySessions, setReadySessions] = useState<Set<string>>(new Set());
    const [readinessPopup, setReadinessPopup] = useState<string | null>(null); // session key of popup
    const [shakeKey, setShakeKey] = useState<string | null>(null); // exercise key to shake

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
            sessions: Array.isArray(week.sessions) ? week.sessions : [],
            startDate: dateRange
        });
    };

    useEffect(() => {
        const saved = localStorage.getItem('athlete-unit-pref');
        if (saved === 'kg' || saved === 'lbs') setUnit(saved);
    }, []);

    const toggleUnit = (u: 'kg' | 'lbs') => {
        setUnit(u);
        localStorage.setItem('athlete-unit-pref', u);
    };

    // Filter and sort programs
    const filteredPrograms = useMemo(() => {
        let result = [...programs];

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
        if (unit === 'lbs') return val.toString();
        return (num * 0.45359237).toFixed(1).replace(/\.0$/, '');
    };

    const toInternal = (val: any) => {
        if (val === undefined || val === null || val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        if (unit === 'lbs') return val.toString();
        return (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
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

                // Check if session just reached 100% — trigger celebration
                const meta = sessionMetaRef.current[sKey];
                if (meta && !celebratedSessionsRef.current.has(sKey)) {
                    const progress = sessionProgress(meta.exercises, null, state);
                    if (progress === 100) {
                        celebratedSessionsRef.current.add(sKey);
                        setCelebration({ sessionName: meta.sessionName });
                    }
                }
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
                const internalValue = field === 'weight' ? toInternal(value) : value;
                copy[sKey][exIdx].sets[setIdx].actual[field] = internalValue;
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
        const map: Record<string, { program: any; weekNum: number; weekDisplayNum: number; session: any; sKey: string; isActive: boolean; sessionNum: number }[]> = {};
        if (!Array.isArray(programs)) return map;

        programs.forEach(program => {
            if (!program.startDate) return;
            // Use RAW startDate for date computation — weekNum/dayNum are stored relative to this
            const start = parseLocalDate(program.startDate);
            // Snap to Sunday only for computing calendar-week display numbers
            const startSunday = new Date(start);
            startSunday.setDate(startSunday.getDate() - startSunday.getDay());
            const isActive = program.status === 'active';

            const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
            // Collect all sessions with their computed dates to determine sequential week display
            const allSessionDates: { wn: number; date: Date }[] = [];
            weeks.forEach((week: any) => {
                const wn = week.weekNumber || 1;
                const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];
                sessions.forEach((session: any) => {
                    const day = session.day || 1;
                    const d = new Date(start);
                    d.setDate(d.getDate() + (wn - 1) * 7 + (day - 1));
                    allSessionDates.push({ wn, date: d });
                });
            });
            // Get unique calendar weeks (Sun-Sat) that have sessions, sorted chronologically
            const calendarWeekSundays = [...new Set(allSessionDates.map(s => {
                const sun = new Date(s.date);
                sun.setDate(sun.getDate() - sun.getDay());
                return sun.getTime();
            }))].sort((a, b) => a - b);

            weeks.forEach((week: any) => {
                const wn = week.weekNumber || 1;
                const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];
                // Sort sessions by day to determine sequential session number
                const sortedSessions = [...sessions].sort((a: any, b: any) => (a?.day || 1) - (b?.day || 1));
                sessions.forEach((session: any) => {
                    const day = session.day || 1;
                    // Compute actual date from raw startDate
                    const d = new Date(start);
                    d.setDate(d.getDate() + (wn - 1) * 7 + (day - 1));
                    const ds = toDateStr(d);
                    const sKey = sessionKey(program.id, wn, day);
                    // Compute calendar-week display number (1-based, only counting weeks with sessions)
                    const sessionSunday = new Date(d);
                    sessionSunday.setDate(sessionSunday.getDate() - sessionSunday.getDay());
                    const weekDisplayNum = calendarWeekSundays.indexOf(sessionSunday.getTime()) + 1;
                    // sessionNum is the 1-based position of this session in the week (sorted by day)
                    const sessionNum = sortedSessions.findIndex((s: any) => (s?.day || 1) === day) + 1;
                    if (!map[ds]) map[ds] = [];
                    map[ds].push({ program, weekNum: wn, weekDisplayNum: weekDisplayNum || 1, session, sKey, isActive, sessionNum });
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
                hasActiveSession: sessions.some(s => s.isActive),
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
                                minWidth: 44,
                                padding: '8px 6px 6px',
                                borderRadius: 12,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: isSelected
                                    ? 'var(--primary)'
                                    : d.isToday
                                        ? 'rgba(125, 135, 210, 0.15)'
                                        : 'transparent',
                                border: isSelected
                                    ? '1px solid var(--primary)'
                                    : d.isToday
                                        ? '1px solid rgba(125, 135, 210, 0.3)'
                                        : '1px solid transparent',
                            }}
                        >
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: isSelected ? 'white' : 'var(--secondary-foreground)',
                            }}>
                                {SHORT_DAYS[d.date.getDay()]}
                            </span>
                            <span style={{
                                fontSize: '1.05rem',
                                fontWeight: 700,
                                color: isSelected ? 'white' : d.isToday ? 'var(--primary)' : 'var(--foreground)',
                            }}>
                                {d.date.getDate()}
                            </span>
                            {/* Session/Meet indicators */}
                            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                {d.isMeet && <span style={{ fontSize: '0.65rem' }}>🏆</span>}
                                <div style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: d.hasSession
                                        ? isSelected ? 'white'
                                            : d.hasActiveSession ? 'var(--accent)' : 'rgba(148, 163, 184, 0.4)'
                                        : 'transparent',
                                    transition: 'background 0.2s',
                                }} />
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
            <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    display: 'flex', background: 'var(--card-bg)', borderRadius: 10,
                    padding: 3, border: '1px solid var(--card-border)',
                }}>
                    {([['date', 'Schedule'], ['blocks', 'All Blocks']] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode as 'date' | 'blocks')}
                            style={{
                                padding: '6px 14px', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 600, borderRadius: 8,
                                transition: 'all 0.2s',
                                background: viewMode === mode ? 'var(--primary)' : 'transparent',
                                color: viewMode === mode ? 'white' : 'var(--secondary-foreground)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Unit toggle */}
                <div style={{
                    display: 'flex', background: 'var(--card-bg)', borderRadius: 10,
                    padding: 3, border: '1px solid var(--card-border)',
                }}>
                    {(['kg', 'lbs'] as const).map(u => (
                        <button
                            key={u}
                            onClick={() => toggleUnit(u)}
                            style={{
                                padding: '6px 14px', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 600, borderRadius: 8,
                                transition: 'all 0.2s',
                                background: unit === u ? 'var(--primary)' : 'transparent',
                                color: unit === u ? 'white' : 'var(--secondary-foreground)',
                                minWidth: 50,
                            }}
                        >
                            {u.toUpperCase()}
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
                            background: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            borderRadius: 12,
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
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {selectedDateSessions.map(({ program, weekNum, weekDisplayNum, session, sKey, isActive, sessionNum }) => {
                                const exercises: any[] = Array.isArray(session.exercises) ? session.exercises : [];
                                const log = Array.isArray(logs) ? logs.find(l => l.sessionId === sKey && l.programId === program.id) : undefined;
                                const progress = sessionProgress(exercises, log, editState[sKey]);
                                const sessionOpen = openSessions.has(sKey);

                                // Register session metadata for celebration detection
                                sessionMetaRef.current[sKey] = { exercises, sessionName: session.name || `Session ${session.day}` };

                                return (
                                    <div key={sKey} id={`session-${sKey}`} style={{
                                        background: 'var(--card-bg)',
                                        border: sessionOpen ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        transition: 'border-color 0.2s, opacity 0.2s',
                                        opacity: 1,
                                    }}>
                                        {/* Past program label */}
                                        {!isActive && (
                                            <div style={{
                                                padding: '4px 16px',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderBottom: '1px solid var(--card-border)',
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                color: 'var(--secondary-foreground)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                            }}>
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
                                                padding: '14px 16px',
                                                cursor: 'pointer',
                                                background: sessionOpen ? (isActive ? 'rgba(125, 135, 210, 0.08)' : 'rgba(255,255,255,0.02)') : 'transparent',
                                                transition: 'background 0.2s',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{
                                                            color: sessionOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                            fontSize: '0.75rem',
                                                            transition: 'transform 0.2s',
                                                            display: 'inline-block',
                                                            transform: sessionOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        }}>▶</span>
                                                        <div>
                                                            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                                                {session.name || `Session ${session.day}`}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                                                {program.name} — Week {weekDisplayNum} • {weekDateRangeFromDate(program.startDate, weekNum)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: progress === 100 ? 'var(--success)' : progress > 0 ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                }}>
                                                    {progress}%
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'var(--background)', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: 2, transition: 'width 300ms',
                                                    width: `${progress}%`,
                                                    background: progress === 100 ? 'var(--success)' : 'var(--primary)',
                                                }} />
                                            </div>
                                        </div>

                                        {/* Expanded: Toggle All + Save Status */}
                                        {sessionOpen && (
                                            <div style={{
                                                padding: '8px 16px',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                borderTop: '1px solid var(--card-border)',
                                                background: 'rgba(125, 135, 210, 0.04)',
                                            }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isCoachView && !readySessions.has(sKey)) {
                                                            handleLockedExerciseClick(sKey, `${sKey}-expand-all`);
                                                            return;
                                                        }
                                                        const anyOpen = exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`));
                                                        toggleSessionExercises(sKey, exercises, !anyOpen);
                                                    }}
                                                    style={{
                                                        padding: '2px 8px', height: '22px',
                                                        background: 'rgba(125, 135, 210, 0.15)',
                                                        border: '1px solid rgba(125, 135, 210, 0.3)',
                                                        borderRadius: '4px', color: 'var(--primary)',
                                                        fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                                                        textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    }}
                                                >
                                                    {exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`)) ? 'Collapse All' : 'Expand All'}
                                                </button>
                                                <div style={{ fontSize: '0.75rem' }}>
                                                    {saving.has(sKey) ? (
                                                        <span style={{ color: 'var(--warning)' }}>Saving...</span>
                                                    ) : savedKeys.has(sKey) ? (
                                                        <span style={{ color: 'var(--success)' }}>Saved</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}

                                        {/* Expanded: Readiness + Exercise Cards */}
                                        {sessionOpen && (
                                            <div style={{ background: 'var(--card-border)', position: 'relative' }}>
                                                {!isCoachView && <ReadinessCheckin athleteId={athleteId} sessionKey={sKey} programId={program.id} onReadinessSubmit={() => markSessionReady(sKey)} />}

                                                {/* Warmup Drills Display */}
                                                {(session.warmupDrills || log?.warmupDrills) && (
                                                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--card-border)' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            Warm-Up & Prep Drills
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                                            {linkify(session.warmupDrills || log?.warmupDrills)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Readiness gate popup */}
                                                {!isCoachView && readinessPopup === sKey && (
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
                                                    const sets = isEdit ? exerciseData.sets : (Array.isArray(ex.sets) ? ex.sets : []);
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

                                                    const category = exerciseData.category || ex.category || getExerciseCategory(exerciseData.name || ex.name);
                                                    const catColor = CATEGORY_COLORS[category] || '#94A3B8';

                                                    const isLocked = !isCoachView && !readySessions.has(sKey);

                                                    return (
                                                        <div key={exIdx} className={shakeKey === exKey ? 'readiness-shake' : ''} style={{ background: 'var(--background)', borderBottom: '1px solid var(--card-border)', opacity: isLocked ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg)', borderBottom: exOpen ? '1px solid var(--card-border)' : 'none' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                    <div style={{ width: 3, height: 20, borderRadius: 2, background: catColor }} />
                                                                    <div
                                                                        onClick={() => {
                                                                            if (isLocked) {
                                                                                handleLockedExerciseClick(sKey, exKey);
                                                                                return;
                                                                            }
                                                                            toggle(openExercises, exKey, setOpenExercises);
                                                                            if (!editState[sKey]) initEdit(sKey, exercises, log);
                                                                        }}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                                                    >
                                                                        {isLocked && <span style={{ fontSize: '0.8rem' }}>🔒</span>}
                                                                        <span style={{
                                                                            color: 'var(--secondary-foreground)', fontSize: '0.7rem',
                                                                            transition: 'transform 0.2s', display: 'inline-block',
                                                                            transform: exOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                        }}>▶</span>
                                                                        <span style={{ fontSize: '0.95rem', color: 'var(--foreground)', fontWeight: 500 }}>{exerciseData.name || ex.name}</span>
                                                                    </div>
                                                                </div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                                                    {sets.length} sets
                                                                </div>
                                                            </div>

                                                            {exOpen && (
                                                                <div style={{ padding: '0 8px 16px 8px' }}>
                                                                    {/* Coach's notes — surfaced first so the athlete reads any
                                                                        prescribed cues/instructions before seeing the protocol. */}
                                                                    <div style={{ display: 'flex', padding: '12px 0 8px 0', alignItems: 'flex-start' }}>
                                                                        <textarea
                                                                            value={exerciseData.notes || ''}
                                                                            onChange={e => updateNotes(sKey, exIdx, e.target.value, program.id)}
                                                                            onBlur={() => triggerAutoSave(sKey, program.id)}
                                                                            onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                            placeholder="Coach's notes:"
                                                                            style={{
                                                                                flex: 1, minHeight: 60, padding: '8px 12px', border: '1px solid var(--card-border)',
                                                                                borderRadius: 4, background: 'var(--background)', fontSize: '0.9rem',
                                                                                color: 'var(--foreground)', resize: 'vertical', outlineColor: 'var(--primary)',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    {(() => {
                                                                        const prevForHeader = getPrevSets(exerciseData.name || ex.name, sKey);
                                                                        const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                        return (
                                                                            <>
                                                                                <div style={{ display: 'flex', borderBottom: '1px dashed var(--card-border)', marginBottom: 8 }}>
                                                                                    <div style={{ width: '130px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: prevDateLabel ? 'var(--secondary-foreground)' : 'var(--primary)', padding: '4px 0' }}>
                                                                                        {prevDateLabel ? <span>🕐 {prevDateLabel}</span> : 'Prescribed'}
                                                                                    </div>
                                                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                                                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: 'var(--card-border)' }} />
                                                                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)', padding: '4px 0', background: 'var(--card-bg)' }}>Actual</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{ display: 'flex', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                                                                    <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    </div>
                                                                                    <div style={{ position: 'relative', width: 1, background: 'var(--card-border)', margin: '0 8px' }} />
                                                                                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                    {sets.map((set: any, setIdx: number) => {
                                                                        const target = isEdit ? set.target : set;
                                                                        const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                        const prev = getPrevSets(exerciseData.name || ex.name, sKey);
                                                                        const prevSet = prev?.sets?.[setIdx];
                                                                        return (
                                                                            <div key={setIdx} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed var(--card-border)' }}>
                                                                                <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                                                    {(['weight', 'reps', 'rpe'] as const).map(f => {
                                                                                        const prevVal = (prevSet && f === 'weight') ? toDisplay(prevSet.weight) : '';
                                                                                        const targVal = f === 'weight' ? toDisplay(target[f]) : target[f];
                                                                                        const displayVal = prevVal || targVal || '\u00A0';
                                                                                        const isPrev = !!prevVal;
                                                                                        return (
                                                                                            <div key={f} style={{
                                                                                                flex: 1, padding: '6px 4px',
                                                                                                border: `1px solid ${isPrev ? 'rgba(125,135,210,0.35)' : 'var(--card-border)'}`,
                                                                                                borderRadius: 4,
                                                                                                background: isPrev ? 'rgba(125,135,210,0.08)' : 'var(--background)',
                                                                                                textAlign: 'center', fontSize: '0.9rem',
                                                                                                color: isPrev ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                                                fontWeight: isPrev ? 600 : 400,
                                                                                            }}>
                                                                                                {displayVal}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setIdx > 0 ? copyPrevSet(sKey, exIdx, setIdx, program.id) : copyTargetToActual(sKey, exIdx, setIdx, program.id)}
                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                                                                                >
                                                                                    <ArrowRight size={18} color="var(--primary)" />
                                                                                </button>
                                                                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}>
                                                                                    {['weight', 'reps', 'rpe'].map(f => (
                                                                                        <input key={f} type="number" inputMode="decimal"
                                                                                            value={f === 'weight' ? toDisplay(actual[f]) : actual[f]}
                                                                                            onChange={e => updateSet(sKey, exIdx, setIdx, f, e.target.value, program.id)}
                                                                                            onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                            style={{
                                                                                                flex: 1, padding: '6px 4px', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4,
                                                                                                background: 'var(--background)', textAlign: 'center', fontSize: '0.9rem',
                                                                                                color: 'var(--foreground)', width: '100%', outlineColor: 'var(--primary)',
                                                                                            }}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <div style={{ padding: '12px 0 8px 0', borderBottom: '1px dashed var(--card-border)', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                                                                        <div style={{ display: 'flex', gap: '16px', fontWeight: 600 }}>
                                                                            <span>E1RM: {toDisplay(maxE1RM)} {unit}</span>
                                                                            <span>NL: {totalNL}</span>
                                                                            <span>Tonnage: {toDisplay(tonnage)} {unit}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '16px', marginTop: 4 }}>
                                                                            <span>Total: <span style={{ fontWeight: 'normal' }}>{exStress.total.toFixed(2)}</span></span>
                                                                            <span>Peripheral: <span style={{ fontWeight: 'normal' }}>{exStress.peripheral.toFixed(2)}</span></span>
                                                                            <span>Central: <span style={{ fontWeight: 'normal' }}>{exStress.central.toFixed(2)}</span></span>
                                                                        </div>
                                                                    </div>
                                                                    <ExerciseFeedback
                                                                        athleteId={athleteId}
                                                                        coachId={coachId || ''}
                                                                        exerciseName={exerciseData.name || ex.name}
                                                                        weekNum={weekDisplayNum}
                                                                        dayNum={sessionNum}
                                                                        blockName={program.name}
                                                                        unit={unit}
                                                                        sets={(editState[sKey]?.[exIdx]?.sets || []).map((s: any, i: number) => ({ setNumber: i + 1, actual: s.actual || { weight: '', reps: '', rpe: '' } }))}
                                                                    />
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
                    )}
                </div>
            )}

            {/* ═══ BLOCKS VIEW (All Programs) ═══ */}
            {viewMode === 'blocks' && (
                <>
            {/* Toolbar: Search + Sort */}
            <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    borderRadius: 10, padding: '0 12px', height: 42,
                }}>
                    <Search size={16} color="var(--secondary-foreground)" style={{ flexShrink: 0 }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search blocks..."
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: 'var(--foreground)', fontSize: '0.85rem',
                            outline: 'none', padding: '8px 0',
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 2 }}
                        >
                            ×
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                        display: 'flex', background: 'var(--card-bg)', borderRadius: 10,
                        padding: 3, border: '1px solid var(--card-border)',
                    }}>
                        {(['latest', 'oldest'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortOrder(s)}
                                style={{
                                    padding: '6px 14px', border: 'none', cursor: 'pointer',
                                    fontSize: '0.75rem', fontWeight: 600, borderRadius: 8,
                                    transition: 'all 0.2s',
                                    background: sortOrder === s ? 'var(--primary)' : 'transparent',
                                    color: sortOrder === s ? 'white' : 'var(--secondary-foreground)',
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

            {viewMode === 'blocks' && filteredPrograms.map(program => {
                const blockOpen = openBlocks.has(program.id);
                const weeks: any[] = Array.isArray(program.weeks) ? program.weeks : [];
                const totalWeeks = weeks.length;
                const totalSessions = weeks.reduce((s: number, w: any) => s + (Array.isArray(w.sessions) ? w.sessions.length : 0), 0);

                // Calculate Block Progress
                let bTotalSets = 0;
                let bFilledSets = 0;
                weeks.forEach((w: any) => {
                    const wSessions: any[] = Array.isArray(w.sessions) ? w.sessions : [];
                    wSessions.forEach((s: any) => {
                        const sKey = sessionKey(program.id, w.weekNumber || 1, s.day || 1);
                        const exData: any[] = Array.isArray(s.exercises) ? s.exercises : [];
                        const log = Array.isArray(logs) ? logs.find(l => l.sessionId === sKey && l.programId === program.id) : undefined;
                        const esData = editState[sKey];

                        exData.forEach((ex: any) => {
                            bTotalSets += Array.isArray(ex.sets) ? ex.sets.length : 0;
                        });

                        if (esData) {
                            esData.forEach((ex: any) => {
                                (ex.sets || []).forEach((set: any) => {
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
                    <div key={program.id} style={{ marginBottom: 16 }}>
                        {/* ═══ Block Header ═══ */}
                        <button
                            onClick={() => toggle(openBlocks, program.id, setOpenBlocks)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px', background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)', borderRadius: blockOpen ? '8px 8px 0 0' : '8px',
                                color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{program.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                    {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingRight: 24 }}>
                                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--background)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 3, transition: 'width 300ms',
                                            width: `${blockProgressPct}%`,
                                            background: blockProgressPct === 100 ? 'var(--success)' : 'var(--primary)'
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--foreground)', fontWeight: 600, width: 30 }}>
                                        {blockProgressPct}%
                                    </span>
                                </div>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', transition: 'transform 200ms', transform: blockOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </button>

                        {/* ═══ Weeks ═══ */}
                        {blockOpen && (() => {
                            // Sort weeks with sessions for sequential display numbering (skip empty weeks)
                            const sortedWeeksForDisplay = [...weeks].filter((w: any) => Array.isArray(w?.sessions) && w.sessions.length > 0).sort((a: any, b: any) => (a?.weekNumber || 1) - (b?.weekNumber || 1));
                            return weeks.map((week: any) => {
                            if (!week) return null;
                            const sessions: any[] = Array.isArray(week.sessions) ? week.sessions : [];
                            if (sessions.length === 0) return null;
                            const weekNum = week.weekNumber || 1;
                            const weekDisplayNum = sortedWeeksForDisplay.findIndex((w: any) => (w?.weekNumber || 1) === weekNum) + 1;

                            // Skip weeks that fall outside the program's date range
                            if (program.startDate) {
                                const ps = parseLocalDate(program.startDate);
                                const dow = ps.getDay();
                                const w1Sun = new Date(ps);
                                w1Sun.setDate(w1Sun.getDate() - dow);
                                const wSun = new Date(w1Sun);
                                wSun.setDate(wSun.getDate() + (weekNum - 1) * 7);
                                if (program.endDate) {
                                    const pe = parseLocalDate(program.endDate);
                                    pe.setHours(23, 59, 59, 999);
                                    if (wSun > pe) return null;
                                }
                            }
                            const weekKey = `${program.id}-w${weekNum}`;
                            const weekOpen = openWeeks.has(weekKey);

                            return (
                                <div key={weekKey} style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}> {/* Light grey background for RTS style */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        background: 'var(--background)',
                                        borderBottom: '1px solid var(--card-border)', borderLeft: '1px solid var(--card-border)', borderRight: '1px solid var(--card-border)',
                                    }}>
                                        <button
                                            onClick={() => toggle(openWeeks, weekKey, setOpenWeeks)}
                                            style={{
                                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 16px', background: 'transparent',
                                                border: 'none',
                                                color: 'var(--foreground)', cursor: 'pointer', fontSize: '1rem', fontWeight: 600
                                            }}
                                        >
                                            <span>Week {weekDisplayNum} — {weekDateRangeFromDate(program.startDate, weekNum)} <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>• {sessions.length} session{sessions.length !== 1 ? 's' : ''}</span></span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', transition: 'transform 200ms', transform: weekOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                        </button>
                                        {/* Week Overview Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openWeekDrawer(program, week);
                                            }}
                                            title="View week overview"
                                            style={{
                                                background: '#3B82F6',
                                                color: 'white',
                                                border: 'none',
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: '12px',
                                                flexShrink: 0,
                                                boxShadow: '0 1px 4px rgba(59, 130, 246, 0.3)',
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="18 15 12 9 6 15" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* ═══ Sessions (Days) ═══ */}
                                    {weekOpen && [...sessions].sort((a: any, b: any) => (a?.day || 1) - (b?.day || 1)).map((session: any, sessionIndex: number) => {
                                        if (!session) return null;
                                        const day = session.day || 1;
                                        const sessionNum = sessionIndex + 1; // 1-based sequential session number
                                        const sKey = sessionKey(program.id, weekNum, day);
                                        const sessionOpen = openSessions.has(sKey);
                                        const exercises: any[] = Array.isArray(session.exercises) ? session.exercises : [];
                                        const log = Array.isArray(logs) ? logs.find(l => l.sessionId === sKey && l.programId === program.id) : undefined;
                                        const progress = sessionProgress(exercises, log, editState[sKey]);

                                        // Register session metadata for celebration detection
                                        sessionMetaRef.current[sKey] = { exercises, sessionName: session.name || `Session ${day}` };

                                        return (
                                            <div key={sKey} id={`session-${sKey}`} style={{ borderBottom: '1px solid var(--card-border)', borderLeft: '1px solid var(--card-border)', borderRight: '1px solid var(--card-border)' }}>
                                                {/* Session header */}
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    padding: '12px 16px',
                                                    background: sessionOpen ? 'rgba(6, 182, 212, 0.1)' : 'var(--card-bg)',
                                                    color: 'var(--foreground)',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    {/* Top Row: Title and Toggle Button */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                                                            toggle(openSessions, sKey, setOpenSessions);
                                                            if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                {sessionOpen ? (
                                                                    <span style={{ color: 'var(--primary)' }}>▼</span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--secondary-foreground)' }}>▶</span>
                                                                )}
                                                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                                                    {session.name || `Session ${day}`}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Toggle All Button & Save Status */}
                                                        {sessionOpen && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!readySessions.has(sKey)) {
                                                                            handleLockedExerciseClick(sKey, `${sKey}-expand-all`);
                                                                            return;
                                                                        }
                                                                        const anyOpen = exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`));
                                                                        toggleSessionExercises(sKey, exercises, !anyOpen);
                                                                    }}
                                                                    style={{
                                                                        padding: '2px 8px',
                                                                        height: '22px',
                                                                        background: 'rgba(6, 182, 212, 0.2)',
                                                                        border: '1px solid var(--primary)',
                                                                        borderRadius: '4px',
                                                                        color: 'var(--primary)',
                                                                        fontSize: '0.6rem',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.1em',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {exercises.some((_, idx) => openExercises.has(`${sKey}-ex${idx}`)) ? 'Collapse All' : 'Expand All'}
                                                                </button>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', minWidth: 60, justifyContent: 'flex-end' }}>
                                                                    {saving.has(sKey) ? (
                                                                        <span style={{ color: 'var(--warning)' }}>Saving...</span>
                                                                    ) : savedKeys.has(sKey) ? (
                                                                        <span style={{ color: 'var(--success)' }}>✓ Saved</span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom Row: Full Width Progress Bar */}
                                                    <div
                                                        onClick={() => {
                                                            toggle(openSessions, sKey, setOpenSessions);
                                                            if (!openSessions.has(sKey)) initEdit(sKey, exercises, log);
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}
                                                    >
                                                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--background)', overflow: 'hidden' }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: 3, transition: 'width 300ms',
                                                                width: `${progress}%`,
                                                                background: progress === 100 ? 'var(--success)' : 'var(--primary)'
                                                            }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* ═══ Expanded Session: Exercise Cards ═══ */}
                                                {
                                                    sessionOpen && (
                                                        <div style={{ padding: '0', background: 'var(--card-border)' }}> {/* Light grey backdrop for cards */}
                                                            {/* "All Changes Saved" header like RTS */}
                                                            <div style={{ padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
                                                                <span style={{ color: saving.has(sKey) ? 'var(--warning)' : 'var(--success)' }}>{saving.has(sKey) ? 'Saving changes...' : 'All Changes Saved.'}</span>
                                                            </div>

                                                            {/* Readiness Check-In */}
                                                            {!isCoachView && <ReadinessCheckin athleteId={athleteId} sessionKey={sKey} programId={program.id} onReadinessSubmit={() => markSessionReady(sKey)} />}

                                                            {/* Readiness gate popup */}
                                                            {!isCoachView && readinessPopup === sKey && (
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

                                                                const isLocked = !isCoachView && !readySessions.has(sKey);

                                                                return (
                                                                    <div key={exIdx} className={shakeKey === exKey ? 'readiness-shake' : ''} style={{ background: 'var(--background)', borderBottom: '1px solid #cbd5e1', opacity: isLocked ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                                                                        {/* Exercise header */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid #e2e8f0' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        color: 'var(--secondary-foreground)', cursor: 'pointer', padding: '4px',
                                                                                        transition: 'transform 0.2s', transform: exOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                                                                                    }}
                                                                                >
                                                                                    ▶
                                                                                </div>
                                                                                <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 500 }}>{exerciseData.name || ex.name}</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                                                                                Sets <div style={{ minWidth: 40, padding: '4px 8px', border: '1px solid var(--card-border)', borderRadius: 4, textAlign: 'center', background: 'var(--background)' }}>{sets.length}</div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Exercise body / Input rows */}
                                                                        {exOpen && (
                                                                            <div style={{ padding: '0 8px 16px 8px' }}>
                                                                                {/* Coach's notes — surfaced first so the athlete reads any
                                                                                    prescribed cues/instructions before seeing the protocol. */}
                                                                                <div style={{ display: 'flex', padding: '12px 0 8px 0', alignItems: 'flex-start' }}>
                                                                                    <textarea
                                                                                        value={exerciseData.notes || ''}
                                                                                        onChange={e => updateNotes(sKey, exIdx, e.target.value, program.id)}
                                                                                        onBlur={() => triggerAutoSave(sKey, program.id)}
                                                                                        onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                        placeholder="Coach's notes:"
                                                                                        style={{
                                                                                            flex: 1, minHeight: 60, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: 'var(--background)', fontSize: '0.9rem', color: 'var(--foreground)', resize: 'vertical', outlineColor: 'var(--primary)'
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                {/* Target / Actual Header */}
                                                                                <div style={{ display: 'flex', borderBottom: '1px dashed #cbd5e1', marginBottom: 8 }}>
                                                                                    {(() => {
                                                                                        const prevForHeader = getPrevSets(exerciseData.name || ex.name, sKey);
                                                                                        const prevDateLabel = (() => { const raw = prevForHeader?.date; if (!raw) return null; const d = new Date(raw.slice(0, 10)); return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
                                                                                        return <div style={{ width: '130px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: prevDateLabel ? 'var(--secondary-foreground)' : 'var(--primary)', padding: '4px 0' }}>{prevDateLabel ? <span>🕐 {prevDateLabel}</span> : 'Prescribed'}</div>;
                                                                                    })()}
                                                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                                                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: 'var(--card-border)' }}></div>
                                                                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)', padding: '4px 0', background: 'var(--card-bg)' }}>Actual</div>
                                                                                    </div>
                                                                                </div>

                                                                                <div style={{ display: 'flex', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                                                                    <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    </div>
                                                                                    <div style={{ position: 'relative', width: 1, background: 'var(--card-border)', margin: '0 8px' }}></div>
                                                                                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Weight</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                                        <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Set rows */}
                                                                                {sets.map((set: any, setIdx: number) => {
                                                                                    const target = isEdit ? set.target : set;
                                                                                    const actual = isEdit ? set.actual : { weight: '', reps: '', rpe: '' };
                                                                                    const prev = getPrevSets(exerciseData.name || ex.name, sKey);
                                                                                    const prevSet = prev?.sets?.[setIdx];
                                                                                    return (
                                                                                        <div key={setIdx} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                                                            {/* Target side — shows prev logged if available, else coach target */}
                                                                                            <div style={{ display: 'flex', width: '130px', justifyContent: 'center', gap: 4 }}>
                                                                                                {(['weight', 'reps', 'rpe'] as const).map(f => {
                                                                                                    const prevVal = (prevSet && f === 'weight') ? toDisplay(prevSet.weight) : '';
                                                                                                    const targVal = f === 'weight' ? toDisplay(target[f]) : target[f];
                                                                                                    const displayVal = prevVal || targVal || '\u00A0';
                                                                                                    const isPrev = !!prevVal;
                                                                                                    return (
                                                                                                        <div key={f} style={{
                                                                                                            flex: 1, padding: '6px 4px',
                                                                                                            border: `1px solid ${isPrev ? 'rgba(125,135,210,0.35)' : '#cbd5e1'}`,
                                                                                                            borderRadius: 4,
                                                                                                            background: isPrev ? 'rgba(125,135,210,0.08)' : 'var(--background)',
                                                                                                            textAlign: 'center', fontSize: '0.9rem',
                                                                                                            color: isPrev ? 'var(--primary)' : 'var(--secondary-foreground)',
                                                                                                            fontWeight: isPrev ? 600 : 400,
                                                                                                        }}>
                                                                                                            {displayVal}
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>

                                                                                            {/* Arrow */}
                                                                                            <button
                                                                                                onClick={() => setIdx > 0 ? copyPrevSet(sKey, exIdx, setIdx, program.id) : copyTargetToActual(sKey, exIdx, setIdx, program.id)}
                                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                                                                                            >
                                                                                                <ArrowRight size={18} color="var(--primary)" />
                                                                                            </button>

                                                                                            {/* Actual side */}
                                                                                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}>
                                                                                                {['weight', 'reps', 'rpe'].map(f => (
                                                                                                    <input key={f} type="number" inputMode="decimal"
                                                                                                        value={f === 'weight' ? toDisplay(actual[f]) : actual[f]}
                                                                                                        onChange={e => updateSet(sKey, exIdx, setIdx, f, e.target.value, program.id)}
                                                                                                        onFocus={() => { if (!editState[sKey]) initEdit(sKey, exercises, log); }}
                                                                                                        style={{
                                                                                                            flex: 1, padding: '6px 4px', border: '1px solid #94a3b8', borderRadius: 4, background: 'var(--background)', textAlign: 'center', fontSize: '0.9rem', color: 'var(--foreground)', width: '100%', outlineColor: 'var(--primary)'
                                                                                                        }}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}

                                                                                {/* Stats row */}
                                                                                <div style={{ padding: '12px 0 8px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                                                                                    <div style={{ display: 'flex', gap: '16px', fontWeight: 600 }}>
                                                                                        <span>E1RM: {toDisplay(maxE1RM)} {unit}</span>
                                                                                        <span>NL: {totalNL}</span>
                                                                                        <span>Tonnage: {toDisplay(tonnage)} {unit}</span>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', gap: '16px', marginTop: 4 }}>
                                                                                        <span>Total: <span style={{ fontWeight: 'normal' }}>{exStress.total.toFixed(2)}</span></span>
                                                                                        <span>Peripheral: <span style={{ fontWeight: 'normal' }}>{exStress.peripheral.toFixed(2)}</span></span>
                                                                                        <span>Central: <span style={{ fontWeight: 'normal' }}>{exStress.central.toFixed(2)}</span></span>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Send Feedback */}
                                                                                <ExerciseFeedback
                                                                                    athleteId={athleteId}
                                                                                    coachId={coachId || ''}
                                                                                    exerciseName={exerciseData.name || ex.name}
                                                                                    weekNum={weekDisplayNum}
                                                                                    dayNum={sessionNum}
                                                                                    blockName={program.name}
                                                                                    unit={unit}
                                                                                    sets={(editState[sKey]?.[exIdx]?.sets || []).map((s: any, i: number) => ({ setNumber: i + 1, actual: s.actual || { weight: '', reps: '', rpe: '' } }))}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
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
                                background: 'rgba(0, 0, 0, 0.6)',
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
                        background: 'var(--background)',
                        borderTop: '2px solid var(--primary)',
                        borderRadius: '16px 16px 0 0',
                        padding: '0 0 2rem 0'
                    }}>
                        {/* Drag Handle */}
                        <div
                            onClick={() => setWeekDrawer(null)}
                            style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px 0', cursor: 'pointer' }}
                        >
                            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--card-border)' }} />
                        </div>

                        {/* Header */}
                        <div style={{ textAlign: 'center', padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--card-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                                    {weekDrawer.programName || 'Training Program'}
                                </h2>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', margin: '4px 0 0 0' }}>
                                {weekDrawer.startDate || `Week ${weekDrawer.weekNum}`}
                            </p>
                        </div>

                        {/* Sessions by Day */}
                        <div style={{ padding: '1rem' }}>
                            {weekDrawer.sessions
                                .sort((a: any, b: any) => (a.day || 1) - (b.day || 1))
                                .map((sess: any) => {
                                    const dayName = sess.name || DAY_NAMES[((sess.day || 1) - 1) % 7] || `Day ${sess.day}`;
                                    return (
                                        <div key={sess.day} style={{ marginBottom: '1.25rem' }}>
                                            {/* Day Label */}
                                            <div style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                                color: 'var(--secondary-foreground)',
                                                marginBottom: '0.5rem'
                                            }}>
                                                {dayName}
                                            </div>

                                            {/* Exercise Cards */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {(sess.exercises || []).map((ex: any, exIdx: number) => {
                                                    const category = ex.category || getExerciseCategory(ex.name);
                                                    const color = CATEGORY_COLORS[category] || '#94A3B8';
                                                    const setsSummary = formatSetsSummary(ex.sets);
                                                    const targetSessionId = `${weekDrawer.programId}_w${weekDrawer.weekNum}_d${sess.day}`;

                                                    return (
                                                        <div
                                                            key={ex.id || exIdx}
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
                                                                padding: '0.75rem 1rem',
                                                                background: 'var(--card-bg)',
                                                                border: `1px solid ${color}30`,
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.15s ease'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontSize: '0.95rem',
                                                                    fontWeight: 600,
                                                                    color: color,
                                                                    marginBottom: '2px'
                                                                }}>
                                                                    {ex.name}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '0.8rem',
                                                                    color: 'var(--secondary-foreground)',
                                                                    opacity: 0.8
                                                                }}>
                                                                    {setsSummary}
                                                                </div>
                                                            </div>
                                                            <span style={{
                                                                color: color,
                                                                fontSize: '1.2rem',
                                                                fontWeight: 700,
                                                                marginLeft: '0.75rem',
                                                                opacity: 0.7
                                                            }}>+</span>
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

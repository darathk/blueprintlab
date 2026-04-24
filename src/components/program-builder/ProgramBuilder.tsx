'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ExercisePicker from '@/components/program-builder/ExercisePicker';
import ImportProgram from '@/components/programs/ImportProgram';
import ProgramCalendarGrid from './ProgramCalendarGrid';
import { calculateStress } from '@/lib/stress-index';
import { getExerciseCategory } from '@/lib/exercise-db';
import { StickyNote, Pin, Calendar as CalendarIcon, X, Trash2, Copy, CalendarPlus, BookOpen, LayoutGrid } from 'lucide-react';

const StressMatrix = dynamic(() => import('@/components/program-builder/StressMatrix'), {
    loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading stress charts...</div>
});

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

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

// Snap a date string to the preceding Sunday (or same day if already Sunday)
// This ensures program weeks align with the calendar's Sun-Sat grid.
const snapToSunday = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - date.getDay());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Exercise Component
const BuilderExerciseCard = ({ exercise, onUpdate, onRemove, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const addSet = () => {
        const newSets = [...exercise.sets, {
            id: generateId(),
            reps: '5',
            rpe: '7',
            percent: '',
            weight: ''
        }];
        onUpdate('sets', newSets);
    };

    const updateSet = (index, field, value) => {
        const newSets = [...exercise.sets];
        newSets[index][field] = value;
        onUpdate('sets', newSets);
    };

    const removeSet = (index) => {
        const newSets = exercise.sets.filter((_, i) => i !== index);
        onUpdate('sets', newSets);
    };

    const copyPreviousSet = (index) => {
        if (index === 0) return;
        const prev = exercise.sets[index - 1];
        const newSets = [...exercise.sets];
        newSets[index] = { ...newSets[index], reps: prev.reps, rpe: prev.rpe, percent: prev.percent };
        onUpdate('sets', newSets);
    };

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            style={{
                background: 'var(--card-bg)',
                border: isDragOver ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                transition: 'border 0.15s, opacity 0.15s',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'grab'
                }}
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', color: 'var(--secondary-foreground)', cursor: 'grab', flexShrink: 0
                    }} title="Drag to reorder">
                        ⠿
                    </div>
                    <div style={{
                        width: '16px', height: '16px', border: '1px solid var(--foreground)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                    }}>
                        {isCollapsed ? '+' : '-'}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{exercise.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginLeft: '1rem' }}>
                        {exercise.sets.length} Sets
                    </span>
                </div>
                <button
                    type="button"
                    title={`Delete ${exercise.name}`}
                    aria-label={`Delete ${exercise.name}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${exercise.name}" from this session?`)) {
                            onRemove();
                        }
                    }}
                    style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: 'var(--error, #ef4444)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.8)';
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    }}
                >
                    <Trash2 size={12} />
                    Delete
                </button>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 70px 70px 1fr 70px 30px', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--secondary-foreground)', textAlign: 'center' }}>
                        <div>Set</div>
                        <div>Weight</div>
                        <div>Reps</div>
                        <div>RPE</div>
                        <div>% / Notes</div>
                        <div title="Central / Total Stress">Stress</div>
                        <div></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {exercise.sets.map((set, i) => {
                            const { total, central } = calculateStress(set.reps, set.rpe);
                            return (
                                <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 70px 70px 1fr 70px 30px', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>{i + 1}</div>
                                    <input
                                        className="input"
                                        placeholder="lbs/kg"
                                        value={set.weight || ''}
                                        onChange={e => updateSet(i, 'weight', e.target.value)}
                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                    />
                                    <input
                                        className="input"
                                        value={set.reps}
                                        onChange={e => updateSet(i, 'reps', e.target.value)}
                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                    />
                                    <input
                                        className="input"
                                        value={set.rpe}
                                        onChange={e => updateSet(i, 'rpe', e.target.value)}
                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                    />
                                    <input
                                        className="input"
                                        placeholder="Notes"
                                        value={set.notes || ''}
                                        onChange={e => updateSet(i, 'notes', e.target.value)}
                                        style={{ padding: '4px', fontSize: '0.85rem' }}
                                    />
                                    <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                                        {central.toFixed(1)} / {total.toFixed(1)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                        {i > 0 && (
                                            <button
                                                title="Copy Previous"
                                                onClick={() => copyPreviousSet(i)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                                            >
                                                📄
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeSet(i)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0 }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={addSet}
                        style={{ marginTop: '1rem', background: 'transparent', border: '1px dashed var(--card-border)', width: '100%', padding: '0.5rem', borderRadius: '4px', color: 'var(--secondary-foreground)', cursor: 'pointer' }}
                    >
                        + Add Set
                    </button>

                    <textarea
                        className="input"
                        placeholder="Exercise Notes..."
                        value={exercise.notes || ''}
                        onChange={e => onUpdate('notes', e.target.value)}
                        style={{ width: '100%', marginTop: '1rem', minHeight: '60px', fontSize: '0.9rem' }}
                    />
                </div>
            )}
        </div>
    );
};



export default function ProgramBuilder({ athleteId, initialData = null, athletes = [], initialExercises = null, athleteLiftTargets = null, athleteTrainingSchedule = null, athleteName = '', existingPrograms = [], initialCoachNotes = null }: { athleteId?: string, initialData?: any, athletes?: any[], initialExercises?: any, athleteLiftTargets?: any, athleteTrainingSchedule?: string | null, athleteName?: string, existingPrograms?: any[], initialCoachNotes?: any[] | null }) {
    const router = useRouter();
    const [programName, setProgramName] = useState('');
    const [startDate, setStartDate] = useState(() => snapToSunday(new Date().toISOString().split('T')[0]));
    // State for selected athlete in assigning mode
    const [selectedAthleteId, setSelectedAthleteId] = useState(athleteId || '');

    // Lift targets state (only used when building from athlete dashboard)
    const DEFAULT_LIFTS = ['Squat', 'Bench', 'Deadlift'];
    const [liftTargets, setLiftTargets] = useState<Record<string, { timeToPeak: string; stressTarget: string }>>(() => {
        if (athleteLiftTargets && typeof athleteLiftTargets === 'object') {
            return athleteLiftTargets;
        }
        const defaults: Record<string, { timeToPeak: string; stressTarget: string }> = {};
        DEFAULT_LIFTS.forEach(lift => { defaults[lift] = { timeToPeak: '', stressTarget: '' }; });
        return defaults;
    });
    const [liftTargetsExpanded, setLiftTargetsExpanded] = useState(true);
    const [trainingSchedule, setTrainingSchedule] = useState(athleteTrainingSchedule || '');
    const [savingTargets, setSavingTargets] = useState(false);
    const [targetsSaved, setTargetsSaved] = useState(false);

    const updateLiftTarget = (lift: string, field: 'timeToPeak' | 'stressTarget', value: string) => {
        setLiftTargets(prev => ({
            ...prev,
            [lift]: { ...prev[lift], [field]: value }
        }));
        setTargetsSaved(false);
    };

    const addCustomLift = () => {
        const name = prompt('Enter lift name:');
        if (name && name.trim() && !liftTargets[name.trim()]) {
            setLiftTargets(prev => ({ ...prev, [name.trim()]: { timeToPeak: '', stressTarget: '' } }));
        }
    };

    const removeCustomLift = (lift: string) => {
        if (DEFAULT_LIFTS.includes(lift)) return;
        setLiftTargets(prev => {
            const next = { ...prev };
            delete next[lift];
            return next;
        });
    };

    const saveLiftTargets = async () => {
        const targetAthleteId = selectedAthleteId || athleteId;
        if (!targetAthleteId) return;
        setSavingTargets(true);
        try {
            await fetch(`/api/athletes/${targetAthleteId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ liftTargets, trainingSchedule })
            });
            setTargetsSaved(true);
            setTimeout(() => setTargetsSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save lift targets:', err);
        } finally {
            setSavingTargets(false);
        }
    };

    const handleImport = (importedData: any) => {
        if (confirm('Importing will overwrite current program data. Continue?')) {
            if (importedData.name) setProgramName(importedData.name);

            const newWeeks = importedData.weeks.map((w: any) => ({
                id: generateId(),
                weekNumber: w.weekNumber,
                sessions: w.sessions.map((s: any) => ({
                    id: generateId(),
                    day: s.day,
                    name: s.name,
                    exercises: s.exercises.map((e: any) => {
                        // Generate sets based on CSV "Sets" column
                        const setCount = typeof e.sets === 'number' ? e.sets : 3;
                        const setArray = Array.from({ length: setCount }).map(() => ({
                            id: generateId(),
                            reps: e.reps || '5',
                            rpe: e.rpeTarget || '7',
                            weight: '',
                            notes: '' // Set notes could go here if CSV supported it
                        }));

                        return {
                            id: generateId(),
                            name: e.name,
                            notes: e.notes || '',
                            sets: setArray
                        };
                    })
                }))
            }));

            setWeeks(newWeeks);
        }
    };

    interface Exercise {
        id: string;
        name: string;
        sets: any[];
        reps?: string;
        rpeTarget?: number;
        notes?: string;
        category?: string;
        isPrimary?: boolean;
    }

    interface Session {
        id: string;
        day: number;
        name: string;
        exercises: Exercise[];
        scheduledDate?: string;
        warmupDrills?: string;
    }

    interface Week {
        id: string;
        weekNumber: number;
        sessions: Session[];
    }

    interface ProgramBuilderProps {
        initialData?: {
            id?: string;
            name: string;
            athleteId?: string;
            weeks: Week[];
            startDate?: string;
        };
        athleteId?: string;
        athletes?: any[];
    }

    // ... (rest of component state)

    const [weeks, setWeeks] = useState<Week[]>([{
        id: generateId(),
        weekNumber: 1,
        sessions: [{
            id: generateId(),
            day: 1,
            name: 'Session 1',
            exercises: [],
            scheduledDate: '',
            warmupDrills: ''
        }]
    }]);
    const [isSaving, setIsSaving] = useState(false);
    // useTransition tracks the in-flight router.push so the "Saving..." button
    // stays disabled until the destination page has finished streaming —
    // otherwise the button flashes back and the user sees nothing happen.
    const [isNavigating, startNavigation] = useTransition();
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const savedProgramIdRef = useRef<string | null>(initialData?.id || null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadRef = useRef(true);
    const [resumedFromDraft, setResumedFromDraft] = useState<boolean>(initialData?.status === 'draft');

    // Load initial data if provided (Edit Mode)
    useEffect(() => {
        if (initialData) {
            setProgramName(initialData.name || '');
            const rawStartDate = initialData.startDate || new Date().toISOString().split('T')[0];
            const snappedStartDate = snapToSunday(rawStartDate);
            setStartDate(snappedStartDate);
            if (initialData.weeks && initialData.weeks.length > 0) {
                // Sanitize weeks to ensure IDs and structure exist (handles legacy data)
                const sanitizedWeeks = initialData.weeks.map(w => ({
                    ...w,
                    id: w.id || generateId(),
                    sessions: (w.sessions || []).map(s => ({
                        ...s,
                        id: s.id || generateId(),
                        exercises: (s.exercises || []).map(e => {
                            let sets = [];
                            if (Array.isArray(e.sets)) {
                                sets = e.sets.map(set => ({ ...set, id: set.id || generateId() }));
                            } else {
                                // Legacy: convert number to array
                                const count = typeof e.sets === 'number' ? e.sets : 3;
                                sets = Array.from({ length: count }).map(() => ({
                                    id: generateId(),
                                    reps: e.reps || '',
                                    rpe: e.rpeTarget || '',
                                    weight: ''
                                }));
                            }
                            // Correct category from exercise DB (custom exercises override heuristic)
                            const dbEntry = initialExercises?.[e.name];
                            const category = dbEntry?.category || e.category || getExerciseCategory(e.name || '');
                            return { ...e, id: e.id || generateId(), sets, category };
                        })
                    }))
                }));

                // If startDate was snapped to Sunday, rebucket sessions to align with calendar weeks
                if (rawStartDate !== snappedStartDate) {
                    const [oldY, oldM, oldD] = rawStartDate.split('-').map(Number);
                    const oldStart = new Date(oldY, oldM - 1, oldD);
                    oldStart.setHours(0, 0, 0, 0);
                    const [newY, newM, newD] = snappedStartDate.split('-').map(Number);
                    const newStart = new Date(newY, newM - 1, newD);
                    newStart.setHours(0, 0, 0, 0);

                    const allSessions: any[] = [];
                    sanitizedWeeks.forEach(w => {
                        w.sessions.forEach(s => {
                            const actualDate = new Date(oldStart);
                            actualDate.setDate(actualDate.getDate() + (w.weekNumber - 1) * 7 + ((s.day || 1) - 1));
                            const diffTime = actualDate.getTime() - newStart.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays >= 0) {
                                allSessions.push({ ...s, day: (diffDays % 7) + 1, _tempWeekNum: Math.floor(diffDays / 7) + 1 });
                            }
                        });
                    });

                    const reorganizedWeeks: any[][] = [];
                    allSessions.forEach(s => {
                        const wn = s._tempWeekNum;
                        if (!reorganizedWeeks[wn]) reorganizedWeeks[wn] = [];
                        const { _tempWeekNum, ...cleanSession } = s;
                        reorganizedWeeks[wn].push(cleanSession);
                    });
                    const maxWeek = allSessions.reduce((max, s) => s._tempWeekNum > max ? s._tempWeekNum : max, 0);
                    const finalWeeks: any[] = [];
                    for (let i = 1; i <= maxWeek; i++) {
                        finalWeeks.push({ id: generateId(), weekNumber: i, sessions: reorganizedWeeks[i] || [] });
                    }
                    if (finalWeeks.length === 0) {
                        finalWeeks.push({ id: generateId(), weekNumber: 1, sessions: [] });
                    }
                    setWeeks(finalWeeks);
                } else {
                    setWeeks(sanitizedWeeks);
                }
            }
            // Reset initialLoadRef so the state changes from loading don't trigger auto-save
            initialLoadRef.current = true;
        }
    }, [initialData]);

    // Track selected session for "Click to Add"
    const [activeLocation, setActiveLocation] = useState({ w: 0, s: 0 });

    // Collapse/expand state for weeks and sessions
    const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
    const [collapsedSessions, setCollapsedSessions] = useState<Record<string, boolean>>({});

    // Duplicate-to-date modal state: stores source {weekIndex, sessionIndex} or null
    const [duplicateSource, setDuplicateSource] = useState<{ weekIndex: number; sessionIndex: number } | null>(null);
    const [duplicateTargetDate, setDuplicateTargetDate] = useState('');

    // Week overview drawer
    const [weekOverviewIndex, setWeekOverviewIndex] = useState<number | null>(null);

    // Coach Notes panel
    const [notesOpen, setNotesOpen] = useState(false);
    const [coachNotes, setCoachNotes] = useState<any[]>(initialCoachNotes || []);
    const [notesLoading, setNotesLoading] = useState(false);
    const notesFetchedRef = useRef<boolean>(!!initialCoachNotes);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [newNoteCategory, setNewNoteCategory] = useState('general');
    const [notesSaving, setNotesSaving] = useState(false);

    const NOTE_CATEGORIES = [
        { value: 'general', label: 'General', color: 'var(--secondary-foreground)' },
        { value: 'injury', label: 'Injury', color: '#ef4444' },
        { value: 'cues', label: 'Cues', color: '#f59e0b' },
        { value: 'preferences', label: 'Prefs', color: '#a855f7' },
    ];

    const fetchNotes = async (showSpinner: boolean) => {
        if (!athleteId) return;
        if (showSpinner) setNotesLoading(true);
        try {
            const r = await fetch(`/api/coach-notes?athleteId=${athleteId}`);
            if (r.ok) setCoachNotes(await r.json());
        } catch { /* ignore */ }
        notesFetchedRef.current = true;
        if (showSpinner) setNotesLoading(false);
    };

    useEffect(() => {
        if (notesOpen && athleteId && !notesFetchedRef.current) {
            fetchNotes(true);
        }
    }, [notesOpen, athleteId]);

    // Background prefetch on mount so the panel opens instantly the first time
    useEffect(() => {
        if (athleteId && !notesFetchedRef.current) {
            fetchNotes(false);
        }
    }, [athleteId]);

    const addNote = async () => {
        if (!newNoteContent.trim() || !athleteId) return;
        setNotesSaving(true);
        try {
            const r = await fetch('/api/coach-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, content: newNoteContent.trim(), category: newNoteCategory }),
            });
            if (r.ok) {
                const note = await r.json();
                setCoachNotes(prev => [note, ...prev]);
                setNewNoteContent('');
            }
        } catch { /* ignore */ }
        setNotesSaving(false);
    };

    const togglePinNote = async (note: any) => {
        try {
            const r = await fetch('/api/coach-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
            });
            if (r.ok) {
                setCoachNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
            }
        } catch { /* ignore */ }
    };

    const deleteNote = async (id: string) => {
        try {
            const r = await fetch(`/api/coach-notes?id=${id}`, { method: 'DELETE' });
            if (r.ok) setCoachNotes(prev => prev.filter(n => n.id !== id));
        } catch { /* ignore */ }
    };

    const fmtNoteDate = (s: string) => {
        const d = new Date(s), n = new Date();
        const diffMs = n.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const sortedNotes = [...coachNotes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Reference panel: read-only view of a ghost session from an existing program
    const [referenceSession, setReferenceSession] = useState<any | null>(null);

    const toggleWeek = (weekId: string) => {
        setCollapsedWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }));
    };

    const toggleSession = (sessionId: string) => {
        setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
    };

    const addWeek = () => {
        setWeeks([...weeks, {
            id: generateId(),
            weekNumber: weeks.length + 1,
            sessions: [{
                id: generateId(),
                day: 1,
                name: 'Session 1',
                exercises: [],
                scheduledDate: ''
            }]
        }]);
    };

    const removeWeek = (weekIndex: number) => {
        if (weeks.length <= 1) return; // Don't delete the last week
        if (!confirm('Delete this entire week and all its sessions?')) return;
        const newWeeks = weeks.filter((_, i) => i !== weekIndex).map((w, i) => ({
            ...w,
            weekNumber: i + 1
        }));
        setWeeks(newWeeks);
        setActiveLocation({ w: 0, s: 0 });
        setEditingSession(null);
    };

    const addSession = (weekIndex) => {
        const newWeeks = [...weeks];
        // Count total sessions across all weeks for sequential naming
        const totalSessions = newWeeks.reduce((sum, w) => sum + w.sessions.length, 0);
        newWeeks[weekIndex].sessions.push({
            id: generateId(),
            day: newWeeks[weekIndex].sessions.length + 1,
            name: `Session ${totalSessions + 1}`,
            exercises: [],
            scheduledDate: ''
        });
        setWeeks(newWeeks);
    };

    const duplicateSession = (weekIndex, sessionIndex) => {
        const newWeeks = [...weeks];
        const originalSession = newWeeks[weekIndex].sessions[sessionIndex];

        // Determine next available day slot in this week
        const newDay = newWeeks[weekIndex].sessions.length + 1;

        let newName = `${originalSession.name} (Copy)`;
        if (originalSession.name.startsWith('Session ')) {
            newName = `Session ${newDay}`;
        }

        // Clone session
        const newSession = {
            ...originalSession,
            id: generateId(),
            day: newDay,
            name: newName,
            // For session duplication, we don't automatically shift date unless we know context. 
            // Better to clear it or keep it same (user can edit). Let's clear to avoid conflict? 
            // Or keep it since they might want to just move it slightly. Let's keep it.
            // Actually, user asked for "auto layouts appropriate date" for WEEKS. 
            // For sessions, let's just clone.
            exercises: originalSession.exercises.map(e => ({
                ...e,
                id: generateId(),
                sets: (e.sets || []).map(s => ({ ...s, id: generateId() }))
            }))
        };

        newWeeks[weekIndex].sessions.push(newSession);
        setWeeks(newWeeks);
        showToast(`Duplicated "${originalSession.name}"`);
    };

    const duplicateSessionToDate = (sourceWeekIndex: number, sourceSessionIndex: number, targetDateStr: string) => {
        if (!targetDateStr || !startDate) return;

        const originalSession = weeks[sourceWeekIndex]?.sessions[sourceSessionIndex];
        if (!originalSession) return;

        // Calculate target week/day from the date
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const progStart = new Date(sY, sM - 1, sD);
        progStart.setHours(0, 0, 0, 0);

        const [tY, tM, tD] = targetDateStr.split('-').map(Number);
        const targetDate = new Date(tY, tM - 1, tD);
        targetDate.setHours(0, 0, 0, 0);

        const diffDays = Math.round((targetDate.getTime() - progStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            alert('Target date is before the program start date.');
            return;
        }

        const targetWeekNum = Math.floor(diffDays / 7) + 1;
        const targetDayNum = (diffDays % 7) + 1;

        const newWeeks = [...weeks];

        // Ensure target week exists
        let targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        if (targetWeekIndex === -1) {
            const maxWeek = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
            for (let i = maxWeek + 1; i <= targetWeekNum; i++) {
                if (!newWeeks.find(w => w.weekNumber === i)) {
                    newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
                }
            }
            newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
            targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        }

        // Check if target slot is occupied
        const existingIdx = newWeeks[targetWeekIndex].sessions.findIndex(s => s.day === targetDayNum);
        if (existingIdx !== -1) {
            if (!confirm('A session already exists on that date. Replace it?')) return;
            newWeeks[targetWeekIndex].sessions.splice(existingIdx, 1);
        }

        // Clone session with new IDs
        const clonedSession = {
            ...originalSession,
            id: generateId(),
            day: targetDayNum,
            name: originalSession.name,
            scheduledDate: targetDateStr,
            exercises: (originalSession.exercises || []).map(e => ({
                ...e,
                id: generateId(),
                sets: (e.sets || []).map(s => ({ ...s, id: generateId() }))
            }))
        };

        newWeeks[targetWeekIndex].sessions.push(clonedSession);
        setWeeks(newWeeks);
        setDuplicateSource(null);
        setDuplicateTargetDate('');
        showToast(`Duplicated to ${targetDateStr}`);
    };

    const duplicateSessionToNextWeek = (weekNum: number, dayNum: number) => {
        const newWeeks = [...weeks];
        const sourceWeekIdx = newWeeks.findIndex(w => w.weekNumber === weekNum);
        if (sourceWeekIdx === -1) return;
        const sourceSession = newWeeks[sourceWeekIdx].sessions.find(s => s.day === dayNum);
        if (!sourceSession) return;

        const targetWeekNum = weekNum + 1;
        const targetDayNum = dayNum;

        let targetWeekIdx = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        if (targetWeekIdx === -1) {
            const maxWeek = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
            for (let i = maxWeek + 1; i <= targetWeekNum; i++) {
                if (!newWeeks.find(w => w.weekNumber === i)) {
                    newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
                }
            }
            newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
            targetWeekIdx = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        }

        const existingIdx = newWeeks[targetWeekIdx].sessions.findIndex(s => s.day === targetDayNum);
        if (existingIdx !== -1) {
            if (!confirm('A session already exists next week on this day. Replace it?')) return;
            newWeeks[targetWeekIdx].sessions.splice(existingIdx, 1);
        }

        const clonedSession = {
            ...sourceSession,
            id: generateId(),
            day: targetDayNum,
            name: sourceSession.name,
            scheduledDate: sourceSession.scheduledDate ? (() => {
                 const d = new Date(sourceSession.scheduledDate);
                 d.setDate(d.getDate() + 7);
                 return d.toISOString().split('T')[0];
            })() : '',
            exercises: (sourceSession.exercises || []).map(e => ({
                ...e,
                id: generateId(),
                sets: (e.sets || []).map(s => ({ ...s, id: generateId() }))
            }))
        };

        newWeeks[targetWeekIdx].sessions.push(clonedSession);
        setWeeks(newWeeks);
        showToast(`Duplicated session to Week ${targetWeekNum}`);
    };

    // Check whether a given program-week number is free of sessions from other
    // already-assigned programs. This prevents duplicates from landing on dates
    // that already have training scheduled.
    const isWeekOccupiedByExisting = (weekNum: number): boolean => {
        if (!startDate || !existingPrograms?.length) return false;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const progStart = new Date(sy, sm - 1, sd);
        progStart.setHours(0, 0, 0, 0);

        for (let d = 0; d < 7; d++) {
            const date = new Date(progStart);
            date.setDate(date.getDate() + (weekNum - 1) * 7 + d);
            const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            for (const prog of existingPrograms) {
                if (!prog.startDate) continue;
                const ps = String(prog.startDate).split('T')[0];
                const [py, pm, pd] = ps.split('-').map(Number);
                const pStart = new Date(py, pm - 1, pd);
                pStart.setHours(0, 0, 0, 0);
                const parsedWeeks = Array.isArray(prog.weeks) ? prog.weeks : [];
                for (const w of parsedWeeks) {
                    const wn = w.weekNumber || 1;
                    for (const s of (w.sessions || [])) {
                        const sDay = s.day || 1;
                        const sDate = new Date(pStart);
                        sDate.setDate(sDate.getDate() + (wn - 1) * 7 + (sDay - 1));
                        const sDs = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
                        if (sDs === ds) return true;
                    }
                }
            }
        }
        return false;
    };

    const findNextEmptyWeek = (afterWeekNum: number): number => {
        let candidate = afterWeekNum + 1;
        const maxSearch = candidate + 52;
        while (candidate < maxSearch) {
            const existingWeek = weeks.find(w => w.weekNumber === candidate);
            const currentHasSessions = existingWeek && existingWeek.sessions.length > 0;
            const externallyOccupied = isWeekOccupiedByExisting(candidate);
            if (!currentHasSessions && !externallyOccupied) return candidate;
            candidate++;
        }
        return afterWeekNum + 1;
    };

    const duplicateWeekToNextWeek = (weekNum: number) => {
        const newWeeks = [...weeks];
        const sourceWeekIdx = newWeeks.findIndex(w => w.weekNumber === weekNum);
        if (sourceWeekIdx === -1) return;
        const sourceWeek = newWeeks[sourceWeekIdx];

        if (sourceWeek.sessions.length === 0) return;

        const targetWeekNum = findNextEmptyWeek(weekNum);

        let targetWeekIdx = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        if (targetWeekIdx === -1) {
            const maxWeek = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
            for (let i = maxWeek + 1; i <= targetWeekNum; i++) {
                if (!newWeeks.find(w => w.weekNumber === i)) {
                    newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
                }
            }
            newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
            targetWeekIdx = newWeeks.findIndex(w => w.weekNumber === targetWeekNum);
        }

        const weekOffset = targetWeekNum - weekNum;
        const clonedSessions = sourceWeek.sessions.map(sourceSession => ({
            ...sourceSession,
            id: generateId(),
            scheduledDate: sourceSession.scheduledDate ? (() => {
                 const d = new Date(sourceSession.scheduledDate);
                 d.setDate(d.getDate() + weekOffset * 7);
                 return d.toISOString().split('T')[0];
            })() : '',
            exercises: (sourceSession.exercises || []).map(e => ({
                ...e,
                id: generateId(),
                sets: (e.sets || []).map(s => ({ ...s, id: generateId() }))
            }))
        }));

        newWeeks[targetWeekIdx].sessions.push(...clonedSessions);
        setWeeks(newWeeks);
        showToast(`Duplicated Week ${weekNum} → Week ${targetWeekNum}`);
    };


    const removeSession = (weekIndex, sessionIndex) => {
        if (!confirm('Are you sure you want to delete this session?')) return;
        const newWeeks = [...weeks];
        newWeeks[weekIndex].sessions.splice(sessionIndex, 1);

        // Filter out empty weeks and re-index
        const cleanedWeeks = newWeeks.filter(w => w.sessions.length > 0).map((w, i) => ({
            ...w,
            weekNumber: i + 1
        }));

        setWeeks(cleanedWeeks);

        // Clear active/editing state if needed (simple reset if structure changes)
        if (cleanedWeeks.length !== weeks.length) {
            setActiveLocation({ w: 0, s: 0 });
            setEditingSession(null);
        } else if (activeLocation.w === weekIndex && activeLocation.s === sessionIndex) {
            setActiveLocation({ w: 0, s: 0 });
            if (editingSession && editingSession.w === weekIndex && editingSession.s === sessionIndex) {
                setEditingSession(null);
            }
        }
    };



    const duplicateWeek = (weekIndex) => {
        const newWeeks = [...weeks];
        const originalWeek = newWeeks[weekIndex];
        const targetWeekNum = findNextEmptyWeek(originalWeek.weekNumber);
        const weekOffset = targetWeekNum - originalWeek.weekNumber;

        const newWeek = {
            ...originalWeek,
            id: generateId(),
            weekNumber: targetWeekNum,
            sessions: originalWeek.sessions.map(s => {
                let newDate = '';
                if (s.scheduledDate) {
                    const date = new Date(s.scheduledDate);
                    date.setDate(date.getDate() + weekOffset * 7);
                    newDate = date.toISOString().split('T')[0];
                }

                return {
                    ...s,
                    id: generateId(),
                    scheduledDate: newDate,
                    exercises: (s.exercises || []).map(e => ({
                        ...e,
                        id: generateId(),
                        sets: (e.sets || []).map(set => ({ ...set, id: generateId() }))
                    }))
                };
            })
        };

        // Fill in any gap weeks so the calendar stays contiguous
        const maxWeek = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
        for (let i = maxWeek + 1; i < targetWeekNum; i++) {
            if (!newWeeks.find(w => w.weekNumber === i)) {
                newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
            }
        }
        newWeeks.push(newWeek);
        newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        setWeeks(newWeeks);
        showToast(`Duplicated Week ${originalWeek.weekNumber} → Week ${targetWeekNum}`);
    };

    const addExerciseToActiveSession = (exerciseOrName) => {
        const loc = editingSession ?? activeLocation;
        const { w, s } = loc;
        if (w >= weeks.length || s >= weeks[w].sessions.length) return;

        // Accept either an object { name, category, ... } or a plain string
        const exerciseName = typeof exerciseOrName === 'string' ? exerciseOrName : exerciseOrName.name;
        const exerciseCategory = (typeof exerciseOrName === 'object' && exerciseOrName.category)
            ? exerciseOrName.category
            : getExerciseCategory(exerciseName);

        const newWeeks = [...weeks];
        // Default: 3 sets
        const sets = [
            { id: generateId(), reps: '5', rpe: '6', weight: '' },
            { id: generateId(), reps: '5', rpe: '7', weight: '' },
            { id: generateId(), reps: '5', rpe: '8', weight: '' }
        ];

        newWeeks[w].sessions[s].exercises.push({
            id: generateId(),
            name: exerciseName,
            category: exerciseCategory,
            sets: sets,
            notes: ''
        });
        setWeeks(newWeeks);
    };

    const updateExercise = (weekIndex, sessionIndex, exerciseIndex, field, value) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].sessions[sessionIndex].exercises[exerciseIndex][field] = value;
        setWeeks(newWeeks);
    };

    // Immutable set-level update used by the Progression Matrix overlay so every
    // edited cell re-renders without mutating the shared weeks reference.
    const updateProgressionSet = (weekIndex: number, sessionIndex: number, exerciseIndex: number, setIndex: number, field: string, value: string) => {
        setWeeks(prev => prev.map((w, wi) =>
            wi !== weekIndex ? w : {
                ...w,
                sessions: w.sessions.map((s, si) =>
                    si !== sessionIndex ? s : {
                        ...s,
                        exercises: s.exercises.map((ex, ei) =>
                            ei !== exerciseIndex ? ex : {
                                ...ex,
                                sets: ex.sets.map((set: any, li: number) =>
                                    li !== setIndex ? set : { ...set, [field]: value }
                                ),
                            }
                        ),
                    }
                ),
            }
        ));
    };

    const removeExercise = (weekIndex, sessionIndex, exerciseIndex) => {
        // Immutable update so memoized children (BuilderExerciseCard) re-render
        // correctly and StrictMode double-invocation can't splice the same array twice.
        setWeeks(prev => prev.map((w, wi) =>
            wi !== weekIndex ? w : {
                ...w,
                sessions: w.sessions.map((s, si) =>
                    si !== sessionIndex ? s : {
                        ...s,
                        exercises: s.exercises.filter((_, ei) => ei !== exerciseIndex),
                    }
                ),
            }
        ));
    };

    // --- Exercise Drag & Drop ---
    const [dragExercise, setDragExercise] = useState<{ w: number, s: number, e: number } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ w: number, s: number, e: number } | null>(null);

    const handleExerciseDragStart = (w: number, s: number, e: number) => {
        setDragExercise({ w, s, e });
    };

    const handleExerciseDragOver = (ev: React.DragEvent, w: number, s: number, e: number) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!dragExercise) return;
        setDropTarget({ w, s, e });
    };

    const handleExerciseDrop = (ev: React.DragEvent, targetW: number, targetS: number, targetE: number) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!dragExercise) return;

        const { w: srcW, s: srcS, e: srcE } = dragExercise;
        if (srcW === targetW && srcS === targetS && srcE === targetE) {
            setDragExercise(null);
            setDropTarget(null);
            return;
        }

        const newWeeks = [...weeks];
        const srcExercises = newWeeks[srcW].sessions[srcS].exercises;
        const [moved] = srcExercises.splice(srcE, 1);

        if (srcW === targetW && srcS === targetS) {
            // Reorder within same session
            const adjustedTarget = targetE > srcE ? targetE : targetE;
            srcExercises.splice(adjustedTarget, 0, moved);
        } else {
            // Move between sessions
            newWeeks[targetW].sessions[targetS].exercises.splice(targetE, 0, moved);
        }

        setWeeks(newWeeks);
        setDragExercise(null);
        setDropTarget(null);
    };

    const handleExerciseDropOnEmpty = (ev: React.DragEvent, w: number, s: number) => {
        ev.preventDefault();
        if (!dragExercise) return;

        const { w: srcW, s: srcS, e: srcE } = dragExercise;
        const newWeeks = [...weeks];
        const [moved] = newWeeks[srcW].sessions[srcS].exercises.splice(srcE, 1);
        newWeeks[w].sessions[s].exercises.push(moved);

        setWeeks(newWeeks);
        setDragExercise(null);
        setDropTarget(null);
    };

    const handleExerciseDragEnd = () => {
        setDragExercise(null);
        setDropTarget(null);
    };

    // --- Clipboard System ---
    const [clipboard, setClipboard] = useState<{ type: 'week' | 'session', data: any } | null>(null);

    const copyWeek = (weekIndex) => {
        const weekData = weeks[weekIndex];
        setClipboard({ type: 'week', data: weekData });
        showToast(`Copied Week ${weekIndex + 1} to clipboard`);
    };

    const pasteWeek = (targetWeekIndex) => {
        if (!clipboard || clipboard.type !== 'week') return;

        const sourceWeek = clipboard.data;
        const newWeeks = [...weeks];

        // Deep clone sessions from source
        const clonedSessions = sourceWeek.sessions.map(s => ({
            ...s,
            id: generateId(), // New ID
            scheduledDate: '', // Clear date to avoid conflicts/logic issues
            exercises: s.exercises.map(e => ({
                ...e,
                id: generateId(),
                sets: e.sets.map(set => ({ ...set, id: generateId() }))
            }))
        }));

        // Replace target week's sessions
        newWeeks[targetWeekIndex].sessions = clonedSessions;
        setWeeks(newWeeks);
        showToast(`Pasted week into Week ${targetWeekIndex + 1}`);
    };

    const buildPayload = useCallback(() => {
        // Always snap startDate to Sunday to ensure week alignment
        const snappedStart = snapToSunday(startDate);
        const start = new Date(snappedStart);
        const durationDays = weeks.length * 7;
        start.setDate(start.getDate() + durationDays);
        const endDate = start.toISOString().split('T')[0];
        return {
            id: savedProgramIdRef.current || undefined,
            name: programName || 'Untitled Program',
            athleteId: selectedAthleteId,
            startDate: snappedStart,
            endDate,
            weeks,
            status: undefined as string | undefined
        };
    }, [programName, startDate, weeks, selectedAthleteId]);

    const performAutoSave = useCallback(async () => {
        if (!selectedAthleteId) return; // Can't save without an athlete
        setAutoSaveStatus('saving');
        try {
            const payload = buildPayload();
            // Auto-save as draft so it doesn't deactivate other programs
            if (!savedProgramIdRef.current) {
                payload.status = 'draft';
            }
            const method = savedProgramIdRef.current ? 'PUT' : 'POST';
            const res = await fetch('/api/programs', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                if (!savedProgramIdRef.current && data.id) {
                    savedProgramIdRef.current = data.id;
                }
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
            } else {
                setAutoSaveStatus('error');
            }
        } catch (e) {
            console.error('Auto-save failed:', e);
            setAutoSaveStatus('error');
        }
    }, [buildPayload, selectedAthleteId]);

    // Debounced auto-save: trigger 1s after any change. Kept short so an
    // accidental navigation away loses at most ~1s of work rather than several
    // seconds of edits.
    useEffect(() => {
        // Skip auto-save on initial load
        if (initialLoadRef.current) {
            initialLoadRef.current = false;
            return;
        }
        if (!selectedAthleteId) return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        setAutoSaveStatus('idle');
        autoSaveTimerRef.current = setTimeout(() => {
            performAutoSave();
            autoSaveTimerRef.current = null;
        }, 1000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [weeks, programName, startDate, selectedAthleteId, performAutoSave]);

    // Flush any pending debounced save on page unload or component unmount.
    // Without this, a coach who closes the tab or navigates away within the
    // debounce window loses their most recent edits. Using fetch with
    // keepalive:true lets the request complete even after the page is gone.
    const buildPayloadRef = useRef(buildPayload);
    useEffect(() => { buildPayloadRef.current = buildPayload; });

    useEffect(() => {
        const flushPendingSave = () => {
            if (!autoSaveTimerRef.current) return;
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            const payload = buildPayloadRef.current();
            if (!payload.athleteId) return;
            if (!savedProgramIdRef.current) {
                (payload as any).status = 'draft';
            }
            const method = savedProgramIdRef.current ? 'PUT' : 'POST';
            try {
                fetch('/api/programs', {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true,
                }).catch(() => {});
            } catch {
                // ignore
            }
        };

        window.addEventListener('beforeunload', flushPendingSave);
        return () => {
            window.removeEventListener('beforeunload', flushPendingSave);
            flushPendingSave();
        };
    }, []);

    const handleSave = async () => {
        // Cancel any pending auto-save
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        setIsSaving(true);
        try {
            const payload = { ...buildPayload(), status: 'active' };
            const method = savedProgramIdRef.current ? 'PUT' : 'POST';

            const res = await fetch('/api/programs', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // POST/PUT call revalidatePath() server-side, so the destination
                // already has fresh data — no router.refresh() needed. Wrapping
                // push() in startNavigation keeps isNavigating true until the
                // athlete page finishes streaming, so the button stays in its
                // disabled "Saving…" state instead of flashing back.
                startNavigation(() => {
                    router.push(`/dashboard/athletes/${selectedAthleteId}`);
                });
                // Don't reset isSaving — the component is unmounting.
                return;
            }
            alert('Failed to save');
        } catch (e) {
            console.error(e);
            alert('Error');
        }
        // Only reach here on error — reset so user can retry.
        setIsSaving(false);
    };

    // ... (previous state)
    const [editingSession, setEditingSession] = useState<{ w: number, s: number } | null>(null);
    const [progressionSession, setProgressionSession] = useState<{ day: number, name: string } | null>(null);

    // ... (helpers)

    // Helper: get the Sunday that starts the week containing a given date
    const getSunday = (d: Date) => {
        const s = new Date(d);
        s.setDate(s.getDate() - s.getDay());
        s.setHours(0, 0, 0, 0);
        return s;
    };

    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /** Compute the date range label for a given program week, anchored to startDate */
    const weekDateRange = (weekNumber: number): string => {
        if (!startDate) return `Week ${weekNumber}`;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
        return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
    };

    const getShiftedWeeks = (newStartDateStr: string, currentWeeks: any[]) => {
        // Parse as LOCAL time to ensure consistency with Calendar Grid
        const [oldY, oldM, oldD] = startDate.split('-').map(Number);
        const oldStart = new Date(oldY, oldM - 1, oldD);
        oldStart.setHours(0, 0, 0, 0);

        // Snap new start date to Sunday to keep weeks aligned with calendar
        const snappedNewStart = snapToSunday(newStartDateStr);
        const [newY, newM, newD] = snappedNewStart.split('-').map(Number);
        const newStart = new Date(newY, newM - 1, newD);
        newStart.setHours(0, 0, 0, 0);

        // Flatten sessions: convert each to an actual date, then re-bucket using startDate-anchored weeks
        const allSessions: any[] = [];
        currentWeeks.forEach(w => {
            w.sessions.forEach(s => {
                // Compute actual date: oldStart + (weekNumber-1)*7 + (day-1)
                const actualDate = new Date(oldStart);
                actualDate.setDate(actualDate.getDate() + (w.weekNumber - 1) * 7 + (s.day - 1));

                // Compute new week/day relative to new start date
                const diffTime = actualDate.getTime() - newStart.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0) {
                    const newWeekNum = Math.floor(diffDays / 7) + 1;
                    const newDayNum = (diffDays % 7) + 1;

                    allSessions.push({
                        ...s,
                        day: newDayNum,
                        _tempWeekNum: newWeekNum
                    });
                }
            });
        });

        // Re-bucket
        const reorganizedWeeks: any[][] = [];
        allSessions.forEach(s => {
            const wn = s._tempWeekNum;
            if (!reorganizedWeeks[wn]) reorganizedWeeks[wn] = [];

            // clean up temp prop
            const { _tempWeekNum, ...cleanSession } = s;
            reorganizedWeeks[wn].push(cleanSession);
        });

        const finalWeeks: any[] = [];
        const maxWeek = allSessions.reduce((max, s) => s._tempWeekNum > max ? s._tempWeekNum : max, 0);

        for (let i = 1; i <= maxWeek; i++) {
            finalWeeks.push({
                id: generateId(),
                weekNumber: i,
                sessions: reorganizedWeeks[i] || []
            });
        }

        if (finalWeeks.length === 0) {
            finalWeeks.push({ id: generateId(), weekNumber: 1, sessions: [] });
        }

        return finalWeeks;
    };

    // Kept for backward compatibility if used by click handler, but updated to use atomic logic
    const shiftProgramDates = (newStartDateStr: string) => {
        const finalWeeks = getShiftedWeeks(newStartDateStr, weeks);
        setStartDate(snapToSunday(newStartDateStr));
        // We must usually set weeks too if we use this standalone
        // But the previous implementation returned finalWeeks and expected caller to handle?
        // No, previous implementation returned finalWeeks but didn't setWeeks explicitly?
        // Wait, handleSelectDate called `currentWeeks = shiftProgramDates(...)`.
        // It relied on the return value.
        // It did NOT assume setWeeks was called.
        // BUT it did assume setStartDate WAS called.
        // So I should keep this behavior for handleSelectDate.
        return finalWeeks;
    };

    const handleSelectDate = (weekNum: number, dayNum: number, dateStr: string) => {
        let currentWeeks = weeks;

        // Check if date is before start date
        if (new Date(dateStr) < new Date(startDate)) {
            const snapped = snapToSunday(dateStr);
            if (confirm(`This date is before the current program start date (${startDate}). Do you want to move the start date to ${snapped}?`)) {
                currentWeeks = getShiftedWeeks(dateStr, weeks);
                setStartDate(snapped);
                // Recalculate weekNum/dayNum relative to snapped Sunday start
                const [dy, dm, dd] = dateStr.split('-').map(Number);
                const clickedDate = new Date(dy, dm - 1, dd);
                const [sy, sm, sd] = snapped.split('-').map(Number);
                const snappedDate = new Date(sy, sm - 1, sd);
                const diff = Math.round((clickedDate.getTime() - snappedDate.getTime()) / (1000 * 60 * 60 * 24));
                weekNum = Math.floor(diff / 7) + 1;
                dayNum = (diff % 7) + 1;
            } else {
                return;
            }
        }

        // Logic continues with currentWeeks...
        let newWeeks = [...currentWeeks];
        let weekIndex = newWeeks.findIndex(w => w.weekNumber === weekNum);

        if (weekIndex === -1) {
            const currentMaxWeek = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber || 0), 0);
            // Fill gaps
            for (let i = currentMaxWeek + 1; i <= weekNum; i++) {
                newWeeks.push({
                    id: generateId(),
                    weekNumber: i,
                    sessions: []
                });
            }
            // Re-find index
            weekIndex = newWeeks.findIndex(w => w.weekNumber === weekNum);
            // Safety check if still -1 (shouldn't happen unless logic error)
            if (weekIndex === -1) {
                // Force create one if something went wrong
                newWeeks.push({ id: generateId(), weekNumber: weekNum, sessions: [] });
                weekIndex = newWeeks.length - 1;
            }
        }

        const sessionIndex = newWeeks[weekIndex].sessions.findIndex(s => s.day === dayNum);

        if (sessionIndex === -1) {
            // Count total sessions across all weeks for sequential naming
            const totalSessions = newWeeks.reduce((sum, w) => sum + w.sessions.length, 0);
            newWeeks[weekIndex].sessions.push({
                id: generateId(),
                day: dayNum,
                name: `Session ${totalSessions + 1}`,
                exercises: [],
                scheduledDate: ''
            });
            setWeeks(newWeeks);
            setEditingSession({ w: weekIndex, s: newWeeks[weekIndex].sessions.length - 1 });
        } else {
            setEditingSession({ w: weekIndex, s: sessionIndex });
        }
    };

    const handleSessionMove = (fromW, fromD, toW, toD, toDateStr) => {
        let currentWeeks = weeks;
        let targetD = toD;
        let targetW = toW;

        // Capture the original session to move BEFORE any shifting
        const originalSourceWeek = weeks.find(w => w.weekNumber === fromW);
        const originalSession = originalSourceWeek?.sessions.find(s => s.day === fromD);

        if (!originalSession) {
            console.error("Could not find session to move at source", fromW, fromD);
            return;
        }

        let pendingStartDate = null;

        // Check for date shifting
        if (toDateStr && new Date(toDateStr) < new Date(startDate)) {
            const snapped = snapToSunday(toDateStr);
            if (confirm(`Move program start to ${snapped}?`)) {
                // Calculate shifted structure BUT DO NOT SET STATE YET
                currentWeeks = getShiftedWeeks(toDateStr, weeks);
                pendingStartDate = snapped;

                // Recalculate pointers using snapped start date
                const [oY, oM, oD] = startDate.split('-').map(Number);
                const oldStart = new Date(oY, oM - 1, oD);
                oldStart.setHours(0, 0, 0, 0);
                const [nY, nM, nD] = snapped.split('-').map(Number);
                const newStart = new Date(nY, nM - 1, nD);
                newStart.setHours(0, 0, 0, 0);

                // Compute actual date of the source session
                const sourceDate = new Date(oldStart);
                sourceDate.setDate(sourceDate.getDate() + (fromW - 1) * 7 + (fromD - 1));

                // Re-derive week/day relative to new start date
                const diffFromNew = Math.round((sourceDate.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));
                const newFromW = Math.floor(diffFromNew / 7) + 1;
                const newFromD = (diffFromNew % 7) + 1;

                fromD = newFromD;
                fromW = newFromW;

                // Recalculate target relative to snapped start
                const [tY, tM, tD] = toDateStr.split('-').map(Number);
                const targetDate = new Date(tY, tM - 1, tD);
                const targetDiff = Math.round((targetDate.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));
                targetW = Math.floor(targetDiff / 7) + 1;
                targetD = (targetDiff % 7) + 1;

            } else {
                return;
            }
        }

        if (fromW === targetW && fromD === targetD) {
            // Only update if we shifted
            if (currentWeeks !== weeks) {
                setWeeks(currentWeeks);
                if (pendingStartDate) setStartDate(pendingStartDate);
            }
            return;
        }

        let newWeeks = [...currentWeeks]; // logic continues with currentWeeks

        // Ensure target week exists
        let targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetW);
        if (targetWeekIndex === -1) {
            const max = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
            for (let i = max + 1; i <= targetW; i++) {
                if (!newWeeks.find(w => w.weekNumber === i)) {
                    newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
                }
            }
            newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
            targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetW);
        }

        // Find SOURCE in structure
        const sourceWeekIndex = newWeeks.findIndex(w => w.weekNumber === fromW);
        if (sourceWeekIndex === -1) {
            console.error("Source week not found", fromW, newWeeks);
            // Abort everything, do NOT set partial state
            return;
        }

        const sourceSessionIndex = newWeeks[sourceWeekIndex].sessions.findIndex(s => s.day === fromD);
        if (sourceSessionIndex === -1) {
            console.error("Source session not found", fromD, newWeeks[sourceWeekIndex]);
            // Abort
            return;
        }

        // Perform Move
        const [sessionToMove] = newWeeks[sourceWeekIndex].sessions.splice(sourceSessionIndex, 1);

        // Check TARGET occupancy
        const targetSessionIndex = newWeeks[targetWeekIndex].sessions.findIndex(s => s.day === targetD);

        if (targetSessionIndex !== -1) {
            // Swap
            const [targetSession] = newWeeks[targetWeekIndex].sessions.splice(targetSessionIndex, 1);
            targetSession.day = fromD;
            targetSession.scheduledDate = '';
            newWeeks[sourceWeekIndex].sessions.push(targetSession);
            showToast(`Swapped sessions`);
        }

        sessionToMove.day = targetD;
        sessionToMove.scheduledDate = '';
        newWeeks[targetWeekIndex].sessions.push(sessionToMove);

        // Clean up empty source week if desired?
        // Logic currently allows empty weeks.

        // Final atomic update
        setWeeks(newWeeks);
        if (pendingStartDate) {
            setStartDate(pendingStartDate);
        }
    };

    // Lightweight toast notification for copy/duplicate/move operations
    const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
    const showToast = (msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message: msg, key: Date.now() });
        toastTimerRef.current = setTimeout(() => setToast(null), 2000);
    };

    const closeEditor = () => {
        if (editingSession) {
            const { w, s } = editingSession;
            // Check if session exists and is empty
            if (weeks[w] && weeks[w].sessions[s]) {
                const session = weeks[w].sessions[s];
                if (session.exercises.length === 0) {
                    // Auto-remove empty session to prevent "ghost" sessions from accidental clicks
                    const newWeeks = [...weeks];
                    newWeeks[w].sessions.splice(s, 1);
                    setWeeks(newWeeks);
                }
            }
        }
        setEditingSession(null);
    };

    return (
        <div className="program-builder-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: '1.5rem', height: 'calc(100vh - 100px)', paddingTop: '1.5rem', paddingLeft: notesOpen && athleteId ? 360 : 0, transition: 'padding-left 0.25s ease' }}>

            {/* LEFTSIDE BAR: Exercise Picker + Stress Index */}
            <div className="program-builder-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <ExercisePicker initialExercises={initialExercises} onAdd={addExerciseToActiveSession} onDragStart={() => { }} />
                </div>
                {/* Lift Targets Panel - only in athlete-specific program builder */}
                {athleteId && (
                    <div style={{
                        overflow: 'auto',
                        margin: '0.5rem',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 'var(--radius)',
                        flexShrink: 0,
                    }}>
                        <div
                            onClick={() => setLiftTargetsExpanded(!liftTargetsExpanded)}
                            style={{
                                padding: '0.5rem 0.65rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--primary)',
                                borderBottom: liftTargetsExpanded ? '1px solid var(--card-border)' : 'none',
                                background: 'rgba(6, 182, 212, 0.05)',
                                borderRadius: liftTargetsExpanded ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span>Lift Targets{athleteName ? ` — ${athleteName}` : ''}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{liftTargetsExpanded ? '▼' : '▶'}</span>
                        </div>
                        {liftTargetsExpanded && (
                            <div style={{ padding: '0.5rem' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Preferred Schedule</div>
                                    <input
                                        type="text"
                                        placeholder="e.g., M/W/F Evenings"
                                        value={trainingSchedule}
                                        onChange={e => { setTrainingSchedule(e.target.value); setTargetsSaved(false); }}
                                        style={{
                                            background: 'rgba(18, 18, 18, 0.6)',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '4px',
                                            color: 'var(--foreground)',
                                            fontSize: '0.75rem',
                                            padding: '6px 8px',
                                            width: '100%',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 20px', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lift</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Peak (wks)</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', textAlign: 'center' }}>Stress</div>
                                    <div></div>
                                </div>
                                {Object.entries(liftTargets).map(([lift, targets]) => (
                                    <div key={lift} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 65px 20px', gap: '4px', alignItems: 'center', marginBottom: '3px' }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: 'var(--foreground)',
                                            padding: '4px 6px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>{lift}</div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="52"
                                            placeholder="—"
                                            value={targets.timeToPeak}
                                            onChange={e => updateLiftTarget(lift, 'timeToPeak', e.target.value)}
                                            style={{
                                                background: 'rgba(18, 18, 18, 0.6)',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '4px',
                                                color: 'var(--foreground)',
                                                fontSize: '0.75rem',
                                                padding: '4px 6px',
                                                textAlign: 'center',
                                                width: '100%',
                                            }}
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="—"
                                            value={targets.stressTarget}
                                            onChange={e => updateLiftTarget(lift, 'stressTarget', e.target.value)}
                                            style={{
                                                background: 'rgba(18, 18, 18, 0.6)',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '4px',
                                                color: 'var(--foreground)',
                                                fontSize: '0.75rem',
                                                padding: '4px 6px',
                                                textAlign: 'center',
                                                width: '100%',
                                            }}
                                        />
                                        <button
                                            onClick={() => removeCustomLift(lift)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: DEFAULT_LIFTS.includes(lift) ? 'transparent' : 'var(--secondary-foreground)',
                                                cursor: DEFAULT_LIFTS.includes(lift) ? 'default' : 'pointer',
                                                fontSize: '0.7rem',
                                                padding: 0,
                                                pointerEvents: DEFAULT_LIFTS.includes(lift) ? 'none' : 'auto',
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                    <button
                                        onClick={addCustomLift}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px dashed var(--card-border)',
                                            borderRadius: '4px',
                                            color: 'var(--secondary-foreground)',
                                            cursor: 'pointer',
                                            fontSize: '0.65rem',
                                            padding: '4px 8px',
                                            fontWeight: 600,
                                        }}
                                    >
                                        + Add Lift
                                    </button>
                                    <button
                                        onClick={saveLiftTargets}
                                        disabled={savingTargets}
                                        style={{
                                            flex: 1,
                                            background: targetsSaved ? 'rgba(34, 197, 94, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                                            border: `1px solid ${targetsSaved ? 'rgba(34, 197, 94, 0.4)' : 'rgba(6, 182, 212, 0.3)'}`,
                                            borderRadius: '4px',
                                            color: targetsSaved ? '#22c55e' : 'var(--primary)',
                                            cursor: 'pointer',
                                            fontSize: '0.65rem',
                                            padding: '4px 8px',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {savingTargets ? 'Saving...' : targetsSaved ? 'Saved!' : 'Save Targets'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{
                    maxHeight: athleteId ? '35%' : '45%',
                    overflow: 'auto',
                    margin: '0.5rem',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius)',
                }}>
                    <div style={{
                        padding: '0.5rem 0.65rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--accent)',
                        borderBottom: '1px solid var(--card-border)',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius) var(--radius) 0 0',
                    }}>
                        Stress Index
                    </div>
                    <StressMatrix weeks={weeks} startDate={startDate} liftTargets={liftTargets} exerciseDB={initialExercises} />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header (Program Info + View Toggle + Actions) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexShrink: 0 }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{initialData ? 'Edit Program' : 'New Program'}</h1>
                        <div style={{ marginTop: '0.5rem' }}>
                            <input
                                value={programName}
                                onChange={e => setProgramName(e.target.value)}
                                placeholder="Program Name"
                                style={{
                                    background: 'rgba(18, 18, 18, 0.4)',
                                    border: '1px solid var(--card-border)',
                                    borderRadius: 'var(--radius)',
                                    color: 'var(--foreground)',
                                    fontWeight: 600,
                                    fontSize: '1.1rem',
                                    padding: '0.6rem 1rem',
                                    width: '100%',
                                    minWidth: '360px',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {/* View Toggle removed for streamlined Calendar UI */}

                            {resumedFromDraft && autoSaveStatus === 'idle' && (
                                <span
                                    title="This program was auto-saved as a draft. Click Save & Assign to publish it."
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--secondary-foreground)',
                                        background: 'rgba(125,135,210,0.10)',
                                        border: '1px solid var(--card-border)',
                                        padding: '3px 8px', borderRadius: 999,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Resumed draft
                                </span>
                            )}

                            {autoSaveStatus !== 'idle' && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: autoSaveStatus === 'error' ? '#ef4444' : autoSaveStatus === 'saved' ? '#22c55e' : 'var(--secondary-foreground)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {autoSaveStatus === 'saving' && 'Saving...'}
                                    {autoSaveStatus === 'saved' && 'Saved'}
                                    {autoSaveStatus === 'error' && 'Save failed'}
                                </span>
                            )}

                            {athleteId && (
                                <button
                                    onClick={() => setNotesOpen(o => !o)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        background: notesOpen ? 'rgba(125,135,210,0.15)' : 'rgba(255,255,255,0.07)',
                                        border: `1px solid ${notesOpen ? 'var(--primary)' : 'var(--card-border)'}`,
                                        borderRadius: 'var(--radius)', padding: '0.5rem 1rem',
                                        color: notesOpen ? 'var(--primary)' : 'var(--secondary-foreground)',
                                        fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <StickyNote size={14} />
                                    Notes{coachNotes.length > 0 ? ` (${coachNotes.length})` : ''}
                                </button>
                            )}
                            <button onClick={handleSave} className="btn btn-primary" disabled={isSaving || isNavigating}>
                                {isSaving ? 'Saving...' : isNavigating ? 'Loading dashboard...' : 'Save & Assign'}
                            </button>
                        </div>

                        {!athleteId && (
                            <select
                                className="input"
                                style={{ width: '200px', fontSize: '0.8rem', padding: '0.25rem' }}
                                value={selectedAthleteId}
                                onChange={(e) => setSelectedAthleteId(e.target.value)}
                            >
                                <option value="">-- Assign to Athlete --</option>
                                {(athletes || []).map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div style={{ overflowY: 'auto', paddingRight: '1rem', flex: 1 }}>

                    {/* CALENDAR VIEW (Primary) */}
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <ProgramCalendarGrid
                            weeks={weeks}
                            startDate={startDate}
                            onSelectDate={handleSelectDate}
                            onSessionMove={handleSessionMove}
                            onDuplicateSession={(weekNum, dayNum) => {
                                const wIdx = weeks.findIndex(w => w.weekNumber === weekNum);
                                if (wIdx === -1) return;
                                const sIdx = weeks[wIdx].sessions.findIndex(s => s.day === dayNum);
                                if (sIdx === -1) return;
                                setDuplicateSource({ weekIndex: wIdx, sessionIndex: sIdx });
                                setDuplicateTargetDate('');
                            }}
                            onDuplicateSessionToNextWeek={duplicateSessionToNextWeek}
                            onDuplicateWeekToNextWeek={duplicateWeekToNextWeek}
                            onClearWeek={(weekNum: number) => {
                                const wIdx = weeks.findIndex(w => w.weekNumber === weekNum);
                                if (wIdx === -1) return;
                                if (!confirm(`Delete all sessions in Week ${weekNum}?`)) return;
                                const newWeeks = [...weeks];
                                // Clear sessions but keep weekNumber intact so other weeks
                                // don't shift their calendar positions.
                                newWeeks[wIdx] = { ...newWeeks[wIdx], sessions: [] };
                                setWeeks(newWeeks);
                                setEditingSession(null);
                                setActiveLocation({ w: 0, s: 0 });
                                showToast(`Cleared Week ${weekNum}`);
                            }}
                            existingPrograms={existingPrograms}
                            onGhostSessionClick={(ghost: any) => setReferenceSession(ghost)}
                        />
                    </div>


                </div>
            </div>

            {/* Inline Side-Panel Editor for Calendar View */}
            {editingSession && (
                <div style={{
                    position: 'fixed', top: 'var(--header-height, 56px)', right: 0, bottom: 0,
                    width: '40vw', minWidth: '480px', maxWidth: '90vw',
                    background: 'var(--background)', borderLeft: '1px solid var(--card-border)',
                    zIndex: 900, display: 'flex', flexDirection: 'column',
                    boxShadow: '-8px 0 30px rgba(0,0,0,0.5)',
                }}>
                    {/* Editor header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)', flexShrink: 0 }}>
                        <input
                            value={weeks[editingSession.w].sessions[editingSession.s].name}
                            onChange={e => {
                                const newWeeks = [...weeks];
                                newWeeks[editingSession.w].sessions[editingSession.s].name = e.target.value;
                                setWeeks(newWeeks);
                            }}
                            className="input"
                            style={{ fontSize: '1.1rem', fontWeight: 600, flex: 1, marginRight: '1rem' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                                onClick={() => {
                                    const s = weeks[editingSession.w].sessions[editingSession.s];
                                    setProgressionSession({ day: s.day, name: s.name });
                                }}
                                title="Progression View — edit sets/reps/RPE across all weeks"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.4)', color: 'var(--primary)', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                                <LayoutGrid size={14} />
                                Progression
                            </button>
                            <button
                                onClick={() => { duplicateSession(editingSession.w, editingSession.s); }}
                                title="Duplicate Session"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--secondary-foreground)', padding: 6, display: 'flex', alignItems: 'center' }}
                            >
                                <Copy size={16} />
                            </button>
                            <button
                                onClick={() => { setDuplicateSource({ weekIndex: editingSession.w, sessionIndex: editingSession.s }); setDuplicateTargetDate(''); }}
                                title="Duplicate to Date..."
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 6, display: 'flex', alignItems: 'center' }}
                            >
                                <CalendarPlus size={16} />
                            </button>
                            <button
                                onClick={() => { const w = editingSession.w; const s = editingSession.s; closeEditor(); removeSession(w, s); }}
                                title="Delete Session"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 6, display: 'flex', alignItems: 'center' }}
                            >
                                <Trash2 size={16} />
                            </button>
                            <button onClick={closeEditor} className="btn btn-primary" style={{ marginLeft: '0.5rem' }}>Done</button>
                        </div>
                    </div>

                    {/* Editor body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                        {/* Warm-Up Drills Section (Side Panel) */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <textarea
                                className="input"
                                placeholder="Warm-up Drills & Pre-workout Notes"
                                value={weeks[editingSession.w].sessions[editingSession.s].warmupDrills || ''}
                                onChange={e => {
                                    const newWeeks = [...weeks];
                                    newWeeks[editingSession.w].sessions[editingSession.s].warmupDrills = e.target.value;
                                    setWeeks(newWeeks);
                                }}
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px dashed var(--card-border)',
                                    color: 'var(--foreground)',
                                    resize: 'vertical',
                                    borderRadius: '4px'
                                }}
                            />
                            {weeks[editingSession.w].sessions[editingSession.s].warmupDrills?.trim().length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Apply these warm-up drills to EVERY session in the entire block? This will overwrite existing warm-ups elsewhere.')) {
                                                const newWeeks = [...weeks];
                                                const drills = weeks[editingSession.w].sessions[editingSession.s].warmupDrills;
                                                newWeeks.forEach(w => w.sessions.forEach(s => s.warmupDrills = drills));
                                                setWeeks(newWeeks);
                                            }
                                        }}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--accent)',
                                            fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px',
                                            fontWeight: 600, opacity: 0.8
                                        }}
                                        onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                        onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
                                    >
                                        Apply to all sessions
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Exercises */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {weeks[editingSession.w].sessions[editingSession.s].exercises.map((ex, exIndex) => (
                                <BuilderExerciseCard
                                    key={ex.id}
                                    exercise={ex}
                                    onUpdate={(field, val) => updateExercise(editingSession.w, editingSession.s, exIndex, field, val)}
                                    onRemove={() => removeExercise(editingSession.w, editingSession.s, exIndex)}
                                    onDragStart={() => handleExerciseDragStart(editingSession.w, editingSession.s, exIndex)}
                                    onDragOver={(e) => handleExerciseDragOver(e, editingSession.w, editingSession.s, exIndex)}
                                    onDrop={(e) => handleExerciseDrop(e, editingSession.w, editingSession.s, exIndex)}
                                    onDragEnd={handleExerciseDragEnd}
                                    isDragOver={dropTarget?.w === editingSession.w && dropTarget?.s === editingSession.s && dropTarget?.e === exIndex}
                                />
                            ))}
                            {weeks[editingSession.w].sessions[editingSession.s].exercises.length === 0 && (
                                <div
                                    onDragOver={e => { e.preventDefault(); }}
                                    onDrop={e => handleExerciseDropOnEmpty(e, editingSession.w, editingSession.s)}
                                    style={{ padding: '2rem', textAlign: 'center', border: dragExercise ? '2px dashed var(--primary)' : '2px dashed var(--card-border)', borderRadius: 'var(--radius)', color: 'var(--secondary-foreground)', transition: 'border 0.15s' }}
                                >
                                    {dragExercise ? 'Drop exercise here' : 'Use the exercise library above to add exercises.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reference Panel: Read-only view of a past program session.
                When the session editor is also open, this slides to the left of
                the editor so both panels sit side by side. */}
            {referenceSession && (
                <div style={{
                    position: 'fixed', top: 'var(--header-height, 56px)',
                    right: editingSession ? 'max(40vw, 480px)' : 0, bottom: 0,
                    width: '40vw', minWidth: '480px', maxWidth: '90vw',
                    background: 'var(--background)',
                    borderLeft: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRight: editingSession ? '1px solid var(--card-border)' : 'none',
                    zIndex: 899, display: 'flex', flexDirection: 'column',
                    boxShadow: editingSession ? 'none' : '-8px 0 30px rgba(0,0,0,0.5)',
                    transition: 'right 0.25s ease',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--card-border)', background: 'rgba(148, 163, 184, 0.06)', flexShrink: 0 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <BookOpen size={11} />
                                Reference — {referenceSession.programName}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                {referenceSession.sessionName}
                            </div>
                        </div>
                        <button
                            onClick={() => setReferenceSession(null)}
                            className="btn btn-secondary"
                            style={{ marginLeft: '1rem', flexShrink: 0 }}
                        >
                            Close
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                        {/* Warm-up drills */}
                        {referenceSession.warmupDrills && (
                            <div style={{
                                marginBottom: '1.25rem', padding: '10px 12px',
                                background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--card-border)',
                                borderRadius: '4px', fontSize: '0.85rem', color: 'var(--secondary-foreground)',
                                whiteSpace: 'pre-wrap', lineHeight: 1.5,
                            }}>
                                {referenceSession.warmupDrills}
                            </div>
                        )}

                        {/* Exercises */}
                        {referenceSession.exercises?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {referenceSession.exercises.map((ex: any, idx: number) => (
                                    <div key={ex.id || idx} style={{
                                        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                        borderRadius: 'var(--radius)', overflow: 'hidden',
                                    }}>
                                        {/* Exercise header */}
                                        <div style={{
                                            padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', borderBottom: '1px solid var(--card-border)',
                                            background: 'rgba(255,255,255,0.02)',
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                                                {ex.name || 'Unnamed Exercise'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                                {ex.sets?.length || 0} sets
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {ex.notes && (
                                            <div style={{
                                                padding: '6px 14px', fontSize: '0.8rem',
                                                color: 'var(--secondary-foreground)', fontStyle: 'italic',
                                                borderBottom: '1px solid var(--card-border)',
                                                background: 'rgba(255,255,255,0.01)',
                                            }}>
                                                {ex.notes}
                                            </div>
                                        )}

                                        {/* Sets table */}
                                        {Array.isArray(ex.sets) && ex.sets.length > 0 && (
                                            <div style={{ padding: '8px 14px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                    <thead>
                                                        <tr style={{ color: 'var(--secondary-foreground)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Set</th>
                                                            <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>Reps</th>
                                                            <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>RPE</th>
                                                            <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>Weight</th>
                                                            <th style={{ textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ex.sets.map((set: any, si: number) => (
                                                            <tr key={set.id || si} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                                <td style={{ padding: '5px 0', color: 'var(--muted)' }}>{si + 1}</td>
                                                                <td style={{ textAlign: 'center', padding: '5px 0', color: 'var(--foreground)', fontWeight: 500 }}>
                                                                    {set.reps || '—'}
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '5px 0', color: 'var(--accent)' }}>
                                                                    {set.rpe ? `@${set.rpe}` : '—'}
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '5px 0', color: 'var(--foreground)' }}>
                                                                    {set.weight || '—'}
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '5px 0', color: 'var(--secondary-foreground)' }}>
                                                                    {set.percent ? `${set.percent}%` : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                                No exercises in this session.
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Coach Notes Side Panel */}
            {notesOpen && athleteId && (
                <>
                    <div style={{
                        position: 'fixed', top: 'var(--header-height, 56px)', left: 0, bottom: 0, width: 360, zIndex: 850,
                        background: 'var(--background)', borderRight: '1px solid var(--card-border)',
                        display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
                    }}>
                        {/* Panel header */}
                        <div style={{
                            padding: '1rem 1.25rem', borderBottom: '1px solid var(--card-border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
                                    Coach Notes
                                </div>
                                {athleteName && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                        {athleteName}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setNotesOpen(false)}
                                title="Close"
                                style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Notes list */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
                            {notesLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                                    Loading...
                                </div>
                            ) : sortedNotes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                                    No notes yet. Add your first note below.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {sortedNotes.map(note => {
                                        const cat = NOTE_CATEGORIES.find(c => c.value === note.category) || NOTE_CATEGORIES[0];
                                        return (
                                            <div key={note.id} style={{
                                                background: 'var(--card-bg)', border: `1px solid var(--card-border)`,
                                                borderLeft: `3px solid ${cat.color}`,
                                                borderRadius: 'var(--radius)', padding: '0.75rem',
                                                position: 'relative',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: '0.4rem' }}>
                                                    <span style={{
                                                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                                        letterSpacing: '0.06em', color: cat.color,
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    }}>
                                                        {note.pinned && <Pin size={10} style={{ fill: 'currentColor' }} />}
                                                        {cat.label}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => togglePinNote(note)}
                                                            title={note.pinned ? 'Unpin' : 'Pin'}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                                                color: note.pinned ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
                                                                display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                                                            }}
                                                            onMouseEnter={e => { if (!note.pinned) e.currentTarget.style.color = 'var(--secondary-foreground)'; }}
                                                            onMouseLeave={e => { if (!note.pinned) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
                                                        >
                                                            <Pin size={13} style={note.pinned ? { fill: 'currentColor' } : undefined} />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm('Delete this note?')) deleteNote(note.id); }}
                                                            title="Delete"
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                                                color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {note.content}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.4rem' }}>
                                                    {fmtNoteDate(note.updatedAt)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Quick-add form */}
                        <div style={{
                            padding: '1rem', borderTop: '1px solid var(--card-border)', flexShrink: 0,
                            background: 'rgba(125,135,210,0.04)',
                        }}>
                            <textarea
                                value={newNoteContent}
                                onChange={e => setNewNoteContent(e.target.value)}
                                placeholder="Add a note..."
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                                style={{
                                    width: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                    borderRadius: 'var(--radius)', color: 'var(--foreground)', fontSize: '0.85rem',
                                    padding: '0.6rem 0.75rem', resize: 'none', minHeight: 72, outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                                onBlur={e => (e.target.style.borderColor = 'var(--card-border)')}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                                <select
                                    value={newNoteCategory}
                                    onChange={e => setNewNoteCategory(e.target.value)}
                                    style={{
                                        flex: 1, background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                        borderRadius: 'var(--radius)', color: 'var(--foreground)', fontSize: '0.8rem',
                                        padding: '0.4rem 0.6rem', outline: 'none',
                                    }}
                                >
                                    {NOTE_CATEGORIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={addNote}
                                    disabled={notesSaving || !newNoteContent.trim()}
                                    className="btn btn-primary"
                                    style={{
                                        fontSize: '0.8rem', padding: '0.4rem 1rem', flexShrink: 0,
                                        opacity: notesSaving || !newNoteContent.trim() ? 0.5 : 1,
                                        cursor: notesSaving || !newNoteContent.trim() ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {notesSaving ? 'Saving...' : 'Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Week Overview toggle */}
            <button
                onClick={() => setWeekOverviewIndex(prev => prev !== null ? null : 0)}
                title="Week Overview"
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 800,
                    width: 48, height: 48, borderRadius: '50%',
                    background: weekOverviewIndex !== null ? 'var(--primary)' : 'var(--card-bg)',
                    border: `2px solid ${weekOverviewIndex !== null ? 'var(--primary)' : 'var(--card-border)'}`,
                    color: weekOverviewIndex !== null ? '#000' : 'var(--foreground)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)', transition: 'all 0.2s',
                    fontSize: 20,
                }}
            >
                {weekOverviewIndex !== null ? <X size={20} /> : <CalendarIcon size={20} />}
            </button>

            {/* Week Overview Drawer Backdrop */}
            {weekOverviewIndex !== null && (
                <div
                    onClick={() => setWeekOverviewIndex(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 950, transition: 'opacity 0.3s ease' }}
                />
            )}

            {/* Week Overview Drawer */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 951,
                transform: weekOverviewIndex !== null ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                maxHeight: '85vh', overflowY: 'auto',
                background: 'var(--background)',
                borderTop: '2px solid var(--primary)',
                borderRadius: '16px 16px 0 0',
                padding: '0 0 2rem 0',
            }}>
                {/* Handle */}
                <div onClick={() => setWeekOverviewIndex(null)} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px 0', cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--card-border)' }} />
                </div>

                {/* Header */}
                <div style={{ textAlign: 'center', padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--card-border)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                        Week Overview
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', margin: '4px 0 0 0' }}>
                        {programName || 'Untitled Program'}
                    </p>
                </div>

                {/* Week tabs */}
                {weeks.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, padding: '12px 1rem', overflowX: 'auto', flexShrink: 0 }}>
                        {weeks.map((w, i) => (
                            <button
                                key={w.id}
                                onClick={() => setWeekOverviewIndex(i)}
                                style={{
                                    padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
                                    background: weekOverviewIndex === i ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                    color: weekOverviewIndex === i ? '#000' : 'var(--secondary-foreground)',
                                }}
                            >
                                Week {w.weekNumber}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sessions & exercises */}
                {weekOverviewIndex !== null && weeks[weekOverviewIndex] && (
                    <div style={{ padding: '1rem' }}>
                        {weeks[weekOverviewIndex].sessions.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                                No sessions in this week yet.
                            </div>
                        ) : (
                            weeks[weekOverviewIndex].sessions
                                .slice()
                                .sort((a, b) => a.day - b.day)
                                .map((sess) => {
                                    const sessIndex = weeks[weekOverviewIndex!].sessions.indexOf(sess);
                                    return (
                                        <div key={sess.id} style={{ marginBottom: '1.25rem' }}>
                                            {/* Session label */}
                                            <div
                                                onClick={() => {
                                                    setWeekOverviewIndex(null);
                                                    setEditingSession({ w: weekOverviewIndex!, s: sessIndex });
                                                }}
                                                style={{
                                                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                    color: 'var(--primary)', marginBottom: '0.5rem',
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                                }}
                                            >
                                                Day {sess.day} — {sess.name}
                                                <span style={{
                                                    fontSize: '0.65rem', background: 'rgba(6,182,212,0.15)', color: 'var(--primary)',
                                                    padding: '2px 8px', borderRadius: 9999, fontWeight: 600, textTransform: 'none',
                                                }}>Edit</span>
                                            </div>

                                            {/* Exercise cards */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {(sess.exercises || []).map((ex, exIdx) => {
                                                    const category = ex.category || getExerciseCategory(ex.name);
                                                    const color = CATEGORY_COLORS[category] || '#94A3B8';
                                                    const summary = formatSetsSummary(ex.sets);

                                                    return (
                                                        <div key={ex.id || exIdx} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '0.75rem 1rem', background: 'var(--card-bg)',
                                                            border: `1px solid ${color}30`, borderRadius: 8,
                                                        }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color, marginBottom: 2 }}>
                                                                    {ex.name}
                                                                </div>
                                                                {summary && (
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', opacity: 0.8 }}>
                                                                        {summary}
                                                                    </div>
                                                                )}
                                                                {ex.notes && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', fontStyle: 'italic', marginTop: 2 }}>
                                                                        {ex.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginLeft: 12, flexShrink: 0 }}>
                                                                {Array.isArray(ex.sets) ? `${ex.sets.length} sets` : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(!sess.exercises || sess.exercises.length === 0) && (
                                                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', fontStyle: 'italic' }}>
                                                        No exercises yet
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                )}
            </div>

            {duplicateSource && (
                <div
                    onClick={() => { setDuplicateSource(null); setDuplicateTargetDate(''); }}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                            borderRadius: 'var(--radius)', padding: '1.5rem', minWidth: '320px',
                            display: 'flex', flexDirection: 'column', gap: '1rem',
                        }}
                    >
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                            Duplicate Session to Date
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>
                            Duplicating: <strong style={{ color: 'var(--foreground)' }}>
                                {weeks[duplicateSource.weekIndex]?.sessions[duplicateSource.sessionIndex]?.name}
                            </strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Target date</label>
                            <input
                                type="date"
                                className="input"
                                value={duplicateTargetDate}
                                onChange={e => setDuplicateTargetDate(e.target.value)}
                                min={startDate}
                                autoFocus
                                style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setDuplicateSource(null); setDuplicateTargetDate(''); }}
                                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={!duplicateTargetDate}
                                onClick={() => duplicateSessionToDate(duplicateSource.weekIndex, duplicateSource.sessionIndex, duplicateTargetDate)}
                                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                            >
                                Duplicate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action toast — brief confirmation for copy/duplicate/move operations */}
            {toast && (
                <div
                    key={toast.key}
                    style={{
                        position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--card-bg)', border: '1px solid var(--primary)',
                        borderRadius: '8px', padding: '10px 20px', zIndex: 1200,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        animation: 'toast-in 0.2s ease-out',
                        fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)',
                    }}
                >
                    <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>&#10003;</span>
                    {toast.message}
                </div>
            )}
            <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>

            {/* Progression View: full-width matrix of the same session slot across every week */}
            {progressionSession && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
                        zIndex: 1100, display: 'flex', flexDirection: 'column',
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setProgressionSession(null); }}
                >
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '1rem 1.5rem', borderBottom: '1px solid var(--card-border)',
                        background: 'var(--card-bg)', flexShrink: 0,
                    }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                                Progression View
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{progressionSession.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                Edit weight, reps & RPE across every week. Scroll horizontally →
                            </div>
                        </div>
                        <button onClick={() => setProgressionSession(null)} className="btn btn-primary">Done</button>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: 'var(--background)' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', minHeight: '100%' }}>
                            {weeks.map((week, wi) => {
                                const sIdx = week.sessions.findIndex((s: any) => s.day === progressionSession.day);
                                const session: any = sIdx >= 0 ? week.sessions[sIdx] : null;
                                return (
                                    <div key={week.id} style={{
                                        minWidth: '340px', maxWidth: '340px', flexShrink: 0,
                                        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                        borderRadius: 'var(--radius)', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.05)',
                                            borderBottom: '1px solid var(--card-border)',
                                            fontWeight: 600, fontSize: '0.9rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <span>Week {wi + 1}</span>
                                            {session && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', fontWeight: 400 }}>
                                                    {session.exercises.length} ex
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ padding: '0.6rem' }}>
                                            {!session ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                    No session this week
                                                </div>
                                            ) : session.exercises.length === 0 ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                    No exercises
                                                </div>
                                            ) : (
                                                session.exercises.map((ex: any, ei: number) => (
                                                    <div key={ex.id} style={{ marginBottom: '0.65rem', border: '1px solid var(--card-border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.04)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ex.name}>
                                                            {ex.name}
                                                        </div>
                                                        <div style={{ padding: '0.4rem 0.5rem' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 44px 44px', gap: '4px', fontSize: '0.65rem', color: 'var(--secondary-foreground)', marginBottom: '3px', textAlign: 'center' }}>
                                                                <div>#</div>
                                                                <div>Weight</div>
                                                                <div>Reps</div>
                                                                <div>RPE</div>
                                                            </div>
                                                            {(ex.sets || []).map((set: any, si: number) => (
                                                                <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 44px 44px', gap: '4px', alignItems: 'center', marginBottom: '3px' }}>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', textAlign: 'center' }}>{si + 1}</div>
                                                                    <input
                                                                        className="input"
                                                                        placeholder="—"
                                                                        value={set.weight || ''}
                                                                        onChange={e => updateProgressionSet(wi, sIdx, ei, si, 'weight', e.target.value)}
                                                                        style={{ padding: '3px 4px', fontSize: '0.78rem', textAlign: 'center' }}
                                                                    />
                                                                    <input
                                                                        className="input"
                                                                        value={set.reps || ''}
                                                                        onChange={e => updateProgressionSet(wi, sIdx, ei, si, 'reps', e.target.value)}
                                                                        style={{ padding: '3px 4px', fontSize: '0.78rem', textAlign: 'center' }}
                                                                    />
                                                                    <input
                                                                        className="input"
                                                                        value={set.rpe || ''}
                                                                        onChange={e => updateProgressionSet(wi, sIdx, ei, si, 'rpe', e.target.value)}
                                                                        style={{ padding: '3px 4px', fontSize: '0.78rem', textAlign: 'center' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

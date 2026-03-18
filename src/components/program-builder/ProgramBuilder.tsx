'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ExercisePicker from '@/components/program-builder/ExercisePicker';
import ImportProgram from '@/components/programs/ImportProgram';
import ProgramCalendarGrid from './ProgramCalendarGrid';
import { calculateStress } from '@/lib/stress-index';

const StressMatrix = dynamic(() => import('@/components/program-builder/StressMatrix'), {
    loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading stress charts...</div>
});

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

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
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                    ×
                </button>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--accent)' }}>
                            <input
                                type="checkbox"
                                checked={exercise.isPrimary || false}
                                onChange={(e) => onUpdate('isPrimary', e.target.checked)}
                            />
                            Track as Primary Lift
                        </label>
                    </div>

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



export default function ProgramBuilder({ athleteId, initialData = null, athletes = [], initialExercises = null, athleteLiftTargets = null, athleteName = '' }: { athleteId?: string, initialData?: any, athletes?: any[], initialExercises?: any, athleteLiftTargets?: any, athleteName?: string }) {
    const router = useRouter();
    const [programName, setProgramName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
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
                body: JSON.stringify({ liftTargets })
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
        sets: number | any[];
        reps: string;
        rpeTarget: number;
        notes?: string;
        isPrimary?: boolean;
    }

    interface Session {
        id: string;
        day: number;
        name: string;
        exercises: Exercise[];
        scheduledDate?: string;
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

    const [weeks, setWeeks] = useState([{
        id: generateId(),
        weekNumber: 1,
        sessions: [{
            id: generateId(),
            day: 1,
            name: 'Session 1',
            exercises: [],
            scheduledDate: ''
        }]
    }]);
    const [isSaving, setIsSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const savedProgramIdRef = useRef<string | null>(initialData?.id || null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadRef = useRef(true);

    // Load initial data if provided (Edit Mode)
    useEffect(() => {
        if (initialData) {
            setProgramName(initialData.name || '');
            setStartDate(initialData.startDate || new Date().toISOString().split('T')[0]);
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
                            return { ...e, id: e.id || generateId(), sets };
                        })
                    }))
                }));
                setWeeks(sanitizedWeeks);
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
                sets: e.sets.map(s => ({ ...s, id: generateId() }))
            }))
        };

        newWeeks[weekIndex].sessions.push(newSession);
        setWeeks(newWeeks);
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

        const newWeek = {
            ...originalWeek,
            id: generateId(),
            weekNumber: weeks.length + 1,
            sessions: originalWeek.sessions.map(s => {
                let newDate = '';
                if (s.scheduledDate) {
                    const date = new Date(s.scheduledDate);
                    date.setDate(date.getDate() + 7); // Shift by 7 days
                    newDate = date.toISOString().split('T')[0];
                }

                return {
                    ...s,
                    id: generateId(),
                    scheduledDate: newDate,
                    exercises: s.exercises.map(e => ({
                        ...e,
                        id: generateId(),
                        sets: e.sets.map(set => ({ ...set, id: generateId() }))
                    }))
                };
            })
        };

        newWeeks.push(newWeek);
        setWeeks(newWeeks);
    };

    const addExerciseToActiveSession = (exerciseName) => {
        const loc = editingSession ?? activeLocation;
        const { w, s } = loc;
        if (w >= weeks.length || s >= weeks[w].sessions.length) return;

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

    const removeExercise = (weekIndex, sessionIndex, exerciseIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].sessions[sessionIndex].exercises.splice(exerciseIndex, 1);
        setWeeks(newWeeks);
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
    };

    const buildPayload = useCallback(() => {
        const start = new Date(startDate);
        const durationDays = weeks.length * 7;
        start.setDate(start.getDate() + durationDays);
        const endDate = start.toISOString().split('T')[0];
        return {
            id: savedProgramIdRef.current || undefined,
            name: programName || 'Untitled Program',
            athleteId: selectedAthleteId,
            startDate,
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

    // Debounced auto-save: trigger 2s after any change
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
        }, 2000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [weeks, programName, startDate, selectedAthleteId, performAutoSave]);

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
                router.push(`/dashboard/athletes/${selectedAthleteId}`);
                router.refresh();
            } else {
                alert('Failed to save');
            }
        } catch (e) {
            console.error(e);
            alert('Error');
        } finally {
            setIsSaving(false);
        }
    };

    // ... (previous state)
    const [viewMode, setViewMode] = useState('list'); // 'calendar' | 'list'
    const [editingSession, setEditingSession] = useState<{ w: number, s: number } | null>(null);

    // ... (helpers)

    // Helper: get the Sunday that starts the week containing a given date
    const getSunday = (d: Date) => {
        const s = new Date(d);
        s.setDate(s.getDate() - s.getDay());
        s.setHours(0, 0, 0, 0);
        return s;
    };

    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /** Compute the Sun–Sat date range label for a given program week */
    const weekDateRange = (weekNumber: number): string => {
        if (!startDate) return `Week ${weekNumber}`;
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const week1Sunday = getSunday(start);
        const weekSunday = new Date(week1Sunday);
        weekSunday.setDate(weekSunday.getDate() + (weekNumber - 1) * 7);
        const weekSaturday = new Date(weekSunday);
        weekSaturday.setDate(weekSaturday.getDate() + 6);
        const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
        return `${fmt(weekSunday)} – ${fmt(weekSaturday)}`;
    };

    const getShiftedWeeks = (newStartDateStr: string, currentWeeks: any[]) => {
        // Parse as LOCAL time to ensure consistency with Calendar Grid
        const [oldY, oldM, oldD] = startDate.split('-').map(Number);
        const oldStart = new Date(oldY, oldM - 1, oldD);
        oldStart.setHours(0, 0, 0, 0);

        const [newY, newM, newD] = newStartDateStr.split('-').map(Number);
        const newStart = new Date(newY, newM - 1, newD);
        newStart.setHours(0, 0, 0, 0);

        // Week boundaries are Sunday-Saturday
        const oldWeek1Sunday = getSunday(oldStart);
        const newWeek1Sunday = getSunday(newStart);

        // Flatten sessions: convert each to an actual date, then re-bucket into Sun-Sat weeks
        const allSessions: any[] = [];
        currentWeeks.forEach(w => {
            w.sessions.forEach(s => {
                // Compute actual date: week1Sunday + (weekNumber-1)*7 + (day-1)
                const actualDate = new Date(oldWeek1Sunday);
                actualDate.setDate(actualDate.getDate() + (w.weekNumber - 1) * 7 + (s.day - 1));

                // Compute new week/day relative to new start's Sunday
                const diffTime = actualDate.getTime() - newWeek1Sunday.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0) {
                    const newWeekNum = Math.floor(diffDays / 7) + 1;
                    const newDayNum = (diffDays % 7) + 1; // 1=Sun, 7=Sat

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
        setStartDate(newStartDateStr);
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
            if (confirm(`This date is before the current program start date (${startDate}). Do you want to move the start date to ${dateStr}?`)) {
                currentWeeks = getShiftedWeeks(dateStr, weeks);
                setStartDate(dateStr);
                dayNum = 1;
                weekNum = 1;
            } else {
                return;
            }
        }

        // Logic continues with currentWeeks...
        let newWeeks = [...currentWeeks];
        let weekIndex = newWeeks.findIndex(w => w.weekNumber === weekNum);

        if (weekIndex === -1) {
            const currentMaxWeek = newWeeks.length;
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
            if (confirm(`Move program start to ${toDateStr}?`)) {
                // Calculate shifted structure BUT DO NOT SET STATE YET
                currentWeeks = getShiftedWeeks(toDateStr, weeks);
                pendingStartDate = toDateStr;

                // Recalculate pointers using Sunday-Saturday week boundaries
                const oldStart = new Date(startDate);
                const newStart = new Date(toDateStr);
                oldStart.setHours(0, 0, 0, 0);
                newStart.setHours(0, 0, 0, 0);

                const oldSunday = getSunday(oldStart);
                const newSunday = getSunday(newStart);

                // Compute actual date of the source session
                const sourceDate = new Date(oldSunday);
                sourceDate.setDate(sourceDate.getDate() + (fromW - 1) * 7 + (fromD - 1));

                // Re-derive week/day relative to new Sunday
                const diffFromNew = Math.round((sourceDate.getTime() - newSunday.getTime()) / (1000 * 60 * 60 * 24));
                const newFromW = Math.floor(diffFromNew / 7) + 1;
                const newFromD = (diffFromNew % 7) + 1;

                fromD = newFromD;
                fromW = newFromW;

                targetD = 1;
                targetW = 1;

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

    // Helper for toast (simplified - no-op in production)
    const showToast = (_msg) => { };

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

                    // Filter out empty weeks and re-index
                    const cleanedWeeks = newWeeks.filter(week => week.sessions.length > 0).map((week, i) => ({
                        ...week,
                        weekNumber: i + 1
                    }));

                    setWeeks(cleanedWeeks);
                }
            }
        }
        setEditingSession(null);
    };

    return (
        <div className="program-builder-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: '1.5rem', height: 'calc(100vh - 100px)', paddingTop: '1.5rem' }}>

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
                                                background: 'rgba(15, 23, 42, 0.6)',
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
                                                background: 'rgba(15, 23, 42, 0.6)',
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
                    <StressMatrix weeks={weeks} startDate={startDate} />
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
                                    background: 'rgba(15, 23, 42, 0.4)',
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
                            {/* View Toggle */}
                            <div style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                                <button
                                    onClick={() => setViewMode('list')}
                                    style={{ padding: '0.5rem 1rem', background: viewMode === 'list' ? 'var(--accent)' : 'transparent', color: viewMode === 'list' ? 'black' : 'var(--foreground)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
                                >
                                    List View
                                </button>
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    style={{ padding: '0.5rem 1rem', background: viewMode === 'calendar' ? 'var(--accent)' : 'transparent', color: viewMode === 'calendar' ? 'black' : 'var(--foreground)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
                                >
                                    Calendar View
                                </button>
                            </div>

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

                            <button onClick={handleSave} className="btn btn-primary" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save & Assign'}
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

                    {/* CALENDAR VIEW */}
                    {viewMode === 'calendar' && (
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <ProgramCalendarGrid
                                weeks={weeks}
                                startDate={startDate}
                                onSelectDate={handleSelectDate}
                                onSessionMove={handleSessionMove}
                            />
                        </div>
                    )}

                    {/* LIST VIEW (Legacy) */}
                    {viewMode === 'list' && (
                        <div>
                            {weeks.filter(week => week.sessions.length > 0).map((week) => {
                                const wIndex = weeks.indexOf(week);
                                return (
                                <div key={week.id} style={{ marginBottom: '3rem' }}>
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsedWeeks[week.id] ? '0' : '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => toggleWeek(week.id)}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                width: '20px', height: '20px', fontSize: '0.7rem',
                                                border: '1px solid var(--card-border)', borderRadius: '3px',
                                                color: 'var(--secondary-foreground)', transition: 'transform 0.2s',
                                                transform: collapsedWeeks[week.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                            }}>
                                                ▼
                                            </span>
                                            <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>{weekDateRange(week.weekNumber)}</h2>
                                            {collapsedWeeks[week.id] && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginLeft: '0.5rem' }}>
                                                    ({week.sessions.length} session{week.sessions.length !== 1 ? 's' : ''})
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {clipboard?.type === 'week' && (
                                                <button
                                                    onClick={() => pasteWeek(wIndex)}
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.8rem', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--primary)', border: '1px dashed var(--primary)' }}
                                                    title="Overwrite this week with copied content"
                                                >
                                                    Paste Week
                                                </button>
                                            )}
                                            <button onClick={() => copyWeek(wIndex)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>Copy</button>
                                            <button onClick={() => duplicateWeek(wIndex)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>Duplicate</button>
                                            <button onClick={() => addSession(wIndex)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>+ Session</button>
                                            {weeks.length > 1 && (
                                                <button
                                                    onClick={() => removeWeek(wIndex)}
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                    title="Delete this week"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {!collapsedWeeks[week.id] && (
                                    <div style={{ overflowX: 'auto', paddingBottom: '1rem', margin: '0 -1rem', padding: '0 1rem 1rem 1rem' }}>
                                        <div style={{ display: 'grid', gap: '1.5rem', minWidth: '700px' }}>
                                            {week.sessions.map((session, sIndex) => (
                                                <div
                                                    key={session.id}
                                                    className="card"
                                                    onClick={() => setActiveLocation({ w: wIndex, s: sIndex })}
                                                    style={{
                                                        border: (activeLocation.w === wIndex && activeLocation.s === sIndex) ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                                                        transition: 'all 0.2s',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {/* Selection Indicator */}
                                                    {(activeLocation.w === wIndex && activeLocation.s === sIndex) && (
                                                        <div style={{
                                                            position: 'absolute', top: 10, right: 10,
                                                            background: 'var(--accent)', color: 'black',
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'
                                                        }}>
                                                            ACTIVE
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: collapsedSessions[session.id] ? '0' : '1rem', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                                            <span
                                                                onClick={(e) => { e.stopPropagation(); toggleSession(session.id); }}
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                    width: '18px', height: '18px', fontSize: '0.6rem',
                                                                    border: '1px solid var(--card-border)', borderRadius: '3px',
                                                                    color: 'var(--secondary-foreground)', cursor: 'pointer',
                                                                    transition: 'transform 0.2s', flexShrink: 0,
                                                                    transform: collapsedSessions[session.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                                }}
                                                            >
                                                                ▼
                                                            </span>
                                                            <input
                                                                value={session.name}
                                                                onChange={e => {
                                                                    const newWeeks = [...weeks];
                                                                    newWeeks[wIndex].sessions[sIndex].name = e.target.value;
                                                                    setWeeks(newWeeks);
                                                                }}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: '1.1rem', fontWeight: 600, flex: 1 }}
                                                                placeholder="Session Name"
                                                            />
                                                            {collapsedSessions[session.id] && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                                                    {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Date:</span>
                                                            <input
                                                                type="date"
                                                                className="input"
                                                                style={{ padding: '2px 8px', fontSize: '0.8rem', width: 'auto' }}
                                                                value={session.scheduledDate || ''}
                                                                onChange={e => {
                                                                    const newWeeks = [...weeks];
                                                                    newWeeks[wIndex].sessions[sIndex].scheduledDate = e.target.value;
                                                                    setWeeks(newWeeks);
                                                                }}
                                                            />
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); duplicateSession(wIndex, sIndex); }}
                                                                title="Duplicate Session"
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                                            >
                                                                ❐
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeSession(wIndex, sIndex); }}
                                                                title="Delete Session"
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--error)' }}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {!collapsedSessions[session.id] && (
                                                    <>
                                                    {session.exercises.length === 0 ? (
                                                        <div
                                                            onDragOver={e => { e.preventDefault(); }}
                                                            onDrop={e => handleExerciseDropOnEmpty(e, wIndex, sIndex)}
                                                            style={{ padding: '2rem', textAlign: 'center', border: dragExercise ? '2px dashed var(--primary)' : '2px dashed var(--card-border)', borderRadius: '8px', color: 'var(--secondary-foreground)', transition: 'border 0.15s' }}
                                                        >
                                                            {dragExercise ? 'Drop exercise here' : 'Select cards to "Active" then add exercises from sidebar'}
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                            {session.exercises.map((ex, exIndex) => (
                                                                <BuilderExerciseCard
                                                                    key={ex.id}
                                                                    exercise={ex}
                                                                    onUpdate={(field, val) => updateExercise(wIndex, sIndex, exIndex, field, val)}
                                                                    onRemove={() => removeExercise(wIndex, sIndex, exIndex)}
                                                                    onDragStart={() => handleExerciseDragStart(wIndex, sIndex, exIndex)}
                                                                    onDragOver={(e) => handleExerciseDragOver(e, wIndex, sIndex, exIndex)}
                                                                    onDrop={(e) => handleExerciseDrop(e, wIndex, sIndex, exIndex)}
                                                                    onDragEnd={handleExerciseDragEnd}
                                                                    isDragOver={dropTarget?.w === wIndex && dropTarget?.s === sIndex && dropTarget?.e === exIndex}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                    </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    )}
                                </div>
                            ); })}

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4rem' }}>
                                <button onClick={addWeek} className="btn btn-secondary" style={{ padding: '1rem 3rem' }}>
                                    + Add Next Week
                                </button>
                            </div>

                        </div>
                    )}
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
                        <button onClick={closeEditor} className="btn btn-primary" style={{ flexShrink: 0 }}>Done</button>
                    </div>

                    {/* Editor body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
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
        </div>
    );
}

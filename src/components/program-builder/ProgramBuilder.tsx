'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ExercisePicker from '@/components/program-builder/ExercisePicker';
import StressMatrix from '@/components/program-builder/StressMatrix';
import ImportProgram from '@/components/programs/ImportProgram';
import ProgramCalendarGrid from './ProgramCalendarGrid';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Exercise Component
const BuilderExerciseCard = ({ exercise, onUpdate, onRemove }) => {
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
        <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div
                style={{
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 40px', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)', textAlign: 'center' }}>
                        <div>Set</div>
                        <div>Weight</div>
                        <div>Reps</div>
                        <div>RPE</div>
                        <div>% / Notes</div>
                        <div></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {exercise.sets.map((set, i) => (
                            <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ textAlign: 'center', color: 'var(--secondary-foreground)' }}>{i + 1}</div>
                                <input
                                    className="input"
                                    placeholder="lbs"
                                    value={set.weight || ''}
                                    onChange={e => updateSet(i, 'weight', e.target.value)}
                                    style={{ padding: '4px', textAlign: 'center' }}
                                />
                                <input
                                    className="input"
                                    value={set.reps}
                                    onChange={e => updateSet(i, 'reps', e.target.value)}
                                    style={{ padding: '4px', textAlign: 'center' }}
                                />
                                <input
                                    className="input"
                                    value={set.rpe}
                                    onChange={e => updateSet(i, 'rpe', e.target.value)}
                                    style={{ padding: '4px', textAlign: 'center' }}
                                />
                                <input
                                    className="input"
                                    placeholder="Notes"
                                    value={set.notes || ''}
                                    onChange={e => updateSet(i, 'notes', e.target.value)}
                                    style={{ padding: '4px' }}
                                />
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {i > 0 && (
                                        <button
                                            title="Copy Previous"
                                            onClick={() => copyPreviousSet(i)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                                        >
                                            📄
                                        </button>
                                    )}
                                    <button
                                        onClick={() => removeSet(i)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
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



export default function ProgramBuilder({ athleteId, initialData = null, athletes = [] }: { athleteId?: string, initialData?: any, athletes?: any[] }) {
    const router = useRouter();
    const [programName, setProgramName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    // State for selected athlete in assigning mode
    const [selectedAthleteId, setSelectedAthleteId] = useState(athleteId || '');

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
        }
    }, [initialData]);

    // Track selected session for "Click to Add"
    const [activeLocation, setActiveLocation] = useState({ w: 0, s: 0 });

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

    const addSession = (weekIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].sessions.push({
            id: generateId(),
            day: newWeeks[weekIndex].sessions.length + 1,
            name: `Session ${newWeeks[weekIndex].sessions.length + 1}`,
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
        const { w, s } = activeLocation;
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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Calculate End Date
            const start = new Date(startDate);
            const durationDays = weeks.length * 7;
            start.setDate(start.getDate() + durationDays);
            const endDate = start.toISOString().split('T')[0];

            // Use the selected athlete ID (either from prop or dropdown)
            const finalAthleteId = selectedAthleteId;

            const payload = {
                id: initialData?.id, // Includes ID if editing
                name: programName || 'Untitled Program',
                athleteId: finalAthleteId,
                startDate,
                endDate,
                weeks
            };

            const method = initialData?.id ? 'PUT' : 'POST';

            const res = await fetch('/api/programs', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                router.push(`/dashboard/athletes/${finalAthleteId}`);
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

    const getShiftedWeeks = (newStartDateStr: string, currentWeeks: any[]) => {
        // Parse as LOCAL time to ensure consistency with Calendar Grid
        const [oldY, oldM, oldD] = startDate.split('-').map(Number);
        const oldStart = new Date(oldY, oldM - 1, oldD);

        const [newY, newM, newD] = newStartDateStr.split('-').map(Number);
        const newStart = new Date(newY, newM - 1, newD);

        // Normalize to midnight
        oldStart.setHours(0, 0, 0, 0);
        newStart.setHours(0, 0, 0, 0);

        const diffTime = newStart.getTime() - oldStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const shiftAmount = -diffDays;

        // Flatten and shift with normalization
        const allSessions = [];
        currentWeeks.forEach(w => {
            w.sessions.forEach(s => {
                // Calculate absolute day (1-based from old start)
                const absDay = (w.weekNumber - 1) * 7 + s.day;
                const newAbsDay = absDay + shiftAmount;

                if (newAbsDay > 0) {
                    const newWeekNum = Math.ceil(newAbsDay / 7);
                    // Normalize to 1-7 relative to week
                    let newRelDay = newAbsDay % 7;
                    if (newRelDay === 0) newRelDay = 7;

                    allSessions.push({
                        ...s,
                        day: newRelDay,
                        _tempWeekNum: newWeekNum
                    });
                }
            });
        });

        // Re-bucket
        const reorganizedWeeks = [];
        allSessions.forEach(s => {
            const wn = s._tempWeekNum;
            if (!reorganizedWeeks[wn]) reorganizedWeeks[wn] = [];

            // clean up temp prop
            const { _tempWeekNum, ...cleanSession } = s;
            reorganizedWeeks[wn].push(cleanSession);
        });

        const finalWeeks = [];
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
            newWeeks[weekIndex].sessions.push({
                id: generateId(),
                day: dayNum,
                name: `Session ${dayNum}`,
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

                // Recalculate pointers
                const oldStart = new Date(startDate);
                const newStart = new Date(toDateStr);
                oldStart.setUTCHours(0, 0, 0, 0);
                newStart.setUTCHours(0, 0, 0, 0);

                const diffTime = newStart.getTime() - oldStart.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const shiftAmt = -diffDays;

                // Convert FromD (relative 1-7) to Absolute, Shift, then back to Relative
                // This matches getShiftedWeeks logic
                const oldAbsDay = (fromW - 1) * 7 + fromD;
                const newAbsDay = oldAbsDay + shiftAmt;

                const newFromW = Math.ceil(newAbsDay / 7);
                let newFromD = newAbsDay % 7;
                if (newFromD === 0) newFromD = 7;

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

    // Helper for toast (simplified)
    const showToast = (msg) => {
        // Implementation detail or just console
        console.log(msg);
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
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', height: 'calc(100vh - 100px)' }}>

            {/* LEFTSIDE BAR: Exercise Picker (ALWAYS VISIBLE - "Same as previously") */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <ExercisePicker onAdd={addExerciseToActiveSession} onDragStart={() => { }} />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header (Program Info + View Toggle + Actions) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexShrink: 0 }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{initialData ? 'Edit Program' : 'New Program'}</h1>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginTop: '0.5rem' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Start Date:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={{ background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '4px', color: 'var(--foreground)', padding: '2px 6px' }}
                            />
                            <span style={{ margin: '0 0.5rem' }}>•</span>
                            <input
                                value={programName}
                                onChange={e => setProgramName(e.target.value)}
                                placeholder="Program Name"
                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--card-border)', color: 'var(--foreground)', fontWeight: 600, minWidth: '200px' }}
                            />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            {/* Assuming ImportProgram and handleImport are defined elsewhere */}
                            {/* <ImportProgram onImport={handleImport} /> */}
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
                            {weeks.map((week, wIndex) => (
                                <div key={week.id} style={{ marginBottom: '3rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Week {week.weekNumber}</h2>
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
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                                        {week.sessions.map((session, sIndex) => (
                                            <div
                                                key={session.id}
                                                className="card"
                                                onClick={() => setActiveLocation({ w: wIndex, s: sIndex })}
                                                style={{
                                                    border: (activeLocation.w === wIndex && activeLocation.s === sIndex) ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                                                    transition: 'all 0.2s',
                                                    position: 'relative' // Added for absolute positioning of ACTIVE tag
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

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', gap: '1rem' }}>
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

                                                {session.exercises.length === 0 ? (
                                                    <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed var(--card-border)', borderRadius: '8px', color: 'var(--secondary-foreground)' }}>
                                                        Select cards to "Active" then add exercises from sidebar
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        {session.exercises.map((ex, exIndex) => (
                                                            <BuilderExerciseCard
                                                                key={ex.id}
                                                                exercise={ex}
                                                                onUpdate={(field, val) => updateExercise(wIndex, sIndex, exIndex, field, val)}
                                                                onRemove={() => removeExercise(wIndex, sIndex, exIndex)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4rem' }}>
                                <button onClick={addWeek} className="btn btn-secondary" style={{ padding: '1rem 3rem' }}>
                                    + Add Next Week
                                </button>
                            </div>

                            {/* Assuming StressMatrix is defined elsewhere */}
                            {/* <div style={{ marginBottom: '4rem' }}>
                                <StressMatrix weeks={weeks} />
                            </div> */}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Editor for Calendar View */}
            {editingSession && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '90%', maxWidth: '1000px', height: '90vh', background: 'var(--background)', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>

                        {/* Sidebar */}
                        <div style={{ width: '300px', borderRight: '1px solid var(--card-border)', padding: '1rem', background: 'var(--card-bg)' }}>
                            <ExercisePicker
                                onAdd={(name) => {
                                    // Add to currently editing session
                                    const { w, s } = editingSession;
                                    const newWeeks = [...weeks];
                                    const sets = [
                                        { id: generateId(), reps: '5', rpe: '6', weight: '' },
                                        { id: generateId(), reps: '5', rpe: '7', weight: '' },
                                        { id: generateId(), reps: '5', rpe: '8', weight: '' }
                                    ];
                                    newWeeks[w].sessions[s].exercises.push({
                                        id: generateId(),
                                        name: name,
                                        sets: sets,
                                        notes: ''
                                    });
                                    setWeeks(newWeeks);
                                }}
                                onDragStart={() => { }}
                            />
                        </div>

                        {/* Editor */}
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                <div>

                                    <input
                                        value={weeks[editingSession.w].sessions[editingSession.s].name}
                                        onChange={e => {
                                            const newWeeks = [...weeks];
                                            newWeeks[editingSession.w].sessions[editingSession.s].name = e.target.value;
                                            setWeeks(newWeeks);
                                        }}
                                        className="input"
                                        style={{ fontSize: '1.2rem', fontWeight: 600 }}
                                    />
                                </div>
                                <button onClick={closeEditor} className="btn btn-primary">Done</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {weeks[editingSession.w].sessions[editingSession.s].exercises.map((ex, exIndex) => (
                                    <BuilderExerciseCard
                                        key={ex.id}
                                        exercise={ex}
                                        onUpdate={(field, val) => updateExercise(editingSession.w, editingSession.s, exIndex, field, val)}
                                        onRemove={() => removeExercise(editingSession.w, editingSession.s, exIndex)}
                                    />
                                ))}
                                {weeks[editingSession.w].sessions[editingSession.s].exercises.length === 0 && (
                                    <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--card-border)', color: 'var(--secondary-foreground)' }}>
                                        Use the library on the left to add exercises to this session.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

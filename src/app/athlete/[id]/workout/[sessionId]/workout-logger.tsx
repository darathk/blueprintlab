'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';
import { getExerciseCategory } from '@/lib/exercise-db';
import ExerciseFeedback from '@/components/athlete/ExerciseFeedback';
import PRToggle from '@/components/athlete/PRToggle';
import WeightInput from '@/components/athlete/WeightInput';

const CelebrationScreen = dynamic(() => import('@/components/athlete/CelebrationScreen'), { ssr: false });
const PlannedTopSetInput = dynamic(() => import('@/components/athlete/PlannedTopSetInput'), { ssr: false });
const StrengthSuiteModal = dynamic(() => import('@/components/strength-suite/StrengthSuiteModal'), { ssr: false });

// Category-based colors for exercise names
const CATEGORY_COLORS = {
    'Knee': '#EAB308',              // Yellow/Gold - squats
    'Hip': '#EF4444',               // Red/Coral - deadlifts
    'Horizontal Push': '#22C55E',   // Green - bench press
    'Vertical Push': '#F59E0B',     // Amber - overhead press
    'Horizontal Pull': '#06B6D4',   // Cyan - rows
    'Vertical Pull': '#3B82F6',     // Blue - pull-ups
    'Isolation (Upper)': '#A78BFA', // Purple - upper isolation
    'Isolation (Lower)': '#F472B6', // Pink - lower isolation
    'Isolation/Accessory': '#8B5CF6' // Violet - general isolation
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatSetsSummary(sets) {
    if (!Array.isArray(sets) || sets.length === 0) return '';
    const parts = [];
    let i = 0;
    while (i < sets.length) {
        const s = sets[i];
        const reps = s.reps || '';
        const rpe = s.rpe || '';
        const weight = s.weight || '';
        // Count consecutive identical sets
        let count = 1;
        while (i + count < sets.length) {
            const next = sets[i + count];
            if (String(next.reps) === String(reps) && String(next.rpe) === String(rpe) && String(next.weight) === String(weight)) {
                count++;
            } else break;
        }
        let part = '';
        if (count > 1) {
            part = `${count}x${reps}`;
        } else {
            part = `x${reps}`;
        }
        if (rpe) part += ` @${rpe}`;
        if (weight && String(weight).includes('%')) part += ` @${weight}`;
        parts.push(part);
        i += count;
    }
    return parts.join(', ');
}

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
                    style={{
                        color: 'var(--primary)',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
}

export default function WorkoutLogger({ athleteId, coachId = '', programId, sessionId, weekNum = 1, dayNum = 1, blockName = 'Block', exercises, sessionWarmupDrills = '', initialLog, weekSessions = [], weekStartDate = '', scheduledDate = '', programName = '' }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(Date.now());
    const [weekDrawerOpen, setWeekDrawerOpen] = useState(false);
    const savingInFlightRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const [warmupDrills, setWarmupDrills] = useState(initialLog?.warmupDrills || sessionWarmupDrills || '');
    const [celebration, setCelebration] = useState<{ sessionName: string } | null>(null);
    const celebratedRef = useRef(false);
    
    const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
    const [plannedTopSets, setPlannedTopSets] = useState<Record<string, any>>({});
    const [showSuiteModal, setShowSuiteModal] = useState(false);

    const fetchPlannedTopSets = useCallback(async () => {
        if (!athleteId || !sessionId) return;
        try {
            const params = new URLSearchParams({ athleteId, sessionId });
            if (programId) params.append('programId', programId);
            if (weekNum) params.append('weekNum', String(weekNum));
            if (dayNum) params.append('dayNum', String(dayNum));
            const res = await fetch(`/api/top-sets?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const mapping: Record<string, any> = {};
                (data || []).forEach((ts: any) => {
                    if (ts.exerciseName) mapping[ts.exerciseName] = ts;
                });
                setPlannedTopSets(mapping);
            }
        } catch (e) {
            console.error('Failed to fetch planned top sets in workout-logger', e);
        }
    }, [athleteId, sessionId, programId, weekNum, dayNum]);

    useEffect(() => {
        fetchPlannedTopSets();
    }, [fetchPlannedTopSets]);

    useEffect(() => {
        const saved = localStorage.getItem('athlete-unit-pref');
        if (saved === 'kg' || saved === 'lbs') setUnit(saved);
        else if (initialLog?.exercises?.[0]?.unit) setUnit(initialLog.exercises[0].unit);
        else if (initialLog?.exercises?.[0]?.sets?.[0]?.unit) setUnit(initialLog.exercises[0].sets[0].unit);
    }, [initialLog]);

    const toggleUnit = (u: 'kg' | 'lbs') => {
        if (u === unit) return;
        setUnit(u);
        localStorage.setItem('athlete-unit-pref', u);
        setExerciseLogs(prev => {
            return prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => {
                    let actualWeight = s.actual.weight;
                    let targetWeight = s.target.weight;
                    if (actualWeight) {
                        const num = parseFloat(actualWeight);
                        if (!isNaN(num)) {
                            actualWeight = u === 'kg'
                                ? (num * 0.45359237).toFixed(1).replace(/\.0$/, '')
                                : (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
                        }
                    }
                    if (targetWeight && !String(targetWeight).includes('%')) {
                        const num = parseFloat(targetWeight);
                        if (!isNaN(num)) {
                            targetWeight = u === 'kg'
                                ? (num * 0.45359237).toFixed(1).replace(/\.0$/, '')
                                : (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
                        }
                    }
                    return {
                        ...s,
                        target: { ...s.target, weight: targetWeight },
                        actual: { ...s.actual, weight: actualWeight }
                    };
                })
            }));
        });
    };

    // Initialize logs
    const [exerciseLogs, setExerciseLogs] = useState(() => {
        return exercises.map(ex => {
            // Find saved data for this exercise if available
            const savedEx = initialLog?.exercises?.find(l => 
                (l.exerciseId && l.exerciseId === ex.id) || 
                (l.name && l.name.trim().toLowerCase() === ex.name?.trim().toLowerCase())
            );

            // Handle both old (flat) and new (granular) data structures
            const isGranular = Array.isArray(ex.sets);

            let mappedSets = [];
            if (isGranular) {
                mappedSets = ex.sets.map((s, i) => {
                    const savedSet = savedEx?.sets?.[i];
                    return {
                        setNumber: i + 1,
                        target: {
                            weight: s.weight ? String(s.weight) : '',
                            reps: s.reps ? String(s.reps) : '',
                            rpe: s.rpe ? String(s.rpe) : ''
                        },
                        actual: {
                            weight: savedSet?.weight ? String(savedSet.weight) : '',
                            reps: savedSet?.reps ? String(savedSet.reps) : '',
                            rpe: savedSet?.rpe ? String(savedSet.rpe) : ''
                        }
                    };
                });
            } else {
                // Fallback for legacy data/structure
                const setCount = typeof ex.sets === 'number' ? ex.sets : 3;
                mappedSets = Array.from({ length: setCount }).map((_, i) => {
                    const savedSet = savedEx?.sets?.[i];
                    return {
                        setNumber: i + 1,
                        target: {
                            weight: '',
                            reps: ex.reps ? String(ex.reps) : '',
                            rpe: ex.rpeTarget || 8
                        },
                        actual: {
                            weight: savedSet?.weight ? String(savedSet.weight) : '',
                            reps: savedSet?.reps ? String(savedSet.reps) : '',
                            rpe: savedSet?.rpe ? String(savedSet.rpe) : ''
                        }
                    };
                });
            }

            return {
                exerciseId: ex.id,
                name: ex.name,
                category: ex.category || getExerciseCategory(ex.name),
                coachNotes: ex.notes || '',
                sets: mappedSets,
                notes: savedEx?.notes ?? '',
                isCollapsed: false
            };
        });
    });

    // Keep refs in sync for the auto-save closure
    const latestLogsRef = useRef(exerciseLogs);
    const latestDrillsRef = useRef(warmupDrills);
    useEffect(() => { latestLogsRef.current = exerciseLogs; }, [exerciseLogs]);
    useEffect(() => { latestDrillsRef.current = warmupDrills; }, [warmupDrills]);

    // Auto-Save Effect
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSave(false);
        }, 1500); // Debounce 1.5s

        return () => clearTimeout(timer);
    }, [exerciseLogs, warmupDrills]);

    // Calculate Completion for Progress Bar
    const validationStats = useMemo(() => {
        let totalSets = 0;
        let completedSets = 0;

        exerciseLogs.forEach(ex => {
            ex.sets.forEach(set => {
                totalSets++;
                const w = String(set.actual?.weight || '').trim();
                const r = String(set.actual?.reps || '').trim();
                if ((r && r !== '0') || (w && w !== '0' && r)) {
                    completedSets++;
                }
            });
        });

        return { total: totalSets, completed: completedSets, percentage: totalSets > 0 ? (completedSets / totalSets) * 100 : 0 };
    }, [exerciseLogs]);


    // Real-time stats
    const sessionStats = useMemo(() => {
        let total = 0;
        let central = 0;
        let peripheral = 0;

        exerciseLogs.forEach(ex => {
            ex.sets.forEach(set => {
                const r = parseFloat(set.actual.reps) || 0;
                const rpe = parseFloat(set.actual.rpe) || 0;
                if (r > 0 && rpe > 0) {
                    const stress = calculateStress(r, rpe);
                    total += stress.total;
                    central += stress.central;
                    peripheral += stress.peripheral;
                }
            });
        });
        return {
            total: total.toFixed(1),
            central: central.toFixed(1),
            peripheral: peripheral.toFixed(1)
        };
    }, [exerciseLogs]);

    // Format Date: "Friday, Feb 27th, 2026"
    const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    });

    const updateSet = (exIndex, setIndex, field, value) => {
        const newLogs = [...exerciseLogs];
        newLogs[exIndex].sets[setIndex].actual[field] = value;
        setExerciseLogs(newLogs);
    };

    const toggleCollapse = (exIndex) => {
        const newLogs = [...exerciseLogs];
        newLogs[exIndex].isCollapsed = !newLogs[exIndex].isCollapsed;
        setExerciseLogs(newLogs);
    };

    const copyTargetToActual = (exIndex, setIndex) => {
        const newLogs = [...exerciseLogs];
        const set = newLogs[exIndex].sets[setIndex];
        const exName = newLogs[exIndex].name;
        const planned = setIndex === 0 && exName ? plannedTopSets[exName] : null;

        const targetReps = String(set.target.reps || (setIndex === 0 && planned?.reps ? planned.reps : ''));
        const cleanReps = targetReps.includes('-') ? targetReps.split('-')[0] : targetReps;
        let cleanWeight = String(set.target.weight || (setIndex === 0 && planned?.weight ? planned.weight : ''));
        if (cleanWeight.includes('%')) {
            cleanWeight = '';
        } else {
            cleanWeight = cleanWeight.replace(/[^0-9.]/g, '');
        }

        const targetRpe = set.target.rpe || (setIndex === 0 && planned?.rpe ? planned.rpe : '');

        if (cleanWeight) set.actual.weight = cleanWeight;
        if (cleanReps) set.actual.reps = cleanReps;
        if (targetRpe) set.actual.rpe = String(targetRpe);
        setExerciseLogs(newLogs);
    };

    const copyPreviousSet = (exIndex, setIndex) => {
        if (setIndex === 0) return;
        const newLogs = [...exerciseLogs];
        const prevSet = newLogs[exIndex].sets[setIndex - 1];
        newLogs[exIndex].sets[setIndex].actual = { ...prevSet.actual };
        setExerciseLogs(newLogs);
    };

    const updateSetsCount = (exIndex, newCount) => {
        const count = parseInt(newCount);
        if (isNaN(count) || count < 0) return;

        const newLogs = [...exerciseLogs];
        const currentSets = newLogs[exIndex].sets;

        if (count > currentSets.length) {
            const baseTarget = currentSets[0]?.target ? { ...currentSets[0].target } : { weight: '', reps: '', rpe: '' };
            for (let i = currentSets.length; i < count; i++) {
                currentSets.push({
                    setNumber: i + 1,
                    target: { ...baseTarget },
                    actual: { weight: '', reps: '', rpe: '' }
                });
            }
        } else if (count < currentSets.length) {
            newLogs[exIndex].sets = currentSets.slice(0, count);
        }
        setExerciseLogs(newLogs);
    };

    const handleSave = async (redirect = true) => {
        // Prevent concurrent saves — queue a retry instead
        if (savingInFlightRef.current && !redirect) {
            pendingSaveRef.current = true;
            return;
        }

        savingInFlightRef.current = true;
        pendingSaveRef.current = false;
        setIsSaving(true);
        try {
            // Use refs for auto-save to always get the latest state
            const currentLogs = redirect ? exerciseLogs : latestLogsRef.current;
            const currentDrills = redirect ? warmupDrills : latestDrillsRef.current;

            const cleanLogs = currentLogs.map(ex => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                unit: unit,
                sets: ex.sets.map(s => ({
                    weight: s.actual?.weight || '',
                    reps: s.actual?.reps || '',
                    rpe: s.actual?.rpe || '',
                    unit: unit
                })),
                notes: ex.notes || ''
            }));

            const saveDate = initialLog?.date || scheduledDate || new Date().toISOString();

            const res = await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athleteId,
                    programId,
                    sessionId,
                    date: saveDate,
                    exercises: cleanLogs,
                    warmupDrills: currentDrills
                }),
            });

            if (res.ok) {
                setLastSaved(Date.now());
                if (validationStats.percentage === 100 && !celebratedRef.current) {
                    celebratedRef.current = true;
                    setCelebration({ sessionName: `Session ${dayNum}` });
                    if (redirect) return;
                }
                if (redirect) {
                    router.push(`/athlete/${athleteId}/dashboard`);
                    router.refresh();
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            savingInFlightRef.current = false;
            setIsSaving(false);
            // If another save was queued while we were in-flight, fire it now
            if (pendingSaveRef.current) {
                pendingSaveRef.current = false;
                handleSave(false);
            }
        }
    };

    return (
        <div style={{ paddingBottom: '100px', background: 'var(--card-border)', minHeight: '100vh' }}>
            {/* Header Bar */}
            <div style={{
                background: 'var(--background)',
                borderBottom: '1px solid var(--card-border)',
                padding: '1rem',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {formattedDate} 📝
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSaving ? 'var(--warning)' : 'var(--success)' }}>
                        {isSaving ? 'Saving...' : '✓ All Changes Saved'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--card-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${validationStats.percentage}%`,
                        height: '100%',
                        background: validationStats.percentage === 100 ? 'var(--success)' : 'var(--primary)',
                        transition: 'width 0.08s linear' // Near-instant update
                    }} />
                </div>
            </div>

            <div style={{ padding: '0 1rem' }}>
                {/* Session Name & Stats */}
                <div className="glass-panel" style={{
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1rem',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>Session {dayNum}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Plate Loader & Calculators Shortcut */}
                        <button
                            type="button"
                            onClick={() => setShowSuiteModal(true)}
                            title="Open Plate Loader & Calculators"
                            className="chat-press"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.28)',
                                color: '#f87171',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <span>🏋️</span>
                            <span className="hidden sm:inline">Calculators</span>
                        </button>

                        {/* Unit toggle */}
                        <div style={{
                            display: 'flex',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '20px',
                            padding: '2px'
                        }}>
                            {(['lbs', 'kg'] as const).map(u => (
                                <button
                                    key={u}
                                    onClick={() => toggleUnit(u)}
                                    style={{
                                        padding: '2px 10px',
                                        borderRadius: '16px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: unit === u ? 'var(--primary)' : 'transparent',
                                        color: unit === u ? 'white' : 'rgba(255,255,255,0.7)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {u.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9, textAlign: 'right' }}>
                            <div style={{ fontWeight: 600 }}>Stress: {sessionStats.total}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>C: {sessionStats.central} | P: {sessionStats.peripheral}</div>
                        </div>
                    </div>
                </div>

                {/* Warm-Up / Pre-Workout Drills Section */}
                <div style={{ 
                    marginBottom: '1rem', 
                    background: 'var(--card-bg)', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        padding: '10px 16px', 
                        background: 'rgba(255,255,255,0.03)', 
                        borderBottom: '1px solid var(--card-border)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{ fontSize: '1.1rem' }}></span> Warm-Up & Prep Drills
                    </div>
                    <div style={{ padding: '0' }}>
                        <textarea
                            value={warmupDrills}
                            onChange={(e) => setWarmupDrills(e.target.value)}
                            placeholder="Write out warm-up drills, mobility work, or pre-workout instructions here..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                fontSize: '0.95rem',
                                color: 'var(--foreground)',
                                resize: 'vertical',
                                outline: 'none',
                                lineHeight: '1.5'
                            }}
                        />
                    </div>
                </div>

                {/* Exercise Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    {exerciseLogs.map((ex, exIndex) => {
                        // Max E1RM calc
                        const validSets = ex.sets.filter(s => s.actual.weight && s.actual.reps && s.actual.rpe);
                        const e1rms = validSets.map(s => calculateSimpleE1RM(s.actual.weight, s.actual.reps, s.actual.rpe));
                        const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                        // Stats for this exercise
                        const exStress = { total: 0, central: 0, peripheral: 0 };
                        let tonnage = 0;
                        let totalNL = 0;
                        ex.sets.forEach(s => {
                            const w = parseFloat(s.actual.weight) || 0;
                            const r = parseFloat(s.actual.reps) || 0;
                            const rpe = parseFloat(s.actual.rpe) || 0;
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
                            <div key={ex.exerciseId} style={{ borderBottom: exIndex < exerciseLogs.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                                {/* Exercise Header */}
                                <div style={{
                                    background: 'var(--card-bg)',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => toggleCollapse(exIndex)}
                                            style={{
                                                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: '2px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)', fontWeight: 'bold', cursor: 'pointer', padding: 0
                                            }}
                                        >
                                            {ex.isCollapsed ? '+' : '−'}
                                        </button>
                                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 500, margin: 0 }}>{ex.name}</h3>
                                        {(() => {
                                            const planned = plannedTopSets[ex.name];
                                            if (!planned || (!planned.weight && !planned.reps) || !ex.isCollapsed) return null;
                                            return (
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    background: 'rgba(56, 189, 248, 0.08)',
                                                    border: '1px solid rgba(56, 189, 248, 0.2)',
                                                    color: '#38bdf8',
                                                    fontWeight: 600,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <span>Top Set:</span>
                                                    <span style={{ color: '#ffffff', fontWeight: 700 }}>
                                                        {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                    </span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                                        Sets
                                        <input
                                            type="number"
                                            value={ex.sets.length}
                                            onChange={(e) => updateSetsCount(exIndex, e.target.value)}
                                            style={{ width: '40px', padding: '4px', textAlign: 'center', background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)', borderRadius: '4px' }}
                                        />
                                        <span style={{ fontSize: '1.2rem', color: 'var(--secondary-foreground)', marginLeft: 4 }}>...</span>
                                    </div>
                                </div>

                                {!ex.isCollapsed && (
                                    <div style={{ padding: '0 8px 16px 8px' }}>
                                        {/* Planned top set banner */}
                                        {(() => {
                                            const planned = plannedTopSets[ex.name];
                                            if (!planned || (!planned.weight && !planned.reps)) return null;
                                            return (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                    padding: '9px 14px',
                                                    marginBottom: '12px',
                                                    marginTop: '8px',
                                                    borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
                                                    border: '1px solid rgba(56, 189, 248, 0.22)',
                                                    borderLeft: '3px solid #38bdf8',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                                                    fontSize: '0.84rem',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            letterSpacing: '0.06em',
                                                            color: '#38bdf8',
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            Planned Top Set
                                                        </span>
                                                        <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem' }}>
                                                            {planned.weight ? `${planned.weight} ${planned.unit || unit}` : ''}{planned.reps ? ` × ${planned.reps}` : ''}{planned.rpe ? ` @ ${planned.rpe}` : ''}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setExerciseLogs(prev => {
                                                                const copy = JSON.parse(JSON.stringify(prev));
                                                                if (copy[exIndex]?.sets?.[0]) {
                                                                    copy[exIndex].sets[0].actual = {
                                                                        weight: planned.weight ? String(planned.weight) : '',
                                                                        reps: planned.reps ? String(planned.reps) : '',
                                                                        rpe: planned.rpe ? String(planned.rpe) : ''
                                                                    };
                                                                }
                                                                return copy;
                                                            });
                                                        }}
                                                        style={{
                                                            padding: '4px 10px',
                                                            fontSize: '0.72rem',
                                                            borderRadius: 7,
                                                            border: '1px solid rgba(56, 189, 248, 0.35)',
                                                            background: 'rgba(56, 189, 248, 0.12)',
                                                            color: '#38bdf8',
                                                            cursor: 'pointer',
                                                            fontWeight: 600,
                                                            flexShrink: 0,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        Fill Set 1
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                        {/* Coach Note / Cue Callout */}
                                        {(ex.coachNotes || exercises?.[exIndex]?.notes) && (
                                            <div style={{
                                                background: 'rgba(6, 182, 212, 0.08)',
                                                border: '1px solid rgba(6, 182, 212, 0.25)',
                                                borderLeft: '4px solid var(--primary)',
                                                borderRadius: '8px',
                                                padding: '10px 14px',
                                                marginBottom: '12px',
                                                marginTop: '8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                overflow: 'hidden',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                            }}>
                                                <div style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    color: 'var(--primary)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                }}>
                                                    Coach Note / Instructions
                                                </div>
                                                <div style={{
                                                    fontSize: '0.88rem',
                                                    color: 'var(--foreground)',
                                                    lineHeight: 1.4,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                }}>
                                                    {linkify(ex.coachNotes || exercises?.[exIndex]?.notes)}
                                                </div>
                                            </div>
                                        )}

                                                                        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0 8px 0', fontSize: '0.72rem', color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                            <span style={{ width: '20px', textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                                                                                #
                                                                            </span>
                                                                            <span style={{ flex: 1, textAlign: 'center' }}>Weight ({unit})</span>
                                                                            <span style={{ flex: 1, textAlign: 'center' }}>Reps</span>
                                                                            <span style={{ flex: 1, textAlign: 'center' }}>RPE</span>
                                                                            <div style={{ width: '32px' }} />
                                                                        </div>

                                                                        {/* Set Rows */}
                                                                        {ex.sets.map((set, sIndex) => {
                                                                            const repsStr = String(set.target.reps);
                                                                            const cleanReps = repsStr.includes('-') ? repsStr.split('-')[0] : repsStr;
                                                                            const planned = sIndex === 0 ? plannedTopSets[ex.name] : null;
                                                                            const isPlannedTopSet = !!(planned && (planned.weight || planned.reps || planned.rpe));

                                                                            return (
                                                                                <div key={sIndex} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                                                    {/* Stacked Prescribed Target Header */}
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        padding: '0 40px 0 28px',
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
                                                                                                ? `Plan: ${planned.weight} ${planned.unit || unit}`
                                                                                                : (set.target.weight ? `Rx: ${set.target.weight} ${unit}` : 'Rx: —')}
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
                                                                                                ? `Plan: ${planned.reps} reps`
                                                                                                : (cleanReps ? `Rx: ${cleanReps}` : 'Rx: —')}
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
                                                                                                ? `Plan: @ ${planned.rpe}`
                                                                                                : (set.target.rpe ? `Rx: @ ${set.target.rpe}` : 'Rx: —')}
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
                                                                                            {sIndex + 1}
                                                                                        </span>

                                                                                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                                            <WeightInput
                                                                                                internalValue={set.actual.weight}
                                                                                                unit={unit}
                                                                                                onChange={(val) => updateSet(exIndex, sIndex, 'weight', val)}
                                                                                                placeholder=""
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
                                                                                                value={set.actual.reps}
                                                                                                onChange={(e) => updateSet(exIndex, sIndex, 'reps', e.target.value)}
                                                                                                placeholder=""
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
                                                                                                value={set.actual.rpe}
                                                                                                onChange={(e) => updateSet(exIndex, sIndex, 'rpe', e.target.value)}
                                                                                                placeholder=""
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
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '32px', flexShrink: 0 }}>
                                                                                            <button
                                                                                                onClick={() => copyTargetToActual(exIndex, sIndex)}
                                                                                                title="Copy Prescribed"
                                                                                                style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '3px 0', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                            >
                                                                                                Rx
                                                                                            </button>
                                                                                            {sIndex > 0 && (
                                                                                                <button
                                                                                                    onClick={() => copyPreviousSet(exIndex, sIndex)}
                                                                                                    title="Copy Previous Set"
                                                                                                    style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--foreground)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px', cursor: 'pointer', padding: '3px 0', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                                >
                                                                                                    Prev
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}

                                        {/* Stats row */}
                                        <div style={{ padding: '12px 0 8px 0', borderBottom: '1px dashed var(--card-border)', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                                <span>E1RM: {maxE1RM} {unit}</span>
                                                <span>NL: {totalNL}</span>
                                                <span>Tonnage: {tonnage.toLocaleString()} {unit}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: 4 }}>
                                                <span>Total: <span style={{ fontWeight: 'normal' }}>{exStress.total.toFixed(2)}</span></span>
                                                <span>Peripheral: <span style={{ fontWeight: 'normal' }}>{exStress.peripheral.toFixed(2)}</span></span>
                                                <span>Central: <span style={{ fontWeight: 'normal' }}>{exStress.central.toFixed(2)}</span></span>
                                            </div>
                                        </div>

                                        {/* Notes field */}
                                        <div style={{ marginTop: '12px' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>Notes</label>
                                            <textarea
                                                value={ex.notes}
                                                onChange={(e) => {
                                                    const newLogs = [...exerciseLogs];
                                                    newLogs[exIndex].notes = e.target.value;
                                                    setExerciseLogs(newLogs);
                                                }}
                                                placeholder="Add exercise notes here..."
                                                style={{
                                                    width: '100%',
                                                    minHeight: '60px',
                                                    padding: '8px',
                                                    border: '1px solid var(--card-border)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem',
                                                    color: 'var(--foreground)',
                                                    resize: 'vertical',
                                                    outlineColor: 'var(--primary)'
                                                }}
                                            />
                                        </div>

                                        {/* Send Coach Feedback */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px' }}>
                                            <ExerciseFeedback
                                                athleteId={athleteId}
                                                coachId={coachId}
                                                exerciseName={ex.name}
                                                weekNum={weekNum}
                                                dayNum={dayNum}
                                                blockName={blockName}
                                                sessionId={sessionId}
                                                sets={ex.sets}
                                                unit={unit}
                                            />
                                            <PRToggle
                                                athleteId={athleteId}
                                                exerciseName={ex.name}
                                                sets={ex.sets.map(s => (s.actual || { weight: '', reps: '', rpe: '' }))}
                                                unit={unit}
                                                sessionId={sessionId}
                                                programName={blockName}
                                                weekNum={weekNum}
                                                dayNum={dayNum}
                                                date={new Date().toISOString().split('T')[0]}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Plan Next Week's Top Sets */}
                    {exercises.length > 0 && (
                        <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                            <PlannedTopSetInput
                                athleteId={athleteId}
                                sessionId={sessionId}
                                programId={programId}
                                weekNum={weekNum}
                                dayNum={dayNum}
                                exercises={exercises.map(e => ({ name: e.name }))}
                                unit={unit}
                                targetNextWeek={true}
                                onSaved={fetchPlannedTopSets}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Week Overview Drawer Backdrop */}
            {weekDrawerOpen && (
                <div
                    onClick={() => setWeekDrawerOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.6)',
                        zIndex: 200,
                        transition: 'opacity 0.3s ease'
                    }}
                />
            )}

            {/* Week Overview Drawer */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 201,
                transform: weekDrawerOpen ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                maxHeight: '85vh',
                overflowY: 'auto',
                background: 'var(--background)',
                borderTop: '2px solid var(--primary)',
                borderRadius: '16px 16px 0 0',
                padding: '0 0 2rem 0'
            }}>
                {/* Drawer Handle */}
                <div
                    onClick={() => setWeekDrawerOpen(false)}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '12px 0 8px 0',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        width: 40,
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--card-border)'
                    }} />
                </div>

                {/* Drawer Header */}
                <div style={{
                    textAlign: 'center',
                    padding: '0 1rem 1rem 1rem',
                    borderBottom: '1px solid var(--card-border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                            Training Program
                        </h2>
                        <span style={{ fontSize: '1.1rem', opacity: 0.6 }}>&#128197;</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', margin: '4px 0 0 0' }}>
                        {weekStartDate ? `Week of ${weekStartDate}` : `Week ${weekNum}`}
                    </p>
                </div>

                {/* Sessions by Day */}
                <div style={{ padding: '1rem' }}>
                    {weekSessions
                        .sort((a, b) => a.day - b.day)
                        .map((sess) => {
                            let dayName = DAY_NAMES[((sess.day || 1) - 1) % 7] || `Day ${sess.day}`;
                            if (weekStartDate) {
                                const start = new Date(weekStartDate);
                                start.setDate(start.getDate() + ((sess.day || 1) - 1));
                                if (!isNaN(start.getTime())) {
                                    dayName = start.toLocaleDateString('en-US', { weekday: 'long' });
                                }
                            }
                            const fullLabel = sess.name ? `${dayName} — ${sess.name}` : dayName;
                            const isCurrentSession = sess.day === dayNum;

                            return (
                                <div key={sess.day} style={{ marginBottom: '1.25rem' }}>
                                    {/* Day Label */}
                                    <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        color: isCurrentSession ? 'var(--primary)' : 'var(--secondary-foreground)',
                                        marginBottom: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        {fullLabel}
                                        {isCurrentSession && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                background: 'rgba(6, 182, 212, 0.15)',
                                                color: 'var(--primary)',
                                                padding: '2px 8px',
                                                borderRadius: '9999px',
                                                fontWeight: 600,
                                                textTransform: 'none'
                                            }}>Current</span>
                                        )}
                                    </div>

                                    {/* Exercise Cards */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {(sess.exercises || []).map((ex, exIdx) => {
                                            const category = ex.category || getExerciseCategory(ex.name);
                                            const color = CATEGORY_COLORS[category] || '#94A3B8';
                                            const setsSummary = formatSetsSummary(ex.sets);
                                            const targetSessionId = `${programId}_w${weekNum}_d${sess.day}`;

                                            return (
                                                <div
                                                    key={ex.id || exIdx}
                                                    onClick={() => {
                                                        if (!isCurrentSession) {
                                                            setWeekDrawerOpen(false);
                                                            router.push(`/athlete/${athleteId}/workout/${targetSessionId}`);
                                                        }
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.75rem 1rem',
                                                        background: 'var(--card-bg)',
                                                        border: `1px solid ${color}30`,
                                                        borderRadius: '8px',
                                                        cursor: isCurrentSession ? 'default' : 'pointer',
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
                                                    {!isCurrentSession && (
                                                        <span style={{
                                                            color: color,
                                                            fontSize: '1.2rem',
                                                            fontWeight: 700,
                                                            marginLeft: '0.75rem',
                                                            opacity: 0.7
                                                        }}>+</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Footer with Finish Button + Week Overview Toggle */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                background: 'var(--glass-surface-2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid var(--glass-border)',
                padding: '1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px))',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <button
                    onClick={async () => {
                        await handleSave(true);
                    }}
                    disabled={isSaving}
                    className="glass-button glass-button-primary chat-press"
                    style={{
                        padding: '0.875rem 1.5rem',
                        borderRadius: '14px',
                        fontWeight: 700,
                        width: '100%',
                        fontSize: '1rem',
                        opacity: isSaving ? 0.7 : 1,
                    }}
                >
                    {isSaving ? 'Saving...' : 'Finish Session'}
                </button>

                {/* Week Overview Toggle Button */}
                {weekSessions.length > 0 && (
                    <button
                        onClick={() => setWeekDrawerOpen(true)}
                        className="glass-button chat-press"
                        style={{
                            color: 'white',
                            width: '56px',
                            height: '34px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Celebration Modal */}
            {celebration && (
                <CelebrationScreen
                    athleteId={athleteId}
                    coachId={coachId}
                    sessionName={celebration.sessionName}
                    onClose={() => {
                        setCelebration(null);
                        router.push(`/athlete/${athleteId}/dashboard`);
                        router.refresh();
                    }}
                />
            )}

            {/* Strength Suite / Plate Loader Modal */}
            <StrengthSuiteModal
                isOpen={showSuiteModal}
                onClose={() => setShowSuiteModal(false)}
                initialUnit={unit === 'lbs' ? 'lb' : 'kg'}
            />
        </div>
    );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { EXERCISE_DB, EXERCISE_CATEGORIES } from '@/lib/exercise-db';
import { Trash2 } from 'lucide-react';

export default function ExercisePicker({ onDragStart, onAdd, initialExercises = null }: { onDragStart?: any, onAdd?: any, initialExercises?: any }) {
    // Combined DB state
    const [exerciseDB, setExerciseDB] = useState(initialExercises || {});
    const [searchTerm, setSearchTerm] = useState('');

    // Custom Exercise State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseCategory, setNewExerciseCategory] = useState(EXERCISE_CATEGORIES.KNEE);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);

    // Fetch exercises on mount
    const refreshExercises = async () => {
        try {
            const res = await fetch('/api/exercises');
            if (res.ok) {
                const data = await res.json();
                const combined = {};

                // Use API data if available
                if (data.static) {
                    data.static.forEach(ex => combined[ex.name] = ex);
                } else {
                    // Fallback to local DB if API doesn't return static
                    Object.entries(EXERCISE_DB).forEach(([name, details]) => {
                        combined[name] = { name, ...details };
                    });
                }

                // Then custom
                if (data.custom) {
                    data.custom.forEach(ex => combined[ex.name] = ex);
                }
                setExerciseDB(combined);
            } else {
                throw new Error('API failed');
            }
        } catch (e) {
            console.error("Failed to fetch exercises", e);
            // Fallback
            const combined = {};
            Object.entries(EXERCISE_DB).forEach(([name, details]) => {
                combined[name] = { name, ...details };
            });
            setExerciseDB(combined);
        }
    };

    useEffect(() => {
        if (!initialExercises || Object.keys(initialExercises).length === 0) {
            refreshExercises();
        } else {
            setExerciseDB(initialExercises);
        }
    }, [initialExercises]);

    const groupedExercises = useMemo(() => {
        const groups: Record<string, string[]> = {};

        const allExercises = Object.values(exerciseDB);

        // Filter first
        const filtered = allExercises.filter((ex: any) =>
            ex.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.forEach((ex: any) => {
            const cat = ex.category || 'Other';
            if (!groups[cat]) {
                groups[cat] = [];
            }
            groups[cat].push(ex.name);
        });

        // Sort categories alphabetically or by custom order if needed
        // For now, object keys iteration order is roughly insertion order, but better to rely on rendering sort
        return groups;
    }, [exerciseDB, searchTerm]);

    const toggleCategory = (cat) => {
        setExpandedCategory(expandedCategory === cat ? null : cat);
    };

    const handleAddCustomExercise = async () => {
        if (!newExerciseName) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newExerciseName,
                    category: newExerciseCategory
                })
            });

            if (res.ok) {
                setShowAddModal(false);
                setNewExerciseName('');
                await refreshExercises(); // Reload list
            } else {
                alert('Failed to add exercise (name might exist)');
            }
        } catch (e) {
            console.error(e);
            alert('Error adding exercise');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomExercise = async (name: string) => {
        if (!confirm(`Delete custom exercise "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/exercises?name=${encodeURIComponent(name)}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                await refreshExercises();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete exercise');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting exercise');
        }
    };

    const handleDragStartInternal = (e, name) => {
        // Find full exercise data
        const exerciseData = exerciseDB[name] || { name };
        // Set structured payload so weekly view can identify library drags
        const payload = JSON.stringify({ type: 'exercise-library', name: exerciseData.name, category: exerciseData.category || '' });
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(e, exerciseData);
    };

    return (
        <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>Exercise Library</h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="glass-button glass-button-primary chat-press"
                    style={{ borderRadius: '50%', width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                    title="Add Custom Exercise"
                >
                    +
                </button>
            </div>

            <input
                className="glass-input"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ marginBottom: '1rem', width: '100%', fontSize: '0.85rem' }}
            />

            {showAddModal && (
                <div className="glass-panel-elevated" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '12px', animation: 'popoverIn 160ms var(--ease-out)' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>New Exercise</h4>
                    <input
                        className="glass-input"
                        placeholder="Exercise Name"
                        value={newExerciseName}
                        onChange={e => setNewExerciseName(e.target.value)}
                        style={{ marginBottom: '0.5rem', width: '100%', fontSize: '0.85rem' }}
                    />
                    <select
                        className="glass-input"
                        value={newExerciseCategory}
                        onChange={e => setNewExerciseCategory(e.target.value)}
                        style={{ marginBottom: '0.75rem', width: '100%', fontSize: '0.85rem' }}
                    >
                        {Object.values(EXERCISE_CATEGORIES).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleAddCustomExercise} disabled={isSaving} className="glass-button glass-button-primary chat-press" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setShowAddModal(false)} className="glass-button chat-press" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {Object.keys(groupedExercises).map(category => {
                    const exercises = groupedExercises[category] || [];
                    const isExpanded = expandedCategory === category;
                    if (exercises.length === 0) return null;

                    return (
                        <div key={category} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden' }}>
                            <button
                                onClick={() => toggleCategory(category)}
                                className="chat-press"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: isExpanded ? 'rgba(125, 135, 210, 0.12)' : 'var(--glass-surface-2)',
                                    border: 'none',
                                    color: 'var(--foreground)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <span>{category}</span>
                                <span className="glass-badge" style={{ fontSize: '0.7rem' }}>{exercises.length}</span>
                            </button>

                            {isExpanded && (
                                <div style={{ padding: '0.4rem', background: 'var(--glass-surface-1)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {exercises.map(exName => {
                                        const exData: any = exerciseDB[exName] || { name: exName };
                                        const isCustom = !!exData.isCustom;
                                        return (
                                            <div
                                                key={exName}
                                                draggable
                                                onDragStart={(e) => handleDragStartInternal(e, exName)}
                                                onClick={() => onAdd(exData)}
                                                style={{
                                                    padding: '0.5rem 0.65rem',
                                                    background: 'var(--glass-surface-2)',
                                                    borderRadius: '8px',
                                                    cursor: 'grab',
                                                    border: '1px solid var(--glass-border)',
                                                    transition: 'all 0.15s',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                className="exercise-item chat-press"
                                            >
                                                <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        whiteSpace: 'normal',
                                                        wordBreak: 'break-word',
                                                        lineHeight: 1.3,
                                                        fontWeight: 500,
                                                        fontSize: '0.84rem',
                                                        color: 'var(--foreground)',
                                                    }} title={exName}>
                                                        {exName}
                                                    </span>
                                                    {isCustom && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            color: 'var(--accent)',
                                                            border: '1px solid var(--accent)',
                                                            borderRadius: 3,
                                                            padding: '1px 4px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.04em',
                                                            flexShrink: 0,
                                                            alignSelf: 'center',
                                                        }}>Custom</span>
                                                    )}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                                    {isCustom && (
                                                        <button
                                                            type="button"
                                                            title={`Delete custom exercise "${exName}"`}
                                                            aria-label={`Delete custom exercise ${exName}`}
                                                            draggable={false}
                                                            onMouseDown={e => e.stopPropagation()}
                                                            onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                handleDeleteCustomExercise(exName);
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--error, #ef4444)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.95rem',
                                                                padding: '2px 6px',
                                                                borderRadius: 4,
                                                                lineHeight: 1,
                                                            }}
                                                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                                                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                    <span style={{ fontSize: '1.2rem', lineHeight: 0, color: 'var(--accent)' }}>+</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .exercise-item:hover {
                    border-color: var(--accent);
                    transform: translateX(4px);
                }
            `}</style>
        </div>
    );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { EXERCISE_DB, EXERCISE_CATEGORIES } from '@/lib/exercise-db';

export default function ExercisePicker({ onDragStart, onAdd }) {
    // Combined DB state
    const [exerciseDB, setExerciseDB] = useState({});
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
        refreshExercises();
    }, []);

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

    const handleDragStartInternal = (e, name) => {
        // Find full exercise data
        const exerciseData = exerciseDB[name] || { name };
        onDragStart(e, exerciseData);
    };

    return (
        <div className="card" style={{ height: '100%', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>Exercise Library</h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{ background: 'var(--accent)', color: 'black', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold' }}
                    title="Add Custom Exercise"
                >
                    +
                </button>
            </div>

            <input
                className="input"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ marginBottom: '1rem', width: '100%' }}
            />

            {showAddModal && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>New Exercise</h4>
                    <input
                        className="input"
                        placeholder="Exercise Name"
                        value={newExerciseName}
                        onChange={e => setNewExerciseName(e.target.value)}
                        style={{ marginBottom: '0.5rem', width: '100%' }}
                    />
                    <select
                        className="input"
                        value={newExerciseCategory}
                        onChange={e => setNewExerciseCategory(e.target.value)}
                        style={{ marginBottom: '0.5rem', width: '100%' }}
                    >
                        {Object.values(EXERCISE_CATEGORIES).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleAddCustomExercise} disabled={isSaving} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.keys(groupedExercises).map(category => {
                    const exercises = groupedExercises[category] || [];
                    const isExpanded = expandedCategory === category;
                    if (exercises.length === 0) return null;

                    return (
                        <div key={category} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                            <button
                                onClick={() => toggleCategory(category)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    border: 'none',
                                    color: 'var(--foreground)',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                <span>{category}</span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{exercises.length}</span>
                            </button>

                            {isExpanded && (
                                <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                                    {exercises.map(exName => (
                                        <div
                                            key={exName}
                                            draggable
                                            onDragStart={(e) => handleDragStartInternal(e, exName)}
                                            onClick={() => onAdd(exName)}
                                            style={{
                                                padding: '0.5rem',
                                                marginBottom: '4px',
                                                background: 'var(--card-bg)',
                                                borderRadius: '4px',
                                                cursor: 'grab',
                                                fontSize: '0.9rem',
                                                border: '1px solid transparent',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                            className="exercise-item"
                                        >
                                            {exName}
                                            <span style={{ fontSize: '1.2rem', lineHeight: 0, color: 'var(--accent)' }}>+</span>
                                        </div>
                                    ))}
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

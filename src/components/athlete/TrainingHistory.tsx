'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Calendar, Dumbbell } from 'lucide-react';
import { getExerciseCategory } from '@/lib/exercise-db';

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

interface SetData {
    weight?: string;
    reps?: string;
    rpe?: string;
}

interface ExerciseData {
    name: string;
    category?: string;
    sets?: SetData[];
    notes?: string;
}

interface LogEntry {
    id: string;
    programId: string;
    sessionId: string;
    date: string;
    exercises: ExerciseData[];
}

interface ProgramEntry {
    id: string;
    name: string;
}

interface MatchedExercise {
    exercise: ExerciseData;
    log: LogEntry;
    programName: string;
}

export default function TrainingHistory({
    logs,
    programs,
}: {
    logs: LogEntry[];
    programs: ProgramEntry[];
}) {
    const [query, setQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const programMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of programs) map[p.id] = p.name;
        return map;
    }, [programs]);

    const results: MatchedExercise[] = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const matched: MatchedExercise[] = [];
        for (const log of logs) {
            const exercises = Array.isArray(log.exercises) ? log.exercises : [];
            for (const ex of exercises) {
                if (ex.name?.toLowerCase().includes(q)) {
                    matched.push({
                        exercise: ex,
                        log,
                        programName: programMap[log.programId] || 'Unknown Program',
                    });
                }
            }
        }

        // Sort by date descending (most recent first)
        matched.sort((a, b) => {
            const dateA = a.log.date || '';
            const dateB = b.log.date || '';
            return dateB.localeCompare(dateA);
        });

        return matched;
    }, [query, logs, programMap]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'No date';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const formatSets = (sets?: SetData[]) => {
        if (!sets || sets.length === 0) return 'No sets logged';
        return sets
            .map((s, i) => {
                const parts: string[] = [];
                if (s.weight) parts.push(`${s.weight}kg`);
                if (s.reps) parts.push(`${s.reps} reps`);
                if (s.rpe) parts.push(`RPE ${s.rpe}`);
                return parts.length > 0 ? `Set ${i + 1}: ${parts.join(' × ')}` : null;
            })
            .filter(Boolean)
            .join('\n');
    };

    const bestSet = (sets?: SetData[]) => {
        if (!sets || sets.length === 0) return null;
        let best: SetData | null = null;
        let bestWeight = 0;
        for (const s of sets) {
            const w = parseFloat(s.weight || '0');
            if (w > bestWeight) {
                bestWeight = w;
                best = s;
            }
        }
        return best;
    };

    return (
        <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Training History</h1>

            {/* Search Input */}
            <div style={{
                position: 'relative',
                marginBottom: '1.5rem',
            }}>
                <Search size={18} style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--secondary-foreground)',
                    pointerEvents: 'none',
                }} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search exercises... e.g. paused squats"
                    style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        borderRadius: 10,
                        border: '1px solid var(--card-border)',
                        background: 'var(--card-bg)',
                        color: 'var(--foreground)',
                        fontSize: '0.95rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Results */}
            {query.trim() && results.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: 'var(--secondary-foreground)',
                }}>
                    <Dumbbell size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                    <p>No exercises found matching "{query}"</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Try a different name or partial match</p>
                </div>
            )}

            {!query.trim() && (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: 'var(--secondary-foreground)',
                }}>
                    <Search size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                    <p>Search your training history</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Find when you last did an exercise, track weights over time
                    </p>
                </div>
            )}

            {results.length > 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.75rem' }}>
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.map((r, idx) => {
                    const key = `${r.log.id}_${r.exercise.name}_${idx}`;
                    const isExpanded = expandedId === key;
                    const category = r.exercise.category || getExerciseCategory(r.exercise.name);
                    const catColor = CATEGORY_COLORS[category] || '#94A3B8';
                    const best = bestSet(r.exercise.sets);

                    return (
                        <div
                            key={key}
                            style={{
                                border: '1px solid var(--card-border)',
                                borderRadius: 10,
                                background: 'var(--card-bg)',
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : key)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--foreground)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: 4,
                                    height: 36,
                                    borderRadius: 2,
                                    background: catColor,
                                    flexShrink: 0,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {r.exercise.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            <Calendar size={11} />
                                            {formatDate(r.log.date)}
                                        </span>
                                        <span>·</span>
                                        <span>{r.programName}</span>
                                    </div>
                                </div>
                                {best && (
                                    <div style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--primary)',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                    }}>
                                        {best.weight && `${best.weight}kg`}
                                        {best.weight && best.reps && ' × '}
                                        {best.reps && `${best.reps}`}
                                    </div>
                                )}
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isExpanded && (
                                <div style={{
                                    padding: '0 1rem 0.75rem 1rem',
                                    borderTop: '1px solid var(--card-border)',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.75rem',
                                        marginBottom: '0.5rem',
                                    }}>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            background: catColor + '22',
                                            color: catColor,
                                            fontWeight: 600,
                                        }}>
                                            {category}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                            {r.exercise.sets?.length || 0} set{(r.exercise.sets?.length || 0) !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {r.exercise.sets && r.exercise.sets.length > 0 ? (
                                        <table style={{
                                            width: '100%',
                                            fontSize: '0.8rem',
                                            borderCollapse: 'collapse',
                                        }}>
                                            <thead>
                                                <tr style={{ color: 'var(--secondary-foreground)', textAlign: 'left' }}>
                                                    <th style={{ padding: '4px 0', fontWeight: 500 }}>Set</th>
                                                    <th style={{ padding: '4px 0', fontWeight: 500 }}>Weight</th>
                                                    <th style={{ padding: '4px 0', fontWeight: 500 }}>Reps</th>
                                                    <th style={{ padding: '4px 0', fontWeight: 500 }}>RPE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {r.exercise.sets.map((s, si) => (
                                                    <tr key={si} style={{ borderTop: '1px solid var(--card-border)' }}>
                                                        <td style={{ padding: '4px 0' }}>{si + 1}</td>
                                                        <td style={{ padding: '4px 0' }}>{s.weight ? `${s.weight}kg` : '—'}</td>
                                                        <td style={{ padding: '4px 0' }}>{s.reps || '—'}</td>
                                                        <td style={{ padding: '4px 0' }}>{s.rpe || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>No sets logged</p>
                                    )}

                                    {r.exercise.notes && (
                                        <p style={{
                                            marginTop: '0.5rem',
                                            fontSize: '0.8rem',
                                            color: 'var(--secondary-foreground)',
                                            fontStyle: 'italic',
                                        }}>
                                            {r.exercise.notes}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

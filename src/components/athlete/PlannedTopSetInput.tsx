'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
    athleteId: string;
    sessionId: string;
    programId: string;
    weekNum: number;
    dayNum: number;
    exercises: Array<{ name: string }>;
    unit: string;
}

interface TopSetData {
    exerciseName: string;
    weight: string;
    reps: string;
    rpe: string;
}

export default function PlannedTopSetInput({
    athleteId, sessionId, programId, weekNum, dayNum, exercises, unit
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const [topSets, setTopSets] = useState<Record<string, TopSetData>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Fetch any existing planned top sets for this session
    useEffect(() => {
        fetch(`/api/top-sets?athleteId=${athleteId}&sessionId=${sessionId}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const existing: Record<string, TopSetData> = {};
                data.forEach((ts: any) => {
                    existing[ts.exerciseName] = {
                        exerciseName: ts.exerciseName,
                        weight: ts.weight || '',
                        reps: ts.reps || '',
                        rpe: ts.rpe || '',
                    };
                });
                setTopSets(existing);
                setLoaded(true);
                // Auto-expand if there are existing entries
                if (Object.keys(existing).length > 0) setSaved(true);
            })
            .catch(() => setLoaded(true));
    }, [athleteId, sessionId]);

    const updateField = useCallback((exName: string, field: keyof TopSetData, value: string) => {
        setTopSets(prev => ({
            ...prev,
            [exName]: { ...prev[exName] || { exerciseName: exName, weight: '', reps: '', rpe: '' }, [field]: value },
        }));
        setSaved(false);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const entries = Object.values(topSets).filter(ts => ts.weight || ts.reps);
            await Promise.all(
                entries.map(ts =>
                    fetch('/api/top-sets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            athleteId,
                            sessionId,
                            programId,
                            exerciseName: ts.exerciseName,
                            weight: ts.weight || null,
                            reps: ts.reps || null,
                            rpe: ts.rpe || null,
                            unit,
                            weekNum,
                            dayNum,
                        }),
                    })
                )
            );
            setSaved(true);
        } catch (e) {
            console.error('Top set save error:', e);
            alert('Failed to save planned top sets');
        } finally {
            setSaving(false);
        }
    };

    const hasEntries = Object.values(topSets).some(ts => ts.weight || ts.reps);

    if (!loaded) return null;

    return (
        <div style={{
            margin: '0 0 12px',
            background: saved && !expanded ? 'rgba(56, 189, 248, 0.06)' : 'rgba(56, 189, 248, 0.04)',
            border: `1px solid rgba(56, 189, 248, ${saved ? '0.2' : '0.12'})`,
            borderRadius: 12, overflow: 'hidden',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 14px', color: 'var(--foreground)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: saved ? 'rgba(56, 189, 248, 0.15)' : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99,102,241,0.2))',
                    }}>
                        <Target size={14} style={{ color: '#38bdf8' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Planned Top Sets</span>
                        {!expanded && saved && hasEntries && (
                            <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
                                {Object.values(topSets).filter(ts => ts.weight || ts.reps).length} exercise{Object.values(topSets).filter(ts => ts.weight || ts.reps).length !== 1 ? 's' : ''} planned
                            </span>
                        )}
                        {!expanded && !saved && !hasEntries && (
                            <span style={{ fontSize: 10, color: 'rgba(56,189,248,0.6)', fontWeight: 600 }}>
                                Plan your top sets for this session
                            </span>
                        )}
                    </div>
                </div>
                <div style={{
                    width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                }}>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} style={{ color: '#38bdf8' }} />}
                </div>
            </button>

            {/* Expanded form */}
            {expanded && (
                <div style={{ padding: '0 12px 12px' }}>
                    {exercises.slice(0, 4).map((ex, i) => {
                        const ts = topSets[ex.name] || { exerciseName: ex.name, weight: '', reps: '', rpe: '' };
                        return (
                            <div key={ex.name} style={{
                                padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
                                    {ex.name}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder={`${unit}`}
                                        value={ts.weight}
                                        onChange={e => updateField(ex.name, 'weight', e.target.value)}
                                        style={{
                                            flex: 2, background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                                            padding: '6px 8px', fontSize: 13, color: 'var(--foreground)',
                                            outline: 'none', textAlign: 'center', minWidth: 0,
                                        }}
                                    />
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="reps"
                                        value={ts.reps}
                                        onChange={e => updateField(ex.name, 'reps', e.target.value)}
                                        style={{
                                            flex: 1, background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                                            padding: '6px 8px', fontSize: 13, color: 'var(--foreground)',
                                            outline: 'none', textAlign: 'center', minWidth: 0,
                                        }}
                                    />
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="RPE"
                                        value={ts.rpe}
                                        onChange={e => updateField(ex.name, 'rpe', e.target.value)}
                                        style={{
                                            flex: 1, background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                                            padding: '6px 8px', fontSize: 13, color: 'var(--foreground)',
                                            outline: 'none', textAlign: 'center', minWidth: 0,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {/* Save button */}
                    {hasEntries && (
                        <button
                            onClick={handleSave}
                            disabled={saving || saved}
                            style={{
                                width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                                cursor: saving || saved ? 'default' : 'pointer', marginTop: 8,
                                background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #38bdf8, #6366f1)',
                                color: saved ? '#10b981' : '#fff', fontSize: 13, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
                                border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
                            }}
                        >
                            {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Save Planned Top Sets'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

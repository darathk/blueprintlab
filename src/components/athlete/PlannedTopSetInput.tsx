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
    targetNextWeek?: boolean;
    totalWeeks?: number;
    onSaved?: (targetSessionId?: string) => void;
}

interface TopSetData {
    exerciseName: string;
    weight: string;
    reps: string;
    rpe: string;
}

export default function PlannedTopSetInput({
    athleteId, sessionId, programId, weekNum, dayNum, exercises, unit,
    targetNextWeek = false,
    totalWeeks,
    onSaved,
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const [topSets, setTopSets] = useState<Record<string, TopSetData>>({});
    const [initialLoadedKeys, setInitialLoadedKeys] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // If targeting next week on the final week of a program, there is no next week
    const isFinalWeek = targetNextWeek && typeof totalWeeks === 'number' && totalWeeks > 0 && weekNum >= totalWeeks;

    // When targeting next week, the record is stored under the NEXT week's sessionId
    const targetWeekNum = targetNextWeek ? weekNum + 1 : weekNum;
    const targetSessionId = targetNextWeek
        ? `${programId}_w${targetWeekNum}_d${dayNum}`
        : sessionId;

    // Fetch any existing planned top sets for the target session
    useEffect(() => {
        if (isFinalWeek) {
            setLoaded(true);
            return;
        }
        fetch(`/api/top-sets?athleteId=${athleteId}&sessionId=${targetSessionId}&programId=${programId}&weekNum=${targetWeekNum}&dayNum=${dayNum}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const existing: Record<string, TopSetData> = {};
                const loadedKeys = new Set<string>();
                data.forEach((ts: any) => {
                    existing[ts.exerciseName] = {
                        exerciseName: ts.exerciseName,
                        weight: ts.weight || '',
                        reps: ts.reps || '',
                        rpe: ts.rpe || '',
                    };
                    if (ts.weight || ts.reps || ts.rpe) {
                        loadedKeys.add(ts.exerciseName);
                    }
                });
                setTopSets(existing);
                setInitialLoadedKeys(loadedKeys);
                setLoaded(true);
                if (loadedKeys.size > 0) setSaved(true);
            })
            .catch(() => setLoaded(true));
    }, [athleteId, targetSessionId, isFinalWeek]);

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
            // Find all exercises that have entries now OR previously had saved entries (to support clearing)
            const exercisesToSync = (exercises || []).filter(ex => {
                const current = topSets[ex.name];
                const hasCurrentData = current && (current.weight || current.reps || current.rpe);
                const hadPreviousData = initialLoadedKeys.has(ex.name);
                return hasCurrentData || hadPreviousData;
            });

            await Promise.all(
                exercisesToSync.map(ex => {
                    const ts = topSets[ex.name] || { exerciseName: ex.name, weight: '', reps: '', rpe: '' };
                    return fetch('/api/top-sets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            athleteId,
                            sessionId: targetSessionId,
                            programId,
                            exerciseName: ex.name,
                            weight: ts.weight || null,
                            reps: ts.reps || null,
                            rpe: ts.rpe || null,
                            unit,
                            weekNum: targetWeekNum,
                            dayNum,
                        }),
                    });
                })
            );

            // Update initialLoadedKeys to reflect current saved state
            const newLoadedKeys = new Set<string>();
            Object.values(topSets).forEach(ts => {
                if (ts.weight || ts.reps || ts.rpe) newLoadedKeys.add(ts.exerciseName);
            });
            setInitialLoadedKeys(newLoadedKeys);
            setSaved(true);
            if (onSaved) onSaved(targetSessionId);
        } catch (e) {
            console.error('Top set save error:', e);
            alert('Failed to save planned top sets');
        } finally {
            setSaving(false);
        }
    };

    const hasEntries = Object.values(topSets).some(ts => ts.weight || ts.reps);

    if (isFinalWeek) {
        return null;
    }

    if (!loaded) return null;

    const title = targetNextWeek ? 'Plan Next Week\'s Top Sets' : 'Planned Top Sets';
    const subtitle = targetNextWeek
        ? 'What do you want to hit next week?'
        : 'Plan your top sets for this session';

    return (
        <div style={{
            margin: '0 0 14px',
            background: saved && !expanded
                ? 'linear-gradient(180deg, rgba(20, 28, 44, 0.85) 0%, rgba(12, 16, 26, 0.95) 100%)'
                : 'linear-gradient(180deg, rgba(18, 24, 38, 0.85) 0%, rgba(10, 14, 22, 0.95) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid rgba(56, 189, 248, ${saved ? '0.35' : '0.2'})`,
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            overflow: 'hidden',
            transition: 'all 0.2s var(--ease-out)',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="chat-press"
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 16px', color: 'var(--foreground)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: saved ? 'rgba(56, 189, 248, 0.18)' : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99,102,241,0.2))',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 0 12px rgba(56, 189, 248, 0.2)',
                    }}>
                        <Target size={16} style={{ color: '#38bdf8' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>{title}</span>
                        {!expanded && saved && hasEntries && (
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginTop: 1 }}>
                                {Object.values(topSets).filter(ts => ts.weight || ts.reps).length} exercise{Object.values(topSets).filter(ts => ts.weight || ts.reps).length !== 1 ? 's' : ''} planned
                            </span>
                        )}
                        {!expanded && !saved && !hasEntries && (
                            <span style={{ fontSize: '0.72rem', color: 'rgba(56,189,248,0.7)', fontWeight: 500, marginTop: 1 }}>
                                {subtitle}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{
                    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} style={{ color: '#38bdf8' }} />}
                </div>
            </button>

            {/* Expanded form */}
            {expanded && (
                <div style={{ padding: '0 16px 16px' }}>
                    {targetNextWeek && (
                        <div style={{
                            fontSize: '0.75rem', color: 'rgba(56,189,248,0.85)', fontWeight: 600,
                            padding: '6px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            marginBottom: 10,
                        }}>
                            → Pre-fills Week {targetWeekNum} prescribed weights
                        </div>
                    )}
                    {(exercises || []).map((ex, i) => {
                        const ts = topSets[ex.name] || { exerciseName: ex.name, weight: '', reps: '', rpe: '' };
                        return (
                            <div key={ex.name} style={{
                                padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: 7 }}>
                                    {ex.name}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="any"
                                        placeholder={`${unit}`}
                                        value={ts.weight}
                                        onChange={e => updateField(ex.name, 'weight', e.target.value)}
                                        style={{
                                            flex: 2, background: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                                            padding: '8px 10px', fontSize: '0.88rem', color: 'var(--foreground)',
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
                                            flex: 1, background: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                                            padding: '8px 10px', fontSize: '0.88rem', color: 'var(--foreground)',
                                            outline: 'none', textAlign: 'center', minWidth: 0,
                                        }}
                                    />
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="any"
                                        placeholder="RPE"
                                        value={ts.rpe}
                                        onChange={e => updateField(ex.name, 'rpe', e.target.value)}
                                        style={{
                                            flex: 1, background: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                                            padding: '8px 10px', fontSize: '0.88rem', color: 'var(--foreground)',
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
                            className="chat-press"
                            style={{
                                width: '100%', padding: '11px', borderRadius: 12,
                                cursor: saving || saved ? 'default' : 'pointer', marginTop: 12,
                                background: saved ? 'rgba(16,185,129,0.18)' : 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                                color: saved ? '#34d399' : '#fff', fontSize: '0.88rem', fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
                                border: saved ? '1px solid rgba(16,185,129,0.35)' : 'none',
                                boxShadow: saved ? 'none' : '0 4px 16px rgba(56, 189, 248, 0.35)',
                            }}
                        >
                            {saved ? <><Check size={16} /> Saved for Week {targetWeekNum}</> : saving ? 'Saving...' : `Save for Week ${targetWeekNum}`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';

// Per-level descriptions from the coach's chart
// 1 = best, 5 = worst
const SCORE_DESCRIPTIONS: Record<string, Record<number, string>> = {
    leg_soreness: {
        1: 'No soreness or tightness at all.',
        2: 'Very light soreness. Barely noticeable.',
        3: 'Some soreness. Noticeable, but not severe.',
        4: 'Significant soreness. Clearly noticeable in daily activity.',
        5: 'Severe soreness. Pain to use this muscle in full range of motion.',
    },
    push_soreness: {
        1: 'No soreness or tightness at all.',
        2: 'Very light soreness. Barely noticeable.',
        3: 'Some soreness. Noticeable, but not severe.',
        4: 'Significant soreness. Clearly noticeable in daily activity.',
        5: 'Severe soreness. Pain to use this muscle in full range of motion.',
    },
    pull_soreness: {
        1: 'No soreness or tightness at all.',
        2: 'Very light soreness. Barely noticeable.',
        3: 'Some soreness. Noticeable, but not severe.',
        4: 'Significant soreness. Clearly noticeable in daily activity.',
        5: 'Severe soreness. Pain to use this muscle in full range of motion.',
    },
    tiredness: {
        1: 'I feel very fresh.',
        2: 'I feel fresh.',
        3: 'I feel normal — not especially tired or fresh.',
        4: "I'm more tired than normal.",
        5: "I'm always tired.",
    },
    recovery: {
        1: 'Very well recovered. No fatigue.',
        2: 'Well recovered. A little fatigue.',
        3: 'Somewhat adequate / moderate recovery. Some fatigue.',
        4: 'Not well recovered. Fatigued.',
        5: 'Very poorly recovered. Highly fatigued.',
    },
    motivation: {
        1: 'I want to train.',
        2: 'I somewhat want to train.',
        3: 'I am indifferent about training.',
        4: 'I somewhat do not want to train.',
        5: 'I do not want to train.',
    },
    training_load: {
        1: 'No training / recovery training only.',
        2: 'Low training load.',
        3: 'Normal / moderate training load.',
        4: 'High training load.',
        5: 'Very high training load.',
    },
};

const METRICS = [
    { id: 'leg_soreness', label: 'Leg Soreness', emoji: '🦵' },
    { id: 'push_soreness', label: 'Push Soreness', emoji: '💪' },
    { id: 'pull_soreness', label: 'Pull Soreness', emoji: '🔙' },
    { id: 'tiredness', label: 'Tiredness', emoji: '⚡' },
    { id: 'recovery', label: 'Perceived Recovery', emoji: '🔋' },
    { id: 'motivation', label: 'Motivation to Train', emoji: '🔥' },
    { id: 'training_load', label: 'Perceived Training Load', emoji: '🏋️' },
];

// 1 = green (best), 5 = red (worst)
const SCORE_COLORS = ['', '#10b981', '#34d399', '#fbbf24', '#f87171', '#ef4444'];

interface Props {
    athleteId: string;
    sessionKey: string;
    programId: string;
}

export default function ReadinessCheckin({ athleteId, sessionKey, programId }: Props) {
    const [scores, setScores] = useState<Record<string, number>>({});
    const [expanded, setExpanded] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    // Check if readiness already submitted for THIS session
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/readiness?athleteId=${athleteId}`);
                if (res.ok) {
                    const logs = await res.json();
                    const sessionLog = logs.find((l: any) => l.scores?._sessionKey === sessionKey);
                    if (sessionLog?.scores) {
                        const { _sessionKey, ...restScores } = sessionLog.scores;
                        setScores(restScores);
                        setSubmitted(true);
                    }
                }
            } catch { /* ignore */ }
        })();
    }, [athleteId, sessionKey]);

    const handleSelect = (id: string, value: number) => {
        setScores(prev => ({ ...prev, [id]: value }));
    };

    const isComplete = METRICS.every(m => scores[m.id]);

    const avgScore = isComplete
        ? (Object.values(scores).reduce((a, b) => a + b, 0) / METRICS.length).toFixed(1)
        : null;

    const handleSubmit = async () => {
        if (!isComplete) return;
        setSaving(true);
        try {
            await fetch('/api/readiness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athleteId,
                    programId,
                    date: today,
                    scores: { ...scores, _sessionKey: sessionKey },
                }),
            });
            setSubmitted(true);
        } catch (e) {
            console.error('Failed to save readiness:', e);
        }
        setSaving(false);
    };

    // Lower avg = better (green), higher = worse (red)
    const avgColor = avgScore
        ? parseFloat(avgScore) <= 2 ? '#10b981'
            : parseFloat(avgScore) <= 3 ? '#fbbf24'
                : '#ef4444'
        : 'var(--secondary-foreground)';

    // Submitted summary bar
    if (submitted && !expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
                    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', marginBottom: 12,
                    boxSizing: 'border-box',
                }}
            >
                {/* Top row: icon + label + avg */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600 }}>Readiness</span>
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: avgColor }}>{avgScore}</span>
                        <span style={{ fontSize: 10, color: 'var(--secondary-foreground)' }}>/ 5</span>
                        <ChevronDown size={14} style={{ color: 'var(--secondary-foreground)' }} />
                    </div>
                </div>
                {/* Bottom row: score pills */}
                <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'space-between' }}>
                    {METRICS.map(m => (
                        <div key={m.id} style={{
                            flex: 1, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${SCORE_COLORS[scores[m.id]] || '#555'}22`,
                            color: SCORE_COLORS[scores[m.id]] || '#999',
                            border: `1px solid ${SCORE_COLORS[scores[m.id]] || '#555'}44`,
                        }}>
                            {scores[m.id]}
                        </div>
                    ))}
                </div>
            </button>
        );
    }

    return (
        <div style={{
            background: expanded ? 'rgba(15, 23, 42, 0.5)' : 'linear-gradient(135deg, rgba(125,135,210,0.15), rgba(168,85,247,0.12))',
            border: expanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(125,135,210,0.35)',
            borderRadius: 12, marginBottom: 12, overflow: 'hidden',
            boxShadow: expanded ? 'none' : '0 0 20px rgba(125,135,210,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: expanded ? 'none' : 'linear-gradient(90deg, rgba(125,135,210,0.08), rgba(168,85,247,0.06))',
                    border: 'none', cursor: 'pointer',
                    padding: '12px 14px', color: 'var(--foreground)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: expanded ? 'rgba(125,135,210,0.2)' : 'linear-gradient(135deg, #7d87d2, #a855f7)',
                        boxShadow: expanded ? 'none' : '0 0 12px rgba(125,135,210,0.4)',
                    }}>
                        <Activity size={15} style={{ color: '#fff' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Pre-Session Readiness</span>
                        {!expanded && !submitted && (
                            <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.03em' }}>
                                Tap to check in before training
                            </span>
                        )}
                    </div>
                </div>
                <div style={{
                    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: expanded ? 'rgba(255,255,255,0.05)' : 'rgba(125,135,210,0.2)',
                }}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} style={{ color: '#a78bfa' }} />}
                </div>
            </button>

            {/* Expanded form */}
            {expanded && (
                <div style={{ padding: '0 14px 14px' }}>
                    {/* Scale legend */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                        fontSize: 10, padding: '6px 10px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>1 = Best</span>
                        <span style={{ color: 'var(--secondary-foreground)' }}>Lower is better</span>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>5 = Worst</span>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                        {METRICS.map(m => {
                            const selectedVal = scores[m.id];
                            const desc = selectedVal ? SCORE_DESCRIPTIONS[m.id]?.[selectedVal] : null;
                            const descColor = selectedVal ? SCORE_COLORS[selectedVal] : 'var(--secondary-foreground)';

                            return (
                                <div key={m.id}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14 }}>{m.emoji}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{m.label}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                                        {[1, 2, 3, 4, 5].map(val => {
                                            const selected = selectedVal === val;
                                            const color = SCORE_COLORS[val];
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => !submitted && handleSelect(m.id, val)}
                                                    style={{
                                                        height: 34, borderRadius: 8, border: 'none', cursor: submitted ? 'default' : 'pointer',
                                                        fontSize: 13, fontWeight: 700,
                                                        background: selected ? color : 'rgba(255,255,255,0.04)',
                                                        color: selected ? '#000' : 'rgba(255,255,255,0.3)',
                                                        opacity: selectedVal && !selected ? 0.35 : 1,
                                                        transition: 'all 0.15s',
                                                        boxShadow: selected ? `0 0 12px ${color}44` : 'none',
                                                    }}
                                                >
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Dynamic description based on selected value */}
                                    {desc && (
                                        <div style={{
                                            fontSize: 11, color: descColor, marginTop: 4,
                                            padding: '4px 8px', borderRadius: 6,
                                            background: `${descColor}10`,
                                            border: `1px solid ${descColor}20`,
                                            transition: 'all 0.2s',
                                        }}>
                                            {desc}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Average + Submit */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                        {avgScore && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>Avg:</span>
                                <span style={{ fontSize: 18, fontWeight: 800, color: avgColor }}>{avgScore}</span>
                                <span style={{ fontSize: 11, color: avgColor }}>/ 5</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {submitted ? (
                                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    ✓ Submitted
                                </span>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!isComplete || saving}
                                    style={{
                                        padding: '8px 20px', borderRadius: 8, border: 'none',
                                        fontSize: 13, fontWeight: 700, cursor: isComplete ? 'pointer' : 'not-allowed',
                                        background: isComplete ? 'linear-gradient(135deg, #7d87d2, #a855f7)' : 'rgba(255,255,255,0.1)',
                                        color: '#fff', opacity: isComplete ? 1 : 0.4,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {saving ? 'Saving...' : 'Submit'}
                                </button>
                            )}
                        </div>
                    </div>

                    {submitted && (
                        <button
                            onClick={() => setExpanded(false)}
                            style={{
                                width: '100%', marginTop: 8, padding: '6px', background: 'none',
                                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
                                color: 'var(--secondary-foreground)', fontSize: 11, cursor: 'pointer',
                            }}
                        >
                            Collapse
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';

const METRICS = [
    { id: 'leg_soreness', label: 'Legs', desc: 'How sore are your legs?', emoji: '🦵' },
    { id: 'push_soreness', label: 'Push', desc: 'Chest, shoulders & triceps soreness', emoji: '💪' },
    { id: 'pull_soreness', label: 'Pull', desc: 'Back & biceps soreness', emoji: '🔙' },
    { id: 'tiredness', label: 'Energy', desc: 'Overall energy & alertness level', emoji: '⚡' },
    { id: 'recovery', label: 'Recovery', desc: 'How recovered do you feel?', emoji: '🔋' },
    { id: 'motivation', label: 'Drive', desc: 'Motivation to train today', emoji: '🔥' },
    { id: 'training_load', label: 'Load', desc: 'How heavy does training feel?', emoji: '🏋️' },
];

const SCORE_COLORS = ['', '#ef4444', '#f87171', '#fbbf24', '#34d399', '#10b981'];

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
    const [existingData, setExistingData] = useState<Record<string, number> | null>(null);

    const today = new Date().toISOString().split('T')[0];

    // Check if readiness already submitted today
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/readiness?athleteId=${athleteId}`);
                if (res.ok) {
                    const logs = await res.json();
                    const todayLog = logs.find((l: any) => l.date?.startsWith(today));
                    if (todayLog?.scores) {
                        setExistingData(todayLog.scores);
                        setScores(todayLog.scores);
                        setSubmitted(true);
                    }
                }
            } catch { /* ignore */ }
        })();
    }, [athleteId, today]);

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
                body: JSON.stringify({ athleteId, programId, date: today, scores }),
            });
            setSubmitted(true);
            setExistingData(scores);
        } catch (e) {
            console.error('Failed to save readiness:', e);
        }
        setSaving(false);
    };

    const avgColor = avgScore
        ? parseFloat(avgScore) >= 4 ? '#10b981'
            : parseFloat(avgScore) >= 3 ? '#fbbf24'
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
                    <div style={{ display: 'grid', gap: 10 }}>
                        {METRICS.map(m => (
                            <div key={m.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 14 }}>{m.emoji}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{m.label}</span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', marginBottom: 6, paddingLeft: 22, opacity: 0.7 }}>
                                    {m.desc}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                                    {[1, 2, 3, 4, 5].map(val => {
                                        const selected = scores[m.id] === val;
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
                                                    opacity: scores[m.id] && !selected ? 0.35 : 1,
                                                    transition: 'all 0.15s',
                                                    boxShadow: selected ? `0 0 12px ${color}44` : 'none',
                                                }}
                                            >
                                                {val}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Score legend */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginTop: 8,
                        fontSize: 10, color: 'rgba(255,255,255,0.25)', padding: '0 2px',
                    }}>
                        <span>1 = Poor</span>
                        <span>5 = Excellent</span>
                    </div>

                    {/* Average + Submit */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                        {avgScore && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>Avg Readiness:</span>
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

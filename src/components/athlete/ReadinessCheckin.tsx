'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';

const METRICS = [
    { id: 'leg_soreness', label: 'Legs', emoji: '🦵', type: 'soreness' },
    { id: 'push_soreness', label: 'Push', emoji: '💪', type: 'soreness' },
    { id: 'pull_soreness', label: 'Pull', emoji: '🔙', type: 'soreness' },
    { id: 'tiredness', label: 'Energy', emoji: '⚡', type: 'general' },
    { id: 'recovery', label: 'Recovery', emoji: '🔋', type: 'general' },
    { id: 'motivation', label: 'Drive', emoji: '🔥', type: 'general' },
    { id: 'training_load', label: 'Load', emoji: '🏋️', type: 'general' },
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
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 10, padding: '10px 14px', cursor: 'pointer', marginBottom: 12,
                }}
            >
                <Activity size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600 }}>Readiness</span>
                <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
                    {METRICS.map(m => (
                        <div key={m.id} style={{
                            width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${SCORE_COLORS[scores[m.id]] || '#555'}22`,
                            color: SCORE_COLORS[scores[m.id]] || '#999',
                            border: `1px solid ${SCORE_COLORS[scores[m.id]] || '#555'}44`,
                        }}>
                            {scores[m.id]}
                        </div>
                    ))}
                </div>
                <div style={{
                    fontSize: 15, fontWeight: 800, color: avgColor,
                    background: `${avgColor}15`, borderRadius: 8, padding: '4px 10px',
                    flexShrink: 0,
                }}>
                    {avgScore}
                </div>
                <ChevronDown size={14} style={{ color: 'var(--secondary-foreground)', flexShrink: 0 }} />
            </button>
        );
    }

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, marginBottom: 12, overflow: 'hidden',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 14px', color: 'var(--foreground)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Pre-Session Readiness</span>
                    {!expanded && !submitted && (
                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500, opacity: 0.7 }}>
                            Tap to check in
                        </span>
                    )}
                </div>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Expanded form */}
            {expanded && (
                <div style={{ padding: '0 14px 14px' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {METRICS.map(m => (
                            <div key={m.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <span style={{ fontSize: 14 }}>{m.emoji}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{m.label}</span>
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

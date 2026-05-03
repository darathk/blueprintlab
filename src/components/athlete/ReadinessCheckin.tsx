'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

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
    onReadinessSubmit?: () => void;
}

/* ── Lateral-scroll card form ── */
function ExpandedForm({
    scores, submitted, saving, isComplete, avgScore, avgColor,
    onSelect, onSubmit, onCollapse,
}: {
    scores: Record<string, number>;
    submitted: boolean;
    saving: boolean;
    isComplete: boolean;
    avgScore: string | null;
    avgColor: string;
    onSelect: (id: string, val: number) => void;
    onSubmit: () => void;
    onCollapse: () => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    const scrollTo = useCallback((idx: number) => {
        const clamped = Math.max(0, Math.min(METRICS.length - 1, idx));
        scrollRef.current?.children[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setActiveIdx(clamped);
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollLeft = el.scrollLeft;
        const cardWidth = el.scrollWidth / METRICS.length;
        setActiveIdx(Math.round(scrollLeft / cardWidth));
    }, []);

    const m = METRICS[activeIdx];
    const selectedVal = m ? scores[m.id] : 0;
    const filledCount = METRICS.filter(met => scores[met.id]).length;

    return (
        <div style={{ padding: '0 0 14px' }}>
            {/* Hide scrollbar */}
            <style>{`.readiness-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* Progress bar + percentage */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 14px' }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${METRICS.length > 0 ? (filledCount / METRICS.length) * 100 : 0}%`,
                        background: filledCount === METRICS.length ? '#10b981' : 'var(--primary)',
                        transition: 'width 0.3s ease',
                    }} />
                </div>
                <span style={{ fontSize: 11, color: filledCount === METRICS.length ? '#10b981' : 'var(--secondary-foreground)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                    {METRICS.length > 0 ? Math.round((filledCount / METRICS.length) * 100) : 0}%
                </span>
            </div>

            {/* Card row: arrow – card – arrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px' }}>
                {/* Left arrow */}
                <button
                    onClick={() => scrollTo(activeIdx - 1)}
                    disabled={activeIdx === 0}
                    style={{
                        width: 32, minWidth: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                        cursor: activeIdx === 0 ? 'default' : 'pointer',
                        background: activeIdx === 0 ? 'transparent' : 'rgba(125,135,210,0.15)',
                        color: activeIdx === 0 ? 'rgba(255,255,255,0.08)' : '#a78bfa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Horizontal scroll container */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="readiness-scroll"
                    style={{
                        flex: 1, minWidth: 0,
                        display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
                        gap: 0,
                    }}
                >
                    {METRICS.map((met, i) => {
                        const val = scores[met.id];
                        const desc = val ? SCORE_DESCRIPTIONS[met.id]?.[val] : null;
                        const descColor = val ? SCORE_COLORS[val] : 'var(--secondary-foreground)';

                        return (
                            <div key={met.id} style={{
                                flex: '0 0 100%', scrollSnapAlign: 'center',
                                padding: '0 4px', boxSizing: 'border-box',
                            }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 12, padding: 16,
                                }}>
                                    {/* Metric header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 22 }}>{met.emoji}</span>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{met.label}</span>
                                    </div>

                                    {/* Scale hint */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', marginBottom: 10,
                                        fontSize: 9, padding: '0 2px',
                                    }}>
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>1 Best</span>
                                        <span style={{ color: '#ef4444', fontWeight: 600 }}>5 Worst</span>
                                    </div>

                                    {/* Score buttons */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                        {[1, 2, 3, 4, 5].map(v => {
                                            const selected = val === v;
                                            const color = SCORE_COLORS[v];
                                            return (
                                                <button
                                                    key={v}
                                                    onClick={() => !submitted && onSelect(met.id, v)}
                                                    style={{
                                                        height: 42, borderRadius: 10, border: 'none',
                                                        cursor: submitted ? 'default' : 'pointer',
                                                        fontSize: 16, fontWeight: 800,
                                                        background: selected ? color : 'rgba(255,255,255,0.05)',
                                                        color: selected ? '#000' : 'rgba(255,255,255,0.3)',
                                                        opacity: val && !selected ? 0.3 : 1,
                                                        transition: 'all 0.15s',
                                                        boxShadow: selected ? `0 0 16px ${color}55` : 'none',
                                                    }}
                                                >
                                                    {v}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Dynamic description */}
                                    <div style={{
                                        minHeight: 36, marginTop: 10, fontSize: 12, textAlign: 'center',
                                        padding: '6px 10px', borderRadius: 8, transition: 'all 0.2s',
                                        color: desc ? descColor : 'rgba(255,255,255,0.2)',
                                        background: desc ? `${descColor}10` : 'transparent',
                                        border: desc ? `1px solid ${descColor}25` : '1px solid transparent',
                                    }}>
                                        {desc || 'Select a score'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right arrow */}
                <button
                    onClick={() => scrollTo(activeIdx + 1)}
                    disabled={activeIdx === METRICS.length - 1}
                    style={{
                        width: 32, minWidth: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                        cursor: activeIdx === METRICS.length - 1 ? 'default' : 'pointer',
                        background: activeIdx === METRICS.length - 1 ? 'transparent' : 'rgba(125,135,210,0.15)',
                        color: activeIdx === METRICS.length - 1 ? 'rgba(255,255,255,0.08)' : '#a78bfa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Bottom: submit / avg / status */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 14px 0', gap: 8 }}>
                {isComplete && !submitted && (
                    <button
                        onClick={onSubmit}
                        disabled={saving}
                        style={{
                            padding: '9px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 700,
                            background: 'linear-gradient(135deg, #7d87d2, #a855f7)',
                            color: '#fff', boxShadow: '0 0 16px rgba(125,135,210,0.4)',
                        }}
                    >
                        {saving ? 'Saving...' : 'Submit'}
                    </button>
                )}
                {submitted && (
                    <button onClick={onCollapse} style={{
                        padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)',
                        background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                        ✓ Submitted — Collapse
                    </button>
                )}
                {!isComplete && !submitted && avgScore && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>Avg:</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: avgColor }}>{avgScore}</span>
                    </div>
                )}
            </div>

            {/* Avg readiness when all filled */}
            {avgScore && (
                <div style={{ textAlign: 'center', marginTop: 8, padding: '0 14px' }}>
                    <span style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>Avg Readiness: </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: avgColor }}>{avgScore}</span>
                    <span style={{ fontSize: 11, color: avgColor }}> / 5</span>
                </div>
            )}
        </div>
    );
}

export default function ReadinessCheckin({ athleteId, sessionKey, programId, onReadinessSubmit }: Props) {
    const [scores, setScores] = useState<Record<string, number>>({});
    const [expanded, setExpanded] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    // Check if readiness already submitted for THIS session
    useEffect(() => {
        (async () => {
            try {
                // cache: 'no-store' prevents the browser from serving a stale
                // response from a previously-viewed session on the same page.
                const res = await fetch(`/api/readiness?athleteId=${athleteId}`, { cache: 'no-store' });
                if (res.ok) {
                    const logs = await res.json();
                    // Guard: only match logs that actually have a _sessionKey stored.
                    // Without this, old submissions saved before _sessionKey was added
                    // (where scores._sessionKey === undefined) would falsely match any
                    // session whose key also happened to be undefined.
                    const sessionLog = logs.find(
                        (l: any) => l.scores?._sessionKey != null && l.scores._sessionKey === sessionKey
                    );
                    if (sessionLog?.scores) {
                        const { _sessionKey, ...restScores } = sessionLog.scores;
                        setScores(restScores);
                        setSubmitted(true);
                        onReadinessSubmit?.();
                    } else {
                        // No prior submission for this session — reset state so a
                        // re-used component instance doesn't show last session's data.
                        setScores({});
                        setSubmitted(false);
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
            onReadinessSubmit?.();
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

    // Abbreviated labels for the submitted summary
    const METRIC_ABBREVS: Record<string, string> = {
        leg_soreness: 'Leg', push_soreness: 'Push', pull_soreness: 'Pull',
        tiredness: 'Tired', recovery: 'Rec', motivation: 'Motive', training_load: 'Load',
    };

    // Submitted summary bar
    if (submitted && !expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 0,
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.18)',
                    borderRadius: 14, padding: 0, cursor: 'pointer', marginBottom: 12,
                    boxSizing: 'border-box', overflow: 'hidden',
                }}
            >
                {/* Top row: icon + label + avg */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px' }}>
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
                {/* Separator */}
                <div style={{ height: 1, background: 'rgba(16, 185, 129, 0.12)', width: '100%' }} />
                {/* Bottom row: score pills with labels */}
                <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'space-between', padding: '10px 12px 12px' }}>
                    {METRICS.map(m => (
                        <div key={m.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                            <div style={{
                                width: '100%', height: 28, borderRadius: 7, fontSize: 12, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: `${SCORE_COLORS[scores[m.id]] || '#555'}18`,
                                color: SCORE_COLORS[scores[m.id]] || '#999',
                                border: `1px solid ${SCORE_COLORS[scores[m.id]] || '#555'}33`,
                            }}>
                                {scores[m.id]}
                            </div>
                            <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--secondary-foreground)', letterSpacing: '0.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                {METRIC_ABBREVS[m.id] || m.label}
                            </span>
                        </div>
                    ))}
                </div>
            </button>
        );
    }

    return (
        <div style={{
            background: expanded ? 'rgba(18, 18, 18, 0.5)' : 'linear-gradient(135deg, rgba(125,135,210,0.15), rgba(168,85,247,0.12))',
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

            {/* Expanded lateral scroll form */}
            {expanded && (
                <ExpandedForm
                    scores={scores}
                    submitted={submitted}
                    saving={saving}
                    isComplete={isComplete}
                    avgScore={avgScore}
                    avgColor={avgColor}
                    onSelect={handleSelect}
                    onSubmit={handleSubmit}
                    onCollapse={() => setExpanded(false)}
                />
            )}
        </div>
    );
}

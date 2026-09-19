'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Activity,
    X,
    RefreshCw,
    Sparkles,
    Check,
    Calendar,
    Moon,
    Flame,
    Zap,
    Battery,
    HeartPulse,
    AlertCircle,
    Copy
} from 'lucide-react';

interface AthleteReadinessCardProps {
    athleteId: string;
    athleteName?: string;
    onClose: () => void;
    onInsertToChat?: (text: string) => void;
}

interface ReadinessRecord {
    id: string;
    athleteId: string;
    programId?: string;
    date: string;
    timestamp: string;
    scores: {
        leg_soreness?: number;
        push_soreness?: number;
        pull_soreness?: number;
        tiredness?: number;
        recovery?: number;
        motivation?: number;
        _sessionKey?: string;
        sleepHours?: number | string;
        sleep?: string;
        stress?: number | string;
        notes?: string;
        [key: string]: any;
    };
}

// 1 = best, 5 = worst
const METRICS_META: Record<string, { label: string; emoji: string; reverse?: boolean; desc: Record<number, string> }> = {
    leg_soreness: {
        label: 'Leg Soreness',
        emoji: '🦵',
        desc: { 1: 'None', 2: 'Light', 3: 'Moderate', 4: 'Significant', 5: 'Severe' }
    },
    push_soreness: {
        label: 'Push Soreness',
        emoji: '💪',
        desc: { 1: 'None', 2: 'Light', 3: 'Moderate', 4: 'Significant', 5: 'Severe' }
    },
    pull_soreness: {
        label: 'Pull Soreness',
        emoji: '🔙',
        desc: { 1: 'None', 2: 'Light', 3: 'Moderate', 4: 'Significant', 5: 'Severe' }
    },
    tiredness: {
        label: 'Energy / Fatigue',
        emoji: '⚡',
        desc: { 1: 'Very Fresh', 2: 'Fresh', 3: 'Normal', 4: 'Tired', 5: 'Exhausted' }
    },
    recovery: {
        label: 'Perceived Recovery',
        emoji: '🔋',
        desc: { 1: 'Fully Recovered', 2: 'Well Recovered', 3: 'Adequate', 4: 'Fatigued', 5: 'Poor' }
    },
    motivation: {
        label: 'Motivation',
        emoji: '🔥',
        desc: { 1: 'High / Hungry', 2: 'Good', 3: 'Neutral', 4: 'Low', 5: 'None' }
    },
};

// Convert 1-5 average (where 1 is best) to a 0-10 readiness score
function calcReadinessScore(record?: ReadinessRecord | null): { score: number; status: string; color: string; avg1to5: number } {
    if (!record || !record.scores) {
        return { score: 8.0, status: 'Prime', color: '#10b981', avg1to5: 1.5 };
    }
    const metrics = ['leg_soreness', 'push_soreness', 'pull_soreness', 'tiredness', 'recovery', 'motivation'];
    const vals = metrics.map(m => record.scores[m]).filter((v): v is number => typeof v === 'number' && v > 0);
    
    if (vals.length === 0) {
        return { score: 8.0, status: 'Prime', color: '#10b981', avg1to5: 1.5 };
    }

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // 1 -> 10.0, 5 -> 2.0
    const score = Math.max(1, Math.min(10, Math.round((10 - (avg - 1) * 2) * 10) / 10));

    let status = 'Prime / Ready';
    let color = '#10b981';

    if (score >= 8.0) {
        status = 'Prime / Ready';
        color = '#10b981';
    } else if (score >= 6.0) {
        status = 'Moderate';
        color = '#fbbf24';
    } else {
        status = 'High Fatigue';
        color = '#ef4444';
    }

    return { score, status, color, avg1to5: avg };
}

function getMetricColor(val?: number): string {
    if (!val) return 'rgba(255,255,255,0.2)';
    if (val === 1) return '#10b981';
    if (val === 2) return '#34d399';
    if (val === 3) return '#fbbf24';
    if (val === 4) return '#f87171';
    return '#ef4444';
}

export default function AthleteReadinessCard({
    athleteId,
    athleteName,
    onClose,
    onInsertToChat
}: AthleteReadinessCardProps) {
    const [records, setRecords] = useState<ReadinessRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);

    const fetchData = async () => {
        if (!athleteId) return;
        try {
            const res = await fetch(`/api/readiness?athleteId=${athleteId}`, { cache: 'no-store' });
            if (res.ok) {
                const data: ReadinessRecord[] = await res.json();
                // Sort descending by date/timestamp
                const sorted = (data || []).sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date).getTime();
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date).getTime();
                    return timeB - timeA;
                });
                setRecords(sorted);
                setSelectedRecordIndex(0);
            }
        } catch (err) {
            console.error('Failed to fetch readiness:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [athleteId]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const currentRecord = records[selectedRecordIndex] || null;
    const { score, status, color, avg1to5 } = useMemo(() => calcReadinessScore(currentRecord), [currentRecord]);

    // Compute last 7 entries for trend chart
    const trendData = useMemo(() => {
        const last7 = records.slice(0, 7).reverse();
        if (last7.length === 0) {
            // Generate fallback placeholders
            const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
            return days.map((d, i) => ({
                day: d,
                date: '',
                score: 8.0 + (i % 3) * 0.5,
                status: 'Prime',
                color: '#10b981',
                isPlaceholder: true,
                raw: null
            }));
        }

        return last7.map((rec, idx) => {
            const parsed = rec.date ? new Date(rec.date + 'T00:00:00') : new Date(rec.timestamp);
            const dayInitial = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parsed.getDay()] || 'D';
            const { score: s, status: st, color: c } = calcReadinessScore(rec);
            return {
                day: dayInitial,
                date: rec.date || new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                score: s,
                status: st,
                color: c,
                isPlaceholder: false,
                raw: rec,
                originalIndex: records.indexOf(rec)
            };
        });
    }, [records]);

    // Format summary string for chat insertion
    const handleInsert = () => {
        if (!currentRecord) {
            const summary = `📊 Readiness Status for ${athleteName || 'Athlete'}: Not checked in yet.`;
            onInsertToChat?.(summary);
            window.dispatchEvent(new CustomEvent('insert-chat-message', { detail: { text: summary } }));
            navigator.clipboard?.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
        }

        const dateStr = currentRecord.date ? new Date(currentRecord.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today';
        const s = currentRecord.scores || {};
        const legText = METRICS_META.leg_soreness.desc[s.leg_soreness || 1] || 'None';
        const energyText = METRICS_META.tiredness.desc[s.tiredness || 1] || 'Fresh';
        const recText = METRICS_META.recovery.desc[s.recovery || 1] || 'Full';
        
        let summary = `📊 Readiness Check-In (${dateStr}): ${score.toFixed(1)}/10 [${status}] • Energy: ${energyText} • Legs: ${legText} • Recovery: ${recText}`;
        if (s.notes) {
            summary += ` | Note: "${s.notes}"`;
        }

        onInsertToChat?.(summary);
        window.dispatchEvent(new CustomEvent('insert-chat-message', { detail: { text: summary } }));
        navigator.clipboard?.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Calculate gauge circle stroke
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    // score 0 to 10 mapped to stroke-dashoffset
    const strokeDashoffset = circumference - (Math.min(10, Math.max(0, score)) / 10) * circumference;

    const formattedDate = currentRecord?.date
        ? new Date(currentRecord.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No Check-In Recorded';

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontFamily: 'inherit',
            userSelect: 'none',
        }}>
            {/* ── Top Header ── */}
            <div style={{
                padding: '0.85rem 1.15rem',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.2) 100%)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38bdf8',
                        boxShadow: '0 0 14px rgba(6, 182, 212, 0.25)'
                    }}>
                        <Activity size={17} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                            Readiness Status
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: 1 }}>
                            {athleteName || 'Athlete'} • <span style={{ color: currentRecord ? '#38bdf8' : 'var(--secondary-foreground)' }}>{formattedDate}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                        onClick={handleRefresh}
                        title="Refresh Readiness"
                        className="chat-press"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary-foreground)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={onClose}
                        title="Close Sidebar"
                        className="chat-press"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary-foreground)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* ── Main Scrollable Body ── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {loading ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                        <div className="pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Activity size={18} className="animate-spin" /> Loading readiness metrics…
                        </div>
                    </div>
                ) : !currentRecord ? (
                    <div style={{
                        padding: '2.5rem 1.5rem',
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10
                    }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary-foreground)'
                        }}>
                            <AlertCircle size={22} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>No Check-Ins Yet</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', maxWidth: 240, lineHeight: 1.4 }}>
                            {athleteName || 'This athlete'} has not submitted any pre-session readiness check-ins yet.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── Overall Readiness Score Card ── */}
                        <div style={{
                            background: 'linear-gradient(145deg, rgba(20, 24, 38, 0.9) 0%, rgba(12, 15, 26, 0.95) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 16,
                            padding: '1.25rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Decorative glow behind ring */}
                            <div style={{
                                position: 'absolute',
                                left: 30,
                                top: 20,
                                width: 90,
                                height: 90,
                                background: color,
                                filter: 'blur(45px)',
                                opacity: 0.18,
                                pointerEvents: 'none'
                            }} />

                            {/* Left: Circular Progress Ring */}
                            <div style={{ position: 'relative', width: 105, height: 105, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="105" height="105" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle
                                        cx="52.5"
                                        cy="52.5"
                                        r={radius}
                                        fill="transparent"
                                        stroke="rgba(255, 255, 255, 0.07)"
                                        strokeWidth="8"
                                    />
                                    <circle
                                        cx="52.5"
                                        cy="52.5"
                                        r={radius}
                                        fill="transparent"
                                        stroke={color}
                                        strokeWidth="8"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                    />
                                </svg>
                                <div style={{
                                    position: 'absolute',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center'
                                }}>
                                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                        {score.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--secondary-foreground)', fontWeight: 600, marginTop: 2 }}>
                                        / 10
                                    </span>
                                </div>
                            </div>

                            {/* Right: Status Pill & Meta Details */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                <div style={{
                                    alignSelf: 'flex-start',
                                    padding: '4px 10px',
                                    borderRadius: 20,
                                    background: `${color}18`,
                                    border: `1px solid ${color}40`,
                                    color: color,
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    boxShadow: `0 0 12px ${color}20`
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                                    {status}
                                </div>

                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                                    Overall Recovery
                                </div>

                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', lineHeight: 1.35 }}>
                                    {score >= 8
                                        ? 'Ready for high intensity, maximal lifts & planned volume.'
                                        : score >= 6
                                        ? 'Moderate fatigue present. Monitor RPE & back-off fatigue.'
                                        : 'High systemic fatigue. Consider reducing loads or volume.'}
                                </div>
                            </div>
                        </div>

                        {/* ── 7-Day Trend Section ── */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 14,
                            padding: '0.9rem 1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                            }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                                    7-Day Readiness Trend
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 600 }}>
                                    {trendData.filter(t => !t.isPlaceholder).length} logged
                                </span>
                            </div>

                            {/* Mini Bar Chart */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between',
                                height: 75,
                                gap: 6,
                                padding: '0 4px'
                            }}>
                                {trendData.map((item, idx) => {
                                    const heightPercent = Math.max(15, Math.min(100, (item.score / 10) * 100));
                                    const isSelected = item.originalIndex !== undefined && item.originalIndex === selectedRecordIndex;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (item.originalIndex !== undefined) {
                                                    setSelectedRecordIndex(item.originalIndex);
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 6,
                                                height: '100%',
                                                justifyContent: 'flex-end',
                                                cursor: item.isPlaceholder ? 'default' : 'pointer'
                                            }}
                                        >
                                            {/* Bar */}
                                            <div style={{
                                                width: '100%',
                                                maxWidth: 24,
                                                height: `${heightPercent}%`,
                                                borderRadius: 6,
                                                background: isSelected
                                                    ? 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)'
                                                    : `linear-gradient(180deg, ${item.color} 0%, ${item.color}88 100%)`,
                                                opacity: item.isPlaceholder ? 0.25 : (isSelected ? 1 : 0.7),
                                                boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.6)' : 'none',
                                                transition: 'all 0.2s',
                                                position: 'relative'
                                            }} />
                                            {/* Label */}
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: isSelected ? 800 : 600,
                                                color: isSelected ? '#38bdf8' : (item.isPlaceholder ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)')
                                            }}>
                                                {item.day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Metrics Breakdown Bars ── */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 14,
                            padding: '1rem'
                        }}>
                            <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                marginBottom: '0.85rem'
                            }}>
                                Metrics Breakdown
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                                {Object.entries(METRICS_META).map(([key, meta]) => {
                                    const val = currentRecord.scores[key] || 1;
                                    const labelDesc = meta.desc[val] || '';
                                    const barColor = getMetricColor(val);
                                    // 1 to 5 mapped to percentage: 1 = 100% (best), 5 = 20%
                                    const fillPercent = ((6 - val) / 5) * 100;

                                    return (
                                        <div key={key}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                fontSize: '0.78rem',
                                                marginBottom: 4
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                                                    <span>{meta.emoji}</span>
                                                    <span>{meta.label}</span>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    color: barColor,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <span>{val}/5</span>
                                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>•</span>
                                                    <span>{labelDesc}</span>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div style={{
                                                height: 6,
                                                borderRadius: 3,
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${fillPercent}%`,
                                                    background: barColor,
                                                    borderRadius: 3,
                                                    transition: 'width 0.3s ease',
                                                    boxShadow: `0 0 8px ${barColor}40`
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Daily Externals & Life Notes ── */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 14,
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                        }}>
                            <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase'
                            }}>
                                Daily Externals & Notes
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {/* Sleep tile */}
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: 10,
                                    padding: '0.65rem 0.8rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontSize: '0.72rem', fontWeight: 600 }}>
                                        <Moon size={13} />
                                        <span>Sleep</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                                        {currentRecord.scores?.sleepHours
                                            ? `${currentRecord.scores.sleepHours} hrs`
                                            : currentRecord.scores?.tiredness && currentRecord.scores.tiredness <= 2
                                            ? '7-8 hrs (Rested)'
                                            : '6-7 hrs (Adequate)'}
                                    </div>
                                </div>

                                {/* Life stress tile */}
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: 10,
                                    padding: '0.65rem 0.8rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a855f7', fontSize: '0.72rem', fontWeight: 600 }}>
                                        <Zap size={13} />
                                        <span>Life Stress</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                                        {currentRecord.scores?.stress
                                            ? `${currentRecord.scores.stress}`
                                            : currentRecord.scores?.tiredness && currentRecord.scores.tiredness >= 4
                                            ? 'Elevated'
                                            : 'Low / Normal'}
                                    </div>
                                </div>
                            </div>

                            {/* Check-in Note / Comment box */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderLeft: '3px solid #38bdf8',
                                borderRadius: '0 8px 8px 0',
                                padding: '0.65rem 0.85rem',
                                fontSize: '0.78rem',
                                color: currentRecord.scores?.notes ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                                fontStyle: currentRecord.scores?.notes ? 'normal' : 'italic',
                                lineHeight: 1.4
                            }}>
                                {currentRecord.scores?.notes
                                    ? `"${currentRecord.scores.notes}"`
                                    : 'No specific soreness or life stress comments noted by athlete.'}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Bottom Action Footer ── */}
            <div style={{
                padding: '0.85rem 1rem',
                borderTop: '1px solid var(--glass-border)',
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                flexShrink: 0,
                display: 'flex',
                gap: 8
            }}>
                <button
                    onClick={handleInsert}
                    className="chat-press"
                    style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 10,
                        background: copied
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)',
                        border: copied
                            ? '1px solid #10b981'
                            : '1px solid rgba(6, 182, 212, 0.45)',
                        color: copied ? '#fff' : '#38bdf8',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: copied
                            ? '0 0 16px rgba(16, 185, 129, 0.4)'
                            : '0 0 16px rgba(6, 182, 212, 0.2)'
                    }}
                >
                    {copied ? (
                        <>
                            <Check size={16} />
                            <span>Inserted & Copied!</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} />
                            <span>Insert Status into Chat</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Trophy, ChevronLeft, ChevronRight, Download, Play, User, Calendar, Dumbbell, X } from 'lucide-react';

interface PR {
    id: string;
    athleteId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    rpe: number | null;
    unit: string;
    videoUrl: string | null;
    videoType: string | null;
    sessionId: string | null;
    programName: string | null;
    weekNum: number | null;
    dayNum: number | null;
    note: string | null;
    date: string;
    createdAt: string;
    athlete: { id: string; name: string };
}

function getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    return d.toISOString().split('T')[0];
}

function getWeekLabel(weekStart: string): string {
    const start = new Date(weekStart + 'T12:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
}

export default function HighlightsClient() {
    const [prs, setPrs] = useState<PR[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/prs?coachId=me')
            .then(r => r.ok ? r.json() : [])
            .then(data => { setPrs(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Group PRs by week
    const weekGroups = useMemo(() => {
        const groups: Record<string, PR[]> = {};
        prs.forEach(pr => {
            const weekStart = getWeekStart(new Date(pr.date + 'T12:00:00'));
            if (!groups[weekStart]) groups[weekStart] = [];
            groups[weekStart].push(pr);
        });
        // Sort weeks newest first
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [prs]);

    const [weekIndex, setWeekIndex] = useState(0);
    const currentWeek = weekGroups[weekIndex];

    const handleDownload = useCallback(async (url: string, athleteName: string, exerciseName: string) => {
        try {
            const r = await fetch(url);
            const b = await r.blob();
            const ext = url.includes('.mov') ? '.mov' : url.includes('.webm') ? '.webm' : '.mp4';
            const filename = `${athleteName.replace(/\s+/g, '_')}_${exerciseName.replace(/\s+/g, '_')}_PR${ext}`;

            if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                const file = new File([b], filename, { type: b.type });
                try { await navigator.share({ files: [file] }); return; } catch { }
            }

            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            window.open(url, '_blank');
        }
    }, []);

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading highlights...</div>;
    }

    if (prs.length === 0) {
        return (
            <div style={{
                padding: '4rem 2rem', textAlign: 'center',
                background: 'var(--card-bg)', border: '1px dashed var(--card-border)',
                borderRadius: 16,
            }}>
                <Trophy size={48} style={{ color: 'var(--secondary-foreground)', opacity: 0.4, marginBottom: 16 }} />
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '1.1rem', fontWeight: 600 }}>No PRs yet</p>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', marginTop: 4 }}>
                    When athletes mark personal records in their workout logs, they'll appear here.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Week navigation */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, padding: '12px 16px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 12,
            }}>
                <button
                    onClick={() => setWeekIndex(i => Math.min(weekGroups.length - 1, i + 1))}
                    disabled={weekIndex >= weekGroups.length - 1}
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: weekIndex >= weekGroups.length - 1 ? 'rgba(255,255,255,0.15)' : 'var(--foreground)',
                        opacity: weekIndex >= weekGroups.length - 1 ? 0.5 : 1,
                    }}
                >
                    <ChevronLeft size={18} />
                </button>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
                        {currentWeek ? getWeekLabel(currentWeek[0]) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginTop: 2 }}>
                        {currentWeek ? `${currentWeek[1].length} PR${currentWeek[1].length !== 1 ? 's' : ''}` : ''}
                    </div>
                </div>

                <button
                    onClick={() => setWeekIndex(i => Math.max(0, i - 1))}
                    disabled={weekIndex <= 0}
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: weekIndex <= 0 ? 'rgba(255,255,255,0.15)' : 'var(--foreground)',
                        opacity: weekIndex <= 0 ? 0.5 : 1,
                    }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* PR cards */}
            {currentWeek && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {currentWeek[1].map(pr => (
                        <div key={pr.id} style={{
                            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                            borderRadius: 14, overflow: 'hidden',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}>
                            {/* Video thumbnail or placeholder */}
                            {pr.videoUrl ? (
                                <div
                                    onClick={() => setExpandedVideo(pr.videoUrl)}
                                    style={{
                                        position: 'relative', width: '100%', aspectRatio: '16/9',
                                        background: '#000', cursor: 'pointer', overflow: 'hidden',
                                    }}
                                >
                                    <video
                                        src={pr.videoUrl.includes('#t=') ? pr.videoUrl : `${pr.videoUrl}#t=0.5`}
                                        muted playsInline preload="metadata"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.3)',
                                    }}>
                                        <div style={{
                                            width: 48, height: 48, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Play size={22} fill="#fff" color="#fff" />
                                        </div>
                                    </div>
                                    {/* Download button overlay */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(pr.videoUrl!, pr.athlete.name, pr.exerciseName); }}
                                        style={{
                                            position: 'absolute', bottom: 8, right: 8,
                                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                                            padding: '6px 10px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            color: '#fff', fontSize: 11, fontWeight: 600,
                                        }}
                                    >
                                        <Download size={13} /> Save
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    width: '100%', height: 80,
                                    background: 'linear-gradient(135deg, rgba(125,135,210,0.15), rgba(168,85,247,0.1))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Trophy size={28} style={{ color: 'var(--primary)', opacity: 0.6 }} />
                                </div>
                            )}

                            {/* PR info */}
                            <div style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, rgba(125,135,210,0.3), rgba(168,85,247,0.3))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
                                    }}>
                                        {pr.athlete.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {pr.athlete.name}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--secondary-foreground)' }}>
                                            {new Date(pr.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{pr.exerciseName}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>
                                        {pr.weight} {pr.unit}
                                    </span>
                                    <span style={{ fontSize: 14, color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                        × {pr.reps} rep{pr.reps !== 1 ? 's' : ''}
                                    </span>
                                    {pr.rpe && (
                                        <span style={{ fontSize: 12, color: 'var(--secondary-foreground)' }}>
                                            @ RPE {pr.rpe}
                                        </span>
                                    )}
                                </div>
                                {pr.programName && (
                                    <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginTop: 6 }}>
                                        {pr.programName}{pr.weekNum ? ` · W${pr.weekNum}` : ''}{pr.dayNum ? ` D${pr.dayNum}` : ''}
                                    </div>
                                )}
                                {pr.note && (
                                    <div style={{ fontSize: 12, color: 'var(--secondary-foreground)', marginTop: 6, fontStyle: 'italic' }}>
                                        "{pr.note}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Fullscreen video overlay */}
            {expandedVideo && (
                <div
                    onClick={() => setExpandedVideo(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <button
                        onClick={() => setExpandedVideo(null)}
                        style={{
                            position: 'absolute', top: 16, right: 16,
                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                            width: 40, height: 40, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', zIndex: 10,
                        }}
                    >
                        <X size={22} />
                    </button>
                    <video
                        src={expandedVideo}
                        controls autoPlay playsInline
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }}
                    />
                </div>
            )}
        </div>
    );
}

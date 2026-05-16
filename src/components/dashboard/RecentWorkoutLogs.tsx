'use client';

import { useState } from 'react';

interface Log {
    id: string;
    sessionId: string;
    programId: string;
    date: string;
    exercises: any;
}

interface Program {
    id: string;
    name: string;
    weeks?: any;
}

interface Props {
    logs: Log[];
    programs: Program[];
}

function parseExercises(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

function getSessionName(log: Log, programs: Program[]): string {
    // sessionId format: programId_wX_dY
    const match = log.sessionId?.match(/_w(\d+)_d(\d+)$/);
    if (!match) return log.sessionId || 'Session';
    const [, weekStr, dayStr] = match;
    const weekNum = parseInt(weekStr);
    const dayNum = parseInt(dayStr);
    const program = programs.find(p => p.id === log.programId);
    const programName = program?.name || '';
    // Try to find session name from program weeks
    if (program?.weeks) {
        const weeks = typeof program.weeks === 'string' ? JSON.parse(program.weeks) : program.weeks;
        const week = Array.isArray(weeks) ? weeks.find((w: any) => w.weekNumber === weekNum) : null;
        const session = week?.sessions?.find((s: any) => s.day === dayNum);
        if (session?.name) return session.name;
    }
    return `Week ${weekNum} · Day ${dayNum}`;
}

export default function RecentWorkoutLogs({ logs, programs }: Props) {
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    // Sort by date desc, take last 10
    const sorted = [...logs]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (sorted.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 12, fontSize: '0.9rem'
            }}>
                No workout logs yet.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map(log => {
                const exercises = parseExercises(log.exercises);
                const sessionName = getSessionName(log, programs);
                const program = programs.find(p => p.id === log.programId);
                const dateStr = log.date
                    ? new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';
                const isOpen = expandedLog === log.id;

                // Quick summary: count filled sets
                const totalSets = exercises.reduce((n: number, ex: any) => n + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
                const filledSets = exercises.reduce((n: number, ex: any) =>
                    n + (Array.isArray(ex.sets) ? ex.sets.filter((s: any) => s.weight || s.reps).length : 0), 0);

                return (
                    <div key={log.id} style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}>
                        {/* Header row */}
                        <div
                            onClick={() => setExpandedLog(isOpen ? null : log.id)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 16px', cursor: 'pointer',
                                background: isOpen ? 'rgba(125,135,210,0.06)' : 'transparent',
                                transition: 'background 0.2s',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                                    {sessionName}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                                    {program?.name || 'Unknown Program'} · {dateStr}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    fontSize: '0.75rem', fontWeight: 600,
                                    color: filledSets === totalSets && totalSets > 0 ? '#10b981' : 'var(--secondary-foreground)',
                                    background: filledSets === totalSets && totalSets > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${filledSets === totalSets && totalSets > 0 ? 'rgba(16,185,129,0.3)' : 'var(--card-border)'}`,
                                    padding: '3px 10px', borderRadius: 20,
                                }}>
                                    {filledSets}/{totalSets} sets logged
                                </div>
                                <span style={{
                                    fontSize: '0.75rem', color: 'var(--secondary-foreground)',
                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s', display: 'inline-block',
                                }}>▶</span>
                            </div>
                        </div>

                        {/* Expanded exercise detail */}
                        {isOpen && (
                            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {exercises.length === 0 ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'center', padding: '1rem' }}>
                                        No exercise data recorded.
                                    </div>
                                ) : exercises.map((ex: any, i: number) => {
                                    const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
                                    const hasData = sets.some((s: any) => s.weight || s.reps);
                                    return (
                                        <div key={i} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                padding: '8px 12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                            }}>
                                                <span style={{
                                                    background: 'var(--primary)', color: '#000',
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                                                }}>{i + 1}</span>
                                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent)' }}>{ex.name}</span>
                                                {!hasData && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginLeft: 'auto', opacity: 0.6 }}>
                                                        not logged
                                                    </span>
                                                )}
                                            </div>
                                            {hasData && (
                                                <div style={{ padding: '8px 12px' }}>
                                                    {/* Column headers */}
                                                    <div style={{
                                                        display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr',
                                                        gap: 6, marginBottom: 4,
                                                        fontSize: '0.68rem', fontWeight: 700,
                                                        color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    }}>
                                                        <span></span>
                                                        <span style={{ textAlign: 'center' }}>Weight</span>
                                                        <span style={{ textAlign: 'center' }}>Reps</span>
                                                        <span style={{ textAlign: 'center' }}>RPE</span>
                                                    </div>
                                                    {sets.map((s: any, si: number) => {
                                                        const w = s.weight || s.actual?.weight || '';
                                                        const r = s.reps || s.actual?.reps || '';
                                                        const rpe = s.rpe || s.actual?.rpe || '';
                                                        const hasSetData = w || r || rpe;
                                                        return (
                                                            <div key={si} style={{
                                                                display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr',
                                                                gap: 6, marginBottom: 3,
                                                                opacity: hasSetData ? 1 : 0.35,
                                                            }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                                                    S{si + 1}
                                                                </span>
                                                                {[w, r, rpe].map((val, vi) => (
                                                                    <div key={vi} style={{
                                                                        textAlign: 'center', fontSize: '0.85rem', fontWeight: 600,
                                                                        padding: '4px 6px', borderRadius: 5,
                                                                        background: val ? 'rgba(125,135,210,0.12)' : 'rgba(255,255,255,0.03)',
                                                                        color: val ? 'var(--foreground)' : 'var(--secondary-foreground)',
                                                                        border: `1px solid ${val ? 'rgba(125,135,210,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                                                    }}>
                                                                        {val || '—'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                    {ex.notes && (
                                                        <div style={{
                                                            marginTop: 6, fontSize: '0.78rem', color: 'var(--secondary-foreground)',
                                                            padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 5,
                                                            borderLeft: '2px solid var(--primary)',
                                                        }}>
                                                            📝 {ex.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

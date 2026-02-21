'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignmentManager({ athletes, programs, logs = [] }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleAssign = async (athleteId, programId) => {
        if (!programId) return;
        setLoading(true);
        try {
            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, programId }),
            });

            if (res.ok) {
                router.refresh();
                alert('Program assigned successfully');
            } else {
                alert('Failed to assign program');
            }
        } catch (error) {
            console.error(error);
            alert('Error assigning program');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ul style={{ listStyle: 'none' }}>
            {athletes.map(athlete => {
                const currentProgram = programs.find(p => p.id === athlete.currentProgramId);

                // Progress Calculation
                let progressInfo = null;
                if (currentProgram) {
                    // Total Sessions in Program
                    let totalSessions = 0;
                    currentProgram.weeks.forEach(w => {
                        totalSessions += w.sessions.length;
                    });

                    // Completed Sessions by this Athlete for this Program
                    // Simplistic check: count unique completed sessionIds in logs
                    // A stricter check would match programId AND confirm all exercises are done, but simple count is often enough for high level view
                    const completedSessions = new Set(
                        logs.filter(l => l.athleteId === athlete.id && l.programId === currentProgram.id)
                            .map(l => l.sessionId)
                    ).size;

                    // Calculate Percentage
                    const percent = totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

                    // Estimate Week
                    // Assuming roughly equal distribution or using week structure
                    // Find current week based on completed count?
                    // Simple estimation:
                    const totalWeeks = currentProgram.weeks.length;
                    const sessionsPerWeek = totalSessions / (totalWeeks || 1);
                    const currentWeek = Math.min(totalWeeks, Math.floor(completedSessions / (sessionsPerWeek || 1)) + 1);
                    const remainingWeeks = Math.max(0, totalWeeks - currentWeek + (percent === 100 ? 0 : 1)); // Rough estimate

                    progressInfo = {
                        percent,
                        completed: completedSessions,
                        total: totalSessions,
                        currentWeek,
                        totalWeeks,
                        remaining: remainingWeeks
                    };
                }

                return (
                    <li key={athlete.id} style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{athlete.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginTop: '0.2rem' }}>
                                    Current Program: <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{currentProgram ? currentProgram.name : 'None'}</span>
                                </div>
                            </div>

                        </div>


                        {/* Progress Bar Section */}
                        {
                            currentProgram && progressInfo && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                                        <span>
                                            <strong>Session {progressInfo.completed}</strong> of {progressInfo.total}
                                        </span>
                                        <span>
                                            Week {progressInfo.currentWeek} / {progressInfo.totalWeeks}
                                            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                                ({progressInfo.remaining === 0 && progressInfo.percent === 100 ? 'Completed' : `${progressInfo.remaining} weeks left`})
                                            </span>
                                        </span>
                                    </div>

                                    {/* Bar Track */}
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                        {/* Bar Fill */}
                                        <div style={{
                                            width: `${progressInfo.percent}%`,
                                            height: '100%',
                                            background: progressInfo.percent === 100 ? 'var(--success)' : 'var(--primary)',
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--secondary-foreground)' }}>
                                        {progressInfo.percent}% Complete
                                    </div>
                                </div>
                            )
                        }
                    </li>
                );
            })}
        </ul >
    );
}

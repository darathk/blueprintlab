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

    const handleRestore = async (athleteId) => {
        if (!confirm('Are you sure you want to restore this athlete?')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/athletes/${athleteId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' })
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Failed to restore athlete');
            }
        } catch (error) {
            console.error(error);
            alert('Error restoring athlete');
        } finally {
            setLoading(false);
        }
    };

    const activeAthletes = athletes.filter(a => a.status !== 'archived');
    const archivedAthletes = athletes.filter(a => a.status === 'archived');

    return (
        <div>
            <ul style={{ listStyle: 'none' }}>
                {activeAthletes.map(athlete => {
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
                        const completedSessions = new Set(
                            logs.filter(l => l.athleteId === athlete.id && l.programId === currentProgram.id)
                                .map(l => l.sessionId)
                        ).size;

                        // Calculate Percentage
                        const percent = totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

                        // Estimate Week
                        const totalWeeks = currentProgram.weeks.length;
                        const sessionsPerWeek = totalSessions / (totalWeeks || 1);
                        const currentWeek = Math.min(totalWeeks, Math.floor(completedSessions / (sessionsPerWeek || 1)) + 1);
                        const remainingWeeks = Math.max(0, totalWeeks - currentWeek + (percent === 100 ? 0 : 1));

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

            {archivedAthletes.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>Archived Athletes</h2>
                    <ul style={{ listStyle: 'none' }}>
                        {archivedAthletes.map(athlete => (
                            <li key={athlete.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--card-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{athlete.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>{athlete.email}</div>
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={() => handleRestore(athlete.id)}
                                    disabled={loading}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                >
                                    Restore
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

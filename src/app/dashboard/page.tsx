import Link from 'next/link';
import { getAthletes, getPrograms, getLogs } from '@/lib/storage';
import AthleteStatusCard from './athlete-status-card';

export default async function DashboardPage() {
    const athletes = await getAthletes();
    const programs = await getPrograms();
    const logs = await getLogs();

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Command Center</span>
                </h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></span>
                        System Online
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                    <span className="neon-text">///</span> Active Personnel
                </h2>
                {athletes.length === 0 ? (
                    <p style={{ color: 'var(--secondary-foreground)' }}>No athletes found.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {athletes.map(athlete => {
                            const currentProgram = programs.find(p => p.id === athlete.currentProgramId);

                            // Calculate Progress
                            let progress = {
                                completedSessions: 0,
                                totalSessions: 0,
                                currentWeek: 1,
                                totalWeeks: 0,
                                programName: currentProgram ? currentProgram.name : 'No Program Assigned'
                            };

                            if (currentProgram) {
                                progress.totalWeeks = currentProgram.weeks.length;

                                // Calculate total sessions
                                currentProgram.weeks.forEach(w => {
                                    progress.totalSessions += w.sessions.length;
                                });

                                // Calculate completed sessions based on logs
                                const athleteLogs = logs.filter(l => l.athleteId === athlete.id && l.programId === currentProgram.id);
                                const uniqueSessions = new Set(athleteLogs.map(l => l.sessionId)); // Assuming sessionId or unique combo
                                // Since logs might be at exercise level, we need to group by session.
                                // Our logs struct: { athleteId, programId, weekNumber, dayNumber, ... }
                                // A unique session is (programId, weekNumber, dayNumber).
                                const completedSet = new Set();
                                athleteLogs.forEach(l => {
                                    completedSet.add(`${l.weekNumber}-${l.dayNumber}`);
                                });
                                progress.completedSessions = completedSet.size;

                                // Estimate current week (lazy way: max week in logs, or 1)
                                if (athleteLogs.length > 0) {
                                    const maxWeek = Math.max(...athleteLogs.map(l => l.weekNumber));
                                    progress.currentWeek = maxWeek;
                                }
                            }

                            return (
                                <AthleteStatusCard
                                    key={athlete.id}
                                    athlete={athlete}
                                    progress={progress}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

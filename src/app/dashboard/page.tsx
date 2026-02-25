import Link from 'next/link';
import { getAthletes, getPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import AthleteStatusCard from './athlete-status-card';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import CoachInbox from '@/components/chat/CoachInbox';

export default async function DashboardPage() {
    const [athletes, programs, logSummaries] = await Promise.all([
        getAthletes(),
        getPrograms(),
        getLogSummariesForDashboard()
    ]);

    // Look up coach's Athlete record for the inbox
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    let coach = await prisma.athlete.findUnique({ where: { email: adminEmail } });
    if (!coach) {
        coach = await prisma.athlete.create({ data: { name: 'Coach', email: adminEmail } });
    }

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

            {/* Coach Inbox - Discord-style unified messaging */}
            <CollapsibleSection title="💬 Messages" defaultOpen={false}>
                <CoachInbox coachId={coach.id} coachName={coach.name} />
            </CollapsibleSection>

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

                            let progress = {
                                completedSessions: 0,
                                totalSessions: 0,
                                currentWeek: 1,
                                totalWeeks: 0,
                                programName: currentProgram ? currentProgram.name : 'No Program Assigned'
                            };

                            if (currentProgram) {
                                progress.totalWeeks = (currentProgram.weeks as any[]).length;

                                const weeks = currentProgram.weeks as any[];
                                let totalSessions = 0;
                                weeks.forEach((w: any) => {
                                    totalSessions += w.sessions.length;
                                });
                                progress.totalSessions = totalSessions;

                                const athleteLogSummaries = logSummaries.filter(l => l.program?.athleteId === athlete.id && l.programId === currentProgram.id);
                                const uniqueSessions = new Set(athleteLogSummaries.map(l => l.sessionId));
                                progress.completedSessions = uniqueSessions.size;

                                if (athleteLogSummaries.length > 0) {
                                    const weeksFromLogs = athleteLogSummaries.map(l => {
                                        const match = l.sessionId.match(/week-(\d+)/i);
                                        return match ? parseInt(match[1]) : 1;
                                    });
                                    progress.currentWeek = Math.max(...weeksFromLogs);
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

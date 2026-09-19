import Link from 'next/link';
import { Suspense } from 'react';
import { getAthleteById, getProgramsByAthlete, getLogsByAthlete } from '@/lib/storage';
import dynamic from 'next/dynamic';
import AnnouncementBanner from '@/components/athlete/AnnouncementBanner';
import { currentUser } from '@clerk/nextjs/server';
import { SELF_COACH_EMAILS } from '@/lib/auth-cache';

const ScheduleView = dynamic(() => import('@/components/athlete/ScheduleView'));
const LeaderboardRankWidget = dynamic(
    () => import('@/components/leaderboard/LeaderboardRankWidget')
);

async function AsyncSchedule({ id, disableReadiness = false, athleteEmail = '' }: { id: string; disableReadiness?: boolean; athleteEmail?: string }) {
    try {
        const [athlete, programs, logs] = await Promise.all([
            getAthleteById(id),
            getProgramsByAthlete(id),
            getLogsByAthlete(id)
        ]);

        const finalEmail = (athleteEmail || athlete?.email || '').toLowerCase().trim();
        const finalDisable = disableReadiness || finalEmail === 'jayseng123@gmail.com';

        return (
            <ScheduleView
                programs={programs as any}
                athleteId={id}
                coachId={athlete?.coachId || ''}
                logs={logs as any}
                nextMeetDate={athlete?.nextMeetDate}
                disableReadiness={finalDisable}
                athleteEmail={finalEmail}
            />
        );
    } catch (e) {
        console.error('ScheduleView data error:', e);
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>Unable to load schedule. Please try refreshing.</p>
            </div>
        );
    }
}

export default async function AthleteDashboard({ params }) {
    const { id } = await params;
    const user = await currentUser();
    const email = (user?.primaryEmailAddress?.emailAddress || '').toLowerCase().trim();
    const isSelfCoach = SELF_COACH_EMAILS.includes(email);

    const athlete = await getAthleteById(id);

    if (!athlete) return <div>Athlete not found</div>;

    const athleteEmail = (athlete.email || '').toLowerCase().trim();
    const isJayseng = email === 'jayseng123@gmail.com' || athleteEmail === 'jayseng123@gmail.com';

    return (
        <div style={{ minHeight: '100vh', padding: '1rem 0', maxWidth: 600, margin: '0 auto' }}>
            <header style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                        Hello, <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.3)' }}>{athlete.name}</span>
                    </h1>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', margin: '3px 0 0' }}>Ready to train?</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSelfCoach && (
                        <Link
                            href="/dashboard"
                            className="chat-press"
                            style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: '#38bdf8',
                                padding: '6px 14px',
                                borderRadius: 20,
                                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(59, 130, 246, 0.15) 100%)',
                                border: '1px solid rgba(6, 182, 212, 0.4)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 0 14px rgba(6, 182, 212, 0.25)',
                                transition: 'all 0.16s var(--ease-out)',
                            }}
                        >
                            <span>⚡</span>
                            <span>Coach Mode</span>
                        </Link>
                    )}
                    <Link
                        href="/"
                        className="chat-press"
                        style={{
                            fontSize: '0.78rem',
                            color: 'var(--secondary-foreground)',
                            padding: '6px 14px',
                            borderRadius: 20,
                            background: 'var(--glass-surface-2)',
                            border: '1px solid var(--glass-border)',
                            textDecoration: 'none',
                            transition: 'all 0.16s var(--ease-out)',
                        }}
                    >
                        Logout
                    </Link>
                </div>
            </header>

            {athlete.coachId && (
                <div style={{ padding: '0 1rem' }}>
                    <AnnouncementBanner coachId={athlete.coachId} />
                </div>
            )}

            {athlete.coachId && (
                <div style={{ marginBottom: '1rem', padding: '0 1rem' }}>
                    <LeaderboardRankWidget coachId={athlete.coachId} athleteId={id} athleteName={athlete.name} />
                </div>
            )}

            <div>
                <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading schedule…</div>}>
                    <AsyncSchedule id={id} disableReadiness={isJayseng} athleteEmail={athleteEmail || email} />
                </Suspense>
            </div>
        </div>
    );
}


import Link from 'next/link';
import { Suspense } from 'react';
import { getAthleteById, getProgramsByAthlete, getLogsByAthlete } from '@/lib/storage';
import dynamic from 'next/dynamic';

const ScheduleView = dynamic(() => import('@/components/athlete/ScheduleView'));
const LeaderboardRankWidget = dynamic(
    () => import('@/components/leaderboard/Leaderboard').then(mod => ({ default: mod.LeaderboardRankWidget }))
);

async function AsyncSchedule({ id }: { id: string }) {
    try {
        const [athlete, programs, logs] = await Promise.all([
            getAthleteById(id),
            getProgramsByAthlete(id),
            getLogsByAthlete(id)
        ]);

        return (
            <ScheduleView
                programs={programs as any}
                athleteId={id}
                coachId={athlete?.coachId || ''}
                logs={logs as any}
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
    let athlete;
    try {
        athlete = await getAthleteById(id);
    } catch (e) {
        console.error('AthleteDashboard fetch error:', e);
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Error loading profile. Please try again.</div>;
    }

    if (!athlete) return <div style={{ padding: '2rem', textAlign: 'center' }}>Athlete not found</div>;

    return (
        <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Hello, {athlete.name}</h1>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>Ready to train?</p>
                </div>
                <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Logout</Link>
            </header>

            {athlete.coachId && (
                <Link href={`/athlete/${id}/leaderboard`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: '1rem' }}>
                    <LeaderboardRankWidget coachId={athlete.coachId} athleteId={id} athleteName={athlete.name} />
                </Link>
            )}

            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading schedule…</div>}>
                    <AsyncSchedule id={id} />
                </Suspense>
            </div>
        </div>
    );
}


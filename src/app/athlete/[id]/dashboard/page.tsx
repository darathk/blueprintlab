import Link from 'next/link';
import { Suspense } from 'react';
import { getAthleteById, getProgramsByAthlete, getLogsByAthlete } from '@/lib/storage';
import ScheduleView from '@/components/athlete/ScheduleView';

async function AsyncSchedule({ id }: { id: string }) {
    try {
        const [programs, logs] = await Promise.all([
            getProgramsByAthlete(id),
            getLogsByAthlete(id)
        ]);

        return (
            <ScheduleView
                programs={programs as any}
                athleteId={id}
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
    const athlete = await getAthleteById(id);

    if (!athlete) return <div>Athlete not found</div>;

    return (
        <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Hello, {athlete.name}</h1>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>Ready to train?</p>
                </div>
                <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Logout</Link>
            </header>

            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading schedule…</div>}>
                    <AsyncSchedule id={id} />
                </Suspense>
            </div>
        </div>
    );
}


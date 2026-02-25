import Link from 'next/link';
import { Suspense } from 'react';
import { getAthleteById, getProgramsByAthlete, getLogsByAthlete } from '@/lib/storage';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';

async function AsyncAthleteCalendar({ id }) {
    const athlete = await getAthleteById(id);
    const programs = await getProgramsByAthlete(id);
    const athleteLogs = await getLogsByAthlete(id);

    const program = programs.find(p => p.id === athlete.currentProgramId);

    if (!program) {
        return (
            <div className="card">
                <p>No active program. Check the calendar below for history.</p>
                <div style={{ marginTop: '2rem' }}>
                    <AthleteCalendarContainer
                        programs={programs}
                        athleteId={id}
                        logs={athleteLogs}
                        currentProgramId={athlete.currentProgramId}
                    />
                </div>
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Training Schedule</h2>
            <AthleteCalendarContainer
                programs={programs}
                athleteId={id}
                logs={athleteLogs}
                currentProgramId={athlete.currentProgramId}
            />
        </div>
    );
}

export default async function AthleteDashboard({ params }) {
    const { id } = await params;
    const athlete = await getAthleteById(id);

    if (!athlete) return <div>Athlete not found</div>;

    const Loader = () => <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading calendar data...</div>;

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Hello, {athlete.name}</h1>
                    <p style={{ color: 'var(--secondary-foreground)' }}>Ready to train?</p>
                </div>
                <Link href="/" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>Logout</Link>
            </header>

            <Suspense fallback={<Loader />}>
                <AsyncAthleteCalendar id={id} />
            </Suspense>
        </div>
    );
}

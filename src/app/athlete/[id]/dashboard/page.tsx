import Link from 'next/link';
import { getAthletes, getPrograms, getLogs } from '@/lib/storage';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';

export default async function AthleteDashboard({ params }) {
    const { id } = await params;
    const athletes = await getAthletes();
    const athlete = athletes.find(a => a.id === id);

    if (!athlete) return <div>Athlete not found</div>;

    const programs = await getPrograms();
    const program = programs.find(p => p.id === athlete.currentProgramId);

    const logs = await getLogs(); // Fetch logs
    const athleteLogs = logs.filter(l => l.athleteId === id);

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Hello, {athlete.name}</h1>
                    <p style={{ color: 'var(--secondary-foreground)' }}>Ready to train?</p>
                </div>
                <Link href="/" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>Logout</Link>
            </header>

            {!program ? (
                <div className="card">
                    <p>No active program. Check the calendar below for history.</p>
                    <div style={{ marginTop: '2rem' }}>
                        <AthleteCalendarContainer
                            programs={programs}
                            athleteId={id}
                            logs={athleteLogs} // Pass logs
                            currentProgramId={athlete.currentProgramId}
                        />
                    </div>
                </div>
            ) : (
                <div>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Training Schedule</h2>
                        <AthleteCalendarContainer
                            programs={programs}
                            athleteId={id}
                            logs={athleteLogs} // Pass logs
                            currentProgramId={athlete.currentProgramId}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

import { getPrograms, getAthletes, getLogs } from '@/lib/storage';
import WorkoutLogger from './workout-logger';

export default async function WorkoutPage({ params }) {
    const { id: athleteId, sessionId } = await params;

    // Parse sessionId: programId_wX_dY
    const parts = sessionId.split('_');
    if (parts.length !== 3) return <div>Invalid Session ID</div>;

    const programId = parts[0];
    const weekNum = parseInt(parts[1].substring(1));
    const dayNum = parseInt(parts[2].substring(1));

    const programs = await getPrograms();
    const program = programs.find(p => p.id === programId);

    if (!program) return <div>Program not found</div>;

    const week = program.weeks.find(w => w.weekNumber === weekNum);
    const session = week?.sessions.find(s => s.day === dayNum);

    if (!session) return <div>Session not found</div>;

    // Fetch existing logs to hydrate the logger
    const logs = await getLogs();
    const existingLog = logs.find(l =>
        l.programId === programId &&
        l.sessionId === sessionId
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{session.name}</h1>
            <p style={{ color: 'var(--secondary-foreground)', marginBottom: '2rem' }}>
                Week {weekNum} • Day {dayNum}
            </p>

            <WorkoutLogger
                athleteId={athleteId}
                programId={programId}
                sessionId={sessionId}
                exercises={session.exercises}
                initialLog={existingLog}
            />
        </div>
    );
}

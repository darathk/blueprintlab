import { getAthletes, getPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import AssignmentManager from './assignment-manager';

export default async function AthletesPage() {
    const [athletes, programs, rawSummaries] = await Promise.all([
        getAthletes(),
        getPrograms(),
        getLogSummariesForDashboard()
    ]);

    // Flatten to match the shape AssignmentManager expects: { athleteId, programId, sessionId }
    const logs = rawSummaries.map(s => ({
        athleteId: s.program?.athleteId,
        programId: s.programId,
        sessionId: s.sessionId
    }));

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Athlete Management</h1>

            <div className="card">
                <AssignmentManager athletes={athletes} programs={programs} logs={logs} />
            </div>
        </div>
    );
}

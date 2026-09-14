import { getAthletes, getDashboardPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import AssignmentManager from './assignment-manager';
import { getCoachAuthState } from '@/lib/auth-cache';

export default async function AthletesPage() {
    const { athleteId: coachId } = await getCoachAuthState();

    const [athletes, programs, rawSummaries] = await Promise.all([
        getAthletes(coachId || undefined),
        getDashboardPrograms(coachId || undefined),
        getLogSummariesForDashboard(coachId || undefined)
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

import { getAthletes, getPrograms, getLogs } from '@/lib/storage';
import AssignmentManager from './assignment-manager';

export default async function AthletesPage() {
    const athletes = await getAthletes();
    const programs = await getPrograms();
    const logs = await getLogs();

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Athlete Management</h1>

            <div className="card">
                <AssignmentManager athletes={athletes} programs={programs} logs={logs} />
            </div>
        </div>
    );
}

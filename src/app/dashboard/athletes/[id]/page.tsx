import { getAthletes, getLogs, getReadiness, getPrograms } from '@/lib/storage';
import { processLogsForAnalytics } from '@/lib/analytics';
import Link from 'next/link';
import ProgramList from '@/components/program-builder/ProgramList';
import AthleteCharts from '@/components/dashboard/AthleteCharts';
import BlockOrganizer from '@/components/dashboard/BlockOrganizer';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

export default async function AthleteAnalyticsPage({ params }) {
    const [{ id }, athletes, logs, readinessLogs, programs] = await Promise.all([
        params,
        getAthletes(),
        getLogs(),
        getReadiness(),
        getPrograms()
    ]);
    const athlete = athletes.find(a => a.id === id);

    // Filter logs for this athlete
    const athleteLogs = logs.filter(l => l.athleteId === id);
    const athleteReadiness = readinessLogs.filter(l => l.athleteId === id);

    // Identify exercises logged
    const exerciseNames = new Set();
    athleteLogs.forEach(log => {
        const exercises = log.exercises as any[];
        exercises.forEach((ex: any) => exerciseNames.add(ex.name));
    });
    const uniqueExercises = Array.from(exerciseNames);

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/dashboard" style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Command Center</Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{athlete?.name || 'Athlete'} Analytics</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <Link href={`/dashboard/athletes/${id}/reports`} className="btn btn-secondary" style={{ fontSize: '0.9rem' }}>
                            View Meta-Analytics Reports
                        </Link>
                        <Link href={`/dashboard/athletes/${id}/new-program`} className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
                            + New Program (Builder)
                        </Link>
                    </div>
                </div>
            </div>

            <CollapsibleSection title="Block Organizer & Meet Tracker" defaultOpen={true}>
                <BlockOrganizer athlete={athlete} />
            </CollapsibleSection>

            <CollapsibleSection title="Training Calendar" defaultOpen={false}>
                <AthleteCalendarContainer
                    programs={programs.filter(p => p.athleteId === id)}
                    athleteId={id}
                    currentProgramId={athlete?.currentProgramId}
                    logs={athleteLogs}
                />
            </CollapsibleSection>

            <CollapsibleSection title="Performance Analytics" defaultOpen={true}>
                <AthleteCharts logs={athleteLogs} readinessLogs={athleteReadiness} programs={programs.filter(p => p.athleteId === id)} />
            </CollapsibleSection>

            <CollapsibleSection title="Program History" defaultOpen={false}>
                <ProgramList athleteId={id} />
            </CollapsibleSection>
        </div >
    );
}

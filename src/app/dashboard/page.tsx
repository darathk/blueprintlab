import { getAthletes, getDashboardPrograms, getLogSummariesForDashboard, getLastLogDates } from '@/lib/storage';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getCoachAuthState } from '@/lib/auth-cache';

const ActivePersonnelList = dynamic(() => import('@/components/dashboard/ActivePersonnelList'), {
    loading: () => <div style={{ textAlign: 'center', padding: '50px', color: 'var(--muted)' }}>Loading Command Center...</div>
});

async function DashboardData({ coachId }: { coachId: string }) {
    const [athletes, programs, logSummaries, lastLogDates] = await Promise.all([
        getAthletes(coachId),
        getDashboardPrograms(coachId),
        getLogSummariesForDashboard(coachId),
        getLastLogDates(coachId)
    ]);

    return (
        <ActivePersonnelList
            athletes={athletes}
            programs={programs}
            logSummaries={logSummaries}
            lastLogDates={lastLogDates}
            coachId={coachId}
        />
    );
}

export default async function DashboardPage() {
    const { isCoach, athleteId } = await getCoachAuthState();
    if (!isCoach || !athleteId) return null;
    const coachId = athleteId;

    return (
        <div>
            <div className="dashboard-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingTop: '1.5rem' }}>
                <h1 className="dashboard-heading" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--foreground)' }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(125, 135, 210, 0.45)' }}>Command Center</span>
                </h1>
            </div>

            <Suspense fallback={
                <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--secondary-foreground)' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 500 }}>Loading athletes...</div>
                </div>
            }>
                <DashboardData coachId={coachId} />
            </Suspense>
        </div>
    );
}

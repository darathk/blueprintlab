import { getAthletes, getPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

const ActivePersonnelList = dynamic(() => import('@/components/dashboard/ActivePersonnelList'), {
    loading: () => <div style={{ textAlign: 'center', padding: '50px', color: 'var(--muted)' }}>Loading Command Center...</div>
});

const WeeklyCheckInSummary = dynamic(() => import('@/components/dashboard/WeeklyCheckInSummary'), {
    loading: () => <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>Loading summary...</div>
});

import { currentUser } from '@clerk/nextjs/server';

async function DashboardData({ coachId }: { coachId: string }) {
    const [athletes, programs, logSummaries] = await Promise.all([
        getAthletes(coachId),
        getPrograms(coachId),
        getLogSummariesForDashboard(coachId)
    ]);

    return (
        <ActivePersonnelList
            athletes={athletes}
            programs={programs}
            logSummaries={logSummaries}
            coachId={coachId}
        />
    );
}

export default async function DashboardPage() {
    const user = await currentUser();
    if (!user) return null;

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true }
    });

    if (!coach || coach.role !== 'coach') return null;

    const coachId = coach.id;

    return (
        <div>
            <div className="dashboard-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <h1 className="dashboard-heading" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Command Center</span>
                </h1>
            </div>


            <CollapsibleSection title="Weekly Check-In Summary" defaultOpen={false}>
                <WeeklyCheckInSummary />
            </CollapsibleSection>

            <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', color: 'var(--secondary-foreground)' }} className="pulse">Loading athletes...</div>}>
                <DashboardData coachId={coachId} />
            </Suspense>
        </div>
    );
}

import Link from 'next/link';
import { getAthletes, getPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import ActivePersonnelList from '@/components/dashboard/ActivePersonnelList';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

import { currentUser } from '@clerk/nextjs/server';

export default async function DashboardPage() {
    const user = await currentUser();
    if (!user) return null; // Let layout handle redirect

    const email = user.primaryEmailAddress?.emailAddress || '';
    const coach = await prisma.athlete.findUnique({ where: { email } });

    if (!coach || coach.role !== 'coach') return null;

    const coachId = coach.id;

    const [athletes, programs, logSummaries] = await Promise.all([
        getAthletes(coachId),
        getPrograms(coachId),
        getLogSummariesForDashboard(coachId)
    ]);

    return (
        <div>
            <div className="dashboard-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <h1 className="dashboard-heading" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Command Center</span>
                </h1>
            </div>


            <ActivePersonnelList
                athletes={athletes}
                programs={programs}
                logSummaries={logSummaries}
                coachId={coachId}
            />
        </div>
    );
}

import Link from 'next/link';
import { getAthletes, getPrograms, getLogSummariesForDashboard } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import ActivePersonnelList from '@/components/dashboard/ActivePersonnelList';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

export default async function DashboardPage() {
    const [athletes, programs, logSummaries] = await Promise.all([
        getAthletes(),
        getPrograms(),
        getLogSummariesForDashboard()
    ]);

    // Look up coach's Athlete record for the inbox
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    let coach = await prisma.athlete.findUnique({ where: { email: adminEmail } });
    if (!coach) {
        coach = await prisma.athlete.create({ data: { name: 'Coach', email: adminEmail } });
    }

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
            />
        </div>
    );
}

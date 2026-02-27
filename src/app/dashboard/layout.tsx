import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import TopNavigation from '@/components/dashboard/TopNavigation';

// Cache the auth check so it only runs once per request lifecycle
const getAuthState = cache(async () => {
    const user = await currentUser();
    if (!user) return { isCoach: false, user: null, athleteId: null };

    const email = user.primaryEmailAddress?.emailAddress || '';

    // Check if they exist in the DB
    const athlete = await prisma.athlete.findUnique({ where: { email } });

    // In multi-coach system, coaches are just Athlete records with role === 'coach'
    const isCoach = athlete?.role === 'coach';
    const athleteId = athlete ? athlete.id : null;

    // Fallback for the original admin if they somehow got demoted
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    if (!isCoach && adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
        if (athlete) {
            await prisma.athlete.update({ where: { email }, data: { role: 'coach' } });
        } else {
            await prisma.athlete.create({ data: { name: 'Admin Coach', email, role: 'coach' } });
        }
        return { isCoach: true, user, athleteId: athlete?.id || null };
    }

    return { isCoach, user, athleteId };
});

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isCoach, user, athleteId } = await getAuthState();

    if (!user) redirect('/sign-in');

    // STRICT: Only designated coaches can access the Coach Dashboard
    if (!isCoach) {
        // If they're a known athlete, send to their portal
        if (athleteId) redirect(`/athlete/${athleteId}/dashboard`);
        // Otherwise, send them to the home page — they have no access/need to register
        redirect('/athlete');
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top center, #1e293b 0%, #020617 100%)' }}>
            <header className="glass-panel dashboard-header" style={{
                height: 'var(--header-height)',
                borderBottom: '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2rem',
                marginBottom: '0',
                borderRadius: '0',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 10px rgba(6,182,212,0.5)' }}>Lab</span></span>
                </div>

                <TopNavigation />
            </header>

            <main className="dashboard-main" style={{ flex: 1, padding: '2rem', position: 'relative' }}>
                <div className="container">
                    {children}
                </div>
            </main>
            <footer style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', borderTop: '1px solid var(--card-border)', background: 'rgba(2, 6, 23, 0.5)' }}>
                BlueprintLab v2.0 <span style={{ color: 'var(--primary)' }}>///</span> Meta-Engine Active
            </footer>
        </div>
    );
}

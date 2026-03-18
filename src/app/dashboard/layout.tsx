import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import TopNavigation from '@/components/dashboard/TopNavigation';
import MobileBottomNav, { NavItem } from '@/components/navigation/MobileBottomNav';
import { Home, MessageSquare, Hammer, Dumbbell, Calculator, Trophy } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import NotificationPermissionButton from '@/components/notifications/NotificationPermissionButton';

// Cache the auth check so it only runs once per request lifecycle
const getAuthState = cache(async () => {
    const user = await currentUser();
    if (!user) return { isCoach: false, user: null, athleteId: null, unreadCount: 0 };

    const email = user.primaryEmailAddress?.emailAddress || '';

    // Check if they exist in the DB — only select what we need
    const athlete = await prisma.athlete.findUnique({
        where: { email },
        select: { id: true, role: true, email: true }
    });

    // In multi-coach system, coaches are just Athlete records with role === 'coach'
    const isCoach = athlete?.role === 'coach';
    const athleteId = athlete ? athlete.id : null;

    // Fallback for the original admin if they somehow got demoted
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    if (!isCoach && adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
        let adminAthleteId = athlete?.id;
        if (athlete) {
            await prisma.athlete.update({ where: { email }, data: { role: 'coach' } });
        } else {
            const newAdmin = await prisma.athlete.create({ data: { name: 'Admin Coach', email, role: 'coach' } });
            adminAthleteId = newAdmin.id;
        }

        const unreadCount = adminAthleteId ? await prisma.message.count({ where: { receiverId: adminAthleteId, read: false } }) : 0;
        return { isCoach: true, user, athleteId: adminAthleteId, unreadCount };
    }

    const unreadCount = athleteId ? await prisma.message.count({ where: { receiverId: athleteId, read: false } }) : 0;
    return { isCoach, user, athleteId, unreadCount };
});

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isCoach, user, athleteId, unreadCount } = await getAuthState();

    if (!user) redirect('/sign-in');

    // STRICT: Only designated coaches can access the Coach Dashboard
    if (!isCoach) {
        // If they're a known athlete, send to their portal
        if (athleteId) redirect(`/athlete/${athleteId}/dashboard`);
        // Otherwise, send them to the home page — they have no access/need to register
        redirect('/athlete');
    }

    const coachNavItems: NavItem[] = [
        { label: 'Home', href: '/dashboard', icon: <Home size={20} /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare size={20} />, unreadCount },
        { label: 'Board', href: '/dashboard/leaderboard', icon: <Trophy size={20} /> },
        { label: 'Builder', href: '/dashboard/programs/new', icon: <Hammer size={20} /> },
        { label: 'Loader', href: '/dashboard/plate-loader', icon: <Dumbbell size={20} /> }
    ];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top center, #1e293b 0%, #020617 100%)' }}>
            <header className="dashboard-header" style={{
                height: 'var(--header-height)',
                borderBottom: '1px solid var(--card-border)',
                marginBottom: '0',
                borderRadius: '0',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: '#1e293b'
            }}>
                <div className="w-full flex items-center justify-between h-full px-6 md:px-10 lg:px-14">
                    <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 10px rgba(125, 135, 210,0.5)' }}>Lab</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <TopNavigation unreadCount={unreadCount} userId={athleteId || undefined} />
                    </div>

                    <div className="md:hidden flex items-center">
                        <UserButton afterSignOutUrl="/" />
                    </div>
                </div>
            </header>

            <main className="dashboard-main" style={{ flex: 1, position: 'relative' }}>
                <div className="container">
                    {children}
                </div>
            </main>

            <MobileBottomNav items={coachNavItems} className="mobile-bottom-nav" userId={athleteId || undefined}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    flex: 1
                }}>
                    <NotificationPermissionButton />
                    <UserButton afterSignOutUrl="/" />
                    <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--secondary-foreground)',
                        opacity: 0.7
                    }}>
                        Profile
                    </span>
                </div>
            </MobileBottomNav>
        </div>
    );
}

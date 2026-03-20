import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import AthleteNav from '@/components/athlete/AthleteNav';
import MobileBottomNav, { NavItem } from '@/components/navigation/MobileBottomNav';
import AppSetupBubble from '@/components/notifications/AppSetupBubble';
import { LayoutDashboard, MessageSquare, Dumbbell, Trophy, Settings } from 'lucide-react';

export default async function AthletePortalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = user.primaryEmailAddress?.emailAddress || '';
    const { id } = await params;

    // Fetch athlete and unread count in parallel
    const [requestedAthlete, unreadCount] = await Promise.all([
        prisma.athlete.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, role: true, meetAttempts: true }
        }),
        prisma.message.count({ where: { receiverId: id, read: false } })
    ]);

    if (!requestedAthlete) {
        redirect('/athlete'); // Not found
    }

    // Is the logged in user actually THIS athlete?
    if (requestedAthlete.email !== email) {
        // If not this athlete, check if they are the coach (i.e. not an athlete at all)
        const loggedInUser = await prisma.athlete.findUnique({
            where: { email },
            select: { id: true, role: true }
        });

        // If they are a coach, redirect to the coach dashboard
        // Coaches should NOT be in the athlete portal side of things
        if (loggedInUser?.role === 'coach') {
            redirect('/dashboard');
        }

        // If they are an athlete trying to snoop on another athlete, block them
        if (loggedInUser) {
            redirect(`/athlete/${loggedInUser.id}/dashboard`);
        }
    } else {
        // Even if they ARE the requested athlete, if their role is coach,
        // they should still go to the dashboard (prevents "Combined Chat" view)
        if (requestedAthlete.role === 'coach') {
            redirect('/dashboard');
        }
    }

    const athleteNavItems: NavItem[] = [
        { label: 'Dashboard', href: `/athlete/${id}/dashboard`, icon: <LayoutDashboard size={20} /> },
        { label: 'Messages', href: `/athlete/${id}/chat`, icon: <MessageSquare size={20} />, unreadCount },
        { label: 'Board', href: `/athlete/${id}/leaderboard`, icon: <Trophy size={20} /> },
        { label: 'Loader', href: `/athlete/${id}/plate-loader`, icon: <Dumbbell size={20} /> }
    ];

    if (requestedAthlete.meetAttempts) {
        // Insert right after Messages
        athleteNavItems.splice(2, 0, { label: 'Meet', href: `/athlete/${id}/meet`, icon: <Trophy size={20} /> });
    }

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <header className="athlete-portal-header border-b border-[var(--card-border)] rounded-none border-t-0 border-l-0 border-r-0 sticky top-0 z-[100] w-full" style={{
                height: 'var(--header-height)',
                background: 'rgba(10, 10, 10, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            }}>
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-4 py-3 md:px-8 h-full">
                    <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                        <Link href={`/athlete/${id}/dashboard`} style={{ color: 'inherit' }}>
                            Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 10px rgba(125, 135, 210,0.5)' }}>Lab</span>
                        </Link>
                        <span className="hidden md:inline whitespace-nowrap" style={{ marginLeft: '1.5rem', fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '1rem', borderLeft: '1px solid var(--card-border)', paddingLeft: '1.5rem' }}>{requestedAthlete.name}'s Portal</span>
                    </div>
                    <div className="hidden md:flex" style={{ gap: '1.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <AthleteNav id={id} unreadCount={unreadCount} userId={id} />
                        <div style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '1.5rem', display: 'flex', alignItems: 'center' }}>
                            <UserButton afterSignOutUrl="/sign-in" />
                        </div>
                    </div>
                    {/* On desktop we show top right, on mobile it moves to bottom nav */}
                    <div className="md:hidden flex items-center">
                        {/* Empty spacer or hidden */}
                    </div>
                </div>
            </header>
            <main className="athlete-main" style={{ flex: 1 }}>
                {children}
            </main>
            <AppSetupBubble />
            <MobileBottomNav items={[...athleteNavItems, { label: 'Settings', href: `/athlete/${id}/settings`, icon: <Settings size={20} /> }]} className="mobile-bottom-nav" userId={id} />
        </div>
    );
}

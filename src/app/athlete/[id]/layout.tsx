import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import AthleteNav from '@/components/athlete/AthleteNav';
import MobileBottomNav, { NavItem } from '@/components/navigation/MobileBottomNav';
import { LayoutDashboard, MessageSquare, Dumbbell, Calculator } from 'lucide-react';

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

    const requestedAthlete = await prisma.athlete.findUnique({
        where: { id }
    });

    if (!requestedAthlete) {
        redirect('/athlete'); // Not found
    }

    // Is the logged in user actually THIS athlete?
    if (requestedAthlete.email !== email) {
        // If not this athlete, check if they are the coach (i.e. not an athlete at all)
        const loggedInAsAthlete = await prisma.athlete.findUnique({
            where: { email }
        });

        // If they are an athlete trying to snoop on another athlete, block them
        if (loggedInAsAthlete) {
            redirect(`/athlete/${loggedInAsAthlete.id}/dashboard`);
        }
    }

    const unreadCount = await prisma.message.count({
        where: { receiverId: requestedAthlete.id, read: false }
    });

    const athleteNavItems: NavItem[] = [
        { label: 'Dashboard', href: `/athlete/${id}/dashboard`, icon: <LayoutDashboard size={20} /> },
        { label: 'Messages', href: `/athlete/${id}/chat`, icon: <MessageSquare size={20} />, unreadCount },
        { label: 'Loader', href: `/athlete/${id}/plate-loader`, icon: <Dumbbell size={20} /> }
    ];

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <header className="athlete-portal-header border-b border-[var(--card-border)] rounded-none border-t-0 border-l-0 border-r-0 sticky top-0 z-[100] w-full" style={{
                height: 'var(--header-height)',
                background: 'var(--background)'
            }}>
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-4 py-3 md:px-8 h-full">
                    <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                        <Link href={`/athlete/${id}/dashboard`} style={{ color: 'inherit' }}>
                            Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 10px rgba(125, 135, 210,0.5)' }}>Lab</span>
                        </Link>
                        <span className="hidden md:inline whitespace-nowrap" style={{ marginLeft: '1.5rem', fontWeight: 400, color: 'var(--secondary-foreground)', fontSize: '1rem', borderLeft: '1px solid var(--card-border)', paddingLeft: '1.5rem' }}>{requestedAthlete.name}'s Portal</span>
                    </div>
                    <div className="hidden md:flex" style={{ gap: '1.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <AthleteNav id={id} unreadCount={unreadCount} />
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
            <main className="athlete-main has-mobile-nav" style={{ flex: 1 }}>
                {children}
            </main>
            <MobileBottomNav items={athleteNavItems}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    flex: 1
                }}>
                    <UserButton afterSignOutUrl="/sign-in" />
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

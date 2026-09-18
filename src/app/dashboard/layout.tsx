import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import TopNavigation from '@/components/dashboard/TopNavigation';
import MobileBottomNav, { NavItem } from '@/components/navigation/MobileBottomNav';
import { Home, MessageSquare, Hammer, Medal, Settings, ClipboardList, BookTemplate, Star, Target, Video, DollarSign } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { getCoachAuthState } from '@/lib/auth-cache';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isCoach, user, athleteId, unreadCount } = await getCoachAuthState();

    if (!user) redirect('/sign-in');

    // STRICT: Only designated coaches can access the Coach Dashboard
    if (!isCoach) {
        // If they're a known athlete, send to their portal
        if (athleteId) redirect(`/athlete/${athleteId}/dashboard`);
        // Otherwise, send them to the home page — they have no access/need to register
        redirect('/athlete');
    }

    const coachNavItems: NavItem[] = [
        { label: 'Home', href: '/dashboard', icon: <Home size={26} /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare size={26} />, unreadCount },
        { label: 'Tutorials', href: '/dashboard/tutorials', icon: <Video size={26} /> },
        { label: 'Revenue', href: '/dashboard/revenue', icon: <DollarSign size={26} /> },
        { label: 'Highlights', href: '/dashboard/highlights', icon: <Star size={26} /> },
        { label: 'Board', href: '/dashboard/leaderboard', icon: <Medal size={26} /> },
        { label: 'Meet Data', href: '/dashboard/meet-data', icon: <ClipboardList size={26} /> },
        { label: 'Meet Day', href: '/dashboard/meet-day', icon: <Target size={26} /> }
    ];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <header className="dashboard-header" style={{
                height: 'var(--header-height)',
                borderBottom: '1px solid var(--glass-border)',
                marginBottom: '0',
                borderRadius: '0',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(10, 10, 14, 0.82)',
                backdropFilter: 'blur(var(--glass-blur-lg))',
                WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
                boxShadow: 'var(--glass-specular)'
            }}>
                <div className="w-full flex items-center justify-between h-full px-6 md:px-12 lg:px-16">
                    <Link href="/dashboard" className="chat-press" style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--foreground)' }}>Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 12px rgba(125, 135, 210, 0.4)' }}>Lab</span></span>
                        </div>
                    </Link>

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

            <MobileBottomNav items={[...coachNavItems, { label: 'Settings', href: '/dashboard/settings', icon: <Settings size={26} /> }]} className="mobile-bottom-nav" userId={athleteId || undefined} />
        </div>
    );
}

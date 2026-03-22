'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useUnreadCount } from '@/components/notifications/UnreadBadge';

export default function TopNavigation({ unreadCount = 0, userId }: { unreadCount?: number; userId?: string }) {
    const pathname = usePathname();
    const liveUnread = useUnreadCount(userId || '', unreadCount);
    const displayUnread = userId ? liveUnread : unreadCount;

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <nav className="dashboard-nav flex w-full items-center justify-between md:justify-end" style={{ gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
                <Link
                    href="/dashboard"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none'
                    }}
                >
                    Command Center
                </Link>
                <Link
                    href="/dashboard/messages"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard/messages') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard/messages') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none',
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}
                >
                    Messages
                    {displayUnread > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-12px',
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: '10px',
                            padding: '1px 5px',
                            minWidth: '16px',
                            textAlign: 'center',
                            lineHeight: 1,
                            boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                        }}>
                            {displayUnread}
                        </div>
                    )}
                </Link>
                <Link
                    href="/dashboard/programs/new"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard/programs/new') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard/programs/new') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none'
                    }}
                >
                    Program Builder
                </Link>
                <Link
                    href="/dashboard/leaderboard"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard/leaderboard') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard/leaderboard') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none'
                    }}
                >
                    Leaderboard
                </Link>
                <Link
                    href="/dashboard/meet-data"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard/meet-data') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard/meet-data') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none'
                    }}
                >
                    Meet Data
                </Link>
                <Link
                    href="/dashboard/plate-loader"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: isActive('/dashboard/plate-loader') ? 'var(--primary)' : 'var(--secondary-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                        textShadow: isActive('/dashboard/plate-loader') ? '0 0 10px rgba(125, 135, 210,0.4)' : 'none'
                    }}
                >
                    Loader
                </Link>
            </div>
            <UserButton afterSignOutUrl="/" />
        </nav>
    );
}

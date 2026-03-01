'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

export default function TopNavigation({ unreadCount = 0 }: { unreadCount?: number }) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <nav className="dashboard-nav flex w-full items-center justify-between md:justify-end" style={{ gap: '2rem' }}>
            <div style={{ display: 'flex', gap: 'inherit', alignItems: 'center' }}>
                <Link
                    href="/dashboard"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
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
                        fontSize: '0.95rem',
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
                    {unreadCount > 0 && (
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
                            {unreadCount}
                        </div>
                    )}
                </Link>
                <Link
                    href="/dashboard/programs/new"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
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
                    href="/dashboard/plate-loader"
                    className="nav-link"
                    style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
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

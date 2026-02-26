'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

export default function TopNavigation() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <nav className="dashboard-nav" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
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
                    textShadow: isActive('/dashboard') ? '0 0 10px rgba(6,182,212,0.4)' : 'none'
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
                    textShadow: isActive('/dashboard/messages') ? '0 0 10px rgba(6,182,212,0.4)' : 'none'
                }}
            >
                Messages
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
                    textShadow: isActive('/dashboard/programs/new') ? '0 0 10px rgba(6,182,212,0.4)' : 'none'
                }}
            >
                Program Builder
            </Link>
            <UserButton afterSignOutUrl="/" />
        </nav>
    );
}

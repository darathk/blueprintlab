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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                    { href: '/dashboard', label: 'Command Center' },
                    { href: '/dashboard/messages', label: 'Messages', isMessages: true },
                    { href: '/dashboard/leaderboard', label: 'Leaderboard' },
                    { href: '/dashboard/highlights', label: 'Highlights' },
                    { href: '/dashboard/meet-data', label: 'Meet Data' },
                    { href: '/dashboard/meet-day', label: 'Meet Day' },
                ].map((link) => {
                    const active = isActive(link.href);
                    return (
                        <Link
                            key={link.href}
                            prefetch={true}
                            href={link.href}
                            className="chat-press"
                            style={{
                                fontWeight: active ? 600 : 500,
                                fontSize: '0.8125rem',
                                color: active ? '#fff' : 'var(--secondary-foreground)',
                                padding: '6px 12px',
                                borderRadius: 20,
                                background: active ? 'rgba(125, 135, 210, 0.15)' : 'transparent',
                                border: active ? '1px solid rgba(125, 135, 210, 0.3)' : '1px solid transparent',
                                boxShadow: active ? '0 0 12px rgba(125, 135, 210, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
                                backdropFilter: active ? 'blur(8px)' : 'none',
                                WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
                                transition: 'all 160ms var(--ease-out)',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                            onMouseEnter={(e) => {
                                if (!active) {
                                    e.currentTarget.style.background = 'var(--glass-surface-2)';
                                    e.currentTarget.style.color = 'var(--foreground)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!active) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--secondary-foreground)';
                                }
                            }}
                        >
                            {link.label}
                            {link.isMessages && displayUnread > 0 && (
                                <span style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    borderRadius: 10,
                                    padding: '1px 5px',
                                    minWidth: 16,
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)'
                                }}>
                                    {displayUnread}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
            <UserButton afterSignOutUrl="/" />
        </nav>
    );
}

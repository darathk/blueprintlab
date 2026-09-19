'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUnreadCount } from '@/components/notifications/UnreadBadge';

export default function AthleteNav({ id, unreadCount, userId, canSwitchToCoach }: { id: string; unreadCount: number; userId?: string; canSwitchToCoach?: boolean }) {
    const pathname = usePathname();
    const chatPath = `/athlete/${id}/chat`;
    const isActive = pathname === chatPath;
    const leaderboardPath = `/athlete/${id}/leaderboard`;

    const liveUnread = useUnreadCount(userId || id, unreadCount);
    const displayUnread = liveUnread;

    return (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexShrink: 0 }}>
            {canSwitchToCoach && (
                <Link 
                    prefetch={true} 
                    href="/dashboard" 
                    className="chat-press"
                    title="Switch to Coach Command Center"
                    style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 1rem',
                        borderRadius: '9999px',
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(59, 130, 246, 0.15) 100%)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        boxShadow: '0 0 16px rgba(6, 182, 212, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    <span style={{ fontSize: '0.95rem' }}>⚡</span>
                    <span>Coach Mode</span>
                </Link>
            )}
            <Link prefetch={true} href={`/athlete/${id}/plate-loader`} style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: pathname === `/athlete/${id}/plate-loader` ? 'var(--primary)' : 'var(--secondary-foreground)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                border: '1px solid transparent',
                background: pathname === `/athlete/${id}/plate-loader` ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s',
            }}>
                <span style={{ fontSize: '1.1rem' }}>🏋️</span>
                <span className="hidden sm:inline">Plate Loader</span>
            </Link>
            <Link prefetch={true} href={leaderboardPath} style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: pathname === leaderboardPath ? 'var(--primary)' : 'var(--secondary-foreground)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                border: '1px solid transparent',
                background: pathname === leaderboardPath ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s',
            }}>
                <span style={{ fontSize: '1.1rem' }}>🏆</span>
                <span className="hidden sm:inline">Leaderboard</span>
            </Link>
            <Link prefetch={true} href={`/athlete/${id}/tutorials`} style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: pathname === `/athlete/${id}/tutorials` ? 'var(--primary)' : 'var(--secondary-foreground)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                border: '1px solid transparent',
                background: pathname === `/athlete/${id}/tutorials` ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s',
            }}>
                <span style={{ fontSize: '1.1rem' }}>🎥</span>
                <span className="hidden sm:inline">Tutorials</span>
            </Link>
            <Link prefetch={true} href={chatPath} style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: isActive ? 'var(--primary)' : 'var(--secondary-foreground)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                border: '1px solid transparent',
                background: isActive ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s',
                position: 'relative'
            }}>
                <span style={{ fontSize: '1.1rem' }}>💬</span>
                <span className="hidden sm:inline">Messages</span>
                {displayUnread > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '0px',
                        right: '0px',
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
        </div>
    );
}

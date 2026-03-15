'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AthleteNav({ id, unreadCount }: { id: string; unreadCount: number }) {
    const pathname = usePathname();
    const chatPath = `/athlete/${id}/chat`;
    const isActive = pathname === chatPath;
    const leaderboardPath = `/athlete/${id}/leaderboard`;

    return (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexShrink: 0 }}>
            <Link href={leaderboardPath} style={{
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
            <Link href={`/athlete/${id}/plate-loader`} style={{
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
                <span style={{ fontSize: '1.1rem' }}>🏋️‍♂️</span>
                <span className="hidden sm:inline">Plate Loader</span>
            </Link>
            <Link href={chatPath} style={{
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
                {unreadCount > 0 && (
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
                        {unreadCount}
                    </div>
                )}
            </Link>
        </div>
    );
}

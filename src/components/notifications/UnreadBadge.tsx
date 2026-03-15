'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Client-side component that polls for unread message count
 * and renders a red dot badge. Pass the userId to check for.
 * Polls every 15 seconds for live updates.
 */
export default function UnreadBadge({ userId, initialCount = 0 }: { userId: string; initialCount?: number }) {
    const [count, setCount] = useState(initialCount);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await fetch(`/api/messages/unread?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setCount(data.unread || 0);
            }
        } catch {
            // Silently fail — don't break the UI
        }
    }, [userId]);

    useEffect(() => {
        // Initial fetch
        fetchUnread();

        // Poll every 15 seconds
        const interval = setInterval(fetchUnread, 15000);

        // Also refresh on window focus (user comes back to app)
        const handleFocus = () => fetchUnread();
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchUnread]);

    if (count <= 0) return null;

    return (
        <div style={{
            position: 'absolute',
            top: -4,
            right: -8,
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 700,
            borderRadius: 10,
            padding: '2px 5px',
            minWidth: 16,
            textAlign: 'center',
            lineHeight: 1,
            boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
            zIndex: 10,
        }}>
            {count > 99 ? '99+' : count}
        </div>
    );
}

/**
 * Hook version for components that need the count value
 */
export function useUnreadCount(userId: string, initialCount = 0) {
    const [count, setCount] = useState(initialCount);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await fetch(`/api/messages/unread?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setCount(data.unread || 0);
            }
        } catch {
            // silent
        }
    }, [userId]);

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 15000);
        const handleFocus = () => fetchUnread();
        window.addEventListener('focus', handleFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchUnread]);

    return count;
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Client-side component that shows unread message count with a red badge.
 * Uses Supabase Realtime for instant updates, with polling as fallback.
 */
export default function UnreadBadge({ userId, initialCount = 0 }: { userId: string; initialCount?: number }) {
    const [count, setCount] = useState(initialCount);

    const fetchUnread = useCallback(async () => {
        if (!userId) return;
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
        if (!userId) return;
        // Initial fetch
        fetchUnread();

        // Supabase Realtime: listen for new messages TO this user or read-status changes
        const channel = supabase.channel(`unread-${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'Message',
                filter: `receiverId=eq.${userId}`,
            }, () => {
                // New message received — refetch count immediately
                fetchUnread();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'Message',
                filter: `receiverId=eq.${userId}`,
            }, () => {
                // Message marked as read — refetch count immediately
                fetchUnread();
            })
            .subscribe();

        // Fallback polling every 30s (longer interval since realtime handles most cases)
        const interval = setInterval(fetchUnread, 30000);

        // Also refresh on window focus (user comes back to app)
        const handleFocus = () => fetchUnread();
        window.addEventListener('focus', handleFocus);

        // Listen for custom event to immediately refresh unread count
        const handleRefresh = () => fetchUnread();
        window.addEventListener('unread-refresh', handleRefresh);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('unread-refresh', handleRefresh);
        };
    }, [fetchUnread, userId]);

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
 * Hook version for components that need the count value.
 * Uses Supabase Realtime for instant updates.
 */
export function useUnreadCount(userId: string, initialCount = 0) {
    const [count, setCount] = useState(initialCount);

    const fetchUnread = useCallback(async () => {
        if (!userId) return;
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
        if (!userId) return;
        fetchUnread();

        // Supabase Realtime for instant updates
        const channel = supabase.channel(`unread-hook-${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'Message',
                filter: `receiverId=eq.${userId}`,
            }, () => fetchUnread())
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'Message',
                filter: `receiverId=eq.${userId}`,
            }, () => fetchUnread())
            .subscribe();

        // Fallback polling every 30s
        const interval = setInterval(fetchUnread, 30000);

        const handleFocus = () => fetchUnread();
        window.addEventListener('focus', handleFocus);

        const handleRefresh = () => fetchUnread();
        window.addEventListener('unread-refresh', handleRefresh);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('unread-refresh', handleRefresh);
        };
    }, [fetchUnread, userId]);

    return count;
}

'use client';

import dynamic from 'next/dynamic';

export const CoachInbox = dynamic(() => import('./CoachInbox'), {
    ssr: false,
    loading: () => <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading messages...</div>
});

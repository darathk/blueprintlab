'use client';

import dynamic from 'next/dynamic';

export const ChatInterface = dynamic(() => import('./ChatInterface'), {
    ssr: false,
    loading: () => <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading chat...</div>
});

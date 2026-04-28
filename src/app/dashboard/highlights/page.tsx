import { Suspense } from 'react';
import Link from 'next/link';
import HighlightsClient from './HighlightsClient';

export default function HighlightsPage() {
    return (
        <div>
            <div style={{ marginBottom: '2rem', paddingTop: '1.5rem' }}>
                <Link href="/dashboard" style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Command Center</Link>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginTop: '1rem' }}>Client Highlights</h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    Personal records from your athletes, organized by week. Download videos for social media.
                </p>
            </div>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading highlights...</div>}>
                <HighlightsClient />
            </Suspense>
        </div>
    );
}

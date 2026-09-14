'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Captured application error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            color: 'var(--foreground)',
            background: 'var(--background)'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                Application Error
            </h2>
            <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.95rem', maxWidth: 500, marginBottom: '1.5rem', lineHeight: 1.5 }}>
                {error?.message || 'A client-side exception occurred while loading BlueprintLab.'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    onClick={() => reset()}
                    className="glass-button glass-button-primary chat-press"
                    style={{ fontWeight: 600, cursor: 'pointer' }}
                >
                    Try Again
                </button>
                <Link
                    href="/"
                    className="glass-button chat-press"
                    style={{ textDecoration: 'none' }}
                >
                    Return Home
                </Link>
            </div>
            {error?.stack && (
                <details style={{ marginTop: '2rem', maxWidth: '640px', textAlign: 'left', width: '100%' }}>
                    <summary style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', cursor: 'pointer' }}>
                        Error Details
                    </summary>
                    <pre style={{
                        marginTop: '0.5rem',
                        padding: '1rem',
                        background: 'rgba(0,0,0,0.6)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 10,
                        fontSize: '0.72rem',
                        overflowX: 'auto',
                        color: '#f87171',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {error.stack}
                    </pre>
                </details>
            )}
        </div>
    );
}

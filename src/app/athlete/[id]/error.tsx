'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function isChunkError(err: any): boolean {
    const msg = err?.message || '';
    const name = err?.name || '';
    return (
        name === 'ChunkLoadError' ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to load chunk') ||
        msg.includes('Loading chunk') ||
        msg.includes('missing in assets')
    );
}

export default function AthleteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [reloaded, setReloaded] = useState(false);
    const isChunk = isChunkError(error);

    useEffect(() => {
        console.error('Captured athlete portal error:', error);

        if (isChunk && typeof window !== 'undefined') {
            const key = 'chunk_error_reload_target';
            const lastReload = sessionStorage.getItem(key);
            const currentUrl = window.location.href;

            if (lastReload !== currentUrl) {
                sessionStorage.setItem(key, currentUrl);
                window.location.reload();
                return;
            } else {
                setReloaded(true);
            }
        }
    }, [error, isChunk]);

    const handleRetry = () => {
        if (isChunk && typeof window !== 'undefined') {
            sessionStorage.removeItem('chunk_error_reload_target');
            window.location.reload();
        } else {
            reset();
        }
    };

    return (
        <div style={{
            minHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            color: 'var(--foreground)'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {isChunk ? '🚀' : '⚠️'}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                {isChunk ? 'New Update Available' : 'Unable to load Athlete Portal'}
            </h2>
            <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem', maxWidth: 460, marginBottom: '1.5rem', lineHeight: 1.5 }}>
                {isChunk
                    ? 'A new version of BlueprintLab was just deployed. Click below to reload the latest version.'
                    : (error?.message || 'A client-side exception occurred while rendering this page.')
                }
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    onClick={handleRetry}
                    className="glass-button glass-button-primary chat-press"
                    style={{ fontWeight: 600, cursor: 'pointer' }}
                >
                    {isChunk ? 'Reload Latest Version' : 'Try Again'}
                </button>
                <Link
                    href="/"
                    onClick={() => {
                        if (isChunk && typeof window !== 'undefined') {
                            window.location.href = '/';
                        }
                    }}
                    className="glass-button chat-press"
                    style={{ textDecoration: 'none' }}
                >
                    Return to Login
                </Link>
            </div>
            {error?.stack && !isChunk && (
                <details style={{ marginTop: '2rem', maxWidth: '600px', textAlign: 'left', width: '100%' }}>
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


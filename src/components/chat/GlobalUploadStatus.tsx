'use client';

/**
 * Floating, app-wide status pill that appears whenever there are active
 * chat-media uploads in flight. Lets users navigate away from the chat and
 * still see that their uploads are progressing.
 */

import { useChatUploadJobs, chatUploadManager } from '@/lib/chat-upload-manager';

export default function GlobalUploadStatus() {
    const jobs = useChatUploadJobs();
    if (jobs.length === 0) return null;

    const inFlight = jobs.filter(j => j.status !== 'done' && j.status !== 'error');
    const errors = jobs.filter(j => j.status === 'error');
    const allDone = inFlight.length === 0 && errors.length === 0;

    // Average progress for the active uploads (best effort UI only)
    const avgProgress = inFlight.length > 0
        ? Math.round(inFlight.reduce((sum, j) => sum + j.progress, 0) / inFlight.length)
        : 100;

    const label = allDone
        ? `${jobs.length} upload${jobs.length === 1 ? '' : 's'} sent`
        : errors.length > 0 && inFlight.length === 0
            ? `${errors.length} upload${errors.length === 1 ? '' : 's'} failed`
            : `Uploading ${inFlight.length} file${inFlight.length === 1 ? '' : 's'}…`;

    const accent = errors.length > 0 && inFlight.length === 0
        ? '#ef4444'
        : allDone ? '#10b981' : 'var(--primary, #06b6d4)';

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1200,
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${accent}55`,
                borderRadius: 999,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: '#f8fafc',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                maxWidth: 'min(92vw, 360px)',
            }}
        >
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>

            {!allDone && inFlight.length > 0 && (
                <div style={{ flex: 1, minWidth: 60, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.max(2, avgProgress)}%`,
                        height: '100%',
                        background: accent,
                        transition: 'width 200ms ease',
                    }} />
                </div>
            )}

            {(allDone || errors.length > 0) && (
                <button
                    type="button"
                    onClick={() => chatUploadManager.clearFinished()}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: '0 4px',
                    }}
                    aria-label="Dismiss"
                >
                    ×
                </button>
            )}
        </div>
    );
}

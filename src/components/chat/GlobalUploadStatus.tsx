'use client';

/**
 * Full-width, top-of-screen upload banner that is impossible to miss.
 * Appears whenever media uploads are in flight (from chat or exercise
 * feedback). Shows animated progress, file count, and clear messaging
 * so athletes know their videos are still sending.
 */

import { useChatUploadJobs, chatUploadManager } from '@/lib/chat-upload-manager';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function GlobalUploadStatus() {
    const jobs = useChatUploadJobs();
    if (jobs.length === 0) return null;

    const inFlight = jobs.filter(j => j.status !== 'done' && j.status !== 'error');
    const errors = jobs.filter(j => j.status === 'error');
    const done = jobs.filter(j => j.status === 'done');
    const allDone = inFlight.length === 0 && errors.length === 0;

    const avgProgress = inFlight.length > 0
        ? Math.round(inFlight.reduce((sum, j) => sum + j.progress, 0) / inFlight.length)
        : 100;

    // Determine phase label per job
    const getPhaseLabel = (status: string) => {
        switch (status) {
            case 'compressing': return 'Compressing';
            case 'uploading': return 'Uploading';
            case 'sending': return 'Saving';
            default: return 'Processing';
        }
    };

    // Banner colors & messaging
    const isError = errors.length > 0 && inFlight.length === 0;
    const bgColor = isError
        ? 'rgba(239, 68, 68, 0.12)'
        : allDone
            ? 'rgba(16, 185, 129, 0.12)'
            : 'rgba(99, 102, 241, 0.12)';
    const borderColor = isError
        ? 'rgba(239, 68, 68, 0.35)'
        : allDone
            ? 'rgba(16, 185, 129, 0.35)'
            : 'rgba(99, 102, 241, 0.35)';
    const accentColor = isError ? '#ef4444' : allDone ? '#10b981' : '#818cf8';
    const barGradient = isError
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : allDone
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, #6366f1, #a855f7, #6366f1)';

    return (
        <>
            {/* Keyframes for animations */}
            <style>{`
                @keyframes gus-slide-down {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes gus-progress-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes gus-pulse-icon {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.15); }
                }
                @keyframes gus-fade-out {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-100%); }
                }
            `}</style>

            <div
                role="status"
                aria-live="assertive"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    background: bgColor,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: `1px solid ${borderColor}`,
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                    animation: 'gus-slide-down 0.3s ease-out',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                }}
            >
                <div style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    {/* Icon */}
                    <div style={{
                        flexShrink: 0,
                        animation: !allDone && !isError ? 'gus-pulse-icon 1.5s ease-in-out infinite' : 'none',
                    }}>
                        {isError ? (
                            <AlertCircle size={20} color="#ef4444" />
                        ) : allDone ? (
                            <CheckCircle size={20} color="#10b981" />
                        ) : (
                            <Upload size={20} color="#818cf8" />
                        )}
                    </div>

                    {/* Text content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#f1f5f9',
                            lineHeight: 1.3,
                        }}>
                            {isError
                                ? `${errors.length} upload${errors.length === 1 ? '' : 's'} failed`
                                : allDone
                                    ? `${done.length} file${done.length === 1 ? '' : 's'} sent successfully ✓`
                                    : `Uploading ${inFlight.length} file${inFlight.length === 1 ? '' : 's'}… ${avgProgress}%`
                            }
                        </div>
                        <div style={{
                            fontSize: 11,
                            color: 'rgba(148, 163, 184, 0.9)',
                            marginTop: 2,
                            lineHeight: 1.3,
                        }}>
                            {isError
                                ? 'Tap ✕ to dismiss, then try sending again.'
                                : allDone
                                    ? 'Your coach has received everything.'
                                    : 'Your video is uploading — you can keep using the app.'}
                        </div>

                        {/* Individual file progress for multiple uploads */}
                        {inFlight.length > 1 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {inFlight.map(j => (
                                    <div key={j.id} style={{
                                        fontSize: 10,
                                        color: '#cbd5e1',
                                        background: 'rgba(255,255,255,0.06)',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        display: 'flex',
                                        gap: 4,
                                        alignItems: 'center',
                                    }}>
                                        <span style={{ color: accentColor, fontWeight: 600 }}>
                                            {getPhaseLabel(j.status)}
                                        </span>
                                        <span>{j.progress}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Dismiss button */}
                    {(allDone || isError) && (
                        <button
                            type="button"
                            onClick={() => chatUploadManager.clearFinished()}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8,
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '6px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Progress bar — full width, very visible */}
                {!allDone && !isError && (
                    <div style={{
                        height: 3,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.max(2, avgProgress)}%`,
                            background: barGradient,
                            backgroundSize: '200% 100%',
                            animation: 'gus-progress-shimmer 2s linear infinite',
                            transition: 'width 300ms ease',
                        }} />
                    </div>
                )}
            </div>
        </>
    );
}

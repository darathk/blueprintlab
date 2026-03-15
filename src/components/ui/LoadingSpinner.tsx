'use client';

export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '1.5rem',
        }}>
            {/* Outer glow ring */}
            <div style={{
                position: 'relative',
                width: 80,
                height: 80,
            }}>
                {/* Background track */}
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                >
                    <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="rgba(125, 135, 210, 0.1)"
                        strokeWidth="4"
                    />
                </svg>

                {/* Spinning progress arc */}
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        animation: 'spin 1.2s linear infinite',
                    }}
                >
                    <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="160 54"
                    />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#7d87d2" />
                            <stop offset="50%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#7d87d2" stopOpacity="0.2" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center logo text */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    letterSpacing: '-0.02em',
                    color: 'var(--foreground)',
                }}>
                    <span>B<span style={{ color: 'var(--primary)' }}>L</span></span>
                </div>
            </div>

            {/* Loading text */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
            }}>
                <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    letterSpacing: '0.05em',
                }}>
                    {message}
                </span>
                <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--secondary-foreground)',
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                }}>
                    BlueprintLab
                </span>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default function Loading() {
    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#313133',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
        }}>
            {/* Spinner */}
            <div style={{
                position: 'relative',
                width: 90,
                height: 90,
            }}>
                {/* Background track */}
                <svg width="90" height="90" viewBox="0 0 90 90" style={{ position: 'absolute', top: 0, left: 0 }}>
                    <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(125, 135, 210, 0.1)" strokeWidth="4" />
                </svg>

                {/* Spinning arc */}
                <svg width="90" height="90" viewBox="0 0 90 90" style={{
                    position: 'absolute', top: 0, left: 0,
                    animation: 'bl-spin 1.2s linear infinite',
                }}>
                    <circle
                        cx="45" cy="45" r="38"
                        fill="none"
                        stroke="url(#bl-grad)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="180 59"
                    />
                    <defs>
                        <linearGradient id="bl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#7d87d2" />
                            <stop offset="50%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#7d87d2" stopOpacity="0.15" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Center logo */}
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em',
                }}>
                    <span>B<span style={{ color: '#7d87d2', textShadow: '0 0 12px rgba(125, 135, 210, 0.5)' }}>L</span></span>
                </div>
            </div>

            {/* Branding */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '0.4rem' }}>
                    Blueprint<span style={{ color: '#7d87d2', textShadow: '0 0 10px rgba(125, 135, 210, 0.5)' }}>Lab</span>
                </div>
                <div style={{
                    fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.6)',
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                }}>
                    Loading...
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bl-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
}

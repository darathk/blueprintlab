import React from 'react';

export default function Loading() {
    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#020617', // Match splash background
            color: 'white',
            fontFamily: 'sans-serif'
        }}>
            <div style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Logo Placeholder / "B" */}
                <div style={{
                    fontSize: '4rem',
                    fontWeight: 800,
                    color: '#06b6d4',
                    textShadow: '0 0 20px rgba(6, 182, 212, 0.5)',
                    zIndex: 2
                }}>
                    B
                </div>

                {/* Animated Ring */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: '3px solid rgba(6, 182, 212, 0.1)',
                    borderTopColor: '#06b6d4',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <div style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem'
                }}>
                    Blueprint<span style={{ color: '#06b6d4' }}>Lab</span>
                </div>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                }}>
                    Initializing Meta-Engine...
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
}

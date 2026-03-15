export default function LeaderboardLoading() {
    return (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.5rem 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ height: 24, width: 180, margin: '0 auto', borderRadius: 6, background: 'rgba(148, 163, 184, 0.1)', animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                    display: 'flex', alignItems: 'center', padding: '0.75rem',
                    borderRadius: 12, marginBottom: '0.5rem',
                    border: '1px solid var(--card-border)', background: 'var(--card-bg)',
                }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(148, 163, 184, 0.08)', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
                    <div style={{ flex: 1, marginLeft: '0.75rem' }}>
                        <div style={{ height: 12, width: '40%', borderRadius: 4, background: 'rgba(148, 163, 184, 0.1)', marginBottom: 6, animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
                        <div style={{ height: 8, width: '25%', borderRadius: 4, background: 'rgba(148, 163, 184, 0.06)', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 100 + 50}ms` }} />
                    </div>
                    <div style={{ width: 30, height: 20, borderRadius: 4, background: 'rgba(148, 163, 184, 0.08)', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
                </div>
            ))}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .4; }
                }
            `}</style>
        </div>
    );
}

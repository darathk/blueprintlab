export default function AthleteDashboardLoading() {
    return (
        <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <div>
                    <div style={{
                        height: 20,
                        width: 160,
                        borderRadius: 6,
                        background: 'rgba(148, 163, 184, 0.1)',
                        marginBottom: 8,
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <div style={{
                        height: 14,
                        width: 100,
                        borderRadius: 4,
                        background: 'rgba(148, 163, 184, 0.06)',
                        animation: 'pulse 2s ease-in-out infinite',
                        animationDelay: '100ms',
                    }} />
                </div>
            </header>

            {/* Leaderboard widget skeleton */}
            <div style={{
                borderRadius: 16,
                border: '1px solid var(--card-border)',
                padding: '1rem',
                marginBottom: '1rem',
                background: 'var(--card-bg)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(148, 163, 184, 0.08)',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ height: 10, width: 70, borderRadius: 4, background: 'rgba(148, 163, 184, 0.08)', marginBottom: 6, animation: 'pulse 2s ease-in-out infinite' }} />
                        <div style={{ height: 18, width: 90, borderRadius: 4, background: 'rgba(148, 163, 184, 0.1)', animation: 'pulse 2s ease-in-out infinite', animationDelay: '100ms' }} />
                    </div>
                </div>
            </div>

            {/* Schedule skeleton */}
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        padding: '1rem',
                        borderBottom: i < 3 ? '1px solid var(--card-border)' : 'none',
                    }}>
                        <div style={{
                            height: 14,
                            width: i === 1 ? '55%' : i === 2 ? '45%' : '35%',
                            borderRadius: 4,
                            background: 'rgba(148, 163, 184, 0.1)',
                            marginBottom: 10,
                            animation: 'pulse 2s ease-in-out infinite',
                            animationDelay: `${i * 150}ms`,
                        }} />
                        <div style={{
                            height: 10,
                            width: '30%',
                            borderRadius: 4,
                            background: 'rgba(148, 163, 184, 0.06)',
                            animation: 'pulse 2s ease-in-out infinite',
                            animationDelay: `${i * 150 + 75}ms`,
                        }} />
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .4; }
                }
            `}</style>
        </div>
    );
}

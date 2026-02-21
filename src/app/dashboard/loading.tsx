export default function DashboardLoading() {
    return (
        <div style={{ padding: '2rem', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div style={{ height: '3rem', width: '300px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                <div style={{ height: '2rem', width: '100px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ height: '2.5rem', width: '250px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ height: '150px', background: 'var(--card-bg)' }}>
                            <div style={{ height: '1.5rem', width: '200px', background: 'var(--card-border)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}></div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ height: '4rem', width: '100px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                                <div style={{ height: '4rem', width: '100px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
            `}</style>
        </div>
    );
}

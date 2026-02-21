export default function AthleteLoading() {
    return (
        <div style={{ minHeight: '100vh', padding: '2rem', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ height: '2rem', width: '200px', background: 'var(--card-border)', borderRadius: 'var(--radius)', marginBottom: '0.5rem' }}></div>
                    <div style={{ height: '1rem', width: '150px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                </div>
                <div style={{ height: '1rem', width: '50px', background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
            </div>

            <div className="card" style={{ height: '400px' }}>
                <div style={{ height: '2rem', width: '250px', background: 'var(--card-border)', borderRadius: 'var(--radius)', marginBottom: '2rem' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', height: '60px', marginBottom: '1rem' }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} style={{ background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', height: '120px' }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} style={{ background: 'var(--card-border)', borderRadius: 'var(--radius)' }}></div>
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

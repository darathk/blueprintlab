'use client';

export default function StressBalanceReport({ readinessLogs, reportParams }) {
    // Filter by date range if needed

    // Sort logs
    const sortedLogs = [...(readinessLogs || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div style={{ padding: '0 0.5rem' }}>
            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2rem', textAlign: 'center', borderRadius: 20 }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--foreground)' }}>
                    STRESS BALANCE <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(125, 135, 210, 0.4)' }}>REPORT</span>
                </h3>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderRadius: 16 }}>
                <p style={{ color: 'var(--secondary-foreground)', marginBottom: '1.5rem', fontSize: '0.92rem' }}>
                    Detailed telemetry of Recovery vs Training Load over time.
                </p>
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', borderRadius: '14px', background: 'var(--glass-surface-1)', color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                    Stress/Balance Progression — {sortedLogs.length} Readiness Check-Ins Loaded
                </div>
            </div>
        </div>
    );
}

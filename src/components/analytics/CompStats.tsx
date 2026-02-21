'use client';

import { calculateSimpleE1RM } from '@/lib/stress-index';

export default function CompStats({ logs, programs }) {
    // Helper to find max for a lift type in early vs late logs
    const calculateStats = () => {
        if (!logs || logs.length === 0) return null;

        const getSessionOrder = (sessionId) => {
            if (!programs || !sessionId) return { week: 99, day: 99 };
            for (const prog of programs) {
                if (!prog.weeks) continue;
                for (const week of prog.weeks) {
                    if (!week.sessions) continue;
                    for (const session of week.sessions) {
                        if (session.id === sessionId) {
                            return { week: week.weekNumber, day: session.day };
                        }
                    }
                }
            }
            // Fallback for legacy format "_w1_d1"
            const match = sessionId.match(/_w(\d+)_d(\d+)/);
            if (match) return { week: parseInt(match[1]), day: parseInt(match[2]) };

            return { week: 99, day: 99 };
        };

        const sortedLogs = [...logs].sort((a, b) => {
            const orderA = getSessionOrder(a.sessionId);
            const orderB = getSessionOrder(b.sessionId);

            if (orderA.week !== orderB.week) return orderA.week - orderB.week;
            if (orderA.day !== orderB.day) return orderA.day - orderB.day;

            // Fallback to date sorting
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        const getLiftE1RMs = (liftName) => {
            const sessionMaxes = [];
            sortedLogs.forEach(log => {
                let dailyMax = 0;
                log.exercises.forEach(ex => {
                    // Strict Match: Competition [Lift]
                    if (ex.name === `Competition ${liftName}`) {
                        ex.sets.forEach(set => {
                            const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe);
                            if (e1rm > dailyMax) {
                                dailyMax = e1rm;
                            }
                        });
                    }
                });
                if (dailyMax > 0) {
                    sessionMaxes.push(dailyMax);
                }
            });
            return sessionMaxes;
        };

        const getStatsForLift = (liftName) => {
            const e1rms = getLiftE1RMs(liftName);
            if (!e1rms || e1rms.length === 0) return { start: 0, peak: 0, end: 0 };
            return {
                start: e1rms[0] || 0,
                peak: Math.max(...e1rms) || 0,
                end: e1rms[e1rms.length - 1] || 0
            };
        };

        const stats = {
            Squat: getStatsForLift('Squat'),
            Bench: getStatsForLift('Bench'),
            Deadlift: getStatsForLift('Deadlift'),
        };

        const calculateTotal = (period) => {
            return (stats.Squat[period] || 0) + (stats.Bench[period] || 0) + (stats.Deadlift[period] || 0);
        };

        return {
            Squat: stats.Squat,
            Bench: stats.Bench,
            Deadlift: stats.Deadlift,
            Total: { start: calculateTotal('start'), peak: calculateTotal('peak'), end: calculateTotal('end') },
        };
    };

    const data = calculateStats();
    if (!data) return null;

    const renderRow = (label, key, isTotal = false) => {
        const row = data[key];
        const change = row.end - row.start;
        const isPositive = change >= 0;

        return (
            <tr style={{ borderBottom: '1px solid var(--card-border)', background: isTotal ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{label}</td>
                <td style={{ padding: '1rem', color: 'var(--secondary-foreground)' }}>{row.start.toFixed(1)} lbs</td>
                <td style={{ padding: '1rem', color: 'var(--secondary-foreground)' }}>{row.peak.toFixed(1)} lbs</td>
                <td style={{ padding: '1rem', color: 'var(--secondary-foreground)' }}>{row.end.toFixed(1)} lbs</td>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                    {isPositive ? '+' : ''}{change.toFixed(1)} {key === 'Wilks' ? '' : 'lbs'}
                </td>
            </tr>
        );
    }

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
            <h3 style={{ padding: '1.5rem', background: 'rgba(6, 182, 212, 0.1)', margin: 0, color: 'var(--primary)', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="neon-text">///</span> Mission Telemetry Specs
            </h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--secondary-foreground)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Metric</th>
                            <th style={{ padding: '1rem', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Start</th>
                            <th style={{ padding: '1rem', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Peak</th>
                            <th style={{ padding: '1rem', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>End</th>
                            <th style={{ padding: '1rem', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Delta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderRow('Total', 'Total', true)}
                        {renderRow('Squat', 'Squat')}
                        {renderRow('Bench', 'Bench')}
                        {renderRow('Deadlift', 'Deadlift')}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

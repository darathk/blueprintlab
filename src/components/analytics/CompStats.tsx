'use client';

import { calculateSimpleE1RM } from '@/lib/stress-index';
import InfoTooltip from '@/components/ui/InfoTooltip';

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
                            const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe, set.unit);
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
            <tr style={{ borderBottom: '1px solid var(--glass-border)', background: isTotal ? 'rgba(125, 135, 210, 0.06)' : 'transparent' }}>
                <td className="px-2.5 sm:px-5 py-2 sm:py-3 font-bold text-xs sm:text-sm" style={{ color: isTotal ? 'var(--primary)' : 'var(--foreground)' }}>{label}</td>
                <td className="px-2 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--secondary-foreground)' }}>{row.start.toFixed(1)} <span className="text-[10px] sm:text-xs text-white/50">lbs</span></td>
                <td className="px-2 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--secondary-foreground)' }}>{row.peak.toFixed(1)} <span className="text-[10px] sm:text-xs text-white/50">lbs</span></td>
                <td className="px-2 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--secondary-foreground)' }}>{row.end.toFixed(1)} <span className="text-[10px] sm:text-xs text-white/50">lbs</span></td>
                <td className="px-2.5 sm:px-5 py-2 sm:py-3 font-bold text-xs sm:text-sm whitespace-nowrap" style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                    {isPositive ? '+' : ''}{change.toFixed(1)} <span className="text-[10px] sm:text-xs text-white/50">{key === 'Wilks' ? '' : 'lbs'}</span>
                </td>
            </tr>
        );
    }

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <h3 className="px-3.5 sm:px-6 py-3 sm:py-4" style={{ background: 'var(--glass-surface-2)', margin: 0, color: 'var(--foreground)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem sm:1.15rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.4)' }}>///</span> Mission Telemetry Specs
                <InfoTooltip text="Analyzes your e1RM at the Start, Peak, and End of the block. 'Delta' shows the total gain or loss from the beginning to the end of the block." />
            </h3>
            <div className="overflow-x-auto no-scrollbar">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--glass-surface-3)', borderBottom: '1px solid var(--glass-border)', color: 'var(--secondary-foreground)' }}>
                        <tr>
                            <th className="px-2.5 sm:px-5 py-2 sm:py-3 text-left uppercase text-[10px] sm:text-xs tracking-wider">Metric</th>
                            <th className="px-2 sm:px-5 py-2 sm:py-3 text-left uppercase text-[10px] sm:text-xs tracking-wider">Start</th>
                            <th className="px-2 sm:px-5 py-2 sm:py-3 text-left uppercase text-[10px] sm:text-xs tracking-wider">Peak</th>
                            <th className="px-2 sm:px-5 py-2 sm:py-3 text-left uppercase text-[10px] sm:text-xs tracking-wider">End</th>
                            <th className="px-2.5 sm:px-5 py-2 sm:py-3 text-left uppercase text-[10px] sm:text-xs tracking-wider">Delta</th>
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

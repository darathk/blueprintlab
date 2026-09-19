'use client';

import { useMemo } from 'react';
import InfoTooltip from '@/components/ui/InfoTooltip';

export default function LiftDensity({ logs }) {
    const data = useMemo(() => {
        const heatmap = {}; // { ExerciseName: { repRange: count } }
        const exercises = new Set();

        logs.forEach(log => {
            log.exercises.forEach(ex => {
                exercises.add(ex.name);
                if (!heatmap[ex.name]) heatmap[ex.name] = {};

                const processSet = (reps) => {
                    const r = Math.round(Number(reps));
                    if (r > 0 && r <= 15) {
                        heatmap[ex.name][r] = (heatmap[ex.name][r] || 0) + 1;
                    }
                };

                if (Array.isArray(ex.sets)) {
                    ex.sets.forEach(s => processSet(s.reps));
                } else {
                    processSet(ex.reps);
                }
            });
        });

        // Convert to array and sort by most frequent
        return Array.from(exercises).map(name => ({
            name: name as string,
            counts: heatmap[name as string] as Record<number, number>
        })).sort((a, b) => (a.name as string).localeCompare(b.name as string));
    }, [logs]);

    const maxCount = Math.max(...data.flatMap(d => Object.values(d.counts)));

    const getColor = (count: number) => {
        if (!count) return 'transparent';
        const intensity = count / maxCount;
        // Green (low) -> Yellow -> Red (high)
        if (intensity < 0.33) return '#4ade80'; // Green
        if (intensity < 0.66) return '#facc15'; // Yellow
        return '#f87171'; // Red
    };

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <div className="px-3.5 sm:px-6 py-3 sm:py-4" style={{ background: 'var(--glass-surface-2)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1rem sm:1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.4)' }}>///</span> All Lift Density Data
                    <InfoTooltip text="Displays a heatmap of rep ranges for every exercise performed during the block. Color intensity (green -> yellow -> red) shows how frequently you hit each rep count." />
                </h3>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--glass-surface-3)', color: 'var(--foreground)', borderBottom: '1px solid var(--glass-border)' }}>
                            <th className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-left min-w-[120px] sm:min-w-[160px] sticky left-0 z-10 text-[11px] sm:text-xs uppercase tracking-wider" style={{ background: 'var(--glass-surface-3)', borderRight: '1px solid var(--glass-border)' }}>Exercise</th>
                            {Array.from({ length: 15 }, (_, i) => i + 1).map(rep => (
                                <th key={rep} className="py-2 px-1 w-[26px] sm:w-[36px] text-center text-[10px] sm:text-xs font-semibold">{rep}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={row.name} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(125, 135, 210, 0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                                <td className="px-2.5 sm:px-4 py-2 sm:py-2.5 font-semibold sticky left-0 z-5 text-xs sm:text-sm" style={{
                                    borderRight: '1px solid var(--glass-border)',
                                    background: 'var(--glass-surface-2)',
                                    color: 'var(--foreground)'
                                }}>
                                    {row.name}
                                </td>
                                {Array.from({ length: 15 }, (_, i) => i + 1).map(rep => {
                                    const count = row.counts[rep] || 0;
                                    return (
                                        <td key={rep} className="p-0.5 sm:p-1 text-center" style={{ borderRight: '1px solid var(--glass-border)' }}>
                                            {count > 0 && (
                                                <div style={{
                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                    background: getColor(count),
                                                    margin: '0 auto',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.65rem', color: 'black', fontWeight: 'bold',
                                                    boxShadow: '0 0 8px rgba(0,0,0,0.3)'
                                                }}>
                                                    {count > 1 ? count : ''}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

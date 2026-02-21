'use client';

import { useMemo } from 'react';

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
        <div className="card" style={{ marginBottom: '2rem', padding: 0 }}>
            <div style={{ padding: '1rem', background: '#0f3460', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>All Lift Density Data</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#0f3460', color: 'white' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '150px', position: 'sticky', left: 0, background: '#0f3460', zIndex: 10 }}></th>
                            {Array.from({ length: 15 }, (_, i) => i + 1).map(rep => (
                                <th key={rep} style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}>{rep}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={row.name} style={{ background: idx % 2 === 0 ? 'var(--card-bg)' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{
                                    padding: '0.75rem',
                                    fontWeight: 600,
                                    borderRight: '2px solid #0f3460',
                                    position: 'sticky',
                                    left: 0,
                                    background: 'var(--card-bg)',
                                    zIndex: 5
                                }}>
                                    {row.name}
                                </td>
                                {Array.from({ length: 15 }, (_, i) => i + 1).map(rep => {
                                    const count = row.counts[rep] || 0;
                                    return (
                                        <td key={rep} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                            {count > 0 && (
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                    background: getColor(count),
                                                    margin: '0 auto',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', color: 'black', fontWeight: 'bold'
                                                }}>
                                                    {/* Optional: Show count inside */}
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

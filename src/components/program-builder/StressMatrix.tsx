'use client';

import { useMemo } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { EXERCISE_DB } from '@/lib/exercise-db';

export default function StressMatrix({ weeks, weekLabel }: { weeks: any[]; weekLabel?: string }) {
    const data = useMemo(() => {
        const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];
        const stats: Record<string, { central: number; total: number }> = {};
        categories.forEach(c => stats[c] = { central: 0, total: 0 });

        weeks.forEach(week => {
            week.sessions.forEach(session => {
                session.exercises.forEach(ex => {
                    const setsList = Array.isArray(ex.sets) ? ex.sets : [];
                    const simpleSets = !Array.isArray(ex.sets) ? (parseFloat(ex.sets) || 0) : 0;

                    const processSet = (repsVal, rpeVal, multiplier = 1) => {
                        let reps = 0;
                        if (typeof repsVal === 'string' && repsVal.includes('-')) {
                            const [min, max] = repsVal.split('-').map(Number);
                            reps = (min + max) / 2;
                        } else {
                            reps = parseFloat(repsVal) || 0;
                        }
                        const rpe = parseFloat(rpeVal) || 0;

                        if (reps > 0 && rpe > 0) {
                            const { total, central } = calculateStress(reps, rpe);

                            let category = 'Misc';
                            if (ex.category) category = ex.category;
                            else if (EXERCISE_DB[ex.name]) category = EXERCISE_DB[ex.name].category;
                            else {
                                if (ex.name.includes('Squat')) category = 'Knee';
                                else if (ex.name.includes('Deadlift')) category = 'Hip';
                                else if (ex.name.includes('Bench')) category = 'Horizontal Push';
                                else if (ex.name.includes('Press')) category = 'Vertical Push';
                            }

                            if (stats[category]) {
                                stats[category].total += total * multiplier;
                                stats[category].central += central * multiplier;
                            }
                        }
                    };

                    if (setsList.length > 0) {
                        setsList.forEach(s => processSet(s.reps, s.rpe));
                    } else if (simpleSets > 0) {
                        processSet(ex.reps, ex.rpeTarget, simpleSets);
                    }
                });
            });
        });

        return stats;
    }, [weeks]);

    // Compute totals across all categories
    const totalStress = Object.values(data).reduce((sum, v) => sum + v.total, 0);
    const totalCentral = Object.values(data).reduce((sum, v) => sum + v.central, 0);

    const maxCentral = Math.max(...Object.values(data).map(v => v.central)) || 1;
    const maxTotal = Math.max(...Object.values(data).map(v => v.total)) || 1;

    const BAR_HEIGHT = 60;

    const renderCell = (value: number, max: number, color = 'var(--foreground)') => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>{value.toFixed(1)}</span>
            <div style={{
                height: `${BAR_HEIGHT}px`,
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '4px'
            }}>
                <div style={{
                    width: '40%',
                    background: color,
                    height: `${Math.min((value / max) * 100, 100)}%`,
                    minHeight: value > 0 ? '4px' : '0',
                    borderRadius: '2px 2px 0 0'
                }}></div>
            </div>
        </div>
    );

    const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];

    return (
        <div className="card" style={{ overflowX: 'auto', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>📊</span>
                {weekLabel ? `${weekLabel} Stress Index` : 'Stress Index'}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--card-border)', width: '130px', color: 'var(--secondary-foreground)' }}>Stress</th>
                        {categories.map(cat => (
                            <th key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                                {cat.replace('Horizontal ', '').replace('Vertical ', '') + (cat.includes('Push') || cat.includes('Pull') ? (cat.includes('Horizontal') ? '-H' : '-V') : '')}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* Total Stress (moved to top) */}
                    <tr>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', borderBottom: '1px solid var(--card-border)' }}>
                            TOTAL
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', fontWeight: 400, marginTop: '2px' }}>
                                {totalStress.toFixed(1)}
                            </div>
                        </td>
                        {categories.map(cat => (
                            <td key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', verticalAlign: 'bottom' }}>
                                {renderCell(data[cat].total, maxTotal)}
                            </td>
                        ))}
                    </tr>

                    {/* Central Stress */}
                    <tr>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', borderBottom: '1px solid var(--card-border)' }}>
                            CENTRAL
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', fontWeight: 400, marginTop: '2px' }}>
                                {totalCentral.toFixed(1)}
                            </div>
                        </td>
                        {categories.map(cat => (
                            <td key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', verticalAlign: 'bottom' }}>
                                {renderCell(data[cat].central, maxCentral)}
                            </td>
                        ))}
                    </tr>

                    {/* CS Balance */}
                    <tr>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                            CS BALANCE
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                                {(totalStress > 0 ? (totalCentral / totalStress) : 0).toFixed(2)}
                            </div>
                        </td>
                        {categories.map(cat => {
                            const val = data[cat].total > 0 ? (data[cat].central / data[cat].total) : 0;
                            return (
                                <td key={cat} style={{ padding: '0.75rem', textAlign: 'center', opacity: val > 0 ? 1 : 0.3 }}>
                                    {val.toFixed(2)}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

'use client';

import { useMemo } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { EXERCISE_DB } from '@/lib/exercise-db';

export default function StressMatrix({ weeks }) {
    const data = useMemo(() => {
        const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push', 'Vertical Pull', 'Horizontal Pull'];
        const stats = {
            'Sum': { central: 0, total: 0 },
        };
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

                            // Determine Category
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
                                stats['Sum'].total += total * multiplier;
                                stats['Sum'].central += central * multiplier;
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

    // Max values for scaling
    // We scale relative to the max category value (excluding Sum) to make the bars meaningful within the category comparison
    const maxCentral = Math.max(...Object.entries(data).filter(([k]) => k !== 'Sum').map(([, v]) => v.central)) || 1;
    const maxTotal = Math.max(...Object.entries(data).filter(([k]) => k !== 'Sum').map(([, v]) => v.total)) || 1;

    // Fixed height for consistency
    const BAR_HEIGHT = 60;

    const renderCell = (value, max, color = 'var(--foreground)') => (
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

    const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push', 'Vertical Pull', 'Horizontal Pull'];

    return (
        <div className="card" style={{ marginTop: '2rem', overflowX: 'auto', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>Program Stress Matrix</h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid var(--card-border)', width: '140px', color: 'var(--secondary-foreground)' }}>Type of Stress</th>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', fontWeight: 'bold' }}>Sum</th>
                        {categories.map(cat => (
                            <th key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', color: 'var(--secondary-foreground)' }}>{cat.replace('Horizontal ', '').replace('Vertical ', '') + (cat.includes('Push') || cat.includes('Pull') ? (cat.includes('Horizontal') ? '-H' : '-V') : '')}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* Central Stress */}
                    <tr>
                        <td style={{ padding: '1rem', fontWeight: 'bold', borderBottom: '1px solid var(--card-border)' }}>CENTRAL</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center' }}>
                            {renderCell(data['Sum'].central, data['Sum'].central * 1.1)}
                        </td>
                        {categories.map(cat => (
                            <td key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', verticalAlign: 'bottom' }}>
                                {renderCell(data[cat].central, maxCentral)}
                            </td>
                        ))}
                    </tr>

                    {/* Total Stress */}
                    <tr>
                        <td style={{ padding: '1rem', fontWeight: 'bold', borderBottom: '1px solid var(--card-border)' }}>TOTAL</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center' }}>
                            {renderCell(data['Sum'].total, data['Sum'].total * 1.1)}
                        </td>
                        {categories.map(cat => (
                            <td key={cat} style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', textAlign: 'center', verticalAlign: 'bottom' }}>
                                {renderCell(data[cat].total, maxTotal)}
                            </td>
                        ))}
                    </tr>

                    {/* CS Balance */}
                    <tr>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>CS BALANCE</td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent)' }}>
                            {(data['Sum'].total > 0 ? (data['Sum'].central / data['Sum'].total) : 0).toFixed(2)}
                        </td>
                        {categories.map(cat => {
                            const val = data[cat].total > 0 ? (data[cat].central / data[cat].total) : 0;
                            return (
                                <td key={cat} style={{ padding: '1rem', textAlign: 'center', opacity: val > 0 ? 1 : 0.3 }}>
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

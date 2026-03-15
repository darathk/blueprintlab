'use client';

import { useMemo } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { EXERCISE_DB } from '@/lib/exercise-db';

function computeStress(weeks: any[]) {
    const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];
    const stats: Record<string, { central: number; total: number }> = {};
    categories.forEach(c => stats[c] = { central: 0, total: 0 });

    weeks.forEach(week => {
        week.sessions.forEach(session => {
            session.exercises.forEach(ex => {
                const setsList = Array.isArray(ex.sets) ? ex.sets : [];
                const simpleSets = !Array.isArray(ex.sets) ? (parseFloat(ex.sets) || 0) : 0;

                const processSet = (repsVal: any, rpeVal: any, multiplier = 1) => {
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

    const totalStress = Object.values(stats).reduce((sum, v) => sum + v.total, 0);
    const totalCentral = Object.values(stats).reduce((sum, v) => sum + v.central, 0);

    return { stats, totalStress, totalCentral };
}

const CATEGORIES = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];
const CAT_SHORT: Record<string, string> = {
    'Knee': 'Knee',
    'Hip': 'Hip',
    'Horizontal Push': 'Push-H',
    'Vertical Push': 'Push-V',
};

function WeekStressTable({ label, stats, totalStress, totalCentral }: {
    label: string;
    stats: Record<string, { central: number; total: number }>;
    totalStress: number;
    totalCentral: number;
}) {
    const csBalance = totalStress > 0 ? (totalCentral / totalStress) : 0;

    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--primary)',
                marginBottom: '0.35rem',
            }}>
                {label}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '3px 4px', color: 'var(--secondary-foreground)', fontWeight: 600, borderBottom: '1px solid var(--card-border)' }}></th>
                        {CATEGORIES.map(c => (
                            <th key={c} style={{ textAlign: 'center', padding: '3px 2px', color: 'var(--secondary-foreground)', fontWeight: 600, borderBottom: '1px solid var(--card-border)' }}>
                                {CAT_SHORT[c]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ padding: '3px 4px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>
                            Total <span style={{ color: 'var(--secondary-foreground)', fontWeight: 400 }}>{totalStress.toFixed(1)}</span>
                        </td>
                        {CATEGORIES.map(c => (
                            <td key={c} style={{ textAlign: 'center', padding: '3px 2px', borderBottom: '1px solid var(--card-border)', fontWeight: 600 }}>
                                {stats[c].total > 0 ? stats[c].total.toFixed(1) : <span style={{ opacity: 0.25 }}>—</span>}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ padding: '3px 4px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>
                            Central <span style={{ color: 'var(--secondary-foreground)', fontWeight: 400 }}>{totalCentral.toFixed(1)}</span>
                        </td>
                        {CATEGORIES.map(c => (
                            <td key={c} style={{ textAlign: 'center', padding: '3px 2px', borderBottom: '1px solid var(--card-border)' }}>
                                {stats[c].central > 0 ? stats[c].central.toFixed(1) : <span style={{ opacity: 0.25 }}>—</span>}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ padding: '3px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            CS Bal <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{csBalance.toFixed(2)}</span>
                        </td>
                        {CATEGORIES.map(c => {
                            const val = stats[c].total > 0 ? (stats[c].central / stats[c].total) : 0;
                            return (
                                <td key={c} style={{ textAlign: 'center', padding: '3px 2px', opacity: val > 0 ? 1 : 0.25 }}>
                                    {val > 0 ? val.toFixed(2) : '—'}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

/** Sidebar stress panel — shows stress index for each week */
export default function StressMatrix({ weeks }: { weeks: any[] }) {
    const weekData = useMemo(() => {
        return weeks.map(week => {
            const { stats, totalStress, totalCentral } = computeStress([week]);
            return { weekNumber: week.weekNumber, stats, totalStress, totalCentral };
        });
    }, [weeks]);

    if (weeks.length === 0) {
        return (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.75rem' }}>
                Add exercises to see stress index
            </div>
        );
    }

    return (
        <div style={{ overflowY: 'auto', padding: '0.5rem' }}>
            {weekData.map(wd => (
                <WeekStressTable
                    key={wd.weekNumber}
                    label={`Week ${wd.weekNumber}`}
                    stats={wd.stats}
                    totalStress={wd.totalStress}
                    totalCentral={wd.totalCentral}
                />
            ))}
        </div>
    );
}

'use client';

import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { calculateStress } from '@/lib/stress-index';
import { EXERCISE_DB } from '@/lib/exercise-db'; // Import for category lookup

export default function StressPreview({ weeks }) {
    // Calculate aggregate stress per session by category
    const data = useMemo(() => {
        const sessionData = [];

        weeks.forEach(week => {
            week.sessions.forEach(session => {
                const categoryStress = {};

                session.exercises.forEach(ex => {
                    // Handle Granular Sets (Array) or Legacy (Number)
                    const setsList = Array.isArray(ex.sets) ? ex.sets : [];
                    const simpleSets = !Array.isArray(ex.sets) ? (parseFloat(ex.sets) || 0) : 0;

                    // Helper to process a single set
                    const processSet = (repsVal, rpeVal, multiplier = 1) => {
                        // Parse reps (handle '5-8' range by taking avg)
                        let reps = 0;
                        if (typeof repsVal === 'string' && repsVal.includes('-')) {
                            const [min, max] = repsVal.split('-').map(Number);
                            reps = (min + max) / 2;
                        } else {
                            reps = parseFloat(repsVal) || 0;
                        }

                        const rpe = parseFloat(rpeVal) || 0;

                        if (reps > 0 && rpe > 0) {
                            const singleSetStress = calculateStress(reps, rpe);

                            // Determine Category
                            let category = 'Misc';
                            if (ex.category) {
                                category = ex.category;
                            } else if (EXERCISE_DB[ex.name]) {
                                category = EXERCISE_DB[ex.name].category;
                            } else {
                                // Fallback
                                if (ex.name.includes('Squat')) category = 'Knee';
                                else if (ex.name.includes('Deadlift')) category = 'Hip';
                                else if (ex.name.includes('Bench')) category = 'Push (Horizontal)';
                                else if (ex.name.includes('Press')) category = 'Push (Vertical)';
                            }

                            if (!categoryStress[category]) categoryStress[category] = 0;
                            // Add stress * multiplier (multiplier is 1 for granular, 'sets' count for simple)
                            categoryStress[category] += singleSetStress.total * multiplier;
                        }
                    };

                    if (setsList.length > 0) {
                        setsList.forEach(s => processSet(s.reps, s.rpe));
                    } else if (simpleSets > 0) {
                        processSet(ex.reps, ex.rpeTarget, simpleSets);
                    }
                });

                sessionData.push({
                    name: `W${week.weekNumber} D${session.day}`,
                    ...categoryStress
                });
            });
        });

        return sessionData;
    }, [weeks]);

    // Colors for categories
    const colors = {
        'Knee': '#82ca9d',        // Green
        'Hip': '#8884d8',         // Purple
        'Push (Horizontal)': '#ffc658',// Yellow
        'Push (Vertical)': '#ff8042', // Orange
        'Pull (Vertical)': '#0088fe', // Blue
        'Pull (Horizontal)': '#00C49F',// Teal
        'Misc': '#d0ed57'         // Lime
    };

    return (
        <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--warning)' }}>Stress Forecast (Per Session)</h3>
            <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer>
                    <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <XAxis dataKey="name" style={{ fontSize: '0.6rem' }} tickFormatter={(val) => val.split(' ')[1]} />
                        <YAxis style={{ fontSize: '0.75rem' }} />
                        <Tooltip
                            contentStyle={{ background: '#1c1c1c', border: '1px solid #333', fontSize: '0.8rem' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <ReferenceLine y={50} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />

                        <Bar dataKey="Knee" stackId="a" fill={colors['Knee']} />
                        <Bar dataKey="Hip" stackId="a" fill={colors['Hip']} />
                        <Bar dataKey="Push (Horizontal)" stackId="a" fill={colors['Push (Horizontal)']} />
                        <Bar dataKey="Push (Vertical)" stackId="a" fill={colors['Push (Vertical)']} />
                        <Bar dataKey="Pull (Horizontal)" stackId="a" fill={colors['Pull (Horizontal)']} />
                        <Bar dataKey="Pull (Vertical)" stackId="a" fill={colors['Pull (Vertical)']} />
                        <Bar dataKey="Misc" stackId="a" fill={colors['Misc']} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                {Object.entries(colors).map(([cat, color]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: 8, height: 8, background: color }}></div> {cat}
                    </div>
                ))}
            </div>
        </div>
    );
}

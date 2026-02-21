'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BlockImprovements({ logs, dateRange, programs }) {
    const [activeLift, setActiveLift] = useState('Squat');

    const data = useMemo(() => {
        // Filter logs by date range if applicable
        // ... (assume logs are already filtered by parent for now)

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

        // Sort logs by program trajectory (wX_dY) first, then date fallback
        const sortedLogs = [...logs].sort((a, b) => {
            const orderA = getSessionOrder(a.sessionId);
            const orderB = getSessionOrder(b.sessionId);

            if (orderA.week !== orderB.week) return orderA.week - orderB.week;
            if (orderA.day !== orderB.day) return orderA.day - orderB.day;

            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        // Deduplicate logs by session ID (keep the one with the highest e1RM for this lift)
        const sessionMaxMap = new Map(); // sessionId -> { log, maxE1RM } or uniqueKey -> ...

        sortedLogs.forEach(log => {
            // Find max e1rm for this specific log entry
            const matchingExercises = log.exercises.filter(ex =>
                ex.name === `Competition ${activeLift}`
            );

            if (matchingExercises.length === 0) return;

            let currentLogMax = 0;
            matchingExercises.forEach(ex => {
                const sets = ex.sets || [];
                sets.forEach(set => {
                    const rpe = parseFloat(set.rpe || ex.rpe || 10);
                    const reps = parseFloat(set.reps || ex.reps || 1);
                    const weight = parseFloat(set.weight || ex.weight || 0);

                    if (weight > 0) {
                        const e1rm = weight * (1 + (reps + (10 - rpe)) / 30);
                        if (e1rm > currentLogMax) currentLogMax = e1rm;
                    }
                });
            });

            if (currentLogMax > 0) {
                // Key by sessionId if available, otherwise fallback to unique timestamp
                const key = log.sessionId || log.timestamp || log.date;

                if (!sessionMaxMap.has(key) || currentLogMax > sessionMaxMap.get(key).maxE1RM) {
                    sessionMaxMap.set(key, { log, maxE1RM: currentLogMax });
                }
            }
        });

        // Convert map back to points array
        const points = [];
        Array.from(sessionMaxMap.values()).forEach(({ log, maxE1RM }) => {
            let label = `Ses`; // Default prefix
            if (log.sessionId) {
                const order = getSessionOrder(log.sessionId);
                if (order.week !== 99) {
                    label = `W${order.week} D${order.day}`;
                }
            }

            points.push({
                label: label,
                date: new Date(log.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
                fullDate: new Date(log.date).toLocaleString(),
                rawDate: log.date,
                rawLogSessionId: log.sessionId,
                e1rm: Math.round(maxE1RM)
            });
        });

        // Sort points by Week and Day (using getSessionOrder)
        return points.sort((a, b) => {
            const orderA = a.rawLogSessionId ? getSessionOrder(a.rawLogSessionId) : { week: 99, day: 99 };
            const orderB = b.rawLogSessionId ? getSessionOrder(b.rawLogSessionId) : { week: 99, day: 99 };

            if (orderA.week !== orderB.week) return orderA.week - orderB.week;
            if (orderA.day !== orderB.day) return orderA.day - orderB.day;

            return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
        }).map((p, i) => ({ ...p, label: p.label === 'Ses' ? `Ses ${i + 1}` : p.label }));
    }, [logs, activeLift, programs]);

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', marginBottom: '1.5rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="neon-text" style={{ color: 'var(--accent)' }}>///</span> Block Performance Trajectory
            </h3>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
                {['Squat', 'Bench', 'Deadlift'].map(lift => {
                    let activeColor = 'var(--primary)';
                    if (lift === 'Bench') activeColor = 'var(--accent)';
                    if (lift === 'Deadlift') activeColor = '#f472b6'; // Pink

                    return (
                        <button
                            key={lift}
                            onClick={() => setActiveLift(lift)}
                            style={{
                                padding: '0.6rem 2rem',
                                background: activeLift === lift ? activeColor : 'transparent',
                                color: activeLift === lift ? 'black' : 'var(--secondary-foreground)',
                                border: `1px solid ${activeLift === lift ? activeColor : 'var(--card-border)'}`,
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                transition: 'all 0.2s',
                                fontSize: '0.9rem',
                                boxShadow: activeLift === lift ? `0 0 15px ${activeColor}66` : 'none',
                                textTransform: 'uppercase'
                            }}
                        >
                            {lift}
                        </button>
                    );
                })}
            </div>

            <div style={{ height: '350px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                        <XAxis
                            dataKey="label"
                            stroke="var(--secondary-foreground)"
                            fontSize={11}
                            tickMargin={15}
                            axisLine={false}
                            tickLine={false}
                            interval={0} // Show all ticks
                        />
                        <YAxis
                            stroke="var(--secondary-foreground)"
                            domain={['dataMin - 20', 'dataMax + 20']}
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `${val}`}
                        />
                        <Tooltip
                            labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                    return payload[0].payload.fullDate;
                                }
                                return label;
                            }}
                            contentStyle={{
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid var(--primary)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                color: 'var(--foreground)'
                            }}
                            itemStyle={{ color: 'var(--primary)' }}
                            labelStyle={{ color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}
                            cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="e1rm"
                            stroke={activeLift === 'Squat' ? 'var(--primary)' : activeLift === 'Bench' ? 'var(--accent)' : '#f472b6'}
                            strokeWidth={3}
                            dot={{ fill: 'var(--background)', stroke: activeLift === 'Squat' ? 'var(--primary)' : activeLift === 'Bench' ? 'var(--accent)' : '#f472b6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 7, fill: activeLift === 'Squat' ? 'var(--primary)' : activeLift === 'Bench' ? 'var(--accent)' : '#f472b6', stroke: 'white', strokeWidth: 2 }}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

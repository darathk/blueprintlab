'use client';

import { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { generatePrimaryLiftProgress } from '@/lib/analytics-engine';

export default function PrimaryLiftProgress({ logs }) {
    const [timeRange, setTimeRange] = useState('3m'); // Default 3 months

    const data = useMemo(() => generatePrimaryLiftProgress(logs, timeRange), [logs, timeRange]);

    const ranges = [
        { label: '1 Month', value: '1m' },
        { label: '3 Months', value: '3m' },
        { label: '1 Year', value: '1y' },
        { label: 'All Time', value: 'all' }
    ];

    const lifts = [
        { key: 'Squat', color: 'var(--success)' },
        { key: 'Bench Press', color: 'var(--accent)' },
        { key: 'Deadlift', color: 'var(--warning)' }
    ];

    return (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--foreground)', fontWeight: 600 }}>Primary Lift Progress</h2>

                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--glass-surface-2)', padding: '3px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    {ranges.map(range => (
                        <button
                            key={range.value}
                            onClick={() => setTimeRange(range.value)}
                            className="chat-press"
                            style={{
                                background: timeRange === range.value ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                                color: timeRange === range.value ? '#fff' : 'var(--secondary-foreground)',
                                border: timeRange === range.value ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.16s var(--ease-out)',
                                boxShadow: timeRange === range.value ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                            }}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gap: '3rem' }}>
                {lifts.map(lift => (
                    <div key={lift.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: lift.color }}></div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{lift.key}</h3>
                        </div>

                        <div style={{ height: '250px', width: '100%' }}>
                            {data[lift.key].length > 0 ? (
                                <ResponsiveContainer>
                                    <LineChart data={data[lift.key]} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                        <XAxis
                                            dataKey="displayDate"
                                            style={{ fontSize: '0.75rem', opacity: 0.7 }}
                                            tick={{ fill: 'var(--secondary-foreground)' }}
                                        />
                                        <YAxis
                                            domain={['dataMin - 20', 'dataMax + 20']}
                                            style={{ fontSize: '0.75rem', opacity: 0.7 }}
                                            tick={{ fill: 'var(--secondary-foreground)' }}
                                            width={40}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: '#1c1c1c', border: '1px solid #333', fontSize: '0.9rem' }}
                                            labelStyle={{ color: '#888' }}
                                            itemStyle={{ color: lift.color }}
                                            formatter={(value) => [`${value} lbs`, lift.key]}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke={lift.color}
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#1c1c1c', strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-foreground)', fontSize: '0.9rem', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                    No {lift.key} data in this timeframe
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

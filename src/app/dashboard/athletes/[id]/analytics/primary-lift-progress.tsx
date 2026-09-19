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
        <div className="glass-panel p-3.5 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 sm:mb-6 gap-3">
                <h2 style={{ fontSize: '1.25rem', color: 'var(--foreground)', fontWeight: 600 }}>Primary Lift Progress</h2>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-1 bg-white/[0.04] p-1 rounded-full border border-white/10 self-start sm:self-auto">
                    {ranges.map(range => (
                        <button
                            key={range.value}
                            onClick={() => setTimeRange(range.value)}
                            className="chat-press px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-full transition-all"
                            style={{
                                background: timeRange === range.value ? 'rgba(125, 135, 210, 0.25)' : 'transparent',
                                color: timeRange === range.value ? '#fff' : 'var(--secondary-foreground)',
                                border: timeRange === range.value ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                boxShadow: timeRange === range.value ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                            }}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-6 sm:gap-10">
                {lifts.map(lift => (
                    <div key={lift.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: lift.color }}></div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{lift.key}</h3>
                        </div>

                        <div className="h-[200px] sm:h-[250px] w-full">
                            {data[lift.key].length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data[lift.key]} margin={{ top: 5, right: 10, bottom: 5, left: -14 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                        <XAxis
                                            dataKey="displayDate"
                                            style={{ fontSize: '0.7rem', opacity: 0.7 }}
                                            tick={{ fill: 'var(--secondary-foreground)' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            domain={['dataMin - 20', 'dataMax + 20']}
                                            style={{ fontSize: '0.7rem', opacity: 0.7 }}
                                            tick={{ fill: 'var(--secondary-foreground)' }}
                                            width={34}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: '#1c1c1c', border: '1px solid #333', fontSize: '0.85rem' }}
                                            labelStyle={{ color: '#888' }}
                                            itemStyle={{ color: lift.color }}
                                            formatter={(value) => [`${value} lbs`, lift.key]}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke={lift.color}
                                            strokeWidth={2.5}
                                            dot={{ r: 3, fill: '#1c1c1c', strokeWidth: 2 }}
                                            activeDot={{ r: 5 }}
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

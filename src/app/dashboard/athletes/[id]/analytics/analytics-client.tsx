'use client';

import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, ZAxis, CartesianGrid
} from 'recharts';
import { generateVariationImpactReport, generateCentralBalanceData, generateIntensityHeatmap } from '@/lib/analytics-engine';
import PrimaryLiftProgress from './primary-lift-progress';

export default function AnalyticsClient({ logs }) {
    const variationData = useMemo(() => generateVariationImpactReport(logs), [logs]);
    const centralData = useMemo(() => generateCentralBalanceData(logs), [logs]);
    // Heatmap omitted for brevity/complexity in V1, focusing on top 2 requested features first

    return (
        <div style={{ display: 'grid', gap: '2rem' }}>

            {/* Feature D: Primary Lift Progress */}
            <PrimaryLiftProgress logs={logs} />

            {/* Feature A: Variation Impact */}
            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--primary)' }}>Variation Impact Report</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                    Impact of secondary variations on primary lift gains.
                </p>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer>
                        <BarChart data={variationData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <XAxis type="number" unit="%" />
                            <YAxis type="category" dataKey="name" width={120} style={{ fontSize: '0.8rem' }} />
                            <Tooltip
                                contentStyle={{ background: '#1c1c1c', border: '1px solid #333' }}
                                formatter={(value) => [`${value}% Gain`, 'Impact']}
                            />
                            <Legend />
                            <Bar dataKey="avgGain" fill="var(--success)" name="Avg Primary Gain %" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Feature B: Central Balance */}
            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>Central Balance Sweet Spot</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                    Ratio of Central/Total Stress vs E1RM Gain.
                </p>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" dataKey="x" name="Central Ratio" unit="" domain={[0, 1]} />
                            <YAxis type="number" dataKey="y" name="Gain" unit="%" />
                            <ZAxis range={[100, 100]} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#1c1c1c', border: '1px solid #333' }} />
                            <Scatter name="Blocks" data={centralData} fill="var(--warning)" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Feature C: Intensity Heatmap */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--foreground)' }}>Intensity Heatmap</h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Gain % per Zone</div>
                </div>

                <IntensityHeatmap logs={logs} />
            </div>
        </div>
    );
}

function IntensityHeatmap({ logs }) {
    const data = useMemo(() => generateIntensityHeatmap(logs), [logs]);

    const yLabels = ["10+", "7-10", "4-6", "1-3"];
    const xLabels = ["6-7", "7-8", "8-9", "9+"];

    // Helper to find data for a cell
    const getCellData = (reps, rpe) => {
        const point = data.find(d => d.reps === reps && d.rpe === rpe);
        return point ? parseFloat(point.gain) : null;
    };

    // Determine max gain for color scaling
    const maxGain = Math.max(...data.map(d => parseFloat(d.gain)), 5); // Default max 5% for scale if empty

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>
                {/* Y-Axis Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: '1rem', height: '300px' }}>
                    {yLabels.map(label => (
                        <div key={label} style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>
                            {label} Reps
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${xLabels.length}, 1fr)`,
                    gridTemplateRows: `repeat(${yLabels.length}, 1fr)`,
                    gap: '4px',
                    width: '100%',
                    maxWidth: '500px',
                    height: '300px'
                }}>
                    {yLabels.map(reps => (
                        xLabels.map(rpe => {
                            const gain = getCellData(reps, rpe);
                            const intensity = gain !== null ? Math.max(0.2, Math.min(1, gain / maxGain)) : 0.05;

                            return (
                                <div
                                    key={`${reps}-${rpe}`}
                                    style={{
                                        background: gain !== null ? `rgba(16, 185, 129, ${intensity})` : 'var(--card-border)',
                                        color: gain !== null && intensity > 0.6 ? '#000' : 'var(--foreground)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        transition: 'all 0.2s'
                                    }}
                                    title={`Reps: ${reps}, RPE: ${rpe}, Gain: ${gain}%`}
                                >
                                    {gain !== null ? `${gain}%` : '-'}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            {/* X-Axis Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', maxWidth: '500px', paddingLeft: '60px', marginTop: '0.5rem' }}>
                {xLabels.map(label => (
                    <div key={label} style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>
                        RPE {label}
                    </div>
                ))}
            </div>
        </div>
    );
}

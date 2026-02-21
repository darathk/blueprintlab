'use client';

import { useMemo, useState } from 'react';
import { calculateSimpleE1RM } from '@/lib/stress-index';

export default function CompLiftHeatMap({ logs, programs, activeLift = 'Squat' }) {
    const [metric, setMetric] = useState('# of Blocks'); // 'End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'

    // Constants for table dimensions
    const RPE_COLUMNS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];
    const REPS_ROWS = Array.from({ length: 12 }, (_, i) => i + 1); // 1 to 12

    const heatmapData = useMemo(() => {
        if (!logs || !programs || logs.length === 0) return { matrix: {}, maxVal: 0, minVal: 0 };

        // 1. First, we need to calculate the Start, Peak, End E1RM and Gain for EACH block (Program)
        // Similar to the Meta Analysis logic, but isolated here.
        const blockStats = new Map(); // programId -> { start, peak, end, gain }

        // Group sets by program
        const setsByProgram = new Map();

        logs.forEach(log => {
            const progId = log.programId || log.programName; // Fallback to name if generic
            if (!setsByProgram.has(progId)) setsByProgram.set(progId, []);

            log.exercises.forEach(ex => {
                // Strict match for Competition Lift
                if (ex.name === `Competition ${activeLift}`) {
                    ex.sets.forEach(set => {
                        const weight = parseFloat(set.weight || 0);
                        const reps = parseFloat(set.reps || 0);
                        const rpe = parseFloat(set.rpe || 0);
                        if (weight > 0 && reps > 0 && rpe > 0) {
                            setsByProgram.get(progId).push({
                                rawDate: new Date(log.date),
                                weight, reps, rpe,
                                e1rm: calculateSimpleE1RM(weight, reps, rpe)
                            });
                        }
                    });
                }
            });
        });

        // Compute Block E1RM stats
        setsByProgram.forEach((sets, progId) => {
            if (sets.length === 0) return;

            // Sort chronologically
            sets.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

            const firstSet = sets[0];
            const lastSet = sets[sets.length - 1];
            const peakE1RM = Math.max(...sets.map(s => s.e1rm));

            const startE1RM = firstSet.e1rm;
            const endE1RM = lastSet.e1rm;
            const gain = endE1RM - startE1RM;

            blockStats.set(progId, {
                startE1RM, peakE1RM, endE1RM, gain
            });
        });

        // 2. Now map these Block metrics back to the Rep/RPE Pairings
        // Matrix: { "rep-rpe": { blocksHit: Set(progId), sumEnd: 0, sumPeak: 0, sumGain: 0 } }
        const cellData = {};

        setsByProgram.forEach((sets, progId) => {
            const stats = blockStats.get(progId);
            if (!stats) return;

            // Track which unique cells this block hit
            const cellsHitByThisBlock = new Set<string>();

            sets.forEach(set => {
                // Round reps and find closest RPE bin (0.5 increments)
                const r = Math.round(set.reps);
                const rpeBin = Math.round(set.rpe * 2) / 2;

                if (r > 0 && r <= 12 && rpeBin >= 5 && rpeBin <= 10) {
                    cellsHitByThisBlock.add(`${r}-${rpeBin}`);
                }
            });

            // For every cell hit by this block, aggregate this block's total metrics
            cellsHitByThisBlock.forEach(cellKey => {
                if (!cellData[cellKey]) {
                    cellData[cellKey] = {
                        blocksCount: 0,
                        sumEnd: 0,
                        sumPeak: 0,
                        sumGain: 0
                    };
                }
                cellData[cellKey].blocksCount += 1;
                cellData[cellKey].sumEnd += stats.endE1RM;
                cellData[cellKey].sumPeak += stats.peakE1RM;
                cellData[cellKey].sumGain += stats.gain;
            });
        });

        // 3. Finalize matrix values based on active Metric
        const matrix = {};
        let maxVal = -Infinity;
        let minVal = Infinity;

        Object.keys(cellData).forEach(key => {
            const data = cellData[key];
            let val = 0;
            if (metric === '# of Blocks') {
                val = data.blocksCount;
            } else if (metric === 'End E1RM') {
                val = data.blocksCount > 0 ? (data.sumEnd / data.blocksCount) : 0;
            } else if (metric === 'Peak E1RM') {
                val = data.blocksCount > 0 ? (data.sumPeak / data.blocksCount) : 0;
            } else if (metric === 'Gain') {
                val = data.blocksCount > 0 ? (data.sumGain / data.blocksCount) : 0;
            }

            matrix[key] = val;
            if (val > maxVal) maxVal = val;
            if (val < minVal) minVal = val;
        });

        if (maxVal === -Infinity) maxVal = 0;
        if (minVal === Infinity) minVal = 0;

        return { matrix, maxVal, minVal };
    }, [logs, programs, activeLift, metric]);

    // Color interpolation gradient logic (Yellow to Red)
    // Actually RTS uses Green -> Yellow -> Red? The tooltip says "Warmer the color, higher value". 
    // Usually that's pure Red for highest, Yellow for mid, Blue/Green for low. Let's use CSS var range or HSL.
    const getColor = (value) => {
        if (!value && value !== 0) return 'rgba(255,255,255,0.02)';

        // Handle no variance
        if (heatmapData.maxVal === heatmapData.minVal) return '#facc15'; // Default yellow if all same

        // Normalize 0 to 1
        const normalized = (value - heatmapData.minVal) / (heatmapData.maxVal - heatmapData.minVal);

        // We will blend from Green (120deg) to Yellow (60deg) to Red (0deg)
        // Hue range: 120 -> 0. (Green is lowest, Red is highest)
        const hue = (1 - normalized) * 120;
        return `hsl(${hue}, 90%, 50%)`;
    };

    return (
        <div className="card" style={{ marginBottom: '2rem', padding: 0 }}>
            <div style={{ padding: '1rem', background: '#2563eb', borderTopLeftRadius: 'var(--radius)', borderTopRightRadius: 'var(--radius)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: 600 }}>Competition Lift Heat Map 🤔</h3>
            </div>

            <div style={{ padding: '1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
                    <strong>Comp Lifts:</strong> {activeLift}
                </div>

                <div style={{ background: 'var(--background)', border: '1px solid var(--card-border)', padding: '0.4rem 0.8rem', borderRadius: '4px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem', paddingRight: '0.5rem', borderRight: '1px solid var(--card-border)' }}>Y</span>
                    {['End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                            <input
                                type="radio"
                                name="heatmapMetric"
                                checked={metric === opt}
                                onChange={() => setMetric(opt)}
                                style={{ accentColor: 'var(--accent)' }}
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            </div>

            <div style={{ overflowX: 'auto', padding: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px', fontSize: '0.85rem' }}>
                    <thead>
                        <tr>
                            <td style={{ width: '40px' }}></td>
                            {RPE_COLUMNS.map(rpe => (
                                <th key={rpe} style={{ textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', paddingBottom: '0.5rem' }}>
                                    {rpe}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {REPS_ROWS.map(rep => (
                            <tr key={rep}>
                                <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', paddingRight: '1rem' }}>
                                    {rep}
                                </td>
                                {RPE_COLUMNS.map(rpe => {
                                    const key = `${rep}-${rpe}`;
                                    const val = heatmapData.matrix[key];
                                    const hasData = val !== undefined && !isNaN(val) && (metric !== '# of Blocks' || val > 0);

                                    return (
                                        <td key={rpe} style={{
                                            background: hasData ? getColor(val) : 'rgba(255,255,255,0.05)',
                                            height: '40px',
                                            borderRadius: '4px',
                                            transition: 'background 0.3s ease',
                                            cursor: hasData ? 'pointer' : 'default'
                                        }} title={hasData ? `${metric}: ${val.toFixed(1)}` : ''}>
                                            {/* Empty rounded rectangle */}
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

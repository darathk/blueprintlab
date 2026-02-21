'use client';

import { useMemo, useState } from 'react';

// Props:
// blocks: Array of block stats (id, name, gain, startDate, endDate)
// logs: Raw logs to determine the Rep/RPE placement
// primaryLift: 'Squat', 'Bench', etc.

export default function CompetitionLiftHeatMap({ blocks, logs, primaryLift }) {
    const [selectedCell, setSelectedCell] = useState(null); // { reps, rpe, data: [blocks], val }
    const [metric, setMetric] = useState('Gain'); // 'End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'
    const [viewMode, setViewMode] = useState('radial'); // 'grid' | 'radial'
    const [showInfo, setShowInfo] = useState(false);

    // Grid Definition based on screenshot
    // Rows: Reps 1 to 12
    // Cols: RPE 10 down to 5 (0.5 steps)
    const ROWS = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2... 12]
    const COLS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];

    // 1. Process Data
    const heatmapData = useMemo(() => {
        if (!blocks || blocks.length === 0 || !logs) return { data: {}, minVal: 0, maxVal: 0 };

        const data = {}; // Key: "reps-rpe", Value: { sumEnd: 0, sumPeak: 0, sumGain: 0, count: 0, blocks: [] }

        blocks.forEach(block => {
            const blockLogs = logs.filter(l =>
                (l.programId === block.id || (!l.programId && l.programName === block.name)) &&
                l.exercises.some(e =>
                    e.name === `Competition ${primaryLift}` ||
                    e.isPrimary
                )
            );

            if (blockLogs.length === 0) return;

            // Determine DOMINANT Rep/RPE scheme for this block
            const pairs = {};
            blockLogs.forEach(l => {
                l.exercises.forEach(e => {
                    if (e.name === `Competition ${primaryLift}` || e.isPrimary) {
                        e.sets.forEach(s => {
                            const reps = Math.round(s.reps || e.reps || 0);
                            const rpe = Math.round((s.rpe || e.rpe || 0) * 2) / 2;

                            if (reps > 0 && rpe >= 5 && rpe <= 10) {
                                const key = `${reps}-${rpe}`;
                                pairs[key] = (pairs[key] || 0) + 1;
                            }
                        });
                    }
                });
            });

            // Add block to ALL cells that were performed (unique Rep/RPE pairs)
            Object.keys(pairs).forEach(pairKey => {
                if (!data[pairKey]) {
                    data[pairKey] = { sumEnd: 0, sumPeak: 0, sumGain: 0, count: 0, blocks: [] };
                }
                data[pairKey].sumEnd += (block.endE1RM || 0);
                data[pairKey].sumPeak += (block.peakE1RM || 0);
                data[pairKey].sumGain += (block.gain || 0);
                data[pairKey].count += 1;
                data[pairKey].blocks.push(block);
            });
        });

        // Compute Min/Max for current metric to establish color gradient scale
        let minVal = Infinity;
        let maxVal = -Infinity;

        Object.keys(data).forEach(key => {
            const cell = data[key];
            let val = 0;
            if (metric === '# of Blocks') val = cell.count;
            else if (metric === 'End E1RM') val = cell.count > 0 ? (cell.sumEnd / cell.count) : 0;
            else if (metric === 'Peak E1RM') val = cell.count > 0 ? (cell.sumPeak / cell.count) : 0;
            else if (metric === 'Gain') val = cell.count > 0 ? (cell.sumGain / cell.count) : 0;

            if (val > maxVal) maxVal = val;
            if (val < minVal) minVal = val;
        });

        if (maxVal === -Infinity) maxVal = 0;
        if (minVal === Infinity) minVal = 0;

        return { data, minVal, maxVal };
    }, [blocks, logs, primaryLift, metric]);

    // Helpers
    const getCellData = (reps, rpe) => heatmapData.data[`${reps}-${rpe}`];

    // True Heatmap Gradient (Red -> Yellow -> Green) mapped to 0 -> 1 normalized
    const getGradientColor = (val) => {
        if (val === undefined || val === null || isNaN(val)) return 'rgba(255,255,255,0.02)';

        const { minVal, maxVal } = heatmapData;

        // Zero Variance or only 1 data point
        if (maxVal === minVal) return `hsl(60, 90%, 50%)`; // default Yellow

        const normalized = (val - minVal) / (maxVal - minVal);

        // Red (0) -> Yellow (60) -> Green (120)
        // High value = Green (120)
        // Low value = Red (0)
        const hue = normalized * 120;
        return `hsl(${hue}, 90%, 50%)`;
    };

    // --- Radial SVG Logic ---
    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const describeArc = (x, y, innerRadius, outerRadius, startAngle, endAngle) => {
        const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
        const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
        const startInner = polarToCartesian(x, y, innerRadius, endAngle);
        const endInner = polarToCartesian(x, y, innerRadius, startAngle);

        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        return [
            "M", startOuter.x, startOuter.y,
            "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
            "L", endInner.x, endInner.y,
            "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
            "Z"
        ].join(" ");
    };

    const renderRadialHeatMap = () => {
        const cx = 350;
        const cy = 350;
        const maxRadius = 300;
        const innerRadius = 70;
        const ringWidth = (maxRadius - innerRadius) / COLS.length;

        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 0', position: 'relative' }}>
                <svg width="700" height="700" viewBox="0 0 700 700" style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
                    {/* Background rings to guide the eye */}
                    {COLS.map((_, i) => (
                        <circle key={`bg-ring-${i}`} cx={cx} cy={cy} r={innerRadius + i * ringWidth} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    ))}
                    <circle cx={cx} cy={cy} r={maxRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                    {/* Data Slices */}
                    {ROWS.map(reps => {
                        const centerAngle = reps * 30; // 12 * 30 = 360 (Top)
                        const startAngle = centerAngle - 14;
                        const endAngle = centerAngle + 14;

                        // Radial lines
                        const lineEnd = polarToCartesian(cx, cy, maxRadius, centerAngle - 15);
                        const lineStart = polarToCartesian(cx, cy, innerRadius, centerAngle - 15);

                        return (
                            <g key={`rep-group-${reps}`}>
                                <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                                {COLS.map((rpe, rpeIndex) => {
                                    const rInner = innerRadius + (rpeIndex * ringWidth);
                                    const rOuter = rInner + ringWidth - 2;

                                    const cell = getCellData(reps, rpe);
                                    let val = undefined;
                                    if (cell && cell.count > 0) {
                                        if (metric === '# of Blocks') val = cell.count;
                                        else if (metric === 'End E1RM') val = cell.sumEnd / cell.count;
                                        else if (metric === 'Peak E1RM') val = cell.sumPeak / cell.count;
                                        else if (metric === 'Gain') val = cell.sumGain / cell.count;
                                    }

                                    const hasData = val !== undefined && !isNaN(val) && (cell && cell.count > 0);
                                    const d = describeArc(cx, cy, rInner, rOuter, startAngle, endAngle);

                                    return (
                                        <path
                                            key={`${reps}-${rpe}`}
                                            d={d}
                                            fill={hasData ? getGradientColor(val) : 'rgba(255,255,255,0.02)'}
                                            stroke={selectedCell?.reps === reps && selectedCell?.rpe === rpe ? '#fff' : 'none'}
                                            strokeWidth="2"
                                            onClick={() => hasData && setSelectedCell({ reps, rpe, blocks: cell.blocks, val })}
                                            style={{ cursor: hasData ? 'pointer' : 'default', transition: 'fill 0.2s, stroke 0.2s' }}
                                        >
                                            <title>{hasData ? `${metric}: ${metric === '# of Blocks' ? val : val.toFixed(1)} (${cell.count} blocks)` : `${reps} Reps @ RPE ${rpe}`}</title>
                                        </path>
                                    );
                                })}
                            </g>
                        );
                    })}

                    {/* Outer Rep Labels */}
                    {ROWS.map(reps => {
                        const centerAngle = reps * 30;
                        const pos = polarToCartesian(cx, cy, maxRadius + 25, centerAngle);
                        return (
                            <text key={`label-${reps}`} x={pos.x} y={pos.y} fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
                                {reps} Rep
                            </text>
                        );
                    })}

                    {/* Center Label (RPE legend idea) */}
                    <text x={cx} y={cy - 10} fill="#aaa" fontSize="12" textAnchor="middle">Center = 10 RPE</text>
                    <text x={cx} y={cy + 10} fill="#aaa" fontSize="12" textAnchor="middle">Outer = 5 RPE</text>
                </svg>
            </div>
        );
    };

    return (
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', overflow: 'visible', background: 'var(--background)' }}>
            {/* Header / Config */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="neon-text" style={{ color: 'var(--primary)' }}>///</span> {primaryLift} Heat Map
                    <span
                        onMouseEnter={() => setShowInfo(true)}
                        onMouseLeave={() => setShowInfo(false)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--card-border)', color: 'var(--secondary-foreground)', fontSize: '0.8rem', cursor: 'help', marginLeft: '0.5rem' }}
                    >?</span>
                </h3>

                {/* RTS style tooltip popup */}
                {showInfo && (
                    <div style={{ position: 'absolute', top: '100%', left: '0', width: '450px', background: 'var(--card-bg)', backdropFilter: 'blur(12px)', color: 'var(--foreground)', padding: '1.5rem', borderRadius: 'var(--radius)', zIndex: 100, border: '1px solid var(--card-border)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                        <strong style={{ display: 'block', marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--primary)' }}>Green indicates higher values; Red indicates lower values.</strong>
                        <p style={{ marginBottom: '1rem', color: 'var(--secondary-foreground)' }}>This heat map is an easy way for you to see what kinds of rep and RPE pairings you respond well to. Reps are listed down the vertical axis. RPE is across the horizontal axis. Click on a dot for more detailed info.</p>

                        <p style={{ marginBottom: '0.7rem' }}><strong style={{ color: 'var(--foreground)' }}>End E1RM:</strong> This is the final E1RM of the training block. Greener colors indicate a higher-than-average End E1RM for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: '0.7rem' }}><strong style={{ color: 'var(--foreground)' }}>Peak E1RM:</strong> This is the best E1RM from the training block. Greener colors indicate a higher-than-average Peak E1RM for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: '0.7rem' }}><strong style={{ color: 'var(--foreground)' }}>Gain:</strong> This refers to the change between your starting E1RM and End E1RM for each block. In other words, it's how productive each block was for you. Greener colors indicate a higher-than-average Gain for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: 0 }}><strong style={{ color: 'var(--foreground)' }}># of Blocks:</strong> This refers to how many blocks are associated with this rep-RPE combo. Greener colors indicate a higher-than-average number for blocks containing this rep-RPE pairing. This is useful in determining where you have robust data and where the data is more slim.</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    Comp Lifts: <span style={{ fontWeight: 400 }}>{primaryLift}</span>

                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '2px', marginLeft: '1rem' }}>
                        <button
                            onClick={() => setViewMode('grid')}
                            style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? '#000' : 'var(--secondary-foreground)', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >Grid View</button>
                        <button
                            onClick={() => setViewMode('radial')}
                            style={{ background: viewMode === 'radial' ? 'var(--primary)' : 'transparent', color: viewMode === 'radial' ? '#000' : 'var(--secondary-foreground)', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >Radial View</button>
                    </div>
                </div>

                <div style={{ background: 'var(--secondary)', border: '1px solid var(--card-border)', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--secondary-foreground)', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    </span>
                    {['End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 500 }}>
                            <input
                                type="radio"
                                name="heatmapMetric"
                                checked={metric === opt}
                                onChange={() => setMetric(opt)}
                                style={{ accentColor: 'var(--primary)', transform: 'scale(1.1)' }}
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
                    <div style={{ minWidth: '600px', display: 'grid', gridTemplateColumns: `50px repeat(${COLS.length}, 1fr)`, gap: '4px' }}>
                        {/* Header Row */}
                        <div></div> {/* Empty Top-Left */}
                        {COLS.map(rpe => (
                            <div key={rpe} style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', paddingBottom: '0.5rem' }}>
                                {rpe}
                            </div>
                        ))}

                        {/* Rows */}
                        {ROWS.map(reps => (
                            <div key={reps} style={{ display: 'contents' }}>
                                {/* Row Label (Reps) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', paddingRight: '0.5rem' }}>
                                    {reps}
                                </div>

                                {/* Cells */}
                                {COLS.map(rpe => {
                                    const cell = getCellData(reps, rpe);
                                    let val = undefined;

                                    if (cell && cell.count > 0) {
                                        if (metric === '# of Blocks') val = cell.count;
                                        else if (metric === 'End E1RM') val = cell.sumEnd / cell.count;
                                        else if (metric === 'Peak E1RM') val = cell.sumPeak / cell.count;
                                        else if (metric === 'Gain') val = cell.sumGain / cell.count;
                                    }

                                    const hasData = val !== undefined && !isNaN(val) && (cell && cell.count > 0);

                                    return (
                                        <div
                                            key={`${reps}-${rpe}`}
                                            onClick={() => hasData && setSelectedCell({ reps, rpe, blocks: cell.blocks, val })}
                                            style={{
                                                height: '40px',
                                                background: hasData ? getGradientColor(val) : 'rgba(255,255,255,0.02)',
                                                borderRadius: '6px',
                                                cursor: hasData ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: selectedCell?.reps === reps && selectedCell?.rpe === rpe ? '2px solid white' : '1px solid rgba(255,255,255,0.02)',
                                                boxShadow: hasData ? 'inset 0 0 10px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'transform 0.1s',
                                            }}
                                            title={hasData ? `${metric}: ${metric === '# of Blocks' ? val : val.toFixed(1)} (${cell.count} blocks)` : ''}
                                            onMouseEnter={(e) => { if (hasData) e.currentTarget.style.transform = 'scale(1.05)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                        >
                                            {/* Empty rounded rectangle */}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                renderRadialHeatMap()
            )}

            <div style={{ textAlign: 'right', padding: '0 1.5rem 1.5rem 0', fontSize: '0.8rem', color: 'var(--foreground)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                <span>Lower</span>
                <div style={{ width: '150px', height: '12px', background: 'linear-gradient(90deg, hsl(0, 90%, 50%), hsl(60, 90%, 50%), hsl(120, 90%, 50%))', borderRadius: '4px' }}></div>
                <span>Higher</span>
            </div>

            {/* Modal */}
            {selectedCell && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(5, 10, 20, 0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)'
                }} onClick={() => setSelectedCell(null)}>
                    <div className="glass-panel" style={{
                        padding: '2rem', borderRadius: '12px',
                        width: '450px', maxWidth: '90vw', border: '1px solid var(--primary)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--foreground)' }}>
                                <span style={{ color: 'var(--primary)' }}>{selectedCell.reps}</span> Reps @ <span style={{ color: 'var(--accent)' }}>RPE {selectedCell.rpe}</span>
                            </h3>
                            <button onClick={() => setSelectedCell(null)} style={{ background: 'transparent', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 0.5 }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--muted)' }}>
                            Average {metric}: <span style={{ color: 'var(--foreground)', fontWeight: 'bold', fontSize: '1.2rem', marginLeft: '0.5rem' }}>
                                {metric === '# of Blocks' ? selectedCell.val : selectedCell.val.toFixed(1)}
                            </span>
                        </div>

                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--secondary-foreground)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Phase / Mission</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{metric}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedCell.blocks.map((b, i) => {
                                        let bVal = 0;
                                        if (metric === '# of Blocks') bVal = 1;
                                        else if (metric === 'End E1RM') bVal = b.endE1RM || 0;
                                        else if (metric === 'Peak E1RM') bVal = b.peakE1RM || 0;
                                        else if (metric === 'Gain') bVal = b.gain || 0;

                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--foreground)' }}>{b.name}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: metric === 'Gain' && bVal > 0 ? 'var(--success)' : (metric === 'Gain' && bVal < 0 ? 'var(--danger)' : 'var(--foreground)'), fontWeight: 600 }}>
                                                    {metric === 'Gain' && bVal > 0 ? '+' : ''}{metric === '# of Blocks' ? bVal : bVal.toFixed(1)} {metric !== '# of Blocks' && 'lbs'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                            <button className="btn btn-primary" onClick={() => setSelectedCell(null)}>Close Data</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

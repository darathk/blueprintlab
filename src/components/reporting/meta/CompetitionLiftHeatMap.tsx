'use client';

import { useMemo, useState } from 'react';

// Props:
// blocks: Array of block stats (id, name, gain, startDate, endDate)
// logs: Raw logs to determine the Rep/RPE placement
// primaryLift: 'Squat', 'Bench', etc.

export default function CompetitionLiftHeatMap({ blocks, logs, primaryLift }) {
    const [selectedCell, setSelectedCell] = useState(null); // { reps, rpe, data: [blocks], val }
    const [expandedBlockId, setExpandedBlockId] = useState(null);
    const [metric, setMetric] = useState('Gain'); // 'End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'radial'
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
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', overflow: 'visible', borderRadius: 16 }}>
            {/* Header / Config */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.4)' }}>///</span> {primaryLift} Heat Map
                    <span
                        onMouseEnter={() => setShowInfo(true)}
                        onMouseLeave={() => setShowInfo(false)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--glass-surface-3)', border: '1px solid var(--glass-border)', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'help', marginLeft: '0.5rem', fontWeight: 700 }}
                    >?</span>
                </h3>

                {/* RTS style tooltip popup */}
                {showInfo && (
                    <div className="glass-panel-elevated" style={{ position: 'absolute', top: '100%', left: '0', width: '450px', padding: '1.5rem', borderRadius: 16, zIndex: 100, fontSize: '0.85rem', lineHeight: '1.5' }}>
                        <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.95rem', color: 'var(--primary)' }}>Green indicates higher values; Red indicates lower values.</strong>
                        <p style={{ marginBottom: '1rem', color: 'var(--secondary-foreground)' }}>This heat map is an easy way for you to see what kinds of rep and RPE pairings you respond well to. Reps are listed down the vertical axis. RPE is across the horizontal axis. Click on a dot for more detailed info.</p>

                        <p style={{ marginBottom: '0.6rem' }}><strong style={{ color: 'var(--foreground)' }}>End E1RM:</strong> This is the final E1RM of the training block. Greener colors indicate a higher-than-average End E1RM for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: '0.6rem' }}><strong style={{ color: 'var(--foreground)' }}>Peak E1RM:</strong> This is the best E1RM from the training block. Greener colors indicate a higher-than-average Peak E1RM for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: '0.6rem' }}><strong style={{ color: 'var(--foreground)' }}>Gain:</strong> This refers to the change between your starting E1RM and End E1RM for each block. In other words, it&apos;s how productive each block was for you. Greener colors indicate a higher-than-average Gain for blocks containing this rep-RPE pairing.</p>
                        <p style={{ marginBottom: 0 }}><strong style={{ color: 'var(--foreground)' }}># of Blocks:</strong> This refers to how many blocks are associated with this rep-RPE combo. Greener colors indicate a higher-than-average number for blocks containing this rep-RPE pairing. This is useful in determining where you have robust data and where the data is more slim.</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    Comp Lifts: <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)' }}>{primaryLift}</span>

                    <div style={{ display: 'flex', background: 'var(--glass-surface-2)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '3px', marginLeft: '0.5rem' }}>
                        <button
                            onClick={() => setViewMode('grid')}
                            className="chat-press"
                            style={{
                                background: viewMode === 'grid' ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                                color: viewMode === 'grid' ? '#ffffff' : 'var(--secondary-foreground)',
                                border: viewMode === 'grid' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                padding: '0.35rem 0.9rem',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                transition: 'all 0.16s var(--ease-out)',
                                boxShadow: viewMode === 'grid' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                            }}
                        >Grid View</button>
                        <button
                            onClick={() => setViewMode('radial')}
                            className="chat-press"
                            style={{
                                background: viewMode === 'radial' ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                                color: viewMode === 'radial' ? '#ffffff' : 'var(--secondary-foreground)',
                                border: viewMode === 'radial' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                padding: '0.35rem 0.9rem',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                transition: 'all 0.16s var(--ease-out)',
                                boxShadow: viewMode === 'radial' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                            }}
                        >Radial View</button>
                    </div>
                </div>

                <div style={{ background: 'var(--glass-surface-2)', border: '1px solid var(--glass-border)', padding: '6px 14px', borderRadius: '14px', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--secondary-foreground)', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    </span>
                    {['End E1RM', 'Peak E1RM', 'Gain', '# of Blocks'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.82rem', color: metric === opt ? 'var(--foreground)' : 'var(--secondary-foreground)', fontWeight: 600 }}>
                            <input
                                type="radio"
                                name="heatmapMetric"
                                checked={metric === opt}
                                onChange={() => setMetric(opt)}
                                style={{ accentColor: 'var(--primary)' }}
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
            {selectedCell && (() => {
                // Build session-level protocol data for each block in the selected cell
                const blocksWithSessions = selectedCell.blocks.map(block => {
                    const blockLogs = logs.filter(l =>
                        (l.programId === block.id || (!l.programId && l.programName === block.name)) &&
                        l.exercises.some(e =>
                            e.name === `Competition ${primaryLift}` || e.isPrimary
                        )
                    );

                    // Find sessions that actually contain the selected reps/rpe combo
                    const matchingSessions = [];
                    blockLogs.forEach(log => {
                        const matchingExercises = [];
                        log.exercises.forEach(e => {
                            if (e.name === `Competition ${primaryLift}` || e.isPrimary) {
                                const matchingSets = (e.sets || []).filter(s => {
                                    const sReps = Math.round(s.reps || e.reps || 0);
                                    const sRpe = Math.round((s.rpe || e.rpe || 0) * 2) / 2;
                                    return sReps === selectedCell.reps && sRpe === selectedCell.rpe;
                                });
                                if (matchingSets.length > 0) {
                                    matchingExercises.push({ name: e.name, sets: matchingSets });
                                }
                            }
                        });
                        if (matchingExercises.length > 0) {
                            matchingSessions.push({
                                date: log.date,
                                sessionName: log.sessionName || log.name || 'Session',
                                matchingExercises,
                                allExercises: log.exercises
                            });
                        }
                    });

                    return { ...block, matchingSessions };
                });

                return (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(5, 10, 20, 0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)'
                }} onClick={() => { setSelectedCell(null); setExpandedBlockId(null); }}>
                    <div className="solid-panel" style={{
                        padding: '2rem', borderRadius: '12px',
                        width: '650px', maxWidth: '90vw', maxHeight: '85vh', border: '1px solid var(--primary)',
                        display: 'flex', flexDirection: 'column'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--foreground)' }}>
                                <span style={{ color: 'var(--primary)' }}>{selectedCell.reps}</span> Reps @ <span style={{ color: 'var(--accent)' }}>RPE {selectedCell.rpe}</span>
                            </h3>
                            <button onClick={() => { setSelectedCell(null); setExpandedBlockId(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 0.5 }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--muted)', flexShrink: 0 }}>
                            Average {metric}: <span style={{ color: 'var(--foreground)', fontWeight: 'bold', fontSize: '1.2rem', marginLeft: '0.5rem' }}>
                                {metric === '# of Blocks' ? selectedCell.val : selectedCell.val.toFixed(1)}
                            </span>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                            {blocksWithSessions.map((b, i) => {
                                let bVal = 0;
                                if (metric === '# of Blocks') bVal = 1;
                                else if (metric === 'End E1RM') bVal = b.endE1RM || 0;
                                else if (metric === 'Peak E1RM') bVal = b.peakE1RM || 0;
                                else if (metric === 'Gain') bVal = b.gain || 0;

                                const isExpanded = expandedBlockId === b.id;

                                return (
                                    <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: isExpanded ? '1rem' : 0 }}>
                                        {/* Block Row - Clickable */}
                                        <div
                                            onClick={() => setExpandedBlockId(isExpanded ? null : b.id)}
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '0.75rem 0.5rem', cursor: 'pointer', transition: 'background 0.15s',
                                                borderRadius: '6px',
                                                background: isExpanded ? 'rgba(125,135,210,0.08)' : 'transparent',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{
                                                    color: 'var(--secondary-foreground)', fontSize: '0.75rem',
                                                    transition: 'transform 0.2s',
                                                    display: 'inline-block',
                                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                                }}>▶</span>
                                                <div>
                                                    <div style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem' }}>{b.name}</div>
                                                    <div style={{ color: 'var(--secondary-foreground)', fontSize: '0.75rem', marginTop: '2px' }}>
                                                        {b.startDate && new Date(b.startDate).toLocaleDateString()} – {b.endDate && b.endDate !== 'Ongoing' ? new Date(b.endDate).toLocaleDateString() : 'Ongoing'}
                                                        {b.matchingSessions.length > 0 && <span style={{ marginLeft: '0.5rem', color: 'var(--primary)' }}>• {b.matchingSessions.length} session{b.matchingSessions.length !== 1 ? 's' : ''}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{
                                                textAlign: 'right',
                                                color: metric === 'Gain' && bVal > 0 ? 'var(--success)' : (metric === 'Gain' && bVal < 0 ? 'var(--danger)' : 'var(--foreground)'),
                                                fontWeight: 600, fontSize: '0.9rem'
                                            }}>
                                                {metric === 'Gain' && bVal > 0 ? '+' : ''}{metric === '# of Blocks' ? bVal : bVal.toFixed(1)} {metric !== '# of Blocks' && 'lbs'}
                                            </div>
                                        </div>

                                        {/* Expanded Protocol Detail */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '0 0.5rem 1rem 2.25rem',
                                                animation: 'fadeIn 0.2s ease'
                                            }}>
                                                {/* Block Stats Summary */}
                                                <div style={{
                                                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
                                                    marginBottom: '1rem', padding: '0.75rem',
                                                    background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)'
                                                }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start E1RM</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>{b.startE1RM?.toFixed(1) || '—'}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End E1RM</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>{b.endE1RM?.toFixed(1) || '—'}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak E1RM</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>{b.peakE1RM?.toFixed(1) || '—'}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gain</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: (b.gain || 0) > 0 ? 'var(--success)' : (b.gain || 0) < 0 ? 'var(--danger)' : 'var(--foreground)', marginTop: '2px' }}>
                                                            {(b.gain || 0) > 0 ? '+' : ''}{b.gain?.toFixed(1) || '0.0'} lbs
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Session Protocol List */}
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--secondary-foreground)', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                    Sessions with {selectedCell.reps}×{selectedCell.rpe} RPE Protocol
                                                </div>

                                                {b.matchingSessions.length === 0 ? (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', padding: '0.5rem 0' }}>
                                                        No matching sessions found.
                                                    </div>
                                                ) : (
                                                    b.matchingSessions.map((session, si) => (
                                                        <div key={si} style={{
                                                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)',
                                                            borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)' }}>
                                                                    {session.sessionName}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                                                    {new Date(session.date).toLocaleDateString()}
                                                                </div>
                                                            </div>

                                                            {/* Matching comp lift sets */}
                                                            {session.matchingExercises.map((ex, ei) => (
                                                                <div key={ei} style={{ marginBottom: '0.25rem' }}>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '4px' }}>{ex.name}</div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                                        {ex.sets.map((s, si2) => (
                                                                            <span key={si2} style={{
                                                                                fontSize: '0.75rem', padding: '3px 8px',
                                                                                background: 'rgba(125,135,210,0.12)', border: '1px solid rgba(125,135,210,0.25)',
                                                                                borderRadius: '4px', color: 'var(--foreground)', fontFamily: 'monospace',
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {s.weight || '—'}lbs × {s.reps || '—'} @{s.rpe || '—'}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Other exercises in this session */}
                                                            {session.allExercises.filter(e => e.name !== `Competition ${primaryLift}` && !e.isPrimary).length > 0 && (
                                                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Other exercises this session</div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                                        {session.allExercises.filter(e => e.name !== `Competition ${primaryLift}` && !e.isPrimary).map((e, aei) => (
                                                                            <span key={aei} style={{
                                                                                fontSize: '0.7rem', padding: '2px 6px',
                                                                                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)',
                                                                                borderRadius: '4px', color: 'var(--secondary-foreground)'
                                                                            }}>
                                                                                {e.name} ({e.sets?.length || 0}s)
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
                            <button className="btn btn-primary" onClick={() => { setSelectedCell(null); setExpandedBlockId(null); }}>Close Data</button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}

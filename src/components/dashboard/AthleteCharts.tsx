'use client';

import { useState, useMemo } from 'react';

// Helpers
const TIMELINES = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    'ALL': Infinity
};

const PRIMARY_LIFTS = ['Squat', 'Bench', 'Deadlift'];

export default function AthleteCharts({ logs, readinessLogs = [], programs = [] }) {
    const [timeline, setTimeline] = useState('ALL');
    const [selectedProgramId, setSelectedProgramId] = useState('ALL');

    // Filtered Data based on Timeline AND Program
    const { filteredLogs, filteredReadiness } = useMemo(() => {
        const now = new Date();
        const daysToSubtract = TIMELINES[timeline];
        const cutoffDate = daysToSubtract === Infinity ? new Date(0) : new Date(now.setDate(now.getDate() - daysToSubtract));

        const filterByDateAndProgram = (items) => {
            return items.filter(item => {
                const itemDate = new Date(item.date);
                if (itemDate < cutoffDate) return false;

                // If a specific program is selected, valid logs MUST match that ID.
                // Fallback to name match for legacy logs.
                if (selectedProgramId !== 'ALL') {
                    const selectedProgram = programs.find(p => p.id === selectedProgramId);

                    // 1. Strict ID Match
                    if (item.programId && item.programId === selectedProgramId) return true;

                    // 2. Legacy Name Match (if no ID on log)
                    if (!item.programId && item.programName && selectedProgram &&
                        item.programName.trim().toLowerCase() === selectedProgram.name.trim().toLowerCase()) return true;

                    return false;
                }

                return true;
            });
        };

        return {
            filteredLogs: filterByDateAndProgram(logs || []),
            filteredReadiness: filterByDateAndProgram(readinessLogs || [])
        };

    }, [logs, readinessLogs, timeline, selectedProgramId, programs]);


    const chartData = useMemo(() => {
        if (!filteredLogs.length) return {};

        const data = {};

        PRIMARY_LIFTS.forEach(lift => {
            const sessionMaxMap = new Map();

            filteredLogs.forEach(log => {
                // Match anything containing the lift name (e.g., "Squat", "Competition Squat", "Low Bar Squat")
                const matchingExercises = log.exercises.filter(ex => {
                    const exName = (ex.name || '').toLowerCase();
                    return exName.includes(lift.toLowerCase());
                });

                if (matchingExercises.length === 0) return;

                let currentLogMax = 0;
                matchingExercises.forEach(ex => {
                    const sets = ex.sets || [];
                    sets.forEach(set => {
                        // Support both new `set.actual` structure and legacy flat `set` structure
                        const actualSource = set.actual || set;

                        const rpe = parseFloat(actualSource.rpe || ex.rpe || 10);
                        const reps = parseFloat(actualSource.reps || ex.reps || 1);
                        const weight = parseFloat(actualSource.weight || ex.weight || 0);

                        if (weight > 0 && String(actualSource.weight).trim() !== '') {
                            // Epley / BlockReview formula: weight * (1 + (reps + (10 - rpe)) / 30)
                            const e1rm = weight * (1 + (reps + (10 - rpe)) / 30);
                            if (e1rm > currentLogMax) currentLogMax = e1rm;
                        }
                    });
                });

                if (currentLogMax > 0) {
                    // Key by sessionId if available, otherwise unique timestamp
                    const key = log.sessionId || log.id || log.date;

                    if (!sessionMaxMap.has(key) || currentLogMax > sessionMaxMap.get(key).maxE1RM) {
                        sessionMaxMap.set(key, {
                            date: log.date,
                            e1rm: Math.round(currentLogMax)
                        });
                    }
                }
            });

            const points = Array.from(sessionMaxMap.values());
            points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (points.length >= 2) data[lift] = points;
        });

        return data;
    }, [filteredLogs]);

    const readinessData = useMemo(() => {
        if (!filteredReadiness || filteredReadiness.length === 0) return null;

        // Group by metric
        // Metrics: leg_soreness, push_soreness, pull_soreness, tiredness, recovery, motivation, training_load
        const metrics = [
            'leg_soreness', 'push_soreness', 'pull_soreness',
            'tiredness', 'recovery', 'motivation', 'training_load'
        ];
        const data: Record<string, any[]> = {};

        filteredReadiness.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        metrics.forEach(m => {
            data[m] = filteredReadiness
                .map(l => ({
                    date: l.date,
                    value: l.scores[m] || 0
                }))
                .filter(item => item.value > 0); // Filter out 0 (unrecorded) values to prevent dips below axis
        });
        return data;
    }, [filteredReadiness]);


    const [activePoint, setActivePoint] = useState(null);

    // SVG Chart Helper
    const renderLineChart = (dataPoints, color, title, showPercent = true) => {
        if (!dataPoints || dataPoints.length < 2) return null;
        const height = 150;
        const width = 350;
        const padding = 20;

        const values = dataPoints.map(d => d.value ?? d.e1rm);
        const minVal = showPercent ? Math.min(...values) * 0.9 : 1; // Fixed scale 1-5 for readiness
        const maxVal = showPercent ? Math.max(...values) * 1.1 : 5;

        const getX = (index) => padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
        const getY = (value) => height - padding - ((value - minVal) / (maxVal - minVal)) * (height - 2 * padding);

        const points = dataPoints.map((d, i) => `${getX(i)},${getY(d.value ?? d.e1rm)}`).join(' ');

        return (
            <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: color, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}></span>
                    {title}
                </h3>
                <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: '10px' }}>
                    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', minWidth: '500px' }}>
                        {/* Grid Lines */}
                        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1" />
                        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1" />

                        {/* Mid-line for reference */}
                        <line x1={padding} y1={getY((minVal + maxVal) / 2)} x2={width - padding} y2={getY((minVal + maxVal) / 2)} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />

                        {/* Configurable Reference Lines */}
                        {!showPercent && <line x1={padding} y1={getY(3)} x2={width - padding} y2={getY(3)} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2" />}

                        {/* The Line Glow */}
                        <filter id={`glow-${title.replace(/\s/g, '')}`}>
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        <polyline
                            points={points}
                            fill="none"
                            stroke={color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter={`url(#glow-${title.replace(/\s/g, '')})`}
                            style={{ opacity: 0.8 }}
                        />

                        {/* Data Points */}
                        {dataPoints.map((d, i) => {
                            const cx = getX(i);
                            const cy = getY(d.value ?? d.e1rm);
                            const isHovered = activePoint && activePoint.title === title && activePoint.index === i;

                            return (
                                <circle
                                    key={i}
                                    cx={cx}
                                    cy={cy}
                                    r={isHovered ? 6 : 4}
                                    fill={isHovered ? color : "var(--background)"}
                                    stroke={color}
                                    strokeWidth="2"
                                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                                    onMouseEnter={() => setActivePoint({
                                        title,
                                        index: i,
                                        value: (d.value ?? d.e1rm).toFixed(1),
                                        date: new Date(d.date).toLocaleDateString(),
                                        x: cx,
                                        y: cy
                                    })}
                                    onMouseLeave={() => setActivePoint(null)}
                                />
                            );
                        })}
                    </svg>

                    {/* Custom Tooltip */}
                    {activePoint && activePoint.title === title && (
                        <div style={{
                            position: 'absolute',
                            left: `${activePoint.x}px`,
                            top: `${activePoint.y - 40}px`, // Float above the point
                            transform: 'translateX(-50%)',
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: `1px solid ${color}`,
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '0.8rem',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            boxShadow: `0 4px 12px rgba(0,0,0,0.5)`
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{activePoint.value} lbs</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>{activePoint.date}</div>
                            {/* Little triangle pointer */}
                            <div style={{
                                position: 'absolute',
                                bottom: '-5px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: `5px solid ${color}`
                            }} />
                        </div>
                    )}
                </div>
                {showPercent && (
                    <div style={{ fontSize: '0.8rem', marginTop: '1rem', textAlign: 'right', color: 'var(--secondary-foreground)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Progress:</span>
                        <span style={{ color: (values[values.length - 1] - values[0]) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                            {((values[values.length - 1] - values[0]) / values[0] * 100).toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                {/* Program Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mission Filter:</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem', appearance: 'none', background: 'var(--card-bg)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                            value={selectedProgramId}
                            onChange={(e) => setSelectedProgramId(e.target.value)}
                        >
                            <option value="ALL">All Missions</option>
                            {programs.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary)', fontSize: '0.8rem' }}>▼</div>
                    </div>
                </div>

                {/* Timeline */}
                <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', padding: '4px', border: '1px solid var(--card-border)' }}>
                    {Object.keys(TIMELINES).map(tl => (
                        <button
                            key={tl}
                            onClick={() => setTimeline(tl)}
                            style={{
                                padding: '0.4rem 1rem',
                                background: timeline === tl ? 'var(--primary)' : 'transparent',
                                color: timeline === tl ? 'white' : 'var(--foreground)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                transition: 'all 0.2s',
                                boxShadow: timeline === tl ? '0 0 10px rgba(6, 182, 212, 0.3)' : 'none'
                            }}
                        >
                            {tl}
                        </button>
                    ))}
                </div>
            </div>



            {/* Section: Performance (Lift E1RMs) */}
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="neon-text" style={{ color: 'var(--primary)' }}>///</span> Performance Telemetry
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
                {PRIMARY_LIFTS.map(lift => {
                    const data = chartData[lift];
                    if (!data) return null;
                    // Colors: Squat=Cyan, Bench=Purple, Deadlift=Pink/Red
                    let color = 'var(--primary)';
                    if (lift === 'Bench') color = 'var(--accent)';
                    if (lift === 'Deadlift') color = '#f472b6'; // Pink

                    return (
                        <div key={lift}>
                            {renderLineChart(data, color, `${lift} E1RM`)}
                        </div>
                    );
                })}
                {Object.keys(chartData).length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--secondary-foreground)', border: '1px dashed var(--card-border)', borderRadius: '12px' }}>
                        No telemetry data found for current parameters.
                    </div>
                )}
            </div>


        </div>
    );
}

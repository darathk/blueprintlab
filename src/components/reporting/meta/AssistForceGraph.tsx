'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';

interface Node {
    id: string;
    isCenter: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    targetDist: number;
    color: string;
    label: string;
    data?: any;
}

export default function AssistForceGraph({ assistData, primaryLift }) {
    const nodesRef = useRef<Node[]>([]);
    const requestRef = useRef<number | null>(null);
    const [tick, setTick] = useState(0);
    const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    const width = 800;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;

    // Initialize the nodes
    useEffect(() => {
        if (!assistData || assistData.length === 0) return;

        const gains = assistData.map((d: any) => parseFloat(d.avgGain));
        const minGain = Math.min(...gains);
        const maxGain = Math.max(...gains);

        const counts = assistData.map((d: any) => d.count);
        const maxCount = Math.max(...counts, 1);

        const newNodes: Node[] = [];

        // 1. Center Hub Node
        newNodes.push({
            id: 'center',
            isCenter: true,
            x: cx,
            y: cy,
            vx: 0,
            vy: 0,
            radius: 45,
            targetDist: 0,
            color: 'var(--card-bg)', // Inheriting dark theme for center
            label: primaryLift,
        });

        // 2. Satellite Nodes
        assistData.forEach((d: any) => {
            const gain = parseFloat(d.avgGain);
            // Higher gain = distance closer to center
            const normalizedGain = maxGain === minGain ? 0.5 : (gain - minGain) / (maxGain - minGain);
            const targetDist = 240 - (normalizedGain * 140); // 100px to 240px

            // Size: frequent blocks = larger
            const radius = 15 + ((d.count / maxCount) * 20); // 15px to 35px

            // Color gradient (Green to Red based on gain)
            // Note: HeatMap uses (1 - normalized) for hue, meaning lower is warmer/red.
            // Let's stick with the heat map logic: warmer = higher value?
            // Actually, in Heatmap previously: `const hue = (1 - normalized) * 120;` so high = 0 (Red), low = 120 (Green)
            // Usually Gain you want Green for good... let's do Green=high, Red=low.
            const hue = normalizedGain * 120; // High gain = 120 (Green), Low gain = 0 (Red)

            // Random starting position forming a loose ring
            const angle = Math.random() * Math.PI * 2;
            const r = targetDist + (Math.random() * 40 - 20); // start near target

            newNodes.push({
                id: d.name,
                isCenter: false,
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r,
                vx: 0,
                vy: 0,
                radius,
                targetDist,
                color: `hsl(${hue}, 80%, 45%)`,
                label: d.name,
                data: d,
            });
        });

        nodesRef.current = newNodes;

        // Kick off physics loop
        startPhysics();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [assistData, primaryLift]);

    const startPhysics = () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const loop = () => {
            const nodes = nodesRef.current;
            if (!nodes || nodes.length === 0) return;

            const center = nodes[0];
            center.x = cx;
            center.y = cy;
            center.vx = 0;
            center.vy = 0;

            const friction = 0.85;
            const springForce = 0.05;
            const repulsionForce = 1.2;

            for (let i = 1; i < nodes.length; i++) {
                let n = nodes[i];

                // 1. Spring towards center target distance
                const dx = center.x - n.x;
                const dy = center.y - n.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const diff = dist - n.targetDist;

                const fx = (dx / dist) * diff * springForce;
                const fy = (dy / dist) * diff * springForce;

                n.vx += fx;
                n.vy += fy;

                // 2. Repulsion to prevent overlaps
                for (let j = 0; j < nodes.length; j++) {
                    if (i === j) continue;
                    let other = nodes[j];

                    const dx2 = n.x - other.x;
                    const dy2 = n.y - other.y;
                    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
                    const minDist = n.radius + other.radius + 15; // 15px gap padding

                    if (dist2 < minDist) {
                        const overlap = minDist - dist2;
                        const pushForce = overlap * repulsionForce;
                        n.vx += (dx2 / dist2) * pushForce;
                        n.vy += (dy2 / dist2) * pushForce;
                    }
                }
            }

            // 3. Apply velocity
            let totalKineticEnergy = 0;
            for (let i = 1; i < nodes.length; i++) {
                let n = nodes[i];
                n.vx *= friction;
                n.vy *= friction;
                n.x += n.vx;
                n.y += n.vy;
                totalKineticEnergy += Math.abs(n.vx) + Math.abs(n.vy);
            }

            // Halt loop if system is settled to save CPU
            if (totalKineticEnergy > 0.5) {
                setTick(t => t + 1);
                requestRef.current = requestAnimationFrame(loop);
            } else {
                setTick(t => t + 1); // Final render
            }
        };

        requestRef.current = requestAnimationFrame(loop);
    };

    // Replay physics interaction lightly if mouse enters ring boundary
    const handleSvgInteract = () => {
        // Just checking if we need a wake-up jolt
    };

    const nodes = nodesRef.current;
    if (!nodes || nodes.length === 0) return null;

    return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--card-bg)', borderRadius: 'var(--radius)' }}>
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{ overflow: 'visible' }}
                onMouseEnter={handleSvgInteract}
            >
                {/* Background Guide Rings indicating Gravity Pull */}
                <circle cx={cx} cy={cy} r={100} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx={cx} cy={cy} r={170} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx={cx} cy={cy} r={240} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Edges from Center */}
                {nodes.slice(1).map(n => (
                    <line
                        key={`edge-${n.id}`}
                        x1={cx} y1={cy}
                        x2={n.x} y2={n.y}
                        stroke={n.color}
                        strokeWidth="1.5"
                        strokeOpacity="0.3"
                    />
                ))}

                {/* Nodes */}
                {nodes.map(n => (
                    <g
                        key={n.id}
                        transform={`translate(${n.x}, ${n.y})`}
                        onMouseEnter={(e) => {
                            if (!n.isCenter) {
                                setHoveredNode(n);
                                setHoverPos({ x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseMove={(e) => {
                            setHoverPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: n.isCenter ? 'default' : 'help' }}
                    >
                        {/* Node Circle */}
                        <circle
                            r={n.radius}
                            fill={n.color}
                            stroke={n.isCenter ? 'var(--primary)' : hoveredNode?.id === n.id ? '#fff' : 'rgba(0,0,0,0.5)'}
                            strokeWidth={n.isCenter ? 3 : hoveredNode?.id === n.id ? 2 : 1}
                            style={{ transition: 'stroke 0.2s', filter: n.isCenter ? 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.4))' : 'none' }}
                        />

                        {/* Text label cutoff to fit inside smaller nodes, full inside center */}
                        {n.isCenter ? (
                            <text
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fill="var(--foreground)"
                                fontSize="14"
                                fontWeight="bold"
                            >
                                {n.label}
                            </text>
                        ) : n.radius > 20 ? ( // Only show text inside if radius is big enough
                            <text
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fill="#fff"
                                fontSize="10"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none' }} // Prevent text from blocking mouse events
                            >
                                {n.label.length > 10 ? n.label.substring(0, 8) + '..' : n.label}
                            </text>
                        ) : null}
                    </g>
                ))}
            </svg>

            {/* Hover Tooltip Portal */}
            {hoveredNode && hoveredNode.data && (
                <div style={{
                    position: 'fixed',
                    left: hoverPos.x + 15,
                    top: hoverPos.y + 15,
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--card-border)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    padding: '1rem',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    minWidth: '200px',
                    color: 'var(--foreground)',
                    fontSize: '0.85rem'
                }}>
                    <strong style={{ display: 'block', fontSize: '1rem', color: hoveredNode.color, marginBottom: '0.5rem' }}>{hoveredNode.label}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--secondary-foreground)' }}>Avg Gain:</span>
                        <strong style={{ color: parseFloat(hoveredNode.data.avgGain) > 0 ? 'var(--success)' : 'inherit' }}>
                            {parseFloat(hoveredNode.data.avgGain) > 0 ? '+' : ''}{hoveredNode.data.avgGain} lbs
                        </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--secondary-foreground)' }}>Data points:</span>
                        <strong>{hoveredNode.data.count} Blocks</strong>
                    </div>
                </div>
            )}
        </div>
    );
}

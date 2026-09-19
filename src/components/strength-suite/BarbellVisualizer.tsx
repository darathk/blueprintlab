'use client';

import React from 'react';

export interface PlateSpec {
    weight: number;
    color: string;
    lightColor: string;
    darkColor: string;
    textColor: string;
    width: number;
    height: number; // in SVG units
    label: string;
}

export const KG_PLATE_SPECS: Record<number, PlateSpec> = {
    25: { weight: 25, color: '#dc2626', lightColor: '#ef4444', darkColor: '#991b1b', textColor: '#ffffff', width: 22, height: 260, label: '25' },
    20: { weight: 20, color: '#2563eb', lightColor: '#3b82f6', darkColor: '#1d4ed8', textColor: '#ffffff', width: 20, height: 260, label: '20' },
    15: { weight: 15, color: '#eab308', lightColor: '#facc15', darkColor: '#a16207', textColor: '#000000', width: 18, height: 230, label: '15' },
    10: { weight: 10, color: '#16a34a', lightColor: '#22c55e', darkColor: '#15803d', textColor: '#ffffff', width: 16, height: 200, label: '10' },
    5:  { weight: 5,  color: '#f1f5f9', lightColor: '#ffffff', darkColor: '#cbd5e1', textColor: '#0f172a', width: 14, height: 165, label: '5' },
    2.5: { weight: 2.5, color: '#1e293b', lightColor: '#334155', darkColor: '#090d16', textColor: '#ffffff', width: 13, height: 135, label: '2.5' },
    1.25: { weight: 1.25, color: '#94a3b8', lightColor: '#cbd5e1', darkColor: '#64748b', textColor: '#0f172a', width: 11, height: 110, label: '1.25' },
    0.5: { weight: 0.5, color: '#94a3b8', lightColor: '#cbd5e1', darkColor: '#64748b', textColor: '#0f172a', width: 9, height: 95, label: '0.5' },
    0.25: { weight: 0.25, color: '#94a3b8', lightColor: '#cbd5e1', darkColor: '#64748b', textColor: '#0f172a', width: 8, height: 85, label: '0.25' },
};

export const LB_PLATE_SPECS: Record<number, PlateSpec> = {
    55: { weight: 55, color: '#dc2626', lightColor: '#ef4444', darkColor: '#991b1b', textColor: '#ffffff', width: 22, height: 260, label: '55' },
    45: { weight: 45, color: '#2563eb', lightColor: '#3b82f6', darkColor: '#1d4ed8', textColor: '#ffffff', width: 20, height: 260, label: '45' },
    35: { weight: 35, color: '#eab308', lightColor: '#facc15', darkColor: '#a16207', textColor: '#000000', width: 18, height: 230, label: '35' },
    25: { weight: 25, color: '#16a34a', lightColor: '#22c55e', darkColor: '#15803d', textColor: '#ffffff', width: 16, height: 200, label: '25' },
    10: { weight: 10, color: '#f1f5f9', lightColor: '#ffffff', darkColor: '#cbd5e1', textColor: '#0f172a', width: 14, height: 165, label: '10' },
    5:  { weight: 5,  color: '#1e293b', lightColor: '#334155', darkColor: '#090d16', textColor: '#ffffff', width: 13, height: 135, label: '5' },
    2.5: { weight: 2.5, color: '#94a3b8', lightColor: '#cbd5e1', darkColor: '#64748b', textColor: '#0f172a', width: 11, height: 110, label: '2.5' },
};

export function getPlateSpec(w: number, unit: 'kg' | 'lb'): PlateSpec {
    const specs = unit === 'kg' ? KG_PLATE_SPECS : LB_PLATE_SPECS;
    if (specs[w]) return specs[w];
    return {
        weight: w,
        color: '#94a3b8',
        lightColor: '#cbd5e1',
        darkColor: '#64748b',
        textColor: '#0f172a',
        width: 12,
        height: 120,
        label: String(w),
    };
}

interface BarbellVisualizerProps {
    plates: number[];
    barWeight: number;
    includeCollars: boolean;
    unit: 'kg' | 'lb';
    onRemovePlate?: (index: number) => void;
    isInteractive?: boolean;
}

export default function BarbellVisualizer({
    plates,
    barWeight,
    includeCollars,
    unit,
    onRemovePlate,
    isInteractive = false,
}: BarbellVisualizerProps) {
    const svgWidth = 440;
    const svgHeight = 320;
    const centerY = svgHeight / 2;

    // Dimensions for sleeve & shaft
    const shaftX = 35;
    const shaftWidth = 55;
    const shaftHeight = 24;

    const innerCollarX = shaftX + shaftWidth;
    const innerCollarWidth = 22;
    const innerCollarHeight = 72;

    const sleeveStartX = innerCollarX + innerCollarWidth;
    const sleeveLength = 275;
    const sleeveHeight = 32;

    // Calculate positions of plates
    let currentX = sleeveStartX;
    const renderedPlates = plates.map((w, index) => {
        const spec = getPlateSpec(w, unit);
        const x = currentX;
        currentX += spec.width + 1.5;
        return { ...spec, x, index };
    });

    const collarX = currentX + 2;
    const collarWidth = 22;
    const collarHeight = 64;

    return (
        <div className="w-full flex items-center justify-center select-none py-2">
            <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto max-w-[440px] max-h-[290px] overflow-visible"
                style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))' }}
            >
                <defs>
                    {/* Metallic Bar Shaft Gradient */}
                    <linearGradient id="barShaftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="30%" stopColor="#94a3b8" />
                        <stop offset="50%" stopColor="#f8fafc" />
                        <stop offset="70%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#334155" />
                    </linearGradient>

                    {/* Chrome Sleeve Gradient */}
                    <linearGradient id="sleeveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#64748b" />
                        <stop offset="20%" stopColor="#cbd5e1" />
                        <stop offset="45%" stopColor="#ffffff" />
                        <stop offset="70%" stopColor="#cbd5e1" />
                        <stop offset="90%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#334155" />
                    </linearGradient>

                    {/* Inner Stopper Collar (Gold/Brass Tinted Metal) */}
                    <linearGradient id="stopperCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#57534e" />
                        <stop offset="15%" stopColor="#a8a29e" />
                        <stop offset="40%" stopColor="#fef08a" />
                        <stop offset="60%" stopColor="#ca8a04" />
                        <stop offset="90%" stopColor="#713f12" />
                        <stop offset="100%" stopColor="#292524" />
                    </linearGradient>

                    {/* Competition Collar Metallic Gradient */}
                    <linearGradient id="compCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="25%" stopColor="#cbd5e1" />
                        <stop offset="50%" stopColor="#ffffff" />
                        <stop offset="75%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#334155" />
                    </linearGradient>

                    {/* Outer Drop Shadows */}
                    <filter id="plateShadow" x="-20%" y="-10%" width="140%" height="120%">
                        <feDropShadow dx="3" dy="0" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
                    </filter>
                </defs>

                {/* 1. Barbell Shaft (knurled inside grip portion) */}
                <rect
                    x={shaftX}
                    y={centerY - shaftHeight / 2}
                    width={shaftWidth}
                    height={shaftHeight}
                    rx={2}
                    fill="url(#barShaftGrad)"
                    stroke="#1e293b"
                    strokeWidth="1"
                />
                <line x1={shaftX + 12} y1={centerY - shaftHeight / 2} x2={shaftX + 12} y2={centerY + shaftHeight / 2} stroke="#334155" strokeWidth="1" strokeDasharray="1,2" />
                <line x1={shaftX + 28} y1={centerY - shaftHeight / 2} x2={shaftX + 28} y2={centerY + shaftHeight / 2} stroke="#334155" strokeWidth="1" strokeDasharray="1,2" />
                <line x1={shaftX + 44} y1={centerY - shaftHeight / 2} x2={shaftX + 44} y2={centerY + shaftHeight / 2} stroke="#334155" strokeWidth="1" strokeDasharray="1,2" />

                {/* 2. Barbell Inner Stopper Collar */}
                <g>
                    <rect
                        x={innerCollarX}
                        y={centerY - innerCollarHeight / 2}
                        width={innerCollarWidth}
                        height={innerCollarHeight}
                        rx={3}
                        fill="url(#stopperCollarGrad)"
                        stroke="#1c1917"
                        strokeWidth="1.5"
                    />
                    <line
                        x1={innerCollarX + 4}
                        y1={centerY - innerCollarHeight / 2 + 3}
                        x2={innerCollarX + 4}
                        y2={centerY + innerCollarHeight / 2 - 3}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth="1.5"
                    />
                </g>

                {/* 3. Barbell Sleeve */}
                <rect
                    x={sleeveStartX}
                    y={centerY - sleeveHeight / 2}
                    width={sleeveLength}
                    height={sleeveHeight}
                    rx={2}
                    fill="url(#sleeveGrad)"
                    stroke="#475569"
                    strokeWidth="1"
                />
                {/* Sleeve end cap bevel */}
                <rect
                    x={sleeveStartX + sleeveLength - 4}
                    y={centerY - sleeveHeight / 2}
                    width={4}
                    height={sleeveHeight}
                    fill="#1e293b"
                    rx={1}
                />

                {/* 4. Loaded Plates */}
                {renderedPlates.map((plate) => {
                    const topY = centerY - plate.height / 2;
                    const gradId = `plateGrad_${plate.weight}_${plate.index}`;
                    const isClickable = isInteractive && Boolean(onRemovePlate);

                    return (
                        <g
                            key={`${plate.weight}_${plate.index}`}
                            filter="url(#plateShadow)"
                            onClick={() => onRemovePlate && onRemovePlate(plate.index)}
                            style={{ cursor: isClickable ? 'pointer' : 'default' }}
                            className={isClickable ? 'hover:opacity-90 active:scale-95 transition-opacity' : ''}
                        >
                            <defs>
                                <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={plate.lightColor} />
                                    <stop offset="30%" stopColor={plate.color} />
                                    <stop offset="70%" stopColor={plate.color} />
                                    <stop offset="100%" stopColor={plate.darkColor} />
                                </linearGradient>
                            </defs>

                            {/* Main plate body */}
                            <rect
                                x={plate.x}
                                y={topY}
                                width={plate.width}
                                height={plate.height}
                                rx={4}
                                fill={`url(#${gradId})`}
                                stroke={plate.darkColor}
                                strokeWidth="1.5"
                            />

                            {/* Inner rim groove */}
                            <rect
                                x={plate.x + 2}
                                y={topY + 6}
                                width={plate.width - 4}
                                height={plate.height - 12}
                                rx={2}
                                fill="none"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="1"
                            />

                            {/* Center weight label (vertical text) */}
                            {plate.height >= 120 && (
                                <text
                                    x={plate.x + plate.width / 2}
                                    y={centerY}
                                    fill={plate.textColor}
                                    fontSize={plate.width > 16 ? '11' : '9'}
                                    fontWeight="800"
                                    fontFamily="system-ui, sans-serif"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    transform={`rotate(-90, ${plate.x + plate.width / 2}, ${centerY})`}
                                    style={{
                                        letterSpacing: '0.5px',
                                        textShadow: plate.textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : 'none',
                                    }}
                                >
                                    {plate.label}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* 5. Calibrated Competition Collars */}
                {includeCollars && (
                    <g filter="url(#plateShadow)">
                        <rect
                            x={collarX}
                            y={centerY - collarHeight / 2}
                            width={collarWidth}
                            height={collarHeight}
                            rx={3}
                            fill="url(#compCollarGrad)"
                            stroke="#334155"
                            strokeWidth="1.5"
                        />
                        <rect
                            x={collarX + 7}
                            y={centerY - collarHeight / 2 - 12}
                            width={8}
                            height={13}
                            rx={2}
                            fill="#e2e8f0"
                            stroke="#475569"
                            strokeWidth="1"
                        />
                        <line
                            x1={collarX + 3}
                            y1={centerY - collarHeight / 2 - 12}
                            x2={collarX + 19}
                            y2={centerY - collarHeight / 2 - 12}
                            stroke="#64748b"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <line x1={collarX + 5} y1={centerY - collarHeight / 2 + 4} x2={collarX + 5} y2={centerY + collarHeight / 2 - 4} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
                        <line x1={collarX + 11} y1={centerY - collarHeight / 2 + 4} x2={collarX + 11} y2={centerY + collarHeight / 2 - 4} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                        <line x1={collarX + 17} y1={centerY - collarHeight / 2 + 4} x2={collarX + 17} y2={centerY + collarHeight / 2 - 4} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
                    </g>
                )}
            </svg>
        </div>
    );
}

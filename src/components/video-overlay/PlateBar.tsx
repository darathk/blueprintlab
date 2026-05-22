'use client';

import React from 'react';
import { calculatePlates, BAR_WEIGHT_LBS, type Plate } from '@/lib/plate-calculator';

interface PlateBarProps {
    /** Total barbell weight in lbs */
    totalLbs: number;
    /** Scale factor — 1 = default size, 0.7 = smaller card, 1.3 = larger */
    scale?: number;
}

const BASE_UNIT = 7; // px — base height unit

export default function PlateBar({ totalLbs, scale = 1 }: PlateBarProps) {
    const plates = calculatePlates(totalLbs);
    const u = BASE_UNIT * scale;

    if (totalLbs <= 0) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: Math.round(u * 0.22),
            height: Math.round(u * 5.8),
        }}>
            {/* Bar end nub */}
            <div style={{
                width: Math.round(u * 0.55),
                height: Math.round(u * 1.4),
                background: 'linear-gradient(to bottom, #CBD5E1, #94A3B8)',
                borderRadius: Math.round(u * 0.15),
                alignSelf: 'center',
            }} />

            {/* Collar */}
            <div style={{
                width: Math.round(u * 0.7),
                height: Math.round(u * 2.2),
                background: 'linear-gradient(to bottom, #E2E8F0, #CBD5E1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: Math.round(u * 0.2),
                alignSelf: 'center',
            }} />

            {/* Plates — heaviest (innermost) first */}
            {plates.map((plate, i) => (
                <PlateRect key={i} plate={plate} u={u} />
            ))}

            {/* Show empty bar text if just the bar */}
            {plates.length === 0 && (
                <span style={{
                    fontSize: Math.round(u * 0.9),
                    color: 'rgba(255,255,255,0.35)',
                    fontStyle: 'italic',
                    alignSelf: 'center',
                }}>bar only</span>
            )}
        </div>
    );
}

function PlateRect({ plate, u }: { plate: Plate; u: number }) {
    const h = Math.round(plate.height * u);
    const w = Math.round(plate.width * u * 1.15);
    const fontSize = Math.max(6, Math.round(u * 0.75));

    return (
        <div style={{
            width: w,
            height: h,
            background: `linear-gradient(to right, ${plate.color}CC, ${plate.color}, ${plate.color}CC)`,
            border: `1px solid ${plate.borderColor}`,
            borderRadius: Math.round(u * 0.25),
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: Math.round(u * 0.2),
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 3px rgba(0,0,0,0.4)`,
        }}>
            <span style={{
                fontSize,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                fontFamily: 'var(--font-geist-sans, system-ui)',
            }}>
                {plate.label}
            </span>
        </div>
    );
}

'use client';

import React from 'react';
import PlateBar from './PlateBar';
import { calculatePlates, lbsToKgDisplay } from '@/lib/plate-calculator';

export interface ClipSetData {
    weight: string;
    reps: string;
    rpe: string;
}

interface OverlayCardProps {
    exerciseName: string;
    sessionLabel: string;      // e.g. "Week 2 · Competition Bench"
    set: ClipSetData;
    /** Card width in px — drives font & element scaling */
    width: number;
    /** Forwarded ref so the editor can measure card height */
    cardRef?: React.Ref<HTMLDivElement>;
    /** Extra inline style overrides (e.g. position: absolute, left, top) */
    style?: React.CSSProperties;
    /** Resize handle element rendered at bottom-right corner */
    resizeHandle?: React.ReactNode;
    /** Drag-start handler bound to the card body */
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

// Scale factor: card is "native" at 280px wide
const NATIVE_WIDTH = 280;

export default function OverlayCard({
    exerciseName,
    sessionLabel,
    set,
    width,
    cardRef,
    style,
    resizeHandle,
    onPointerDown,
}: OverlayCardProps) {
    const scale = width / NATIVE_WIDTH;
    const weightLbs = parseFloat(set.weight) || 0;
    const weightKg = weightLbs > 0 ? lbsToKgDisplay(weightLbs) : null;
    const reps = set.reps || '—';
    const rpe = set.rpe ? `@RPE ${set.rpe}` : '';

    // Font sizes (scale with card width)
    const fs = {
        label:    Math.round(11 * scale),
        name:     Math.round(22 * scale),
        weight:   Math.round(16 * scale),
        rpe:      Math.round(12 * scale),
        logoH:    Math.round(20 * scale),
    };

    const pad = Math.round(16 * scale);
    const gap = Math.round(6 * scale);

    return (
        <div
            ref={cardRef as React.Ref<HTMLDivElement>}
            onPointerDown={onPointerDown}
            style={{
                position: 'absolute',
                width,
                background: 'rgba(8, 8, 12, 0.86)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderRadius: Math.round(18 * scale),
                border: '1px solid rgba(255,255,255,0.13)',
                padding: pad,
                fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
                boxSizing: 'border-box',
                ...style,
            }}
        >
            {/* Top row: session label */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: gap }}>
                <span style={{
                    fontSize: fs.label,
                    color: 'rgba(255,255,255,0.45)',
                    fontWeight: 500,
                    lineHeight: 1.3,
                }}>
                    {sessionLabel}
                </span>
            </div>

            {/* Exercise name */}
            <div style={{
                fontSize: fs.name,
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.15,
                marginBottom: Math.round(4 * scale),
            }}>
                {exerciseName}
            </div>

            {/* Weight + reps line */}
            <div style={{
                fontSize: fs.weight,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.88)',
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: Math.round(6 * scale),
            }}>
                <span>
                    {weightLbs > 0 ? `${weightLbs}lbs` : '—'}
                    {weightKg ? ` / ${weightKg}kg` : ''}
                    {` × ${reps}`}
                </span>
                {rpe && (
                    <span style={{ fontSize: fs.rpe, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                        {rpe}
                    </span>
                )}
            </div>

            {/* Resize handle (injected by editor) */}
            {resizeHandle}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas drawing — mirrors the JSX above for export burn-in
// ─────────────────────────────────────────────────────────────────────────────

interface DrawCardOptions {
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
    width: number;
    exerciseName: string;
    sessionLabel: string;
    set: ClipSetData;
    logoImage?: HTMLImageElement | null;
}

export function drawCardToCanvas({
    ctx, x, y, width, exerciseName, sessionLabel, set, logoImage,
}: DrawCardOptions): void {
    const scale = width / NATIVE_WIDTH;
    const pad = Math.round(16 * scale);
    const gap = Math.round(6 * scale);
    const radius = Math.round(18 * scale);

    const weightLbs = parseFloat(set.weight) || 0;
    const weightKg = weightLbs > 0 ? lbsToKgDisplay(weightLbs) : null;
    const reps = set.reps || '—';
    const rpe = set.rpe ? `@RPE ${set.rpe}` : '';

    // ── Height estimation ──────────────────────────────────────────────
    const lineH = {
        label:  Math.round(14 * scale),
        name:   Math.round(28 * scale),
        weight: Math.round(22 * scale),
    };
    const estHeight = pad * 2 + lineH.label + gap + lineH.name + 4 * scale + lineH.weight;

    // ── Background ────────────────────────────────────────────────────
    ctx.save();
    roundedRect(ctx, x, y, width, estHeight, radius);
    ctx.fillStyle = 'rgba(8,8,12,0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    let curY = y + pad;
    const fontBase = `'Geist', system-ui, -apple-system, sans-serif`;

    // ── Session label ─────────────────────────────────────────────────
    ctx.save();
    ctx.font = `500 ${Math.round(11 * scale)}px ${fontBase}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(sessionLabel, x + pad, curY + Math.round(11 * scale));
    ctx.restore();

    curY += lineH.label + gap;

    // ── Exercise name ─────────────────────────────────────────────────
    ctx.save();
    ctx.font = `700 ${Math.round(22 * scale)}px ${fontBase}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(exerciseName, x + pad, curY + Math.round(22 * scale));
    ctx.restore();
    curY += lineH.name + Math.round(4 * scale);

    // ── Weight / reps line ────────────────────────────────────────────
    const weightText = weightLbs > 0
        ? `${weightLbs}lbs${weightKg ? ` / ${weightKg}kg` : ''} × ${reps}`
        : `— × ${reps}`;
    ctx.save();
    ctx.font = `600 ${Math.round(16 * scale)}px ${fontBase}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(weightText, x + pad, curY + Math.round(16 * scale));

    if (rpe) {
        const mainW = ctx.measureText(weightText).width;
        ctx.font = `500 ${Math.round(12 * scale)}px ${fontBase}`;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(rpe, x + pad + mainW + Math.round(6 * scale), curY + Math.round(16 * scale));
    }
    ctx.restore();
}

// Draw plates on canvas (mirrors PlateBar JSX)
function drawPlatesCanvas(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    totalLbs: number,
    scale: number,
): void {
    const u = 7 * scale * 0.92; // matches PlateBar's BASE_UNIT * scale
    const gapPx = Math.round(u * 0.22);
    const totalH = Math.round(u * 5.8);
    const midY = y + totalH / 2;

    let curX = x;

    // Bar nub
    const nubW = Math.round(u * 0.55);
    const nubH = Math.round(u * 1.4);
    ctx.fillStyle = '#94A3B8';
    roundedRect(ctx, curX, midY - nubH / 2, nubW, nubH, 2);
    ctx.fill();
    curX += nubW + gapPx;

    // Collar
    const colW = Math.round(u * 0.7);
    const colH = Math.round(u * 2.2);
    ctx.fillStyle = '#E2E8F0';
    roundedRect(ctx, curX, midY - colH / 2, colW, colH, 2);
    ctx.fill();
    curX += colW + gapPx;

    // Plates
    const plates = calculatePlates(totalLbs);
    for (const plate of plates) {
        const ph = Math.round(plate.height * u);
        const pw = Math.round(plate.width * u * 1.15);
        const px = curX;
        const py = midY - ph / 2;

        ctx.save();
        const grad = ctx.createLinearGradient(px, py, px + pw, py);
        grad.addColorStop(0, plate.color + 'CC');
        grad.addColorStop(0.5, plate.color);
        grad.addColorStop(1, plate.color + 'CC');
        ctx.fillStyle = grad;
        roundedRect(ctx, px, py, pw, ph, Math.round(u * 0.25));
        ctx.fill();
        ctx.strokeStyle = plate.borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        const fontSize = Math.max(6, Math.round(u * 0.75));
        ctx.font = `700 ${fontSize}px 'Geist', system-ui`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(plate.label, px + pw / 2, py + ph - Math.round(u * 0.2));
        ctx.restore();

        curX += pw + gapPx;
    }
}

// Utility: canvas rounded rect path
function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

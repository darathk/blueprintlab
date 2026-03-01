'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { RotateCcw, Calculator, ArrowRightLeft } from 'lucide-react';

const PLATES = [
    { weight: 25, color: '#ef4444', label: '25', text: '#fff', width: 24, height: 210 },   // Red
    { weight: 20, color: '#3b82f6', label: '20', text: '#fff', width: 24, height: 210 },   // Blue
    { weight: 15, color: '#eab308', label: '15', text: '#000', width: 24, height: 180 },   // Yellow
    { weight: 10, color: '#22c55e', label: '10', text: '#fff', width: 24, height: 155 },   // Green
    { weight: 5, color: '#f8fafc', label: '5', text: '#000', width: 20, height: 120, border: '#cbd5e1' },     // White
    { weight: 2.5, color: '#1e293b', label: '2.5', text: '#fff', width: 18, height: 100 }, // Black
    { weight: 2, color: '#3b82f6', label: '2', text: '#fff', width: 16, height: 90 }, // Blue
    { weight: 1.5, color: '#eab308', label: '1.5', text: '#000', width: 14, height: 85 }, // Yellow
    { weight: 1.25, color: '#e2e8f0', label: '1.25', text: '#000', width: 14, height: 80, border: '#cbd5e1' }, // Silver
    { weight: 1, color: '#22c55e', label: '1', text: '#fff', width: 12, height: 70 }, // Green
    { weight: 0.5, color: '#f8fafc', label: '0.5', text: '#000', width: 10, height: 65, border: '#cbd5e1' }, // White
    { weight: 0.25, color: '#e2e8f0', label: '0.25', text: '#000', width: 8, height: 60, border: '#cbd5e1' }, // Silver
    { weight: 0.125, color: '#e2e8f0', label: '0.125', text: '#000', width: 6, height: 55, border: '#cbd5e1' } // Silver
];

export default function PlateLoader({
    initialWeight = '',
    inline = false,
    onClose
}: {
    initialWeight?: string | number,
    inline?: boolean,
    onClose?: () => void
}) {
    const [mode, setMode] = useState<'calculate' | 'reverse'>('calculate');
    const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
    const [targetStr, setTargetStr] = useState<string>(initialWeight ? String(initialWeight) : '');
    const [barWeight, setBarWeight] = useState<number>(20); // 20kg standard
    const [includeCollars, setIncludeCollars] = useState<boolean>(true); // 2.5kg collars each = 5kg flag
    const [manualPlates, setManualPlates] = useState<number[]>([]); // Array of plate weights (for one side)

    // Sync externally changing initial weights
    useEffect(() => {
        if (initialWeight !== undefined && initialWeight !== '') {
            setTargetStr(String(initialWeight));
        }
    }, [initialWeight]);

    // Calculate Mode Logic
    const calculatedPlates = useMemo(() => {
        if (mode !== 'calculate') return [];
        let target = parseFloat(targetStr);
        if (isNaN(target) || target <= 0) return [];

        let targetKg = unit === 'lb' ? target / 2.20462 : target;
        let effectiveBarWeight = barWeight + (includeCollars ? 5 : 0);
        let remaining = targetKg - effectiveBarWeight;

        if (remaining <= 0) return [];

        let perSide = remaining / 2;
        let loaded: number[] = [];

        for (const p of PLATES) {
            while (perSide >= p.weight - 0.01) { // -0.01 for floating point safety
                loaded.push(p.weight);
                perSide -= p.weight;
            }
        }
        return loaded;
    }, [targetStr, unit, barWeight, mode, includeCollars]);

    const displayPlates = mode === 'calculate' ? calculatedPlates : manualPlates;

    // Derived totals for display
    const totalKg = useMemo(() => {
        if (mode === 'calculate') {
            const t = parseFloat(targetStr);
            if (isNaN(t)) return 0;
            return unit === 'kg' ? t : t / 2.20462;
        } else {
            return barWeight + (includeCollars ? 5 : 0) + (manualPlates.reduce((a, b) => a + b, 0) * 2);
        }
    }, [mode, targetStr, unit, barWeight, manualPlates, includeCollars]);

    const totalLb = totalKg * 2.20462;

    const summaryMap = useMemo(() => {
        const counts: Record<number, number> = {};
        displayPlates.forEach(p => {
            counts[p] = (counts[p] || 0) + 1;
        });
        return counts;
    }, [displayPlates]);

    const addManualPlate = (w: number) => {
        if (manualPlates.length >= 10) return; // Limit visual overflow
        setManualPlates(prev => [...prev, w].sort((a, b) => b - a)); // Keep heavy plates inside
    };

    const removeManualPlate = (index: number) => {
        setManualPlates(prev => prev.filter((_, i) => i !== index));
    };

    const clearManual = () => setManualPlates([]);

    return (
        <div className={inline ? "" : "glass-panel"} style={{
            display: 'flex', flexDirection: 'column',
            height: inline ? 'auto' : '100%',
            minHeight: inline ? 'auto' : 'calc(100vh - 160px)',
            background: inline ? 'var(--card-bg)' : 'var(--background)',
            borderRadius: inline ? 12 : 0,
            overflow: 'hidden',
            border: inline ? '1px solid var(--card-border)' : 'none'
        }}>

            {/* Header Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
                <button
                    onClick={() => setMode('calculate')}
                    style={{
                        flex: 1, padding: '12px', background: mode === 'calculate' ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                        border: 'none', borderBottom: mode === 'calculate' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: mode === 'calculate' ? 'var(--primary)' : 'var(--secondary-foreground)',
                        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                >
                    <Calculator size={16} /> Calculate
                </button>
                <button
                    onClick={() => setMode('reverse')}
                    style={{
                        flex: 1, padding: '12px', background: mode === 'reverse' ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                        border: 'none', borderBottom: mode === 'reverse' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: mode === 'reverse' ? 'var(--primary)' : 'var(--secondary-foreground)',
                        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                >
                    <ArrowRightLeft size={16} /> Reverse
                </button>
                {inline && onClose && (
                    <button onClick={onClose} style={{ padding: '0 16px', background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                )}
            </div>

            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* Visualizer Section */}
                <div style={{
                    position: 'relative', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)', borderRadius: 12, marginBottom: 20, overflow: 'hidden'
                }}>

                    {/* The Bar */}
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Center knurling area wrapper */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 400, transform: 'translateX(-20px)' }}>

                            {/* Inside of bar / Collars area */}
                            <div style={{
                                width: 40, height: 50, background: '#64748b', border: '2px solid #475569',
                                borderRight: 'none', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, zIndex: 10
                            }}>
                                {barWeight}
                            </div>

                            {/* Optional 2.5kg Collar Rendering */}
                            {includeCollars && (
                                <div style={{
                                    width: 14, height: 65, background: '#cbd5e1', border: '2px solid #94a3b8',
                                    borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    zIndex: 11, position: 'relative', boxShadow: '2px 0 5px rgba(0,0,0,0.3)', marginRight: 2
                                }}>
                                    {/* Collar pin */}
                                    <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 6, height: 8, background: '#e2e8f0', borderRadius: '2px 2px 0 0', border: '1px solid #94a3b8', borderBottom: 'none' }}></div>
                                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 14, height: 4, background: '#e2e8f0', borderRadius: '2px', border: '1px solid #94a3b8' }}></div>
                                </div>
                            )}

                            {/* The Sleeve where plates go */}
                            <div style={{
                                flex: 1, height: 30, background: 'linear-gradient(to bottom, #cbd5e1, #94a3b8)', border: '1px solid #64748b',
                                borderLeft: 'none', position: 'relative', display: 'flex', alignItems: 'center', paddingLeft: 2
                            }}>
                                <div style={{
                                    display: 'flex', gap: '2px', alignItems: 'center', height: '100%', width: '100%'
                                }}>
                                    {displayPlates.map((pw, i) => {
                                        const pInfo = PLATES.find(p => p.weight === pw) || PLATES[0];
                                        return (
                                            <div key={i}
                                                onClick={() => mode === 'reverse' ? removeManualPlate(i) : undefined}
                                                style={{
                                                    width: pInfo.width,
                                                    height: pInfo.height,
                                                    background: pInfo.color,
                                                    border: pInfo.border ? `2px solid ${pInfo.border}` : `2px solid rgba(0,0,0,0.1)`,
                                                    borderRadius: 4,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    writingMode: 'vertical-rl',
                                                    textOrientation: 'mixed',
                                                    color: pInfo.text,
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    boxShadow: '2px 0 5px rgba(0,0,0,0.3)',
                                                    cursor: mode === 'reverse' ? 'pointer' : 'default',
                                                    flexShrink: 0,
                                                    zIndex: 10 - i,
                                                    transition: 'transform 0.1s'
                                                }}
                                                className={mode === 'reverse' ? 'hover-scale' : ''}>
                                                {pw}
                                            </div>
                                        )
                                    })}

                                    {/* Collar at the end if there are plates */}
                                    {displayPlates.length > 0 && (
                                        <div style={{ width: 16, height: 40, background: '#475569', borderRadius: 2, marginLeft: 2, border: '1px solid #1e293b' }}></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Clear Button (Reverse mode) */}
                    {mode === 'reverse' && manualPlates.length > 0 && (
                        <button onClick={clearManual} style={{
                            position: 'absolute', top: 12, right: 12, background: '#ef4444', color: '#fff', border: 'none',
                            padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>

                {/* Total Readout */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalKg > 0 ? totalKg.toFixed(1).replace('.0', '') : '0'} <span style={{ fontSize: '1rem', color: 'var(--secondary-foreground)' }}>KG</span></span>
                    <span style={{ margin: '0 12px', color: 'var(--card-border)' }}>|</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>{totalLb > 0 ? totalLb.toFixed(1).replace('.0', '') : '0'} <span style={{ fontSize: '0.9rem' }}>LB</span></span>
                </div>

                {/* Controls */}
                {mode === 'calculate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: 4 }}>Target Weight</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number" inputMode="decimal"
                                        value={targetStr}
                                        onChange={e => setTargetStr(e.target.value)}
                                        placeholder="e.g. 100"
                                        style={{
                                            width: '100%', padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                            borderRadius: 8, color: 'var(--foreground)', fontSize: '1.2rem', fontWeight: 600, outlineColor: 'var(--primary)'
                                        }}
                                    />
                                    {/* Unit Toggle inside input */}
                                    <button
                                        onClick={() => setUnit(u => u === 'kg' ? 'lb' : 'kg')}
                                        style={{
                                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                            background: 'rgba(125, 135, 210, 0.1)', color: 'var(--primary)', border: 'none',
                                            padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                                        }}>
                                        {unit.toUpperCase()}
                                    </button>
                                </div>
                            </div>
                            <div style={{ width: 120 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: 4 }}>Bar Weight</label>
                                <select
                                    value={barWeight}
                                    onChange={e => setBarWeight(Number(e.target.value))}
                                    style={{
                                        width: '100%', padding: '12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                        borderRadius: 8, color: 'var(--foreground)', fontSize: '1rem', outlineColor: 'var(--primary)', appearance: 'none'
                                    }}
                                >
                                    <option value={20}>20 KG</option>
                                    <option value={25}>25 KG</option>
                                    <option value={15}>15 KG</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: 4 }}>Collars</label>
                                <button
                                    onClick={() => setIncludeCollars(!includeCollars)}
                                    style={{
                                        height: '46px', padding: '0 16px', background: includeCollars ? 'var(--primary)' : 'var(--card-bg)',
                                        border: includeCollars ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                                        color: includeCollars ? '#fff' : 'var(--foreground)', borderRadius: 8, fontSize: '0.9rem',
                                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                                    }}
                                >
                                    {includeCollars ? '+ 5KG' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        {/* Text Summary */}
                        {displayPlates.length > 0 && (
                            <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, textAlign: 'center', color: 'var(--primary)' }}>Per Side Plates</div>
                                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, justifyContent: 'center' }}>
                                    {PLATES.map(pInfo => {
                                        const w = pInfo.weight;
                                        if (!summaryMap[w]) return null;
                                        return (
                                            <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: pInfo.color, color: pInfo.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, border: pInfo.border ? `1px solid ${pInfo.border}` : 'none' }}>
                                                    {w}
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>x{summaryMap[w]}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: 8 }}>
                                    Total Bar Includes ± {((totalKg - parseFloat(targetStr || '0')) * (unit === 'lb' ? 2.20462 : 1)).toFixed(1)} mismatch
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Inventory (Reverse mode) */}
                {mode === 'reverse' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)' }}>Tap to add to bar</span>
                            <select
                                value={barWeight}
                                onChange={e => setBarWeight(Number(e.target.value))}
                                style={{
                                    padding: '6px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                                    borderRadius: 8, color: 'var(--foreground)', fontSize: '0.85rem'
                                }}
                            >
                                <option value={20}>20 KG Bar</option>
                                <option value={25}>25 KG Bar</option>
                                <option value={15}>15 KG Bar</option>
                            </select>
                            <button
                                onClick={() => setIncludeCollars(!includeCollars)}
                                style={{
                                    padding: '6px 12px', background: includeCollars ? 'var(--primary)' : 'var(--card-bg)',
                                    border: includeCollars ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                                    color: includeCollars ? '#fff' : 'var(--foreground)', borderRadius: 8, fontSize: '0.85rem',
                                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {includeCollars ? 'Collars: ON (5kg)' : 'Collars: OFF'}
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, alignContent: 'start' }}>
                            {PLATES.map(p => (
                                <button
                                    key={p.weight}
                                    onClick={() => addManualPlate(p.weight)}
                                    style={{
                                        aspectRatio: '1', borderRadius: '50%', background: p.color, border: p.border ? `2px solid ${p.border}` : 'none',
                                        color: p.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.1s'
                                    }}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.text === '#fff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)', width: '60%', height: '60%', borderRadius: '50%' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{p.weight}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .hover-scale { transition: transform 0.1s; }
                .hover-scale:active { transform: scale(0.95) !important; }
            `}} />
        </div>
    );
}

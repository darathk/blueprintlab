'use client';

import React, { useState, useMemo } from 'react';
import BarbellVisualizer, { KG_PLATE_SPECS, LB_PLATE_SPECS } from './BarbellVisualizer';
import { RotateCcw, Plus, Minus, Check } from 'lucide-react';

interface BarbellTabProps {
    initialWeight?: number | string;
    initialUnit?: 'kg' | 'lb';
}

const KG_DENOMINATIONS = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_DENOMINATIONS = [55, 45, 35, 25, 10, 5, 2.5];

export default function BarbellTab({ initialWeight = 100, initialUnit = 'kg' }: BarbellTabProps) {
    const [subMode, setSubMode] = useState<'calculate' | 'load'>('calculate');
    const [unit, setUnit] = useState<'kg' | 'lb'>(initialUnit);
    const [targetWeightStr, setTargetWeightStr] = useState<string>(String(initialWeight || 100));
    const [barWeight, setBarWeight] = useState<number>(initialUnit === 'kg' ? 20 : 45);
    const [includeCollars, setIncludeCollars] = useState<boolean>(true);

    // Manual inventory counts: plateWeight -> count per side
    const [inventoryCounts, setInventoryCounts] = useState<Record<number, number>>({
        25: 0, 20: 0, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0,
        55: 0, 45: 0, 35: 0,
    });

    // Handle unit switch defaults
    const handleUnitSwitch = (newUnit: 'kg' | 'lb') => {
        if (newUnit === unit) return;
        const currentTarget = parseFloat(targetWeightStr) || 0;
        if (currentTarget > 0) {
            const converted = newUnit === 'lb' ? currentTarget * 2.20462 : currentTarget / 2.20462;
            setTargetWeightStr(String(Math.round(converted * 2) / 2));
        }
        setBarWeight(newUnit === 'kg' ? 20 : 45);
        setUnit(newUnit);
    };

    // Plate denominations based on current unit
    const activeDenominations = unit === 'kg' ? KG_DENOMINATIONS : LB_DENOMINATIONS;
    const collarWeight = unit === 'kg' ? 5 : 5; // 5kg or 5lb total (2.5 each side)

    // 1. Calculate Mode plates per side
    const calculatedPlates = useMemo(() => {
        if (subMode !== 'calculate') return [];
        const target = parseFloat(targetWeightStr);
        if (isNaN(target) || target <= 0) return [];

        const totalBarCollar = barWeight + (includeCollars ? collarWeight : 0);
        let remainingPerSide = (target - totalBarCollar) / 2;
        if (remainingPerSide <= 0) return [];

        const plates: number[] = [];
        for (const denom of activeDenominations) {
            while (remainingPerSide >= denom - 0.001) {
                plates.push(denom);
                remainingPerSide -= denom;
            }
        }
        return plates;
    }, [subMode, targetWeightStr, barWeight, includeCollars, collarWeight, activeDenominations]);

    // 2. Load Mode plates per side (ordered largest to smallest for barbell)
    const manualPlates = useMemo(() => {
        const list: number[] = [];
        activeDenominations.forEach((denom) => {
            const count = inventoryCounts[denom] || 0;
            for (let i = 0; i < count; i++) {
                list.push(denom);
            }
        });
        return list;
    }, [inventoryCounts, activeDenominations]);

    const activePlates = subMode === 'calculate' ? calculatedPlates : manualPlates;

    // Derived total weights
    const loadedTotal = useMemo(() => {
        const platesTotal = activePlates.reduce((acc, p) => acc + p, 0) * 2;
        const collarsTotal = includeCollars ? collarWeight : 0;
        return barWeight + collarsTotal + platesTotal;
    }, [activePlates, barWeight, includeCollars, collarWeight]);

    const otherUnitTotal = unit === 'kg' ? loadedTotal * 2.20462 : loadedTotal / 2.20462;

    // Modify inventory
    const changeInventory = (denom: number, delta: number) => {
        setInventoryCounts((prev) => {
            const current = prev[denom] || 0;
            const updated = Math.max(0, Math.min(12, current + delta));
            return { ...prev, [denom]: updated };
        });
    };

    const clearInventory = () => {
        setInventoryCounts({
            25: 0, 20: 0, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0,
            55: 0, 45: 0, 35: 0,
        });
    };

    const handleRemovePlateAtIndex = (index: number) => {
        if (subMode !== 'load') return;
        const plateWeight = manualPlates[index];
        if (plateWeight !== undefined) {
            changeInventory(plateWeight, -1);
        }
    };

    // Per-side plate summary text (e.g. "25 kg + 15 kg" or "2x 25 kg + 15 kg")
    const perSideSummary = useMemo(() => {
        if (activePlates.length === 0) return 'None (Empty Bar)';
        const counts: Record<number, number> = {};
        activePlates.forEach((w) => {
            counts[w] = (counts[w] || 0) + 1;
        });
        const parts = Object.entries(counts)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([weight, count]) => (count > 1 ? `${count}x ${weight} ${unit}` : `${weight} ${unit}`));
        return parts.join(' + ');
    }, [activePlates, unit]);

    return (
        <div className="w-full flex flex-col gap-5">
            {/* Top Sub-mode Selector [Calculate | Load] */}
            <div className="flex justify-center">
                <div
                    style={{
                        display: 'inline-flex',
                        padding: '4px',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setSubMode('calculate')}
                        className="chat-press"
                        style={{
                            padding: '8px 24px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: subMode === 'calculate' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                            background: subMode === 'calculate' ? '#ffffff' : 'transparent',
                            color: subMode === 'calculate' ? '#0a0a0a' : 'var(--secondary-foreground)',
                            boxShadow: subMode === 'calculate' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
                            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                            cursor: 'pointer',
                        }}
                    >
                        Calculate
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubMode('load')}
                        className="chat-press"
                        style={{
                            padding: '8px 24px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: subMode === 'load' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                            background: subMode === 'load' ? '#ffffff' : 'transparent',
                            color: subMode === 'load' ? '#0a0a0a' : 'var(--secondary-foreground)',
                            boxShadow: subMode === 'load' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
                            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                            cursor: 'pointer',
                        }}
                    >
                        Load
                    </button>
                </div>
            </div>

            {/* Main Content Grid: Controls on Left, Visualizer & Readout on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* LEFT CARD: Inputs / Inventory */}
                <div
                    className="lg:col-span-5 glass-panel flex flex-col justify-between"
                    style={{
                        padding: '24px',
                        borderRadius: '20px',
                        background: 'rgba(16, 16, 24, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {subMode === 'calculate' ? (
                        /* CALCULATE MODE CONTROLS */
                        <div className="flex flex-col gap-6">
                            {/* Target Weight + Unit Toggle */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        color: 'var(--secondary-foreground)',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Target Weight
                                </label>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex-1 flex items-center px-4"
                                        style={{
                                            height: '52px',
                                            borderRadius: '14px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                                        }}
                                    >
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            value={targetWeightStr}
                                            onChange={(e) => setTargetWeightStr(e.target.value)}
                                            placeholder="100"
                                            style={{
                                                width: '100%',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#ffffff',
                                                fontSize: '1.25rem',
                                                fontWeight: 800,
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                    {/* Unit pill switch */}
                                    <div
                                        className="flex p-1"
                                        style={{
                                            height: '52px',
                                            borderRadius: '14px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('kg')}
                                            className="chat-press"
                                            style={{
                                                padding: '0 16px',
                                                borderRadius: '10px',
                                                fontWeight: 800,
                                                fontSize: '0.85rem',
                                                background: unit === 'kg' ? '#ffffff' : 'transparent',
                                                color: unit === 'kg' ? '#0a0a0a' : 'var(--secondary-foreground)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            kg
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('lb')}
                                            className="chat-press"
                                            style={{
                                                padding: '0 16px',
                                                borderRadius: '10px',
                                                fontWeight: 800,
                                                fontSize: '0.85rem',
                                                background: unit === 'lb' ? '#ffffff' : 'transparent',
                                                color: unit === 'lb' ? '#0a0a0a' : 'var(--secondary-foreground)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            lb
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bar Weight */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        color: 'var(--secondary-foreground)',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Bar Weight
                                </label>
                                <div
                                    className="flex items-center px-4"
                                    style={{
                                        height: '52px',
                                        borderRadius: '14px',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                    }}
                                >
                                    <input
                                        type="number"
                                        step="any"
                                        value={barWeight}
                                        onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            outline: 'none',
                                        }}
                                    />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', fontWeight: 700 }}>
                                        {unit.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Collars Checkbox */}
                            <label
                                className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl transition-all"
                                style={{
                                    background: includeCollars ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                    border: includeCollars ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                                }}
                            >
                                <div
                                    style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        background: includeCollars ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                                        border: includeCollars ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {includeCollars && <Check size={14} strokeWidth={3} />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={includeCollars}
                                    onChange={(e) => setIncludeCollars(e.target.checked)}
                                    className="hidden"
                                />
                                <div className="flex flex-col">
                                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: includeCollars ? '#f87171' : '#ffffff' }}>
                                        Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                        +{collarWeight} {unit} total
                                    </span>
                                </div>
                            </label>
                        </div>
                    ) : (
                        /* LOAD MODE INVENTORY */
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>Plate inventory</h4>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)' }}>
                                        Add one plate to each side at a time.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearInventory}
                                    className="chat-press"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        padding: '4px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Inventory List with Steppers */}
                            <div className="flex flex-col gap-2 my-1">
                                {activeDenominations.map((denom) => {
                                    const spec = unit === 'kg' ? KG_PLATE_SPECS[denom] : LB_PLATE_SPECS[denom];
                                    const count = inventoryCounts[denom] || 0;

                                    return (
                                        <div
                                            key={denom}
                                            className="flex items-center justify-between px-3 py-2 rounded-xl"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.025)',
                                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    style={{
                                                        width: '14px',
                                                        height: '18px',
                                                        borderRadius: '3px',
                                                        background: spec?.color || '#94a3b8',
                                                        border: `1px solid ${spec?.darkColor || '#475569'}`,
                                                    }}
                                                />
                                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                                                    {denom} {unit}
                                                </span>
                                            </div>

                                            {/* Stepper buttons [-] [0] [+] */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => changeInventory(denom, -1)}
                                                    disabled={count === 0}
                                                    className="chat-press"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        color: count > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: count > 0 ? 'pointer' : 'default',
                                                    }}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span
                                                    style={{
                                                        minWidth: '24px',
                                                        textAlign: 'center',
                                                        fontWeight: 800,
                                                        fontSize: '0.95rem',
                                                        color: count > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.3)',
                                                    }}
                                                >
                                                    {count}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => changeInventory(denom, 1)}
                                                    className="chat-press"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        color: '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bar & Collars Settings for Load Mode */}
                            <div className="pt-3 border-t border-white/5 flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1">
                                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                                            Bar Weight
                                        </label>
                                        <div className="flex items-center px-3" style={{ height: '42px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                            <input
                                                type="number"
                                                step="any"
                                                value={barWeight}
                                                onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                                                style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', fontWeight: 700 }}>{unit.toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                                            Unit
                                        </label>
                                        <div className="flex p-1" style={{ height: '42px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleUnitSwitch('kg')}
                                                style={{ padding: '0 10px', borderRadius: '7px', fontWeight: 800, fontSize: '0.75rem', background: unit === 'kg' ? '#ffffff' : 'transparent', color: unit === 'kg' ? '#0a0a0a' : 'var(--secondary-foreground)', border: 'none', cursor: 'pointer' }}
                                            >
                                                kg
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUnitSwitch('lb')}
                                                style={{ padding: '0 10px', borderRadius: '7px', fontWeight: 800, fontSize: '0.75rem', background: unit === 'lb' ? '#ffffff' : 'transparent', color: unit === 'lb' ? '#0a0a0a' : 'var(--secondary-foreground)', border: 'none', cursor: 'pointer' }}
                                            >
                                                lb
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer select-none p-2.5 rounded-xl" style={{ background: includeCollars ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)', border: includeCollars ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: includeCollars ? '#ef4444' : 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                        {includeCollars && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <input type="checkbox" checked={includeCollars} onChange={(e) => setIncludeCollars(e.target.checked)} className="hidden" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: includeCollars ? '#f87171' : '#fff' }}>
                                        Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars (+{collarWeight} {unit})
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT CARD: Barbell Visualization & Big Total Display */}
                <div
                    className="lg:col-span-7 glass-panel flex flex-col justify-between"
                    style={{
                        padding: '24px',
                        borderRadius: '20px',
                        background: 'rgba(16, 16, 24, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {/* Header Label & Big Loaded Weight */}
                    <div className="flex flex-col items-center justify-center text-center">
                        <span
                            style={{
                                fontSize: '0.8125rem',
                                fontWeight: 800,
                                color: 'var(--secondary-foreground)',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                marginBottom: '2px',
                            }}
                        >
                            {subMode === 'calculate' ? 'NEAREST AVAILABLE' : 'LOADED TOTAL'}
                        </span>
                        <div className="flex items-baseline justify-center gap-1.5">
                            <span
                                style={{
                                    fontSize: '3rem',
                                    fontWeight: 900,
                                    lineHeight: 1,
                                    color: '#ef4444', // Signature crimson red from screenshots
                                    letterSpacing: '-0.03em',
                                }}
                            >
                                {loadedTotal % 1 === 0 ? loadedTotal : loadedTotal.toFixed(1)}
                            </span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                                {unit}
                            </span>
                        </div>
                        <span
                            style={{
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: 'var(--secondary-foreground)',
                                marginTop: '4px',
                            }}
                        >
                            {otherUnitTotal.toFixed(2)} {unit === 'kg' ? 'lb' : 'kg'}
                        </span>
                    </div>

                    {/* Barbell Sleeve Rendering */}
                    <div className="my-auto py-4 overflow-x-auto flex justify-center">
                        <BarbellVisualizer
                            plates={activePlates}
                            barWeight={barWeight}
                            includeCollars={includeCollars}
                            unit={unit}
                            onRemovePlate={subMode === 'load' ? handleRemovePlateAtIndex : undefined}
                            isInteractive={subMode === 'load'}
                        />
                    </div>

                    {/* Plates per side footer count */}
                    <div className="text-center pt-2">
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                            {activePlates.length} {activePlates.length === 1 ? 'plate' : 'plates'} per side
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Callout Bar: Per side plate breakdown exact to Screenshot 1 */}
            <div
                className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
                style={{
                    background: 'rgba(16, 16, 24, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderLeft: '4px solid #ef4444', // Red accent bar
                    backdropFilter: 'blur(16px)',
                }}
            >
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ef4444' }}>
                    Per side:
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    {perSideSummary}
                </span>
            </div>
        </div>
    );
}

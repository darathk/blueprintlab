'use client';

import React, { useState, useMemo } from 'react';
import BarbellVisualizer, { KG_PLATE_SPECS, LB_PLATE_SPECS } from './BarbellVisualizer';
import { Plus, Minus, Check } from 'lucide-react';

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

    // Per-side plate summary text (e.g. "25 kg + 15 kg")
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
        <div className="w-full flex flex-col gap-5 max-w-5xl mx-auto">
            {/* Main Content Grid: Controls on Left, Visualizer & Readout on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* LEFT CARD: Inputs / Inventory */}
                <div
                    className="lg:col-span-5 flex flex-col justify-between"
                    style={{
                        padding: '28px 24px',
                        borderRadius: '20px',
                        background: '#1c1d22',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minHeight: '520px',
                    }}
                >
                    {/* Sub-mode Selector [Calculate | Load] at Top of Left Card (matching reference screenshot) */}
                    <div className="flex justify-center mb-6">
                        <div
                            style={{
                                display: 'inline-flex',
                                padding: '4px',
                                borderRadius: '14px',
                                background: '#141418',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setSubMode('calculate')}
                                className="chat-press"
                                style={{
                                    padding: '8px 22px',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    border: subMode === 'calculate' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                    background: subMode === 'calculate' ? '#ffffff' : 'transparent',
                                    color: subMode === 'calculate' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: subMode === 'calculate' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                Calculate
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubMode('load')}
                                className="chat-press"
                                style={{
                                    padding: '8px 22px',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    border: subMode === 'load' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                    background: subMode === 'load' ? '#ffffff' : 'transparent',
                                    color: subMode === 'load' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: subMode === 'load' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                Load
                            </button>
                        </div>
                    </div>

                    {subMode === 'calculate' ? (
                        /* CALCULATE MODE CONTROLS */
                        <div className="flex flex-col gap-6 flex-1">
                            {/* Target Weight + Unit Toggle */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: 'rgba(255, 255, 255, 0.75)',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Target weight
                                </label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex-1 flex items-center px-4"
                                        style={{
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: '#141418',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
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
                                                fontSize: '1.15rem',
                                                fontWeight: 700,
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                    {/* Unit toggle */}
                                    <div
                                        className="flex p-1"
                                        style={{
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: '#141418',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('kg')}
                                            className="chat-press"
                                            style={{
                                                padding: '0 16px',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '0.875rem',
                                                background: unit === 'kg' ? '#ffffff' : 'transparent',
                                                color: unit === 'kg' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
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
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '0.875rem',
                                                background: unit === 'lb' ? '#ffffff' : 'transparent',
                                                color: unit === 'lb' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
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
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: 'rgba(255, 255, 255, 0.75)',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Bar weight
                                </label>
                                <div
                                    className="flex items-center px-4"
                                    style={{
                                        height: '48px',
                                        borderRadius: '12px',
                                        background: '#141418',
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
                                </div>
                            </div>

                            {/* Collars Checkbox exact to reference screenshot */}
                            <label
                                className="flex items-start gap-3 cursor-pointer select-none mt-2"
                            >
                                <div
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '5px',
                                        background: includeCollars ? '#ffffff' : 'transparent',
                                        border: includeCollars ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0a0a0a',
                                        marginTop: '2px',
                                        flexShrink: 0,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {includeCollars && <Check size={14} strokeWidth={3.5} />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={includeCollars}
                                    onChange={(e) => setIncludeCollars(e.target.checked)}
                                    className="hidden"
                                />
                                <div className="flex flex-col">
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', lineHeight: 1.2 }}>
                                        Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                        +{collarWeight} {unit} total
                                    </span>
                                </div>
                            </label>
                        </div>
                    ) : (
                        /* LOAD MODE INVENTORY */
                        <div className="flex flex-col gap-4 flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>Plate inventory</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                        Add one plate to each side at a time.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearInventory}
                                    className="chat-press"
                                    style={{
                                        background: 'transparent',
                                        color: '#ef4444',
                                        border: 'none',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Inventory List with Steppers */}
                            <div className="flex flex-col gap-1.5 my-1">
                                {activeDenominations.map((denom) => {
                                    const spec = unit === 'kg' ? KG_PLATE_SPECS[denom] : LB_PLATE_SPECS[denom];
                                    const count = inventoryCounts[denom] || 0;

                                    return (
                                        <div
                                            key={denom}
                                            className="flex items-center justify-between py-1"
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
                                                        background: '#141418',
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                        color: count > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
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
                                                        width: '28px',
                                                        textAlign: 'center',
                                                        fontWeight: 800,
                                                        fontSize: '0.95rem',
                                                        color: '#ef4444',
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
                                                        background: '#141418',
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
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
                            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600, marginBottom: '6px' }}>
                                        Bar weight
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 flex items-center px-4" style={{ height: '48px', borderRadius: '12px', background: '#141418', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                            <input
                                                type="number"
                                                step="any"
                                                value={barWeight}
                                                onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                                                style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, outline: 'none' }}
                                            />
                                        </div>
                                        <div className="flex p-1" style={{ height: '48px', borderRadius: '12px', background: '#141418', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleUnitSwitch('kg')}
                                                style={{ padding: '0 16px', borderRadius: '8px', fontWeight: 800, fontSize: '0.875rem', background: unit === 'kg' ? '#ffffff' : 'transparent', color: unit === 'kg' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)', border: 'none', cursor: 'pointer' }}
                                            >
                                                kg
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUnitSwitch('lb')}
                                                style={{ padding: '0 16px', borderRadius: '8px', fontWeight: 800, fontSize: '0.875rem', background: unit === 'lb' ? '#ffffff' : 'transparent', color: unit === 'lb' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)', border: 'none', cursor: 'pointer' }}
                                            >
                                                lb
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer select-none mt-1">
                                    <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: includeCollars ? '#ffffff' : 'transparent', border: includeCollars ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', marginTop: '2px', flexShrink: 0 }}>
                                        {includeCollars && <Check size={14} strokeWidth={3.5} />}
                                    </div>
                                    <input type="checkbox" checked={includeCollars} onChange={(e) => setIncludeCollars(e.target.checked)} className="hidden" />
                                    <div className="flex flex-col">
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', lineHeight: 1.2 }}>
                                            Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                            +{collarWeight} {unit} total
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT CARD: Barbell Visualization & Big Total Display */}
                <div
                    className="lg:col-span-7 flex flex-col justify-between"
                    style={{
                        padding: '28px 24px',
                        borderRadius: '20px',
                        background: '#1c1d22',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minHeight: '520px',
                    }}
                >
                    {/* Header Label & Big Loaded Weight */}
                    <div className="flex flex-col items-center justify-center text-center">
                        <span
                            style={{
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                color: 'rgba(255, 255, 255, 0.7)',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                marginBottom: '4px',
                            }}
                        >
                            {subMode === 'calculate' ? 'NEAREST AVAILABLE' : 'LOADED TOTAL'}
                        </span>
                        <div className="flex items-baseline justify-center">
                            <span
                                style={{
                                    fontSize: '3.75rem',
                                    fontWeight: 900,
                                    lineHeight: 1,
                                    color: '#ef4444',
                                    letterSpacing: '-0.03em',
                                }}
                            >
                                {loadedTotal % 1 === 0 ? loadedTotal : loadedTotal.toFixed(1)}
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginLeft: '6px' }}>
                                {unit}
                            </span>
                        </div>
                        <span
                            style={{
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.65)',
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
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.65)' }}>
                            {activePlates.length} {activePlates.length === 1 ? 'plate' : 'plates'} per side
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Callout Bar exact to Screenshot */}
            <div
                className="flex items-center gap-2 px-6 py-4 rounded-xl"
                style={{
                    background: '#1c1d22',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderLeft: '4px solid #ef4444',
                }}
            >
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444', marginRight: '4px' }}>
                    Per side
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    {perSideSummary}
                </span>
            </div>
        </div>
    );
}

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
    const [includeCollars, setIncludeCollars] = useState<boolean>(false);

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
        <div className="w-full flex flex-col gap-5 max-w-[1000px] mx-auto px-2 pb-32 md:pb-12">
            {/* Main Cards: 12-column grid side-by-side on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* LEFT CARD: Controls */}
                <div
                    className="md:col-span-5 flex flex-col p-6 sm:p-7 rounded-2xl"
                    style={{
                        background: 'rgba(20, 20, 30, 0.65)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.09)',
                        boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        minHeight: '460px',
                    }}
                >
                    {/* Decoupled Segment Selector: Calculate | Load in 50/50 Grid */}
                    <div className="w-full mb-6">
                        <div
                            className="w-full max-w-[280px] mx-auto grid grid-cols-2 p-1.5 rounded-2xl"
                            style={{
                                background: 'rgba(10, 10, 16, 0.65)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.05)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setSubMode('calculate')}
                                className="chat-press flex items-center justify-center py-2.5 px-4 rounded-xl font-extrabold text-sm transition-all cursor-pointer select-none"
                                style={{
                                    background: subMode === 'calculate' ? '#ffffff' : 'transparent',
                                    color: subMode === 'calculate' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: subMode === 'calculate' ? '0 2px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : 'none',
                                }}
                            >
                                Calculate
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubMode('load')}
                                className="chat-press flex items-center justify-center py-2.5 px-4 rounded-xl font-extrabold text-sm transition-all cursor-pointer select-none"
                                style={{
                                    background: subMode === 'load' ? '#ffffff' : 'transparent',
                                    color: subMode === 'load' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: subMode === 'load' ? '0 2px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : 'none',
                                }}
                            >
                                Load
                            </button>
                        </div>
                    </div>

                    {subMode === 'calculate' ? (
                        /* CALCULATE MODE */
                        <div className="flex flex-col gap-6 flex-1">
                            {/* Target Weight + Unit Switch */}
                            <div>
                                <label className="block text-sm font-semibold text-white/80 mb-2">
                                    Target weight
                                </label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex-1 flex items-center px-4 rounded-xl"
                                        style={{
                                            height: '52px',
                                            minWidth: 0,
                                            background: 'rgba(10, 10, 16, 0.55)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                                        }}
                                    >
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            value={targetWeightStr}
                                            onChange={(e) => setTargetWeightStr(e.target.value)}
                                            placeholder="100"
                                            className="w-full bg-transparent border-none text-white text-xl font-bold outline-none"
                                        />
                                    </div>

                                    {/* Dedicated Unit switch with fixed width */}
                                    <div
                                        className="flex items-center p-1 rounded-xl shrink-0 w-[110px]"
                                        style={{
                                            height: '52px',
                                            background: 'rgba(10, 10, 16, 0.55)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('kg')}
                                            className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                            style={{
                                                background: unit === 'kg' ? '#ffffff' : 'transparent',
                                                color: unit === 'kg' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                                boxShadow: unit === 'kg' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                            }}
                                        >
                                            kg
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('lb')}
                                            className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                            style={{
                                                background: unit === 'lb' ? '#ffffff' : 'transparent',
                                                color: unit === 'lb' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                                boxShadow: unit === 'lb' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                            }}
                                        >
                                            lb
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bar Weight */}
                            <div>
                                <label className="block text-sm font-semibold text-white/80 mb-2">
                                    Bar weight
                                </label>
                                <div
                                    className="w-full flex items-center px-4 rounded-xl"
                                    style={{
                                        height: '52px',
                                        background: 'rgba(10, 10, 16, 0.55)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                                    }}
                                >
                                    <input
                                        type="number"
                                        step="any"
                                        value={barWeight}
                                        onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-transparent border-none text-white text-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            {/* Collars Checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <div
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        background: includeCollars ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                                        border: includeCollars ? '1.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.45)',
                                        boxShadow: includeCollars ? '0 0 10px rgba(255, 255, 255, 0.4)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0a0a0a',
                                        marginTop: '2px',
                                        flexShrink: 0,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {includeCollars && <Check size={12} strokeWidth={3.5} />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={includeCollars}
                                    onChange={(e) => setIncludeCollars(e.target.checked)}
                                    className="hidden"
                                />
                                <div className="flex flex-col">
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', textShadow: '0 0 12px rgba(239, 68, 68, 0.3)', lineHeight: 1.2 }}>
                                        Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                                        +{collarWeight} {unit} total
                                    </span>
                                </div>
                            </label>
                        </div>
                    ) : (
                        /* LOAD MODE */
                        <div className="flex flex-col gap-4 flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-extrabold text-white">Plate inventory</h4>
                                    <p className="text-xs text-white/60 mt-0.5">
                                        Add one plate to each side at a time.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearInventory}
                                    className="chat-press text-sm font-extrabold text-[#ef4444] cursor-pointer hover:underline"
                                    style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Inventory List */}
                            <div className="flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.08] my-1">
                                {activeDenominations.map((denom) => {
                                    const spec = unit === 'kg' ? KG_PLATE_SPECS[denom] : LB_PLATE_SPECS[denom];
                                    const count = inventoryCounts[denom] || 0;

                                    return (
                                        <div
                                            key={denom}
                                            className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    style={{
                                                        width: '16px',
                                                        height: '22px',
                                                        borderRadius: '4px',
                                                        background: spec?.color || '#94a3b8',
                                                        border: `1px solid ${spec?.darkColor || '#475569'}`,
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-white">
                                                    {denom} {unit}
                                                </span>
                                            </div>

                                            {/* Stepper buttons */}
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => changeInventory(denom, -1)}
                                                    disabled={count === 0}
                                                    className="chat-press flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 6px rgba(0, 0, 0, 0.2)',
                                                        color: count > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
                                                        cursor: count > 0 ? 'pointer' : 'default',
                                                    }}
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <span
                                                    className="w-6 text-center font-extrabold text-base text-[#ef4444]"
                                                    style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.35)' }}
                                                >
                                                    {count}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => changeInventory(denom, 1)}
                                                    className="chat-press flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-all"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 6px rgba(0, 0, 0, 0.2)',
                                                        color: '#ffffff',
                                                    }}
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bar & Collars in Load Mode */}
                            <div className="flex flex-col gap-2 mt-1">
                                <label className="block text-sm font-semibold text-white/70">
                                    Bar weight
                                </label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex-1 flex items-center px-4 rounded-xl"
                                        style={{
                                            height: '52px',
                                            background: 'rgba(10, 10, 16, 0.55)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                                        }}
                                    >
                                        <input
                                            type="number"
                                            step="any"
                                            value={barWeight}
                                            onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent border-none text-white text-xl font-bold outline-none"
                                        />
                                    </div>
                                    {/* Dedicated Unit switch with fixed width */}
                                    <div
                                        className="flex items-center p-1 rounded-xl shrink-0 w-[110px]"
                                        style={{
                                            height: '52px',
                                            background: 'rgba(10, 10, 16, 0.55)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('kg')}
                                            className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                            style={{
                                                background: unit === 'kg' ? '#ffffff' : 'transparent',
                                                color: unit === 'kg' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                                boxShadow: unit === 'kg' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                            }}
                                        >
                                            kg
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUnitSwitch('lb')}
                                            className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                            style={{
                                                background: unit === 'lb' ? '#ffffff' : 'transparent',
                                                color: unit === 'lb' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                                boxShadow: unit === 'lb' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                            }}
                                        >
                                            lb
                                        </button>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer select-none mt-2">
                                    <div
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            background: includeCollars ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                                            border: includeCollars ? '1.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.45)',
                                            boxShadow: includeCollars ? '0 0 10px rgba(255, 255, 255, 0.4)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#0a0a0a',
                                            marginTop: '2px',
                                            flexShrink: 0,
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {includeCollars && <Check size={12} strokeWidth={3.5} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={includeCollars}
                                        onChange={(e) => setIncludeCollars(e.target.checked)}
                                        className="hidden"
                                    />
                                    <div className="flex flex-col">
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', textShadow: '0 0 12px rgba(239, 68, 68, 0.3)', lineHeight: 1.2 }}>
                                            Add {unit === 'kg' ? '2.5 kg' : '2.5 lb'} collars
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                                            +{collarWeight} {unit} total
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT CARD: Barbell Visualization & Big Total */}
                <div
                    className="md:col-span-7 flex flex-col justify-between p-6 sm:p-7 rounded-2xl relative overflow-hidden"
                    style={{
                        background: 'rgba(20, 20, 30, 0.65)',
                        backgroundImage: 'radial-gradient(ellipse at 50% 38%, rgba(239, 68, 68, 0.09) 0%, transparent 68%)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.09)',
                        boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        minHeight: '460px',
                    }}
                >
                    {/* Header: Nearest Available / Loaded Total & Big Weight */}
                    <div className="flex flex-col items-center justify-center text-center pt-1">
                        <div
                            className="inline-flex items-center px-3 py-1 rounded-full mb-2"
                            style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {subMode === 'calculate' ? 'NEAREST AVAILABLE' : 'LOADED TOTAL'}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-center">
                            <span
                                style={{
                                    fontSize: '4rem',
                                    fontWeight: 900,
                                    lineHeight: 1,
                                    color: '#ef4444',
                                    letterSpacing: '-0.02em',
                                    textShadow: '0 0 32px rgba(239, 68, 68, 0.4), 0 0 60px rgba(239, 68, 68, 0.15)',
                                }}
                            >
                                {loadedTotal % 1 === 0 ? loadedTotal : loadedTotal.toFixed(1)}
                            </span>
                            <span
                                style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 800,
                                    color: '#ef4444',
                                    marginLeft: '6px',
                                    textShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
                                }}
                            >
                                {unit}
                            </span>
                        </div>
                        <span
                            style={{
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.65)',
                                marginTop: '4px',
                            }}
                        >
                            {otherUnitTotal.toFixed(2)} {unit === 'kg' ? 'lb' : 'kg'}
                        </span>
                    </div>

                    {/* Barbell Graphic */}
                    <div className="my-auto py-4 flex items-center justify-center w-full">
                        <BarbellVisualizer
                            plates={activePlates}
                            barWeight={barWeight}
                            includeCollars={includeCollars}
                            unit={unit}
                            onRemovePlate={subMode === 'load' ? handleRemovePlateAtIndex : undefined}
                            isInteractive={subMode === 'load'}
                        />
                    </div>

                    {/* Footer Plates Count */}
                    <div className="text-center pb-1">
                        <div
                            className="inline-flex items-center px-4 py-1.5 rounded-full"
                            style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                            }}
                        >
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                                {activePlates.length} {activePlates.length === 1 ? 'plate' : 'plates'} per side
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Callout Bar */}
            <div
                className="flex items-center gap-3 px-6 py-4 rounded-2xl"
                style={{
                    background: 'rgba(20, 20, 30, 0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    borderLeft: '4px solid #ef4444',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 16px rgba(239, 68, 68, 0.15)',
                }}
            >
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', textShadow: '0 0 10px rgba(239, 68, 68, 0.3)', flexShrink: 0 }}>
                    Per side
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
                    {perSideSummary}
                </span>
            </div>
        </div>
    );
}

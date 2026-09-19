'use client';

import React, { useState, useMemo } from 'react';
import BarbellVisualizer, { KG_PLATE_SPECS, LB_PLATE_SPECS, getPlateSpec } from './BarbellVisualizer';
import { Plus, Minus, RotateCcw, Check, Dumbbell, Sparkles, Layers } from 'lucide-react';

interface BarbellTabProps {
    initialWeight?: number | string;
    initialUnit?: 'kg' | 'lb';
}

const KG_DENOMINATIONS = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_DENOMINATIONS = [55, 45, 35, 25, 10, 5, 2.5];

const KG_BENCHMARKS = [60, 100, 140, 180, 220];
const LB_BENCHMARKS = [135, 225, 315, 405, 495];

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

    // Handle unit switch
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

    // Active plate specs & denominations
    const activeDenominations = unit === 'kg' ? KG_DENOMINATIONS : LB_DENOMINATIONS;
    const collarWeight = 5; // 5 kg or 5 lb total (2.5 each side)

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

    // Inventory operations
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

    // Quick target increment
    const adjustTarget = (delta: number) => {
        const current = parseFloat(targetWeightStr) || 0;
        const next = Math.max(0, Math.round((current + delta) * 4) / 4);
        setTargetWeightStr(String(next));
    };

    // Plate summary groups for visual chips
    const plateSummaryGroups = useMemo(() => {
        if (activePlates.length === 0) return [];
        const map: Record<number, number> = {};
        activePlates.forEach((w) => {
            map[w] = (map[w] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([weightStr, count]) => ({
                weight: Number(weightStr),
                count,
                spec: getPlateSpec(Number(weightStr), unit),
            }));
    }, [activePlates, unit]);

    // Barbell presets
    const barPresets = unit === 'kg'
        ? [
            { label: "Men's Olympic", weight: 20 },
            { label: "Women's", weight: 15 },
            { label: 'Squat Bar', weight: 25 },
        ]
        : [
            { label: "Standard Bar", weight: 45 },
            { label: "Women's", weight: 35 },
            { label: 'Squat Bar', weight: 55 },
        ];

    return (
        <div className="w-full flex flex-col items-center gap-5 sm:gap-6 max-w-3xl mx-auto px-3 sm:px-4 pb-32 md:pb-16">
            {/* Header exact to Points / RPE / Max tabs */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Barbell Plate Loader
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                    Visual Olympic plate loading and precision barbell math
                </p>
            </div>

            {/* Top Central Mode Switcher */}
            <div className="w-full flex justify-center">
                <div
                    className="w-full max-w-xs sm:max-w-sm grid grid-cols-2 p-1.5 rounded-2xl"
                    style={{
                        background: 'rgba(12, 12, 20, 0.75)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setSubMode('calculate')}
                        className="chat-press flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all cursor-pointer select-none truncate"
                        style={{
                            background: subMode === 'calculate' ? '#ffffff' : 'transparent',
                            color: subMode === 'calculate' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                            boxShadow: subMode === 'calculate' ? '0 2px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : 'none',
                        }}
                    >
                        <Sparkles size={14} className={subMode === 'calculate' ? 'text-red-600' : 'text-zinc-400'} />
                        Calculate
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubMode('load')}
                        className="chat-press flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all cursor-pointer select-none truncate"
                        style={{
                            background: subMode === 'load' ? '#ffffff' : 'transparent',
                            color: subMode === 'load' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                            boxShadow: subMode === 'load' ? '0 2px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : 'none',
                        }}
                    >
                        <Layers size={14} className={subMode === 'load' ? 'text-red-600' : 'text-zinc-400'} />
                        Load Barbell
                    </button>
                </div>
            </div>

            {/* HERO STAGE: Full-Width Showcase Card */}
            <div
                className="w-full flex flex-col p-5 sm:p-7 rounded-3xl relative overflow-hidden"
                style={{
                    background: 'rgba(20, 20, 32, 0.75)',
                    backgroundImage: 'radial-gradient(ellipse at 50% 35%, rgba(239, 68, 68, 0.12) 0%, transparent 68%)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 20px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                }}
            >
                {/* Hero Header Strip: Badges */}
                <div className="flex items-center justify-between w-full pb-3.5 border-b border-white/[0.08]">
                    <span
                        className="px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black tracking-wider uppercase"
                        style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                    >
                        {subMode === 'calculate' ? 'NEAREST ACHIEVABLE' : 'LOADED TOTAL'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] text-zinc-300 border border-white/10">
                        {activePlates.length} {activePlates.length === 1 ? 'plate' : 'plates'} / side
                    </span>
                </div>

                {/* Big Centerpiece Weight Readout */}
                <div className="flex flex-col items-center text-center my-3 sm:my-4">
                    <div className="flex items-baseline justify-center gap-1.5">
                        <span
                            className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none"
                            style={{ textShadow: '0 0 32px rgba(239, 68, 68, 0.45)' }}
                        >
                            {loadedTotal % 1 === 0 ? loadedTotal : loadedTotal.toFixed(1)}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-red-500 leading-none">
                            {unit}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
                        <span className="text-xs sm:text-sm font-semibold text-zinc-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
                            ≈ {otherUnitTotal.toFixed(1)} {unit === 'kg' ? 'lb' : 'kg'}
                        </span>
                        {subMode === 'calculate' && parseFloat(targetWeightStr) > 0 && Math.abs(loadedTotal - parseFloat(targetWeightStr)) > 0.01 && (
                            <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                Target: {targetWeightStr} {unit} ({loadedTotal - parseFloat(targetWeightStr) > 0 ? '+' : ''}{(loadedTotal - parseFloat(targetWeightStr)).toFixed(1)} {unit})
                            </span>
                        )}
                    </div>
                </div>

                {/* Barbell Graphic */}
                <div className="py-2 sm:py-4 flex flex-col items-center justify-center w-full min-h-[220px]">
                    <BarbellVisualizer
                        plates={activePlates}
                        barWeight={barWeight}
                        includeCollars={includeCollars}
                        unit={unit}
                        onRemovePlate={subMode === 'load' ? handleRemovePlateAtIndex : undefined}
                        isInteractive={subMode === 'load'}
                    />

                    {subMode === 'load' && activePlates.length > 0 && (
                        <p className="text-xs text-zinc-400 font-medium mt-2 text-center">
                            💡 Tap any plate on the sleeve to remove it
                        </p>
                    )}
                </div>

                {/* Hero Footer: Centered Inside-Out Loading Sequence */}
                <div className="pt-4 border-t border-white/[0.08] flex flex-col items-center text-center gap-2.5">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Per-Side Loading (Inside → Out)
                        </span>
                        {includeCollars && (
                            <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                                +{collarWeight} {unit} Collars Included
                            </span>
                        )}
                    </div>

                    {plateSummaryGroups.length === 0 ? (
                        <p className="text-xs sm:text-sm font-semibold text-zinc-400 py-1 text-center">
                            Empty bar ({barWeight} {unit}). Use controls below to load.
                        </p>
                    ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            {plateSummaryGroups.map(({ weight: pWeight, count, spec }) => (
                                <div
                                    key={pWeight}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        border: `1px solid ${spec.color}66`,
                                        boxShadow: `0 0 10px ${spec.color}20`,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '9px',
                                            height: '13px',
                                            borderRadius: '3px',
                                            background: spec.color,
                                            boxShadow: `0 0 6px ${spec.color}`,
                                        }}
                                    />
                                    <span className="text-xs font-black text-white">
                                        {count > 1 ? `${count} × ` : ''}{pWeight} {unit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CONTROLS DECK */}
            {subMode === 'calculate' ? (
                /* CALCULATE MODE CONTROLS */
                <div className="w-full flex flex-col gap-5">
                    {/* Card 1: Target Weight & Quick Adjustments */}
                    <div
                        className="w-full flex flex-col p-5 sm:p-6 rounded-2xl"
                        style={{
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        {/* Centered Target Weight Title */}
                        <div className="flex flex-col items-center text-center mb-3">
                            <label className="text-sm sm:text-base font-extrabold text-white">
                                Target Weight
                            </label>
                            <span className="text-xs font-semibold text-zinc-400 mt-0.5">
                                Exact plate combination
                            </span>
                        </div>

                        {/* Input & Unit Row: Centered & Balanced */}
                        <div className="flex items-center justify-center gap-2.5 w-full max-w-md mx-auto">
                            <div
                                className="flex-1 flex items-center px-4 rounded-xl"
                                style={{
                                    height: '52px',
                                    minWidth: 0,
                                    background: 'rgba(10, 10, 16, 0.65)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.45)',
                                }}
                            >
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    value={targetWeightStr}
                                    onChange={(e) => setTargetWeightStr(e.target.value)}
                                    placeholder="100"
                                    className="w-full bg-transparent border-none text-white text-3xl font-black text-center outline-none"
                                />
                            </div>

                            {/* Unit Switcher */}
                            <div
                                className="flex items-center p-1 rounded-xl shrink-0 w-[116px]"
                                style={{
                                    height: '52px',
                                    background: 'rgba(10, 10, 16, 0.65)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleUnitSwitch('kg')}
                                    className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                    style={{
                                        background: unit === 'kg' ? '#ffffff' : 'transparent',
                                        color: unit === 'kg' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                        boxShadow: unit === 'kg' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
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
                                        boxShadow: unit === 'lb' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                                    }}
                                >
                                    lb
                                </button>
                            </div>
                        </div>

                        {/* Quick Adjustments Grid */}
                        <div className="mt-6 max-w-md mx-auto w-full">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                    Quick Adjust (+ / -)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setTargetWeightStr(String(barWeight))}
                                    className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                >
                                    Reset to Bar
                                </button>
                            </div>

                            {/* Positive Steps */}
                            <div className="grid grid-cols-4 gap-2 mb-2 w-full">
                                {(unit === 'kg' ? [2.5, 5, 10, 20] : [5, 10, 25, 45]).map((step) => (
                                    <button
                                        key={`add-${step}`}
                                        type="button"
                                        onClick={() => adjustTarget(step)}
                                        className="chat-press min-h-[44px] py-2 px-1 rounded-xl text-xs font-extrabold text-white flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                        }}
                                    >
                                        +{step}
                                    </button>
                                ))}
                            </div>

                            {/* Negative Steps */}
                            <div className="grid grid-cols-4 gap-2 w-full">
                                {(unit === 'kg' ? [-2.5, -5, -10, -20] : [-5, -10, -25, -45]).map((step) => (
                                    <button
                                        key={`sub-${step}`}
                                        type="button"
                                        onClick={() => adjustTarget(step)}
                                        className="chat-press min-h-[44px] py-2 px-1 rounded-xl text-xs font-extrabold text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                        }}
                                    >
                                        {step}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Warmup Benchmarks */}
                        <div className="mt-6 pt-5 border-t border-white/[0.06] max-w-md mx-auto w-full">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block text-center mb-3">
                                Warmup Targets (Wheels)
                            </span>
                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
                                {(unit === 'kg' ? KG_BENCHMARKS : LB_BENCHMARKS).map((bench) => {
                                    const isSelected = parseFloat(targetWeightStr) === bench;
                                    return (
                                        <button
                                            key={bench}
                                            type="button"
                                            onClick={() => setTargetWeightStr(String(bench))}
                                            className="chat-press min-h-[44px] py-2 px-1 rounded-xl text-xs font-extrabold flex items-center justify-center text-center transition-all cursor-pointer"
                                            style={{
                                                background: isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                                border: isSelected ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                                                color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                                            }}
                                        >
                                            {bench}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Barbell & Collars */}
                    <div
                        className="w-full flex flex-col p-5 sm:p-6 rounded-2xl"
                        style={{
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <Dumbbell size={16} className="text-red-400" />
                            <h4 className="text-sm sm:text-base font-extrabold text-white text-center">
                                Barbell & Equipment
                            </h4>
                        </div>

                        {/* Bar Presets Grid (3 columns on mobile and desktop) */}
                        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto w-full">
                            {barPresets.map((bp) => {
                                const isSelected = barWeight === bp.weight;
                                return (
                                    <button
                                        key={bp.weight}
                                        type="button"
                                        onClick={() => setBarWeight(bp.weight)}
                                        className="chat-press flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-xl transition-all cursor-pointer text-center min-h-[56px]"
                                        style={{
                                            background: isSelected ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(220, 38, 38, 0.14) 100%)' : 'rgba(10, 10, 16, 0.55)',
                                            border: isSelected ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                                            boxShadow: isSelected ? '0 0 14px rgba(239, 68, 68, 0.25)' : 'none',
                                        }}
                                    >
                                        <span className="text-[11px] sm:text-xs font-bold text-white truncate w-full">
                                            {bp.label}
                                        </span>
                                        <span className="text-xs sm:text-sm font-black text-white/90">
                                            {bp.weight} {unit}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Collars Toggle Card */}
                        <div
                            onClick={() => setIncludeCollars(!includeCollars)}
                            className="chat-press flex items-center justify-between p-3.5 sm:p-4 rounded-xl mt-3.5 cursor-pointer select-none transition-all max-w-md mx-auto w-full"
                            style={{
                                background: includeCollars ? 'rgba(239, 68, 68, 0.12)' : 'rgba(10, 10, 16, 0.5)',
                                border: includeCollars ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-extrabold text-white">
                                    Competition Collars
                                </span>
                                <span className="text-xs text-zinc-400 mt-0.5">
                                    +{collarWeight} {unit} total (+2.5 {unit} / side)
                                </span>
                            </div>

                            <div
                                style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '6px',
                                    background: includeCollars ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                                    border: includeCollars ? '1px solid #ef4444' : '1.5px solid rgba(255, 255, 255, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                }}
                            >
                                {includeCollars && <Check size={14} strokeWidth={3.5} />}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* LOAD MODE CONTROLS: Olympic Plate Rack */
                <div className="w-full flex flex-col gap-5">
                    {/* Card 1: Visual Olympic Plate Rack */}
                    <div
                        className="w-full flex flex-col p-5 sm:p-6 rounded-2xl"
                        style={{
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex flex-col items-center text-center mb-4">
                            <h4 className="text-sm sm:text-base font-extrabold text-white">
                                Olympic Plate Rack
                            </h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Adjust plates on sleeve with + / -
                            </p>
                            <button
                                type="button"
                                onClick={clearInventory}
                                className="chat-press flex items-center gap-1.5 text-xs font-extrabold text-red-400 hover:text-red-300 py-1.5 px-3.5 rounded-lg bg-red-500/10 border border-red-500/20 cursor-pointer mt-2.5"
                            >
                                <RotateCcw size={13} />
                                Clear All Plates
                            </button>
                        </div>

                        {/* Visual Plate Tiles Grid (2 cols on mobile, 3 on sm, 4 on md+) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                            {activeDenominations.map((denom) => {
                                const spec = unit === 'kg' ? KG_PLATE_SPECS[denom] : LB_PLATE_SPECS[denom];
                                const count = inventoryCounts[denom] || 0;

                                return (
                                    <div
                                        key={denom}
                                        className="relative flex flex-col justify-between p-3.5 rounded-2xl select-none transition-all group overflow-hidden"
                                        style={{
                                            background: count > 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(10, 10, 16, 0.55)',
                                            border: count > 0 ? `1.5px solid ${spec?.color || '#ef4444'}` : '1px solid rgba(255, 255, 255, 0.08)',
                                            boxShadow: count > 0 ? `0 4px 18px ${spec?.color}25, inset 0 1px 0 rgba(255, 255, 255, 0.1)` : 'none',
                                            minHeight: '144px',
                                        }}
                                    >
                                        {/* Top Accent Color Bar */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-1.5"
                                            style={{ background: spec?.color || '#ef4444' }}
                                        />

                                        {/* Header: Color dot & Count Badge (Centered) */}
                                        <div className="flex items-center justify-center gap-2 w-full pt-1">
                                            <div
                                                style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: spec?.color,
                                                    boxShadow: `0 0 6px ${spec?.color}`,
                                                }}
                                            />
                                            <span
                                                className="text-[11px] font-black px-2.5 py-0.5 rounded-full"
                                                style={{
                                                    background: count > 0 ? spec?.color : 'rgba(255, 255, 255, 0.08)',
                                                    color: count > 0 ? spec?.textColor || '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                                                }}
                                            >
                                                {count > 0 ? `${count} / side` : '0'}
                                            </span>
                                        </div>

                                        {/* Plate Weight (Centered) */}
                                        <div className="my-2 text-center">
                                            <span className="text-2xl sm:text-3xl font-black text-white leading-none block">
                                                {denom}
                                            </span>
                                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mt-1">
                                                {unit} plate
                                            </span>
                                        </div>

                                        {/* Stepper Buttons - Roomy, No accidental touches! */}
                                        <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.08]">
                                            <button
                                                type="button"
                                                onClick={() => changeInventory(denom, -1)}
                                                disabled={count === 0}
                                                className="chat-press flex-1 flex items-center justify-center h-10 rounded-xl transition-all"
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    color: count > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
                                                    cursor: count > 0 ? 'pointer' : 'default',
                                                }}
                                                aria-label={`Remove one ${denom} ${unit} plate`}
                                            >
                                                <Minus size={15} strokeWidth={2.5} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => changeInventory(denom, 1)}
                                                className="chat-press flex-1 flex items-center justify-center h-10 rounded-xl cursor-pointer transition-all"
                                                style={{
                                                    background: count > 0 ? spec?.color : 'rgba(255, 255, 255, 0.12)',
                                                    border: count > 0 ? `1px solid ${spec?.color}` : '1px solid rgba(255, 255, 255, 0.15)',
                                                    color: count > 0 ? spec?.textColor || '#ffffff' : '#ffffff',
                                                    boxShadow: count > 0 ? `0 2px 10px ${spec?.color}40` : 'none',
                                                }}
                                                aria-label={`Add one ${denom} ${unit} plate`}
                                            >
                                                <Plus size={15} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card 2: Equipment & Units */}
                    <div
                        className="w-full flex flex-col p-5 sm:p-6 rounded-2xl"
                        style={{
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto w-full">
                            {/* Units */}
                            <div className="flex flex-col items-center">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2 text-center">
                                    Units
                                </label>
                                <div
                                    className="flex items-center p-1 rounded-xl w-full"
                                    style={{
                                        height: '46px',
                                        background: 'rgba(10, 10, 16, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleUnitSwitch('kg')}
                                        className="chat-press flex-1 h-full rounded-lg font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center"
                                        style={{
                                            background: unit === 'kg' ? '#ffffff' : 'transparent',
                                            color: unit === 'kg' ? '#09090b' : 'rgba(255, 255, 255, 0.65)',
                                            boxShadow: unit === 'kg' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
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
                                            boxShadow: unit === 'lb' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                                        }}
                                    >
                                        lb
                                    </button>
                                </div>
                            </div>

                            {/* Collars Toggle */}
                            <div className="flex flex-col items-center">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2 text-center">
                                    Collars
                                </label>
                                <div
                                    onClick={() => setIncludeCollars(!includeCollars)}
                                    className="chat-press flex items-center justify-between px-4 rounded-xl cursor-pointer select-none transition-all w-full"
                                    style={{
                                        height: '46px',
                                        background: includeCollars ? 'rgba(239, 68, 68, 0.15)' : 'rgba(10, 10, 16, 0.5)',
                                        border: includeCollars ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                    }}
                                >
                                    <span className="text-xs font-bold text-white">
                                        +{collarWeight} {unit} Collars
                                    </span>
                                    <div
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '5px',
                                            background: includeCollars ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                                            border: includeCollars ? '1px solid #ef4444' : '1.5px solid rgba(255, 255, 255, 0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                        }}
                                    >
                                        {includeCollars && <Check size={13} strokeWidth={3.5} />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Barbell Weight */}
                        <div className="mt-5 pt-4 border-t border-white/[0.06] max-w-md mx-auto w-full flex flex-col items-center">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2.5 text-center">
                                Barbell Weight
                            </label>
                            <div className="grid grid-cols-3 gap-2 w-full">
                                {barPresets.map((bp) => {
                                    const isSelected = barWeight === bp.weight;
                                    return (
                                        <button
                                            key={bp.weight}
                                            type="button"
                                            onClick={() => setBarWeight(bp.weight)}
                                            className="chat-press flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-xl transition-all cursor-pointer text-center min-h-[56px]"
                                            style={{
                                                background: isSelected ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.12) 100%)' : 'rgba(10, 10, 16, 0.55)',
                                                border: isSelected ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                                            }}
                                        >
                                            <span className="text-[11px] sm:text-xs font-bold text-white truncate w-full">
                                                {bp.label}
                                            </span>
                                            <span className="text-xs sm:text-sm font-black text-white/90">
                                                {bp.weight} {unit}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

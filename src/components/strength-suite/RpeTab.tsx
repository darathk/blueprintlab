'use client';

import React, { useState, useMemo } from 'react';
import { calculateTargetWeightFromRpe, estimate1RMFromRpe } from '@/lib/calculators';
import { ArrowRight, Target, Sparkles, Scale } from 'lucide-react';

interface RpeTabProps {
    onSendToBarbell?: (weight: number, unit: 'kg' | 'lb') => void;
}

const REPS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];

export default function RpeTab({ onSendToBarbell }: RpeTabProps) {
    const [mode, setMode] = useState<'rpe' | 'rir'>('rpe');
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

    // Last Set
    const [lastWeightStr, setLastWeightStr] = useState<string>('225');
    const [lastReps, setLastReps] = useState<number>(5);
    const [lastRpeVal, setLastRpeVal] = useState<number>(8); // In RPE terms

    // Next Set
    const [targetReps, setTargetReps] = useState<number>(3);
    const [targetRpeVal, setTargetRpeVal] = useState<number>(9); // In RPE terms

    const lastWeight = parseFloat(lastWeightStr) || 0;

    // Convert between RPE and RIR for display
    // RPE 10 = 0 RIR, RPE 9 = 1 RIR, RPE 8 = 2 RIR, etc. (RIR = 10 - RPE, RPE = 10 - RIR)
    const toRir = (rpe: number) => Math.max(0, Math.round((10 - rpe) * 2) / 2);
    const fromRir = (rir: number) => Math.max(1, Math.min(10, Math.round((10 - rir) * 2) / 2));

    // Results computation
    const calculation = useMemo(() => {
        if (lastWeight <= 0 || !lastReps || !lastRpeVal || !targetReps || !targetRpeVal) {
            return { e1rm: 0, targetWeight: 0, targetPct: 0, delta: 0, deltaPct: 0 };
        }
        const res = calculateTargetWeightFromRpe(lastWeight, lastReps, lastRpeVal, targetReps, targetRpeVal);
        const delta = res.targetWeight - lastWeight;
        const deltaPct = lastWeight > 0 ? (delta / lastWeight) * 100 : 0;
        return {
            ...res,
            delta: parseFloat(delta.toFixed(1)),
            deltaPct: parseFloat(deltaPct.toFixed(1)),
        };
    }, [lastWeight, lastReps, lastRpeVal, targetReps, targetRpeVal]);

    const roundIncrement = unit === 'kg' ? 2.5 : 5;
    const roundedTarget = Math.round(calculation.targetWeight / roundIncrement) * roundIncrement;

    return (
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto">
            {/* Header exact to Screenshots 3-7 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    <span style={{ color: '#ef4444' }}>RPE</span> Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                    Calculate target weights based on Rate of Perceived Exertion
                </p>

                {/* Submode pill toggle: [ RPE | RIR ] */}
                <div
                    className="mt-4 flex p-1"
                    style={{
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setMode('rpe')}
                        className="chat-press"
                        style={{
                            padding: '6px 20px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            border: mode === 'rpe' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                            background: mode === 'rpe' ? '#ef4444' : 'transparent',
                            color: mode === 'rpe' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.15s ease',
                            cursor: 'pointer',
                        }}
                    >
                        RPE
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('rir')}
                        className="chat-press"
                        style={{
                            padding: '6px 20px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            border: mode === 'rir' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                            background: mode === 'rir' ? '#ef4444' : 'transparent',
                            color: mode === 'rir' ? '#ffffff' : 'var(--secondary-foreground)',
                            transition: 'all 0.15s ease',
                            cursor: 'pointer',
                        }}
                    >
                        RIR
                    </button>
                </div>
            </div>

            {/* Input Form Card exact to Screenshot 3 */}
            <div
                className="w-full glass-panel flex flex-col gap-8"
                style={{
                    padding: '32px',
                    borderRadius: '24px',
                    background: 'rgba(16, 16, 24, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* 1. LAST SET SECTION */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                            Last Set
                        </h4>
                        {/* Unit toggle */}
                        <div
                            className="flex p-0.5"
                            style={{
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setUnit('lbs')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    background: unit === 'lbs' ? '#ffffff' : 'transparent',
                                    color: unit === 'lbs' ? '#0a0a0a' : 'var(--secondary-foreground)',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                lbs
                            </button>
                            <button
                                type="button"
                                onClick={() => setUnit('kg')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    background: unit === 'kg' ? '#ffffff' : 'transparent',
                                    color: unit === 'kg' ? '#0a0a0a' : 'var(--secondary-foreground)',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                kg
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Weight */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                Weight
                            </label>
                            <div
                                className="flex items-center px-4"
                                style={{
                                    height: '50px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                <input
                                    type="number"
                                    step="any"
                                    value={lastWeightStr}
                                    onChange={(e) => setLastWeightStr(e.target.value)}
                                    placeholder="225"
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
                                <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 700 }}>
                                    {unit}
                                </span>
                            </div>
                        </div>

                        {/* Reps */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                Reps
                            </label>
                            <select
                                value={lastReps}
                                onChange={(e) => setLastReps(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    padding: '0 16px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {REPS_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* RPE or RIR */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                {mode === 'rpe' ? 'RPE' : 'RIR'}
                            </label>
                            <select
                                value={mode === 'rpe' ? lastRpeVal : toRir(lastRpeVal)}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setLastRpeVal(mode === 'rpe' ? val : fromRir(val));
                                }}
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    padding: '0 16px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {RPE_OPTIONS.map((rpe) => {
                                    const displayVal = mode === 'rpe' ? rpe : toRir(rpe);
                                    return (
                                        <option key={rpe} value={displayVal}>
                                            {displayVal}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* e1RM feedback banner */}
                    {calculation.e1rm > 0 && (
                        <div
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                            style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-400" />
                                <span style={{ fontSize: '0.8125rem', color: 'var(--secondary-foreground)' }}>
                                    Estimated 1RM (e1RM):
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                                    {calculation.e1rm} {unit}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)' }}>
                                *RTS Formula Standard
                            </span>
                        </div>
                    )}
                </div>

                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

                {/* 2. NEXT SET SECTION */}
                <div className="flex flex-col gap-4">
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                        Next Set
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Target Reps */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                Target Reps
                            </label>
                            <select
                                value={targetReps}
                                onChange={(e) => setTargetReps(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    padding: '0 16px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {REPS_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Target RPE or RIR */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                                Target {mode === 'rpe' ? 'RPE' : 'RIR'}
                            </label>
                            <select
                                value={mode === 'rpe' ? targetRpeVal : toRir(targetRpeVal)}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setTargetRpeVal(mode === 'rpe' ? val : fromRir(val));
                                }}
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    padding: '0 16px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {RPE_OPTIONS.map((rpe) => {
                                    const displayVal = mode === 'rpe' ? rpe : toRir(rpe);
                                    return (
                                        <option key={rpe} value={displayVal}>
                                            {displayVal}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 3. CALCULATION RESULT CARD */}
                {calculation.targetWeight > 0 && (
                    <div
                        className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(16, 16, 24, 0.9) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <div className="flex flex-col">
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Recommended Target Weight
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span style={{ fontSize: '2.75rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                    {calculation.targetWeight}
                                </span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>
                                    {unit}
                                </span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginLeft: '6px' }}>
                                    (Nearest {roundedTarget} {unit})
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>
                                    {calculation.targetPct}% of 1RM
                                </span>
                                <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                                <span
                                    style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: calculation.delta >= 0 ? '#10b981' : '#ef4444',
                                    }}
                                >
                                    {calculation.delta >= 0 ? `+${calculation.delta}` : calculation.delta} {unit} ({calculation.deltaPct > 0 ? `+${calculation.deltaPct}` : calculation.deltaPct}%)
                                </span>
                            </div>
                        </div>

                        {onSendToBarbell && (
                            <button
                                type="button"
                                onClick={() => onSendToBarbell(roundedTarget, unit === 'lbs' ? 'lb' : 'kg')}
                                className="chat-press flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer"
                                style={{
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Scale size={16} />
                                <span>Load onto Barbell</span>
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

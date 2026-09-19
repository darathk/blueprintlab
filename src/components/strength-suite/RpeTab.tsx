'use client';

import React, { useState, useMemo } from 'react';
import { calculateTargetWeightFromRpe } from '@/lib/calculators';
import StrengthSelect from './StrengthSelect';
import { ArrowRight, Scale, Sparkles } from 'lucide-react';

interface RpeTabProps {
    onSendToBarbell?: (weight: number, unit: 'kg' | 'lb') => void;
}

const REPS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => ({ value: r, label: String(r) }));
const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((r) => ({
    value: r,
    label: String(r),
}));

export default function RpeTab({ onSendToBarbell }: RpeTabProps) {
    const [mode, setMode] = useState<'rpe' | 'rir'>('rpe');
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

    // Last Set
    const [lastWeightStr, setLastWeightStr] = useState<string>('225');
    const [lastReps, setLastReps] = useState<number>(5);
    const [lastRpeVal, setLastRpeVal] = useState<number>(8);

    // Next Set
    const [targetReps, setTargetReps] = useState<number>(3);
    const [targetRpeVal, setTargetRpeVal] = useState<number>(9);

    const lastWeight = parseFloat(lastWeightStr) || 0;

    // Convert between RPE and RIR for display
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
        <div className="w-full flex flex-col items-center gap-6 max-w-3xl mx-auto px-3 sm:px-4 pb-44 md:pb-24">
            {/* Header exact to Screenshots 3-7 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    <span style={{ color: '#ef4444', textDecoration: 'underline', textDecorationColor: '#ef4444' }}>
                        RPE
                    </span>{' '}
                    Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                    Calculate target weights based on Rate of Perceived Exertion
                </p>

                {/* Submode pill toggle: [ RPE | RIR ] and Unit [ lbs | kg ] */}
                <div className="mt-4 flex items-center gap-3">
                    <div
                        style={{
                            display: 'inline-flex',
                            padding: '4px',
                            borderRadius: '9999px',
                            background: 'rgba(10, 10, 16, 0.6)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.05)',
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
                                border: mode === 'rpe' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                                background: mode === 'rpe' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
                                color: mode === 'rpe' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                boxShadow: mode === 'rpe' ? '0 0 14px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
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
                                border: mode === 'rir' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                                background: mode === 'rir' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
                                color: mode === 'rir' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                boxShadow: mode === 'rir' ? '0 0 14px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            RIR
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'inline-flex',
                            padding: '4px',
                            borderRadius: '9999px',
                            background: 'rgba(10, 10, 16, 0.6)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.05)',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setUnit('lbs')}
                            className="chat-press"
                            style={{
                                padding: '6px 14px',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                background: unit === 'lbs' ? '#ffffff' : 'transparent',
                                color: unit === 'lbs' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
                                boxShadow: unit === 'lbs' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            lbs
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnit('kg')}
                            className="chat-press"
                            style={{
                                padding: '6px 14px',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                background: unit === 'kg' ? '#ffffff' : 'transparent',
                                color: unit === 'kg' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
                                boxShadow: unit === 'kg' ? '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : 'none',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            kg
                        </button>
                    </div>
                </div>
            </div>

            {/* Input Form Card exact to Screenshot 3 */}
            <div
                className="w-full flex flex-col gap-6 rounded-3xl"
                style={{
                    padding: '1.75rem 1.25rem',
                    background: 'rgba(20, 20, 30, 0.65)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
            >
                {/* 1. LAST SET SECTION */}
                <div className="flex flex-col">
                    <h4
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: '16px',
                        }}
                    >
                        Last Set
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Weight */}
                        <div className="flex flex-col">
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginBottom: '8px',
                                }}
                            >
                                Weight
                            </label>
                            <div
                                className="flex items-center justify-center px-4"
                                style={{
                                    height: '50px',
                                    borderRadius: '12px',
                                    background: 'rgba(10, 10, 16, 0.55)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
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
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Reps */}
                        <div className="flex flex-col">
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginBottom: '8px',
                                }}
                            >
                                Reps
                            </label>
                            <StrengthSelect
                                value={lastReps}
                                onChange={(val) => setLastReps(Number(val))}
                                options={REPS_OPTIONS}
                            />
                        </div>

                        {/* RPE or RIR */}
                        <div className="flex flex-col">
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginBottom: '8px',
                                }}
                            >
                                {mode === 'rpe' ? 'RPE' : 'RIR'}
                            </label>
                            <StrengthSelect
                                value={mode === 'rpe' ? lastRpeVal : toRir(lastRpeVal)}
                                onChange={(val) => {
                                    const num = Number(val);
                                    setLastRpeVal(mode === 'rpe' ? num : fromRir(num));
                                }}
                                options={RPE_OPTIONS.map((opt) => {
                                    const displayVal = mode === 'rpe' ? opt.value : toRir(Number(opt.value));
                                    return { value: displayVal, label: String(displayVal) };
                                })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. NEXT SET SECTION */}
                <div className="flex flex-col mt-2">
                    <h4
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: '16px',
                        }}
                    >
                        Next Set
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto w-full">
                        {/* Target Reps */}
                        <div className="flex flex-col">
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginBottom: '8px',
                                }}
                            >
                                Target Reps
                            </label>
                            <StrengthSelect
                                value={targetReps}
                                onChange={(val) => setTargetReps(Number(val))}
                                options={REPS_OPTIONS}
                            />
                        </div>

                        {/* Target RPE or RIR */}
                        <div className="flex flex-col">
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                    marginBottom: '8px',
                                }}
                            >
                                Target {mode === 'rpe' ? 'RPE' : 'RIR'}
                            </label>
                            <StrengthSelect
                                value={mode === 'rpe' ? targetRpeVal : toRir(targetRpeVal)}
                                onChange={(val) => {
                                    const num = Number(val);
                                    setTargetRpeVal(mode === 'rpe' ? num : fromRir(num));
                                }}
                                options={RPE_OPTIONS.map((opt) => {
                                    const displayVal = mode === 'rpe' ? opt.value : toRir(Number(opt.value));
                                    return { value: displayVal, label: String(displayVal) };
                                })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. CALCULATION RESULT CARD */}
            {calculation.targetWeight > 0 && (
                <div
                    className="w-full flex flex-col sm:flex-row items-center justify-between gap-5 rounded-3xl relative overflow-hidden"
                    style={{
                        padding: '1.75rem 1.5rem',
                        background: 'rgba(20, 20, 30, 0.65)',
                        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(239, 68, 68, 0.08) 0%, transparent 60%)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderLeft: '4px solid #ef4444',
                        boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 24px rgba(239, 68, 68, 0.12)',
                    }}
                >
                    <div className="flex flex-col text-center sm:text-left">
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', textShadow: '0 0 10px rgba(239, 68, 68, 0.3)', marginBottom: '8px' }}>
                            Recommended Target Weight
                        </span>
                        <div className="flex items-baseline justify-center sm:justify-start gap-2.5 my-1 flex-wrap">
                            <span
                                className="text-4xl sm:text-5xl font-black text-white leading-none tracking-tight"
                                style={{
                                    textShadow: '0 0 24px rgba(239, 68, 68, 0.3)',
                                }}
                            >
                                {calculation.targetWeight}
                            </span>
                            <span
                                className="text-xl sm:text-2xl font-bold text-red-500"
                                style={{ textShadow: '0 0 16px rgba(239, 68, 68, 0.4)' }}
                            >
                                {unit}
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-white/60 ml-1 self-baseline">
                                (Nearest {roundedTarget} {unit})
                            </span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2 mt-4 pt-1">
                            <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white/80"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                {calculation.targetPct}% of 1RM
                            </span>
                            <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{
                                    color: calculation.delta >= 0 ? '#10b981' : '#ef4444',
                                    background: calculation.delta >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    border: calculation.delta >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                            >
                                {calculation.delta >= 0 ? `+${calculation.delta}` : calculation.delta} {unit} ({calculation.deltaPct > 0 ? `+${calculation.deltaPct}` : calculation.deltaPct}%)
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-3">
                        {calculation.e1rm > 0 && (
                            <div
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-zinc-300"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                            >
                                <Sparkles size={13} className="text-amber-400" />
                                <span>e1RM: <strong className="text-white">{calculation.e1rm} {unit}</strong></span>
                            </div>
                        )}
                        {onSendToBarbell && (
                            <button
                                type="button"
                                onClick={() => onSendToBarbell(roundedTarget, unit === 'lbs' ? 'lb' : 'kg')}
                                className="chat-press flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer"
                                style={{
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: '#ffffff',
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                    boxShadow: '0 0 18px rgba(239, 68, 68, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Scale size={16} />
                                <span>Load onto Barbell</span>
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

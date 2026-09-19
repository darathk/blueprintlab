'use client';

import React, { useState, useMemo } from 'react';
import { calculate1RM, OneRepMaxFormula } from '@/lib/calculators';
import StrengthSelect from './StrengthSelect';
import { BarChart3, Layers } from 'lucide-react';

const FORMULAS: { id: OneRepMaxFormula; label: string; description: string }[] = [
    { id: 'brzycki', label: 'Brzycki', description: 'Collegiate & strength sports standard (1-10 reps)' },
    { id: 'epley', label: 'Epley', description: 'Classic powerlifting formula' },
    { id: 'lander', label: 'Lander', description: 'Accurate for moderate rep sets (6-10 reps)' },
    { id: 'lombardi', label: 'Lombardi', description: 'Exponential curve formula' },
    { id: 'mayhew', label: 'Mayhew et al.', description: 'Validated on college athletes' },
    { id: 'oconner', label: 'O’Conner', description: 'Linear progression model' },
    { id: 'wathan', label: 'Wathan', description: 'Exponential curve validated on compound lifts' },
];

const PERCENTAGES = [
    { pct: 100, reps: '1 rep' },
    { pct: 95, reps: '2 reps' },
    { pct: 90, reps: '4 reps' },
    { pct: 85, reps: '6 reps' },
    { pct: 80, reps: '8 reps' },
    { pct: 75, reps: '10 reps' },
    { pct: 70, reps: '12 reps' },
    { pct: 65, reps: '15 reps' },
    { pct: 60, reps: '18 reps' },
    { pct: 55, reps: '20+ reps' },
    { pct: 50, reps: '25+ reps' },
];

export default function MaxTab() {
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
    const [weightStr, setWeightStr] = useState<string>('315');
    const [reps, setReps] = useState<number>(5);
    const [formula, setFormula] = useState<OneRepMaxFormula>('brzycki');

    const weight = parseFloat(weightStr) || 0;

    // Active formula 1RM
    const oneRepMax = useMemo(() => {
        if (weight <= 0 || reps <= 0) return 0;
        return calculate1RM(weight, reps, formula);
    }, [weight, reps, formula]);

    // All formulas comparison
    const allFormulasComparison = useMemo(() => {
        if (weight <= 0 || reps <= 0) return [];
        return FORMULAS.map((f) => ({
            ...f,
            max: calculate1RM(weight, reps, f.id),
        }));
    }, [weight, reps]);

    return (
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto px-3 sm:px-4 pb-44 md:pb-24">
            {/* Header exact to Screenshots 13-15 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    1RM Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                    Calculate your one-rep maximum using scientifically validated formulas
                </p>

                {/* Unit Switcher */}
                <div
                    className="mt-4 flex p-1 rounded-full"
                    style={{
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
                            padding: '6px 18px',
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
                            padding: '6px 18px',
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

            {/* Input Card exact to Screenshot 13 */}
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
                <h4
                    style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        textAlign: 'center',
                        marginBottom: '4px',
                    }}
                >
                    Your Lift
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
                                value={weightStr}
                                onChange={(e) => setWeightStr(e.target.value)}
                                placeholder="315"
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
                            value={reps}
                            onChange={(val) => setReps(Number(val))}
                            options={Array.from({ length: 15 }, (_, i) => ({
                                value: i + 1,
                                label: String(i + 1),
                            }))}
                        />
                    </div>

                    {/* Formula */}
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
                            Formula
                        </label>
                        <StrengthSelect
                            value={formula}
                            onChange={(val) => setFormula(val as OneRepMaxFormula)}
                            options={FORMULAS.map((f) => ({
                                value: f.id,
                                label: f.label,
                            }))}
                        />
                    </div>
                </div>
            </div>

            {/* RESULTS SECTION */}
            {oneRepMax > 0 && (
                <div className="w-full flex flex-col gap-6">
                    {/* Hero 1RM Display */}
                    <div
                        className="flex flex-col items-center justify-center rounded-3xl text-center relative overflow-hidden"
                        style={{
                            padding: '2rem 1.5rem',
                            background: 'rgba(20, 20, 30, 0.65)',
                            backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(239, 68, 68, 0.12) 0%, transparent 70%)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderTop: '4px solid #ef4444',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 24px rgba(239, 68, 68, 0.15)',
                        }}
                    >
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '0 0 10px rgba(239, 68, 68, 0.3)', marginBottom: '8px' }}>
                            Estimated 1-Rep Max ({FORMULAS.find((f) => f.id === formula)?.label})
                        </span>
                        <div className="flex items-baseline justify-center gap-2 my-2">
                            <span
                                style={{
                                    fontSize: '4rem',
                                    fontWeight: 900,
                                    color: '#ef4444',
                                    lineHeight: 1,
                                    letterSpacing: '-0.02em',
                                    textShadow: '0 0 32px rgba(239, 68, 68, 0.4), 0 0 60px rgba(239, 68, 68, 0.15)',
                                }}
                            >
                                {oneRepMax}
                            </span>
                            <span
                                style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 800,
                                    color: '#ef4444',
                                    textShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
                                }}
                            >
                                {unit}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '12px' }}>
                            Based on {weight} {unit} × {reps} {reps === 1 ? 'rep' : 'reps'}
                        </span>
                    </div>

                    {/* All Formula Comparison Grouped Cards */}
                    <div
                        className="rounded-3xl"
                        style={{
                            padding: '1.75rem 1.25rem',
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Layers size={16} className="text-cyan-400" />
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                                Formula Comparison
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                            {allFormulasComparison.map((f) => {
                                const isActive = f.id === formula;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setFormula(f.id)}
                                        className="chat-press flex flex-col justify-between rounded-xl transition-all text-left cursor-pointer"
                                        style={{
                                            padding: '1.15rem 1.15rem',
                                            minHeight: '94px',
                                            background: isActive ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.18) 100%)' : 'rgba(10, 10, 16, 0.55)',
                                            backdropFilter: 'blur(8px)',
                                            border: isActive ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                                            boxShadow: isActive ? '0 0 18px rgba(239, 68, 68, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                                        }}
                                    >
                                        <span
                                            className="text-xs font-semibold uppercase tracking-wider truncate block"
                                            style={{ color: isActive ? '#ef4444' : '#a1a1aa' }}
                                        >
                                            {f.label}
                                        </span>
                                        <div className="flex items-baseline justify-between mt-1.5">
                                            <span className="text-xl sm:text-2xl font-black text-white leading-tight">
                                                {f.max}
                                            </span>
                                            <span className="text-xs font-bold text-white/50">
                                                {unit}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Percentage Breakdown Table */}
                    <div
                        className="rounded-3xl overflow-hidden"
                        style={{
                            padding: '1.75rem 1.25rem',
                            background: 'rgba(20, 20, 30, 0.65)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.09)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={16} className="text-indigo-400" />
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                                % of 1RM Training Weights
                            </h4>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                                <thead>
                                    <tr className="text-xs uppercase tracking-wider text-zinc-400">
                                        <th className="px-5 py-3 font-semibold">Percentage</th>
                                        <th className="px-5 py-3 font-semibold">Weight ({unit})</th>
                                        <th className="px-5 py-3 font-semibold">Est. Reps</th>
                                        <th className="px-5 py-3 font-semibold">Zone</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PERCENTAGES.map(({ pct, reps: repText }) => {
                                        const w = Math.round((oneRepMax * (pct / 100)) * 2) / 2;
                                        let zone = 'Endurance';
                                        let zoneColor = '#94a3b8';
                                        let zoneBg = 'rgba(148, 163, 184, 0.1)';
                                        let zoneBorder = 'rgba(148, 163, 184, 0.2)';
                                        if (pct >= 90) {
                                            zone = 'Maximal Strength';
                                            zoneColor = '#ef4444';
                                            zoneBg = 'rgba(239, 68, 68, 0.12)';
                                            zoneBorder = 'rgba(239, 68, 68, 0.25)';
                                        } else if (pct >= 80) {
                                            zone = 'Heavy / Strength';
                                            zoneColor = '#f59e0b';
                                            zoneBg = 'rgba(245, 158, 11, 0.12)';
                                            zoneBorder = 'rgba(245, 158, 11, 0.25)';
                                        } else if (pct >= 70) {
                                            zone = 'Hypertrophy';
                                            zoneColor = '#a855f7';
                                            zoneBg = 'rgba(168, 85, 247, 0.12)';
                                            zoneBorder = 'rgba(168, 85, 247, 0.25)';
                                        } else if (pct >= 60) {
                                            zone = 'Speed & Power';
                                            zoneColor = '#38bdf8';
                                            zoneBg = 'rgba(56, 189, 248, 0.12)';
                                            zoneBorder = 'rgba(56, 189, 248, 0.25)';
                                        }

                                        return (
                                            <tr
                                                key={pct}
                                                className="transition-colors rounded-xl overflow-hidden"
                                                style={{
                                                    background: pct === 100 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                                    border: pct === 100 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255, 255, 255, 0.04)',
                                                }}
                                            >
                                                <td className="px-5 py-3.5 rounded-l-xl">
                                                    <span className={`text-sm font-extrabold ${pct === 100 ? 'text-red-400' : 'text-white'}`}>
                                                        {pct}%
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className="text-base sm:text-lg font-black text-white">
                                                        {w} <span className="text-xs font-bold text-white/50">{unit}</span>
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs sm:text-sm font-semibold text-zinc-300">
                                                    {repText}
                                                </td>
                                                <td className="px-5 py-3.5 rounded-r-xl">
                                                    <span
                                                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                                        style={{
                                                            color: zoneColor,
                                                            background: zoneBg,
                                                            border: `1px solid ${zoneBorder}`,
                                                        }}
                                                    >
                                                        {zone}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

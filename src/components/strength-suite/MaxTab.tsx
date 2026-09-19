'use client';

import React, { useState, useMemo } from 'react';
import { calculate1RM, OneRepMaxFormula } from '@/lib/calculators';
import { Trophy, BarChart3, ChevronRight, Layers } from 'lucide-react';

const FORMULAS: { id: OneRepMaxFormula; label: string; description: string }[] = [
    { id: 'brzycki', label: 'Brzycki', description: 'Most accurate for 1-10 reps (widely used in collegiate & strength sports)' },
    { id: 'epley', label: 'Epley', description: 'Classic powerlifting standard formula' },
    { id: 'lander', label: 'Lander', description: 'Accurate for moderate rep sets (6-10 reps)' },
    { id: 'lombardi', label: 'Lombardi', description: 'Exponential curve formula' },
    { id: 'mayhew', label: 'Mayhew et al.', description: 'Validated on college football players' },
    { id: 'oconner', label: 'O’Conner', description: 'Linear progression model' },
    { id: 'wathan', label: 'Wathan', description: 'Exponential curve validated on heavy compound lifts' },
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
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto">
            {/* Header exact to Screenshots 13-15 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    1RM Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                    Calculate your one-rep maximum using scientifically validated formulas
                </p>
            </div>

            {/* Input Card exact to Screenshot 13 */}
            <div
                className="w-full glass-panel flex flex-col gap-6"
                style={{
                    padding: '32px',
                    borderRadius: '24px',
                    background: 'rgba(16, 16, 24, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <div className="flex items-center justify-between">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        Your Lift
                    </h4>
                    {/* Unit Switcher */}
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
                                padding: '4px 12px',
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
                                padding: '4px 12px',
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
                                value={weightStr}
                                onChange={(e) => setWeightStr(e.target.value)}
                                placeholder="315"
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontSize: '1.1rem',
                                    fontWeight: 800,
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
                            value={reps}
                            onChange={(e) => setReps(Number(e.target.value))}
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
                            {Array.from({ length: 15 }, (_, i) => i + 1).map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Formula */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px' }}>
                            Formula
                        </label>
                        <select
                            value={formula}
                            onChange={(e) => setFormula(e.target.value as OneRepMaxFormula)}
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
                            {FORMULAS.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* RESULTS SECTION */}
            {oneRepMax > 0 && (
                <div className="w-full flex flex-col gap-6">
                    {/* Hero 1RM Display */}
                    <div
                        className="flex flex-col items-center justify-center p-8 rounded-2xl text-center relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(16, 16, 24, 0.9) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Estimated 1-Rep Max ({FORMULAS.find((f) => f.id === formula)?.label})
                        </span>
                        <div className="flex items-baseline justify-center gap-2 mt-2">
                            <span style={{ fontSize: '3.75rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.03em' }}>
                                {oneRepMax}
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>
                                {unit}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginTop: '8px' }}>
                            Based on {weight} {unit} × {reps} {reps === 1 ? 'rep' : 'reps'}
                        </span>
                    </div>

                    {/* All Formula Comparison Pills */}
                    <div
                        className="glass-panel p-5 rounded-2xl"
                        style={{
                            background: 'rgba(16, 16, 24, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Layers size={16} className="text-cyan-400" />
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                                Formula Comparison
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                            {allFormulasComparison.map((f) => {
                                const isActive = f.id === formula;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setFormula(f.id)}
                                        className="chat-press flex flex-col items-center p-3 rounded-xl transition-all text-center cursor-pointer"
                                        style={{
                                            background: isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                            border: isActive ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.06)',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isActive ? '#f87171' : 'var(--secondary-foreground)' }}>
                                            {f.label}
                                        </span>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                                            {f.max}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Percentage Breakdown Table */}
                    <div
                        className="glass-panel p-6 rounded-2xl overflow-hidden"
                        style={{
                            background: 'rgba(16, 16, 24, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={16} className="text-indigo-400" />
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                                % of 1RM Training Weights
                            </h4>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                                <thead>
                                    <tr style={{ color: 'var(--secondary-foreground)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '8px 16px' }}>Percentage</th>
                                        <th style={{ padding: '8px 16px' }}>Weight ({unit})</th>
                                        <th style={{ padding: '8px 16px' }}>Est. Reps</th>
                                        <th style={{ padding: '8px 16px' }}>Zone</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PERCENTAGES.map(({ pct, reps: repText }) => {
                                        const w = Math.round((oneRepMax * (pct / 100)) * 2) / 2;
                                        let zone = 'Endurance';
                                        let zoneColor = '#94a3b8';
                                        if (pct >= 90) { zone = 'Maximal Strength'; zoneColor = '#ef4444'; }
                                        else if (pct >= 80) { zone = 'Heavy / Strength'; zoneColor = '#f59e0b'; }
                                        else if (pct >= 70) { zone = 'Hypertrophy'; zoneColor = '#a855f7'; }
                                        else if (pct >= 60) { zone = 'Speed & Power'; zoneColor = '#38bdf8'; }

                                        return (
                                            <tr
                                                key={pct}
                                                style={{
                                                    background: pct === 100 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                                }}
                                            >
                                                <td style={{ padding: '10px 16px', fontWeight: 800, color: pct === 100 ? '#ef4444' : '#ffffff', fontSize: '0.9rem' }}>
                                                    {pct}%
                                                </td>
                                                <td style={{ padding: '10px 16px', fontWeight: 900, color: '#ffffff', fontSize: '1rem' }}>
                                                    {w} {unit}
                                                </td>
                                                <td style={{ padding: '10px 16px', color: 'var(--secondary-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>
                                                    {repText}
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: zoneColor }}>
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

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
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto">
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
                    className="mt-4 flex p-1"
                    style={{
                        borderRadius: '9999px',
                        background: '#141418',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setUnit('lbs')}
                        className="chat-press"
                        style={{
                            padding: '6px 16px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            background: unit === 'lbs' ? '#ffffff' : 'transparent',
                            color: unit === 'lbs' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
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
                            padding: '6px 16px',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            background: unit === 'kg' ? '#ffffff' : 'transparent',
                            color: unit === 'kg' ? '#0a0a0a' : 'rgba(255, 255, 255, 0.6)',
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
                className="w-full flex flex-col gap-6"
                style={{
                    padding: '32px',
                    borderRadius: '20px',
                    background: '#1c1d22',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
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
                                height: '48px',
                                borderRadius: '12px',
                                background: '#141418',
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
                        className="flex flex-col items-center justify-center p-8 rounded-2xl text-center relative overflow-hidden"
                        style={{
                            background: '#1c1d22',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderTop: '4px solid #ef4444',
                        }}
                    >
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '8px' }}>
                            Based on {weight} {unit} × {reps} {reps === 1 ? 'rep' : 'reps'}
                        </span>
                    </div>

                    {/* All Formula Comparison Pills */}
                    <div
                        className="p-5 rounded-2xl"
                        style={{
                            background: '#1c1d22',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Layers size={16} className="text-cyan-400" />
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                                Formula Comparison
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {allFormulasComparison.map((f) => {
                                const isActive = f.id === formula;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setFormula(f.id)}
                                        className="chat-press flex flex-col items-center p-3 rounded-xl transition-all text-center cursor-pointer"
                                        style={{
                                            background: isActive ? 'rgba(239, 68, 68, 0.15)' : '#141418',
                                            border: isActive ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isActive ? '#ef4444' : 'rgba(255, 255, 255, 0.65)' }}>
                                            {f.label}
                                        </span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                                            {f.max}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Percentage Breakdown Table */}
                    <div
                        className="p-6 rounded-2xl overflow-hidden"
                        style={{
                            background: '#1c1d22',
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
                                    <tr style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                                <td style={{ padding: '10px 16px', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem', fontWeight: 600 }}>
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

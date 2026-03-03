'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { solveForRequiredTotal, calculateDots, calculateGL } from '@/lib/calculators';

type LiftTarget = 'squat' | 'bench' | 'deadlift';

export default function ReverseCalculator() {
    // Top Level Settings
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [equipped, setEquipped] = useState<'raw' | 'equipped'>('raw');
    const [events, setEvents] = useState<'sbd' | 'bench'>('sbd');
    const [unit, setUnit] = useState<'kg' | 'lb'>('lb');

    // Bio Inputs
    const [bwStr, setBwStr] = useState<string>('');
    const [totalStr, setTotalStr] = useState<string>('');
    const [ageStr, setAgeStr] = useState<string>('');

    // Target Settings
    const [formula, setFormula] = useState<string>('dots');
    const [targetScoreStr, setTargetScoreStr] = useState<string>('');

    // Lift Breakdown
    const [solveFor, setSolveFor] = useState<LiftTarget>('deadlift');
    const [squatStr, setSquatStr] = useState<string>('');
    const [benchStr, setBenchStr] = useState<string>('');
    const [deadliftStr, setDeadliftStr] = useState<string>('');
    const [showLiftBreakdown, setShowLiftBreakdown] = useState(false);

    // Derived Bodyweight in KG
    const bwKg = useMemo(() => {
        const parsed = parseFloat(bwStr);
        if (isNaN(parsed)) return 0;
        return unit === 'lb' ? parsed / 2.20462 : parsed;
    }, [bwStr, unit]);

    const targetScore = parseFloat(targetScoreStr) || 0;
    const currentEnteredTotal = parseFloat(totalStr) || 0;

    // ----- Forward Calculations for Current Info Cards -----
    const currentDots = useMemo(() => {
        if (bwKg <= 0 || currentEnteredTotal <= 0) return 0;
        const totalKg = unit === 'lb' ? currentEnteredTotal / 2.20462 : currentEnteredTotal;
        return calculateDots(totalKg, bwKg, gender === 'male');
    }, [currentEnteredTotal, bwKg, gender, unit]);

    const currentGl = useMemo(() => {
        if (bwKg <= 0 || currentEnteredTotal <= 0) return 0;
        const totalKg = unit === 'lb' ? currentEnteredTotal / 2.20462 : currentEnteredTotal;
        return calculateGL(totalKg, bwKg, gender === 'male', equipped === 'equipped', events === 'bench');
    }, [currentEnteredTotal, bwKg, gender, equipped, events, unit]);

    // ----- Calculate Required Total -----
    const reqTotalKg = useMemo(() => {
        if (targetScore <= 0 || bwKg <= 0) return 0;

        // Calculate using Bisection Solver
        return solveForRequiredTotal(
            targetScore,
            bwKg,
            gender === 'male',
            formula as 'dots' | 'gl',
            equipped === 'equipped',
            events === 'bench'
        );
    }, [targetScore, bwKg, gender, formula, equipped, events]);

    const reqTotalDisplay = useMemo(() => {
        if (reqTotalKg === 0) return 0;
        return unit === 'lb' ? reqTotalKg * 2.20462 : reqTotalKg;
    }, [reqTotalKg, unit]);

    // ----- Lift Breakdown Logic -----
    // Whenever reqTotal, squat, bench, or deadlift change, auto-calculate the 'solveFor' lift

    const sVal = parseFloat(squatStr) || 0;
    const bVal = parseFloat(benchStr) || 0;
    const dVal = parseFloat(deadliftStr) || 0;

    const currentTotalDisplay = useMemo(() => {
        let t = 0;
        if (solveFor !== 'squat') t += sVal;
        if (solveFor !== 'bench') t += bVal;
        if (solveFor !== 'deadlift') t += dVal;
        return t;
    }, [sVal, bVal, dVal, solveFor]);

    const calculatedLiftValue = useMemo(() => {
        if (reqTotalDisplay <= 0) return 0;
        const required = reqTotalDisplay - currentTotalDisplay;
        return required > 0 ? required : 0;
    }, [reqTotalDisplay, currentTotalDisplay]);

    // Format utility
    const fmt = (val: number) => val.toFixed(1).replace('.0', '');

    return (
        <div className="px-0 md:px-4 pt-8 pb-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>

            {/* Top Level Selectors - Pill Styling */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '24px', padding: '4px', width: '240px' }}>
                    <button onClick={() => setGender('male')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: gender === 'male' ? 'var(--primary)' : 'transparent', color: gender === 'male' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>Male</button>
                    <button onClick={() => setGender('female')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: gender === 'female' ? 'var(--primary)' : 'transparent', color: gender === 'female' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>Female</button>
                </div>
                <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '24px', padding: '4px', width: '240px' }}>
                    <button onClick={() => setEquipped('raw')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: equipped === 'raw' ? 'var(--primary)' : 'transparent', color: equipped === 'raw' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>Raw</button>
                    <button onClick={() => setEquipped('equipped')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: equipped === 'equipped' ? 'var(--primary)' : 'transparent', color: equipped === 'equipped' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>Equipped</button>
                </div>
                <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '24px', padding: '4px', width: '240px' }}>
                    <button onClick={() => setEvents('sbd')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: events === 'sbd' ? 'var(--primary)' : 'transparent', color: events === 'sbd' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>S/B/D</button>
                    <button onClick={() => setEvents('bench')} style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem', background: events === 'bench' ? 'var(--primary)' : 'transparent', color: events === 'bench' ? '#fff' : 'var(--foreground)', fontWeight: 700, border: 'none', borderRadius: '20px', transition: 'all 0.2s', outline: 'none', cursor: 'pointer' }}>Bench</button>
                </div>
            </div>

            {/* Static Bio Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, textAlign: 'right', fontSize: '1.05rem', width: '65px' }}>Weight</span>
                    <input
                        type="number" inputMode="decimal" value={bwStr} onChange={e => setBwStr(e.target.value)}
                        placeholder="Weight"
                        className="glass-panel"
                        style={{ width: '135px', borderRadius: '24px', padding: '8px 16px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', fontSize: '1rem', outline: 'none' }}
                    />
                    <button onClick={() => setUnit(u => u === 'lb' ? 'kg' : 'lb')} style={{ fontWeight: 800, color: 'var(--primary)', background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', width: '35px', fontSize: '1rem', textAlign: 'left', outline: 'none' }}>{unit.toUpperCase()}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, textAlign: 'right', fontSize: '1.05rem', width: '65px' }}>Total</span>
                    <input
                        type="number" inputMode="decimal" value={totalStr} onChange={e => setTotalStr(e.target.value)}
                        placeholder="Total"
                        className="glass-panel"
                        style={{ width: '135px', borderRadius: '24px', padding: '8px 16px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', fontSize: '1rem', outline: 'none' }}
                    />
                    <span style={{ fontWeight: 800, color: 'var(--primary)', background: 'transparent', border: 'none', width: '35px', fontSize: '1rem', textAlign: 'left' }}>{unit.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, textAlign: 'right', fontSize: '1.05rem', width: '65px' }}>Age</span>
                    <input
                        type="number" inputMode="numeric" value={ageStr} onChange={e => setAgeStr(e.target.value)}
                        placeholder="Age"
                        className="glass-panel"
                        style={{ width: '135px', borderRadius: '24px', padding: '8px 16px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', fontSize: '1rem', outline: 'none' }}
                    />
                    <span style={{ width: '35px' }}></span>
                </div>
            </div>

            {/* Target Score Section */}
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '360px', background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Target</span>
                    <select
                        value={formula} onChange={e => setFormula(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: 'rgba(150,150,150,0.2)', color: 'var(--foreground)', fontWeight: 700, fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="gl" style={{ color: '#000' }}>GL Points</option>
                        <option value="dots" style={{ color: '#000' }}>DOTS</option>
                    </select>

                    <div style={{ flex: 1 }} />

                    <input
                        type="number" inputMode="decimal" value={targetScoreStr} onChange={e => setTargetScoreStr(e.target.value)}
                        placeholder="100"
                        className="glass-panel"
                        style={{ width: '90px', borderRadius: '20px', padding: '6px 12px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 700, fontSize: '1rem', textAlign: 'center', outline: 'none' }}
                    />
                </div>

                <div
                    onClick={() => setShowLiftBreakdown(true)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Required Total</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{reqTotalDisplay > 0 ? fmt(reqTotalDisplay) : '0'}{unit === 'lb' ? '#' : 'KG'}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </div>
                </div>
            </div>

            {/* Formula Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', width: '100%', maxWidth: '360px' }}>
                <div className="glass-panel" onClick={() => setFormula('gl')} style={{ padding: '16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: formula === 'gl' ? '1px solid var(--primary)' : '1px solid transparent', background: 'var(--card)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308', fontWeight: 800, fontStyle: 'italic', fontSize: '14px' }}>i</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>GL Points</span>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{currentGl > 0 ? currentGl.toFixed(2) : '-'}</span>
                    </div>
                </div>
                <div className="glass-panel" onClick={() => setFormula('dots')} style={{ padding: '16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: formula === 'dots' ? '1px solid var(--primary)' : '1px solid transparent', background: 'var(--card)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 800, fontStyle: 'italic', fontSize: '14px' }}>i</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>DOTS</span>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{currentDots > 0 ? fmt(currentDots) : '-'}</span>
                    </div>
                </div>
            </div>

            {/* Modals & Overlays */}
            {showLiftBreakdown && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => {
                    if (e.target === e.currentTarget) setShowLiftBreakdown(false);
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', background: 'var(--background)', padding: '24px', borderRadius: '24px', position: 'relative' }}>

                        <button onClick={() => setShowLiftBreakdown(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <h3 style={{ margin: '0 0 24px 0', textAlign: 'center', fontSize: '1.2rem', fontWeight: 800 }}>Lift Breakdown</h3>

                        <div style={{ textAlign: 'center', marginBottom: '24px', fontSize: '1.1rem', fontWeight: 700 }}>
                            Target Total: {fmt(reqTotalDisplay)} {unit.toUpperCase()}
                        </div>

                        {/* Lift Inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px' }}>
                                    <input type="radio" checked={solveFor === 'squat'} onChange={() => setSolveFor('squat')} style={{ accentColor: 'var(--primary)' }} />
                                    <span style={{ fontWeight: 700 }}>Squat:</span>
                                </div>
                                {solveFor === 'squat' ? (
                                    <div style={{ flex: '1 1 150px', padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={squatStr} onChange={e => setSquatStr(e.target.value)} placeholder="0" className="glass-panel" style={{ flex: '1 1 150px', borderRadius: '24px', padding: '12px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', height: '48px', minWidth: 0, outline: 'none' }} />
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px' }}>
                                    <input type="radio" checked={solveFor === 'bench'} onChange={() => setSolveFor('bench')} style={{ accentColor: 'var(--primary)' }} />
                                    <span style={{ fontWeight: 700 }}>Bench:</span>
                                </div>
                                {solveFor === 'bench' ? (
                                    <div style={{ flex: '1 1 150px', padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={benchStr} onChange={e => setBenchStr(e.target.value)} placeholder="0" className="glass-panel" style={{ flex: '1 1 150px', borderRadius: '24px', padding: '12px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', height: '48px', minWidth: 0, outline: 'none' }} />
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px' }}>
                                    <input type="radio" checked={solveFor === 'deadlift'} onChange={() => setSolveFor('deadlift')} style={{ accentColor: 'var(--primary)' }} />
                                    <span style={{ fontWeight: 700 }}>Deadlift:</span>
                                </div>
                                {solveFor === 'deadlift' ? (
                                    <div style={{ flex: '1 1 150px', padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={deadliftStr} onChange={e => setDeadliftStr(e.target.value)} placeholder="0" className="glass-panel" style={{ flex: '1 1 150px', borderRadius: '24px', padding: '12px', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center', height: '48px', minWidth: 0, outline: 'none' }} />
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem' }}>
                            <span style={{ fontWeight: 700 }}>Current Total:</span>
                            <span style={{ fontWeight: 800 }}>{fmt(currentTotalDisplay + calculatedLiftValue)} {unit.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

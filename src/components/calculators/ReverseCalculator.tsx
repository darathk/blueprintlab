'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { solveForRequiredTotal, calculateDots } from '@/lib/calculators';

type LiftTarget = 'squat' | 'bench' | 'deadlift';

export default function ReverseCalculator() {
    // Top Level Settings
    const [sport, setSport] = useState<'pl' | 'oly'>('pl');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [equipped, setEquipped] = useState<'raw' | 'equipped'>('raw');
    const [events, setEvents] = useState<'sbd' | 'bench'>('sbd');
    const [unit, setUnit] = useState<'kg' | 'lb'>('lb');

    // Bio Inputs
    const [bwStr, setBwStr] = useState<string>('200'); // Default BW
    const [ageStr, setAgeStr] = useState<string>('25');

    // Target Settings
    const [formula, setFormula] = useState<string>('dots');
    const [targetScoreStr, setTargetScoreStr] = useState<string>('500');

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

    // ----- Calculate Required Total -----
    const reqTotalKg = useMemo(() => {
        if (targetScore <= 0 || bwKg <= 0 || formula !== 'dots') return 0; // Only support DOTS currently per requirements, but structure for more

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
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Top Level Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', border: '2px solid var(--primary)', borderRadius: '24px', overflow: 'hidden', width: '240px' }}>
                    <button onClick={() => setSport('pl')} style={{ flex: 1, padding: '8px', background: sport === 'pl' ? 'var(--primary)' : 'transparent', color: sport === 'pl' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>PL</button>
                    <button onClick={() => setSport('oly')} style={{ flex: 1, padding: '8px', background: sport === 'oly' ? 'var(--primary)' : 'transparent', color: sport === 'oly' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>OLY</button>
                </div>
                <div style={{ display: 'flex', border: '2px solid var(--primary)', borderRadius: '24px', overflow: 'hidden', width: '240px' }}>
                    <button onClick={() => setGender('male')} style={{ flex: 1, padding: '8px', background: gender === 'male' ? 'var(--primary)' : 'transparent', color: gender === 'male' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>Male</button>
                    <button onClick={() => setGender('female')} style={{ flex: 1, padding: '8px', background: gender === 'female' ? 'var(--primary)' : 'transparent', color: gender === 'female' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>Female</button>
                </div>
                <div style={{ display: 'flex', border: '2px solid var(--primary)', borderRadius: '24px', overflow: 'hidden', width: '240px' }}>
                    <button onClick={() => setEquipped('raw')} style={{ flex: 1, padding: '8px', background: equipped === 'raw' ? 'var(--primary)' : 'transparent', color: equipped === 'raw' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>Raw</button>
                    <button onClick={() => setEquipped('equipped')} style={{ flex: 1, padding: '8px', background: equipped === 'equipped' ? 'var(--primary)' : 'transparent', color: equipped === 'equipped' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>Equipped</button>
                </div>
                <div style={{ display: 'flex', border: '2px solid var(--primary)', borderRadius: '24px', overflow: 'hidden', width: '240px' }}>
                    <button onClick={() => setEvents('sbd')} style={{ flex: 1, padding: '8px', background: events === 'sbd' ? 'var(--primary)' : 'transparent', color: events === 'sbd' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>S/B/D</button>
                    <button onClick={() => setEvents('bench')} style={{ flex: 1, padding: '8px', background: events === 'bench' ? 'var(--primary)' : 'transparent', color: events === 'bench' ? '#fff' : 'var(--primary)', fontWeight: 700, border: 'none' }}>Bench</button>
                </div>
            </div>

            {/* Static Bio Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 800, width: '60px', textAlign: 'right' }}>Weight</span>
                    <input
                        type="number" inputMode="decimal" value={bwStr} onChange={e => setBwStr(e.target.value)}
                        placeholder="Bodyweight"
                        style={{ border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '24px', padding: '12px 20px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, width: '160px', textAlign: 'center' }}
                    />
                    <button onClick={() => setUnit(u => u === 'lb' ? 'kg' : 'lb')} style={{ fontWeight: 800, color: 'var(--primary)', background: 'none', border: 'none' }}>{unit.toUpperCase()}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 800, width: '60px', textAlign: 'right' }}>Total</span>
                    <input
                        type="text" disabled value={reqTotalDisplay > 0 ? fmt(reqTotalDisplay) : ''}
                        placeholder="Total"
                        style={{ border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '24px', padding: '12px 20px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, width: '160px', textAlign: 'center', opacity: 0.7 }}
                    />
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{unit.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 800, width: '60px', textAlign: 'right' }}>Age</span>
                    <input
                        type="number" inputMode="numeric" value={ageStr} onChange={e => setAgeStr(e.target.value)}
                        placeholder="Age"
                        style={{ border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '24px', padding: '12px 20px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, width: '160px', textAlign: 'center' }}
                    />
                    <span style={{ width: '22px' }}></span> {/* Spacer to align with unit labels above */}
                </div>
            </div>

            {/* Target Score Section */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Target</span>
                    <select
                        value={formula} onChange={e => setFormula(e.target.value)}
                        style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'var(--foreground)', fontWeight: 700, fontSize: '1rem', flex: 1 }}
                    >
                        <option value="dots" style={{ color: '#000' }}>DOTS</option>
                        <option value="gl" style={{ color: '#000' }}>GL Points</option>
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <input
                        type="number" inputMode="decimal" value={targetScoreStr} onChange={e => setTargetScoreStr(e.target.value)}
                        placeholder="Score"
                        style={{ width: '100%', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '24px', padding: '12px 20px', background: 'transparent', color: 'var(--foreground)', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }}
                    />
                </div>

                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Required Total</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--primary)' }}>{fmt(reqTotalDisplay)}#</span>
                        <button
                            onClick={() => setShowLiftBreakdown(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Formula Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-panel" onClick={() => setFormula('dots')} style={{ padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: formula === 'dots' ? '1px solid var(--primary)' : '1px solid transparent', opacity: formula === 'dots' ? 1 : 0.5, transition: 'all 0.2s' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 800, fontStyle: 'italic', fontSize: '12px' }}>i</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>DOTS</span>
                        <div style={{ width: '12px', height: '3px', background: '#22c55e', marginTop: '4px' }}></div>
                    </div>
                </div>
                <div className="glass-panel" onClick={() => setFormula('gl')} style={{ padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: formula === 'gl' ? '1px solid var(--primary)' : '1px solid transparent', opacity: formula === 'gl' ? 1 : 0.5, transition: 'all 0.2s' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308', fontWeight: 800, fontStyle: 'italic', fontSize: '12px' }}>i</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>GL Points</span>
                        <div style={{ width: '12px', height: '3px', background: '#eab308', marginTop: '4px' }}></div>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input type="radio" checked={solveFor === 'squat'} onChange={() => setSolveFor('squat')} style={{ accentColor: 'var(--primary)' }} />
                                <span style={{ fontWeight: 700, width: '70px' }}>Squat:</span>
                                {solveFor === 'squat' ? (
                                    <div style={{ flex: 1, padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={squatStr} onChange={e => setSquatStr(e.target.value)} placeholder="0" style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '12px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center' }} />
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input type="radio" checked={solveFor === 'bench'} onChange={() => setSolveFor('bench')} style={{ accentColor: 'var(--primary)' }} />
                                <span style={{ fontWeight: 700, width: '70px' }}>Bench:</span>
                                {solveFor === 'bench' ? (
                                    <div style={{ flex: 1, padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={benchStr} onChange={e => setBenchStr(e.target.value)} placeholder="0" style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '12px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center' }} />
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input type="radio" checked={solveFor === 'deadlift'} onChange={() => setSolveFor('deadlift')} style={{ accentColor: 'var(--primary)' }} />
                                <span style={{ fontWeight: 700, width: '70px' }}>Deadlift:</span>
                                {solveFor === 'deadlift' ? (
                                    <div style={{ flex: 1, padding: '12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: '2px dashed var(--primary)', borderRadius: '24px' }}>
                                        {fmt(calculatedLiftValue)}
                                    </div>
                                ) : (
                                    <input type="number" value={deadliftStr} onChange={e => setDeadliftStr(e.target.value)} placeholder="0" style={{ flex: 1, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '12px', background: 'transparent', color: 'var(--foreground)', fontWeight: 600, textAlign: 'center' }} />
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

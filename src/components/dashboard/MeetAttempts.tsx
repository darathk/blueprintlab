'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LEVELS = ['conservative', 'planned', 'reach'] as const;
const LEVEL_LABELS = { conservative: 'Cons', planned: 'Planned', reach: 'Reach' };
const LEVEL_COLORS = { conservative: '#94a3b8', planned: '#38bdf8', reach: '#a855f7' };

export default function MeetAttempts({ athlete, isReadOnly = false }) {
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);

    // Default structure
    const defaultData = {
        unit: 'kg',
        squat: { jump1to2: 15, jump2to3: 10, conservative: 0, planned: 0, reach: 0 },
        bench: { jump1to2: 10, jump2to3: 5, conservative: 0, planned: 0, reach: 0 },
        deadlift: { jump1to2: 20, jump2to3: 15, conservative: 0, planned: 0, reach: 0 }
    };

    const [data, setData] = useState(athlete.meetAttempts || defaultData);
    const [saving, setSaving] = useState(false);

    // Helpers
    const round25 = (val) => Math.round(val / 2.5) * 2.5;
    const kgToLbs = (kg) => (kg * 2.20462).toFixed(1);
    const lbsToKg = (lbs) => round25(lbs / 2.20462);

    const renderValue = (val) => {
        if (!val) return '-';
        if (data.unit === 'kg') {
            const kg = round25(val);
            const lbs = kgToLbs(kg);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: isReadOnly ? '0.9rem' : '1rem' }}>{kg} kg</span>
                    <span style={{ fontSize: isReadOnly ? '0.7em' : '0.8em', color: 'var(--secondary-foreground)' }}>{lbs} lbs</span>
                </div>
            );
        } else {
            const lbs = val;
            const kg = lbsToKg(lbs);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: isReadOnly ? '0.9rem' : '1rem' }}>{kg} kg</span>
                    <span style={{ fontSize: isReadOnly ? '0.7em' : '0.8em', color: 'var(--secondary-foreground)' }}>{lbs} lbs</span>
                </div>
            );
        }
    };

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: athlete.id,
                meetAttempts: data
            })
        });
        setSaving(false);
        setIsEditing(false);
        router.refresh();
    };

    const updateLift = (lift, field, val) => {
        setData(prev => ({
            ...prev,
            [lift]: { ...prev[lift], [field]: parseFloat(val) || 0 }
        }));
    };

    const updateStrategy = (lift, field, val) => {
        setData(prev => ({
            ...prev,
            [lift]: { ...prev[lift], [field]: val }
        }));
    };

    // Get the weight for a specific attempt and level
    const getAttemptWeight = (liftData, attempt, level) => {
        const target = liftData[level];
        if (!target) return 0;
        if (attempt === 3) return target;
        if (attempt === 2) return target - liftData.jump2to3;
        return target - liftData.jump2to3 - liftData.jump1to2;
    };

    const renderLiftRow = (liftName, liftKey) => {
        const liftData = data[liftKey];

        // Calculate 2nds and 1sts (existing per-column logic)
        const cons2nd = liftData.conservative - liftData.jump2to3;
        const cons1st = cons2nd - liftData.jump1to2;

        const plan2nd = liftData.planned - liftData.jump2to3;
        const plan1st = plan2nd - liftData.jump1to2;

        const reach2nd = liftData.reach - liftData.jump2to3;
        const reach1st = reach2nd - liftData.jump1to2;

        // Meet day strategy: which level for each attempt
        const strat1st = liftData.strategy1st || 'conservative';
        const strat2nd = liftData.strategy2nd || 'planned';
        const strat3rd = liftData.strategy3rd || 'reach';

        // Calculate strategy path weights
        const stratWeight1st = getAttemptWeight(liftData, 1, strat1st);
        const stratWeight2nd = getAttemptWeight(liftData, 2, strat2nd);
        const stratWeight3rd = getAttemptWeight(liftData, 3, strat3rd);

        const stratJump1to2 = round25(stratWeight2nd - stratWeight1st);
        const stratJump2to3 = round25(stratWeight3rd - stratWeight2nd);

        // Helper to check if a cell is on the strategy path
        const isOnPath = (attempt, level) => {
            return (attempt === 1 && level === strat1st) ||
                   (attempt === 2 && level === strat2nd) ||
                   (attempt === 3 && level === strat3rd);
        };

        const cellHighlight = (attempt, level) => {
            if (!isOnPath(attempt, level)) return {};
            return {
                outline: `2px solid ${LEVEL_COLORS[level]}`,
                outlineOffset: '-2px',
                borderRadius: '6px',
            };
        };

        return (
            <div key={liftKey} style={{ marginBottom: '2rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--card-border)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', textTransform: 'capitalize', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>{liftName}</h4>

                {isEditing && !isReadOnly ? (
                    <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem' }}>
                        <div>
                            <label className="label" style={{ fontSize: '0.8rem' }}>Jump 1st → 2nd</label>
                            <input type="number" className="input" value={liftData.jump1to2 || ''} onChange={(e) => updateLift(liftKey, 'jump1to2', e.target.value)} placeholder={`e.g. 15`} style={{ width: '100px' }} />
                        </div>
                        <div>
                            <label className="label" style={{ fontSize: '0.8rem' }}>Jump 2nd → 3rd</label>
                            <input type="number" className="input" value={liftData.jump2to3 || ''} onChange={(e) => updateLift(liftKey, 'jump2to3', e.target.value)} placeholder={`e.g. 10`} style={{ width: '100px' }} />
                        </div>
                    </div>
                ) : null}

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: isReadOnly ? '0.5rem 0.25rem' : '0.5rem', borderBottom: '1px solid var(--card-border)', fontSize: isReadOnly ? '0.8rem' : '1rem' }}>Attempt</th>
                                <th style={{ padding: isReadOnly ? '0.5rem 0.25rem' : '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#94a3b8', fontSize: isReadOnly ? '0.8rem' : '1rem' }}>Cons<span className="hidden md:inline">ervative</span></th>
                                <th style={{ padding: isReadOnly ? '0.5rem 0.25rem' : '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#38bdf8', fontSize: isReadOnly ? '0.8rem' : '1rem' }}>Planned</th>
                                <th style={{ padding: isReadOnly ? '0.5rem 0.25rem' : '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#a855f7', fontSize: isReadOnly ? '0.8rem' : '1rem' }}>Reach</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', fontWeight: 600, fontSize: isReadOnly ? '0.85rem' : '1rem' }}>1st<span className="hidden md:inline"> (Opener)</span></td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', ...cellHighlight(1, 'conservative') }}>{renderValue(cons1st)}</td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)', ...cellHighlight(1, 'planned') }}>{renderValue(plan1st)}</td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', ...cellHighlight(1, 'reach') }}>{renderValue(reach1st)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', fontWeight: 600, fontSize: isReadOnly ? '0.85rem' : '1rem' }}>2nd</td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', ...cellHighlight(2, 'conservative') }}>{renderValue(cons2nd)}</td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)', ...cellHighlight(2, 'planned') }}>{renderValue(plan2nd)}</td>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', ...cellHighlight(2, 'reach') }}>{renderValue(reach2nd)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: isReadOnly ? '0.75rem 0.25rem' : '1rem 0.5rem', fontWeight: 600, fontSize: isReadOnly ? '0.85rem' : '1rem' }}>3rd<span className="hidden md:inline"> (Target)</span></td>

                                {isEditing && !isReadOnly ? (
                                    <>
                                        <td style={{ padding: '1rem 0.5rem', ...cellHighlight(3, 'conservative') }}>
                                            <input type="number" className="input" value={liftData.conservative || ''} onChange={(e) => updateLift(liftKey, 'conservative', e.target.value)} style={{ width: '80px', textAlign: 'center' }} />
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)', ...cellHighlight(3, 'planned') }}>
                                            <input type="number" className="input" value={liftData.planned || ''} onChange={(e) => updateLift(liftKey, 'planned', e.target.value)} style={{ width: '80px', textAlign: 'center', borderColor: '#38bdf8' }} />
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', ...cellHighlight(3, 'reach') }}>
                                            <input type="number" className="input" value={liftData.reach || ''} onChange={(e) => updateLift(liftKey, 'reach', e.target.value)} style={{ width: '80px', textAlign: 'center', borderColor: '#a855f7' }} />
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={{ padding: '1rem 0.5rem', ...cellHighlight(3, 'conservative') }}>{renderValue(liftData.conservative)}</td>
                                        <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)', ...cellHighlight(3, 'planned') }}>{renderValue(liftData.planned)}</td>
                                        <td style={{ padding: '1rem 0.5rem', ...cellHighlight(3, 'reach') }}>{renderValue(liftData.reach)}</td>
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Meet Day Strategy Path */}
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem', opacity: 0.6 }}>
                        Meet Day Strategy
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {/* 1st Attempt */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>1st</span>
                            {isEditing && !isReadOnly ? (
                                <select
                                    className="input"
                                    value={strat1st}
                                    onChange={(e) => updateStrategy(liftKey, 'strategy1st', e.target.value)}
                                    style={{
                                        fontSize: '0.75rem', padding: '0.3rem 0.4rem', minWidth: 0, width: 'auto',
                                        color: LEVEL_COLORS[strat1st], borderColor: LEVEL_COLORS[strat1st],
                                        background: 'rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                                </select>
                            ) : (
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 700, color: LEVEL_COLORS[strat1st],
                                    padding: '0.2rem 0.5rem', borderRadius: '6px',
                                    background: `${LEVEL_COLORS[strat1st]}15`,
                                    border: `1px solid ${LEVEL_COLORS[strat1st]}30`,
                                }}>
                                    {LEVEL_LABELS[strat1st]}
                                </span>
                            )}
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                {stratWeight1st ? `${round25(stratWeight1st)}` : '-'}
                            </span>
                        </div>

                        {/* Arrow 1→2 with jump */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', padding: '0 0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', color: stratJump1to2 > 0 ? 'var(--primary)' : 'var(--secondary-foreground)', fontWeight: 600 }}>
                                +{stratJump1to2}{data.unit}
                            </span>
                            <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>→</span>
                        </div>

                        {/* 2nd Attempt */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>2nd</span>
                            {isEditing && !isReadOnly ? (
                                <select
                                    className="input"
                                    value={strat2nd}
                                    onChange={(e) => updateStrategy(liftKey, 'strategy2nd', e.target.value)}
                                    style={{
                                        fontSize: '0.75rem', padding: '0.3rem 0.4rem', minWidth: 0, width: 'auto',
                                        color: LEVEL_COLORS[strat2nd], borderColor: LEVEL_COLORS[strat2nd],
                                        background: 'rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                                </select>
                            ) : (
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 700, color: LEVEL_COLORS[strat2nd],
                                    padding: '0.2rem 0.5rem', borderRadius: '6px',
                                    background: `${LEVEL_COLORS[strat2nd]}15`,
                                    border: `1px solid ${LEVEL_COLORS[strat2nd]}30`,
                                }}>
                                    {LEVEL_LABELS[strat2nd]}
                                </span>
                            )}
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                {stratWeight2nd ? `${round25(stratWeight2nd)}` : '-'}
                            </span>
                        </div>

                        {/* Arrow 2→3 with jump */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', padding: '0 0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', color: stratJump2to3 > 0 ? 'var(--primary)' : 'var(--secondary-foreground)', fontWeight: 600 }}>
                                +{stratJump2to3}{data.unit}
                            </span>
                            <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>→</span>
                        </div>

                        {/* 3rd Attempt */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>3rd</span>
                            {isEditing && !isReadOnly ? (
                                <select
                                    className="input"
                                    value={strat3rd}
                                    onChange={(e) => updateStrategy(liftKey, 'strategy3rd', e.target.value)}
                                    style={{
                                        fontSize: '0.75rem', padding: '0.3rem 0.4rem', minWidth: 0, width: 'auto',
                                        color: LEVEL_COLORS[strat3rd], borderColor: LEVEL_COLORS[strat3rd],
                                        background: 'rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                                </select>
                            ) : (
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 700, color: LEVEL_COLORS[strat3rd],
                                    padding: '0.2rem 0.5rem', borderRadius: '6px',
                                    background: `${LEVEL_COLORS[strat3rd]}15`,
                                    border: `1px solid ${LEVEL_COLORS[strat3rd]}30`,
                                }}>
                                    {LEVEL_LABELS[strat3rd]}
                                </span>
                            )}
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                {stratWeight3rd ? `${round25(stratWeight3rd)}` : '-'}
                            </span>
                        </div>

                        {/* Total jump */}
                        <div style={{
                            marginLeft: 'auto',
                            fontSize: '0.75rem',
                            color: 'var(--secondary-foreground)',
                            textAlign: 'right',
                        }}>
                            <span style={{ opacity: 0.6 }}>Total</span>
                            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                                +{round25(stratWeight3rd - stratWeight1st)}{data.unit}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={!isReadOnly ? "glass-panel" : ""} style={{ marginBottom: '2rem', padding: !isReadOnly ? '1.5rem' : '0' }}>

            {!isReadOnly && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }} className="neon-text">Attempt Selection</h2>
                        <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>Work backwards from target 3rd attempts</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <select className="input" value={data.unit} onChange={(e) => setData({ ...data, unit: e.target.value })} disabled={!isEditing} style={{ paddingRight: '40px', minWidth: '140px' }}>
                            <option value="kg">Inputs in KG</option>
                            <option value="lbs">Inputs in LBS</option>
                        </select>
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save'}</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="btn btn-secondary">Edit</button>
                        )}
                    </div>
                </div>
            )}

            {isReadOnly && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', padding: '0.2rem 0.6rem', border: '1px solid var(--card-border)', borderRadius: '1rem' }}>
                        Plan based in {data.unit.toUpperCase()}
                    </div>
                </div>
            )}

            {renderLiftRow('Squat', 'squat')}
            {renderLiftRow('Bench Press', 'bench')}
            {renderLiftRow('Deadlift', 'deadlift')}

        </div>
    );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

    // Render calculated values
    const renderValue = (val) => {
        if (!val) return '-';
        if (data.unit === 'kg') {
            const kg = round25(val);
            const lbs = kgToLbs(kg);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{kg} kg</span>
                    <span style={{ fontSize: '0.8em', color: 'var(--secondary-foreground)' }}>{lbs} lbs</span>
                </div>
            );
        } else {
            const lbs = val;
            const kg = lbsToKg(lbs);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{kg} kg</span>
                    <span style={{ fontSize: '0.8em', color: 'var(--secondary-foreground)' }}>{lbs} lbs</span>
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

    const renderLiftRow = (liftName, liftKey) => {
        const liftData = data[liftKey];

        // Calculate 2nds and 1sts
        const cons2nd = liftData.conservative - liftData.jump2to3;
        const cons1st = cons2nd - liftData.jump1to2;

        const plan2nd = liftData.planned - liftData.jump2to3;
        const plan1st = plan2nd - liftData.jump1to2;

        const reach2nd = liftData.reach - liftData.jump2to3;
        const reach1st = reach2nd - liftData.jump1to2;

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
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)' }}>Attempt</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#94a3b8' }}>Conservative</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#38bdf8' }}>Planned</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--card-border)', color: '#a855f7' }}>Reach</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>1st (Opener)</td>
                                <td style={{ padding: '1rem 0.5rem' }}>{renderValue(cons1st)}</td>
                                <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)' }}>{renderValue(plan1st)}</td>
                                <td style={{ padding: '1rem 0.5rem' }}>{renderValue(reach1st)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>2nd</td>
                                <td style={{ padding: '1rem 0.5rem' }}>{renderValue(cons2nd)}</td>
                                <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)' }}>{renderValue(plan2nd)}</td>
                                <td style={{ padding: '1rem 0.5rem' }}>{renderValue(reach2nd)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>3rd (Target)</td>

                                {isEditing && !isReadOnly ? (
                                    <>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <input type="number" className="input" value={liftData.conservative || ''} onChange={(e) => updateLift(liftKey, 'conservative', e.target.value)} style={{ width: '70px', textAlign: 'center' }} />
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)' }}>
                                            <input type="number" className="input" value={liftData.planned || ''} onChange={(e) => updateLift(liftKey, 'planned', e.target.value)} style={{ width: '70px', textAlign: 'center', borderColor: '#38bdf8' }} />
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <input type="number" className="input" value={liftData.reach || ''} onChange={(e) => updateLift(liftKey, 'reach', e.target.value)} style={{ width: '70px', textAlign: 'center', borderColor: '#a855f7' }} />
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={{ padding: '1rem 0.5rem' }}>{renderValue(liftData.conservative)}</td>
                                        <td style={{ padding: '1rem 0.5rem', background: 'rgba(56, 189, 248, 0.05)' }}>{renderValue(liftData.planned)}</td>
                                        <td style={{ padding: '1rem 0.5rem' }}>{renderValue(liftData.reach)}</td>
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
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
                        <select className="input" value={data.unit} onChange={(e) => setData({ ...data, unit: e.target.value })} disabled={!isEditing} style={{ width: 'auto' }}>
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


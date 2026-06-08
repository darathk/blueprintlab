'use client';

import { useState, useMemo, useRef } from 'react';
import { CompetitorProfile, analyzeCompetitor } from '@/lib/openpowerlifting';
import Papa from 'papaparse';
import { Upload, Trash2, TrendingUp, AlertTriangle, Crosshair, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface CompetitorScoutProps {
    athleteId: string;
    savedCompetitors: CompetitorProfile[];
    athleteProjectedTotal: number;
    athleteBodyweight: number;
}

export default function CompetitorScout({ athleteId, savedCompetitors: initialSaved, athleteProjectedTotal, athleteBodyweight }: CompetitorScoutProps) {
    const [saved, setSaved] = useState<CompetitorProfile[]>(initialSaved || []);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(initialSaved?.[0]?.id || null);
    const fileRef = useRef<HTMLInputElement>(null);

    const activeCompetitor = useMemo(() => saved.find(c => c.id === selectedId), [saved, selectedId]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSearching(true);
        setError('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: async (results) => {
                try {
                    if (results.errors.length > 0 && results.data.length === 0) {
                        throw new Error('Failed to parse CSV file. Ensure it is a valid OpenPowerlifting CSV export.');
                    }

                    const meets = results.data as any[];
                    if (meets.length === 0) {
                        throw new Error('The CSV file is empty.');
                    }

                    // Get name from the first row or file name
                    const compName = meets[0].Name || file.name.replace(/\.[^/.]+$/, "");
                    const slug = compName.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // Analyze directly on client using the existing logic
                    const profile = analyzeCompetitor(slug, meets);

                    // Add to saved list
                    const newSaved = [...saved.filter(c => c.id !== profile.id), profile];
                    setSaved(newSaved);
                    setSelectedId(profile.id);

                    // Save to database
                    await fetch(`/api/athletes/${athleteId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ competitors: newSaved })
                    });

                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setSearching(false);
                    if (fileRef.current) fileRef.current.value = '';
                }
            },
            error: (err) => {
                setError(`CSV Parse Error: ${err.message}`);
                setSearching(false);
                if (fileRef.current) fileRef.current.value = '';
            }
        });
    };

    const removeCompetitor = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSaved = saved.filter(c => c.id !== id);
        setSaved(newSaved);
        if (selectedId === id) setSelectedId(newSaved[0]?.id || null);

        await fetch(`/api/athletes/${athleteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competitors: newSaved })
        });
    };

    return (
        <div className="scout-container" id="competitor-scout-report">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em', margin: '0 0 1rem' }}>
                Competitor Scouting
            </h2>

            {/* File Upload Bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', alignItems: 'center' }}>
                <input
                    type="file"
                    accept=".csv"
                    ref={fileRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="competitor-csv-upload"
                />
                <label
                    htmlFor="competitor-csv-upload"
                    style={{
                        padding: '10px 20px', borderRadius: 8, border: '1px dashed var(--card-border)',
                        background: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '0.95rem',
                        cursor: searching ? 'default' : 'pointer', opacity: searching ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, flex: 1, justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
                >
                    {searching ? 'Analyzing...' : <><Upload size={18} /> Upload OpenPowerlifting CSV</>}
                </label>
            </div>
            {error && <div style={{ color: 'var(--error)', fontSize: '0.9rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>{error}</div>}

            {saved.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Sidebar / Tabs */}
                    <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Saved Competitors</div>
                        {saved.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedId(c.id)}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedId === c.id ? 'var(--primary)' : 'var(--card-border)'}`,
                                    background: selectedId === c.id ? 'rgba(34, 211, 238, 0.1)' : 'var(--card-bg)',
                                    color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontWeight: selectedId === c.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                <Trash2 size={14} color="var(--error)" style={{ opacity: 0.6, cursor: 'pointer' }} onClick={(e) => removeCompetitor(c.id, e)} />
                            </button>
                        ))}
                    </div>

                    {/* Main Scouting Report */}
                    {activeCompetitor && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <WinConditionCard 
                                comp={activeCompetitor} 
                                athleteProjectedTotal={athleteProjectedTotal} 
                            />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <HitRateCard comp={activeCompetitor} />
                                <TacticalEngineCard comp={activeCompetitor} />
                            </div>

                            <ProgressionChart comp={activeCompetitor} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function WinConditionCard({ comp, athleteProjectedTotal }: { comp: CompetitorProfile, athleteProjectedTotal: number }) {
    const diff = athleteProjectedTotal - comp.projectedTotal;
    const isWinning = diff >= 0;

    // Likelihood of competitor hitting their projected total
    // Heavily weighted by their overall hit rate and bomb out risk
    const baseLikelihood = comp.hitRates.overall.percent;
    const penalty = comp.hitRates.bombOuts * 5; // 5% penalty per bomb out
    const likelihood = Math.max(0, Math.min(100, baseLikelihood - penalty));

    let tacticalAdvice = '';
    if (isWinning) {
        tacticalAdvice = `Athlete is projected to win by ${diff.toFixed(1)}kg. Stick to the planned attempts.`;
    } else {
        // Find the next 2.5kg increment above the difference
        const neededToTie = Math.abs(diff);
        const neededToWin = Math.ceil((Math.abs(diff) + 0.1) / 2.5) * 2.5;
        tacticalAdvice = `To win, the athlete needs to add +${neededToWin.toFixed(1)}kg to their planned attempts (e.g. +${neededToWin}kg on the 3rd attempt deadlift).`;
    }

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    <Crosshair size={12} style={{ display: 'inline', marginRight: 4 }} /> Win Condition vs {comp.name}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: isWinning ? 'var(--success)' : 'var(--error)' }}>
                    {isWinning ? 'Winning' : 'Losing'} by {Math.abs(diff).toFixed(1)} kg
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--secondary-foreground)', marginTop: 4 }}>
                    Athlete Projected: <strong>{athleteProjectedTotal} kg</strong> <span style={{opacity:0.5}}>|</span> Competitor Projected: <strong>{comp.projectedTotal} kg</strong>
                </div>
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.9rem', color: 'var(--foreground)', borderLeft: `3px solid ${isWinning ? 'var(--success)' : 'var(--warning)'}` }}>
                    {tacticalAdvice}
                </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: 4 }}>Competitor Confidence</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: likelihood > 80 ? 'var(--success)' : likelihood > 60 ? 'var(--warning)' : 'var(--error)' }}>
                    {likelihood}%
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>chance to hit projected total</div>
            </div>
        </div>
    );
}

function HitRateCard({ comp }: { comp: CompetitorProfile }) {
    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                <Activity size={12} style={{ display: 'inline', marginRight: 4 }} /> Historical Hit Rates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                    { label: 'Squat', data: comp.hitRates.squat, color: '#7d87d2' },
                    { label: 'Bench Press', data: comp.hitRates.bench, color: '#a855f7' },
                    { label: 'Deadlift', data: comp.hitRates.deadlift, color: '#10b981' }
                ].map(lift => (
                    <div key={lift.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{lift.label}</span>
                            <span style={{ color: 'var(--secondary-foreground)' }}>{lift.data.percent}% ({lift.data.made}/{lift.data.total})</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-modifier-hover)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: lift.color, width: `${lift.data.percent}%`, borderRadius: 3 }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TacticalEngineCard({ comp }: { comp: CompetitorProfile }) {
    const renderTactic = () => {
        const { hitRates, tactics } = comp;
        
        let weakestLift = 'squat';
        let lowestPct = hitRates.squat.percent;
        if (hitRates.bench.percent < lowestPct) { weakestLift = 'bench'; lowestPct = hitRates.bench.percent; }
        if (hitRates.deadlift.percent < lowestPct) { weakestLift = 'deadlift'; lowestPct = hitRates.deadlift.percent; }

        const jumpSize = weakestLift === 'squat' ? tactics.avgSquatJump2to3 : weakestLift === 'bench' ? tactics.avgBenchJump2to3 : tactics.avgDeadliftJump2to3;

        return (
            <>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', marginBottom: 8, lineHeight: 1.5 }}>
                    <strong>Force Attempts on {weakestLift.charAt(0).toUpperCase() + weakestLift.slice(1)}:</strong> Competitor only makes {lowestPct}% of attempts here. Load heavier on our 2nd attempt to force them into a risky 3rd attempt.
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', marginBottom: 8, lineHeight: 1.5 }}>
                    <strong>Jump Aggression:</strong> They average a {jumpSize.toFixed(1)}kg jump on their 3rd attempt {weakestLift}.
                </div>
                {hitRates.bombOuts > 0 && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--error)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} /> High Bomb-out Risk ({hitRates.bombOuts} career bomb-outs)
                    </div>
                )}
            </>
        );
    };

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Tactical Engine
            </div>
            {renderTactic()}
        </div>
    );
}

function ProgressionChart({ comp }: { comp: CompetitorProfile }) {
    const data = comp.progression.history.map((h, i) => ({
        name: `Meet ${i+1}`,
        total: h.total,
        date: h.date,
        bw: h.bodyweight
    }));

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} /> Trajectory & Progression
                 </div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                    Avg: +{comp.progression.averageTotalIncreaseKg}kg / meet
                 </div>
             </div>
             
             <div style={{ height: 200, width: '100%' }}>
                 <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={data}>
                         <defs>
                             <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                             </linearGradient>
                         </defs>
                         <XAxis dataKey="name" hide />
                         <YAxis domain={['auto', 'auto']} hide />
                         <RechartsTooltip 
                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: '0.85rem' }}
                            labelStyle={{ color: 'var(--secondary-foreground)', marginBottom: 4 }}
                            formatter={(value: any, name: string, props: any) => [`${value}kg (BW: ${props.payload.bw}kg)`, 'Total']}
                         />
                         <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                     </AreaChart>
                 </ResponsiveContainer>
             </div>
        </div>
    );
}

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { CompetitorProfile, analyzeCompetitor, calculateWinProbability, CompetitorLiveData, LiveAttempt, LiveLiftData } from '@/lib/openpowerlifting';
import Papa from 'papaparse';
import { Upload, Trash2, TrendingUp, AlertTriangle, Crosshair, Activity, Eye, ActivitySquare } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { calculateDots } from '@/lib/dots';
import CompareAllView from './CompareAllView';

interface CompetitorScoutProps {
    athleteId: string;
    savedCompetitors: CompetitorProfile[];
    athleteTotals?: { 
        conservative: number; 
        planned: number; 
        reach: number;
        squat?: { conservative: number; planned: number; reach: number };
        bench?: { conservative: number; planned: number; reach: number };
        deadlift?: { conservative: number; planned: number; reach: number };
    };
    athleteData?: any;
    allTimePRs?: any;
    athleteBodyweight: number;
    athleteGender?: 'male' | 'female';
}

export default function CompetitorScout({ athleteId, savedCompetitors: initialSaved, athleteTotals, athleteData, allTimePRs, athleteBodyweight, athleteGender }: CompetitorScoutProps) {
    const [saved, setSaved] = useState<CompetitorProfile[]>(initialSaved || []);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(initialSaved?.[0]?.id || null);
    const fileRef = useRef<HTMLInputElement>(null);

    // activeCompetitor is now computed via getEffectiveCompetitor below

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

    const updateCompetitor = async (updatedComp: CompetitorProfile) => {
        const newSaved = saved.map(c => c.id === updatedComp.id ? updatedComp : c);
        setSaved(newSaved);

        await fetch(`/api/athletes/${athleteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competitors: newSaved })
        });
    };

    // Calculate effective competitor with live data overrides
    const activeCompetitorData = saved.find(c => c.id === selectedId);
    const getEffectiveCompetitor = (comp: CompetitorProfile | undefined) => {
        if (!comp) return null;
        if (!comp.liveData) return comp;

        const effective = { ...comp };
        
        // Helper to get max made attempt or 0
        const getMaxMade = (lift: LiveLiftData) => {
            let max = 0;
            if (lift.attempt1?.status === 'made') max = Math.max(max, lift.attempt1.kg);
            if (lift.attempt2?.status === 'made') max = Math.max(max, lift.attempt2.kg);
            if (lift.attempt3?.status === 'made') max = Math.max(max, lift.attempt3.kg);
            return max;
        };

        const hasPending = (lift: LiveLiftData) => {
            if (!lift.attempt1 || lift.attempt1.status === 'pending') return true;
            if (!lift.attempt2 || lift.attempt2.status === 'pending') return true;
            if (!lift.attempt3 || lift.attempt3.status === 'pending') return true;
            return false;
        };

        const sqMax = getMaxMade(comp.liveData.squat);
        const sqPending = hasPending(comp.liveData.squat);
        effective.projectedSquat = sqPending 
            ? Math.max(comp.projectedSquat, sqMax + (sqMax > 0 ? comp.progression.averageSquatIncreaseKg : 0)) 
            : sqMax;

        const bpMax = getMaxMade(comp.liveData.bench);
        const bpPending = hasPending(comp.liveData.bench);
        effective.projectedBench = bpPending 
            ? Math.max(comp.projectedBench, bpMax + (bpMax > 0 ? comp.progression.averageBenchIncreaseKg : 0)) 
            : bpMax;

        const dlMax = getMaxMade(comp.liveData.deadlift);
        const dlPending = hasPending(comp.liveData.deadlift);
        effective.projectedDeadlift = dlPending 
            ? Math.max(comp.projectedDeadlift, dlMax + (dlMax > 0 ? comp.progression.averageDeadliftIncreaseKg : 0)) 
            : dlMax;

        effective.projectedTotal = effective.projectedSquat + effective.projectedBench + effective.projectedDeadlift;
        return effective;
    };

    const activeCompetitor = getEffectiveCompetitor(activeCompetitorData);

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
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    {/* Sidebar / Tabs */}
                    <div className="w-full md:w-[220px] shrink-0 flex flex-col gap-2">
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Saved Competitors</div>
                        <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {saved.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedId === c.id ? 'var(--primary)' : 'var(--card-border)'}`,
                                        background: selectedId === c.id ? 'rgba(34, 211, 238, 0.1)' : 'var(--card-bg)',
                                        color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s',
                                        minWidth: 'max-content'
                                    }}
                                >
                                    <span style={{ fontWeight: selectedId === c.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                    <Trash2 size={14} color="var(--error)" style={{ opacity: 0.6, cursor: 'pointer', marginLeft: 12 }} onClick={(e) => removeCompetitor(c.id, e)} />
                                </button>
                            ))}
                            {saved.length > 1 && (
                                <button
                                    onClick={() => setSelectedId('COMPARE_ALL')}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedId === 'COMPARE_ALL' ? 'var(--primary)' : 'var(--card-border)'}`,
                                        background: selectedId === 'COMPARE_ALL' ? 'rgba(34, 211, 238, 0.1)' : 'var(--card-bg)',
                                        color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s',
                                        minWidth: 'max-content'
                                    }}
                                >
                                    <span style={{ fontWeight: selectedId === 'COMPARE_ALL' ? 600 : 400 }}>Compare All</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Scouting Report */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid var(--primary)' }}>
                            <strong>Legend:</strong> A <strong><span style={{ color: 'var(--success)' }}>+ (Plus)</span></strong> margin means your athlete is <strong>winning</strong> against the competitor's target or trend. A <strong><span style={{ color: 'var(--error)' }}>- (Minus)</span></strong> margin means your athlete is <strong>losing</strong> against the competitor.
                        </div>

                        {selectedId === 'COMPARE_ALL' ? (
                            <CompareAllView saved={saved} athleteTotals={athleteTotals} athleteBodyweight={athleteBodyweight} athleteGender={athleteGender} allTimePRs={allTimePRs} />
                        ) : activeCompetitor ? (
                            <>
                                <LiveMeetTrackerCard comp={activeCompetitorData!} onUpdate={updateCompetitor} />
                                
                                <WinConditionCard 
                                    comp={activeCompetitor} 
                                    athleteTotals={athleteTotals} 
                                />
                                
                                <HistoricalBestsCard comp={activeCompetitor} />
                                
                                <DotsReportCard 
                                    comp={activeCompetitor} 
                                    athleteTotals={athleteTotals} 
                                    athleteBodyweight={athleteBodyweight} 
                                    athleteGender={athleteGender} 
                                    allTimePRs={allTimePRs}
                                />
                                
                                <PerLiftMatchupCard 
                                    comp={activeCompetitor} 
                                    athleteData={athleteData} 
                                    athleteTotals={athleteTotals}
                                    allTimePRs={allTimePRs} 
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <HitRateCard comp={activeCompetitor} />
                                    <TacticalEngineCard comp={activeCompetitor} />
                                </div>

                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}

function WinConditionCard({ comp, athleteTotals }: { comp: CompetitorProfile, athleteTotals?: any }) {
    const hasLiveData = comp.liveData && (comp.liveData.squat?.attempt1 || comp.liveData.bench?.attempt1 || comp.liveData.deadlift?.attempt1);
    const targetTotal = comp.projectedTotal;
    const contextStr = hasLiveData 
        ? `(Live Projected Total based on meet day data)` 
        : `(Projected Total based on trend)`;

    const baseLikelihood = comp.hitRates.overall.percent;
    const penalty = comp.hitRates.bombOuts * 5;
    const likelihood = Math.max(0, Math.min(100, baseLikelihood - penalty));

    const tiers = [
        { label: 'Conservative', value: athleteTotals?.conservative || 0, color: '#22d3ee' },
        { label: 'Planned', value: athleteTotals?.planned || 0, color: '#f59e0b' },
        { label: 'Reach', value: athleteTotals?.reach || 0, color: '#f43f5e' }
    ];

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                    <Crosshair size={12} style={{ display: 'inline', marginRight: 4 }} /> Target to Beat ({comp.name})
                    <InfoTooltip text="Compares the competitor's Heaviest Total or Projected Total against your athlete's game plans. A + (plus) means your athlete is winning against their target. A - (minus) means your athlete is losing against their target." />
                </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)' }}>
                        {targetTotal.toFixed(1)} kg <span style={{ fontSize: '1.25rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>({(targetTotal * 2.20462).toFixed(1)} lbs)</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>
                        {contextStr}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: 4 }}>Competitor Confidence</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: likelihood > 80 ? 'var(--success)' : likelihood > 60 ? 'var(--warning)' : 'var(--error)' }}>
                        {likelihood}%
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>historical hit rate</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 8 }}>
                {tiers.map(t => {
                    const diff = t.value - targetTotal;
                    const isWinning = diff >= 0;
                    const winProb = calculateWinProbability(t.value, targetTotal);
                    return (
                        <div key={t.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.color}40`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t.label} Plan</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isWinning ? 'var(--success)' : 'var(--error)' }}>
                                {isWinning ? '+' : ''}{diff.toFixed(1)} kg <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>({isWinning ? '+' : ''}{(diff * 2.20462).toFixed(1)} lbs)</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: winProb > 0.5 ? 'var(--success)' : winProb === 0.5 ? 'var(--warning)' : 'var(--error)', marginTop: 8 }}>
                                {(winProb * 100).toFixed(0)}% Win Chance
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginTop: 4 }}>vs Target ({t.value} kg)</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function timeAgo(dateString: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
    
    if (diffMonths < 1) return 'This month';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const years = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    if (remainingMonths === 0) return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    return `${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'mo' : 'mos'} ago`;
}

function HistoricalBestsCard({ comp }: { comp: CompetitorProfile }) {
    if (!comp.historicalBests) return null; // Fallback for older saved data without historicalBests

    const items = [
        { label: 'Squat PR', value: comp.historicalBests.squat.value, unit: 'kg', date: comp.historicalBests.squat.date, color: '#7d87d2' },
        { label: 'Bench PR', value: comp.historicalBests.bench.value, unit: 'kg', date: comp.historicalBests.bench.date, color: '#a855f7' },
        { label: 'Deadlift PR', value: comp.historicalBests.deadlift.value, unit: 'kg', date: comp.historicalBests.deadlift.date, color: '#10b981' },
        { label: 'Heaviest Total', value: comp.historicalBests.total.value, unit: 'kg', date: comp.historicalBests.total.date, color: '#f59e0b' },
        { label: 'Best DOTS', value: comp.historicalBests.dots.value, unit: '', date: comp.historicalBests.dots.date, color: '#ec4899' },
    ];

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                All-Time Career Bests
                <InfoTooltip text="Shows the absolute highest numbers the competitor has ever hit in their career, along with exactly how long ago they hit them." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                {items.map(item => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, borderLeft: `3px solid ${item.color}` }}>
                        <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
                            {item.value.toFixed(item.unit === '' ? 2 : 1)} {item.unit}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginTop: 4 }}>
                            {timeAgo(item.date)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DotsReportCard({ comp, athleteTotals, athleteBodyweight, athleteGender, allTimePRs }: { comp: CompetitorProfile, athleteTotals?: any, athleteBodyweight: number, athleteGender?: 'male'|'female', allTimePRs: any }) {
    if (!comp.historicalBests) return null;
    
    // Calculate Athlete DOTS
    const conDots = (athleteGender && athleteBodyweight > 0 && athleteTotals?.conservative > 0) ? calculateDots(athleteTotals.conservative, athleteBodyweight, athleteGender) : 0;
    const plnDots = (athleteGender && athleteBodyweight > 0 && athleteTotals?.planned > 0) ? calculateDots(athleteTotals.planned, athleteBodyweight, athleteGender) : 0;
    const rchDots = (athleteGender && athleteBodyweight > 0 && athleteTotals?.reach > 0) ? calculateDots(athleteTotals.reach, athleteBodyweight, athleteGender) : 0;
    const bestDots = (athleteGender && athleteBodyweight > 0 && allTimePRs?.total?.value > 0) ? calculateDots(allTimePRs.total.value, athleteBodyweight, athleteGender) : 0;

    // Calculate Competitor Projected DOTS
    const compDotsRatio = comp.historicalBests.total.value > 0 ? (comp.historicalBests.dots.value / comp.historicalBests.total.value) : 0;
    const compProjectedDots = comp.projectedTotal * compDotsRatio;

    const renderDotsBlock = (label: string, value: number, color: string, compareValue?: number) => {
        const diff = compareValue ? value - compareValue : 0;
        return (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: color }}>
                    {value > 0 ? value.toFixed(2) : '—'}
                </div>
                {compareValue && value > 0 && (
                    <div style={{ fontSize: 11, color: diff >= 0 ? 'var(--success)' : 'var(--error)', marginTop: 4 }}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(2)} vs Comp Proj
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                <ActivitySquare size={12} style={{ display: 'inline', marginRight: 4 }} /> Complete DOTS Report
                <InfoTooltip text="Compares the absolute strength score (DOTS) of the competitor against your athlete's planned DOTS, neutralizing weight class advantages." />
            </div>
            
            <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase' }}>Competitor</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
                {renderDotsBlock('Competitor Best DOTS', comp.historicalBests.dots.value, 'var(--secondary-foreground)')}
                {renderDotsBlock('Competitor Proj. DOTS', compProjectedDots, 'var(--warning)')}
            </div>

            <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase' }}>Athlete Game Plans vs Competitor Proj.</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {renderDotsBlock('Best DOTS', bestDots, '#f59e0b', compProjectedDots)}
                {renderDotsBlock('Conservative', conDots, '#22d3ee', compProjectedDots)}
                {renderDotsBlock('Planned', plnDots, '#ec4899', compProjectedDots)}
                {renderDotsBlock('Reach', rchDots, '#f43f5e', compProjectedDots)}
            </div>
        </div>
    );
}

function PerLiftMatchupCard({ comp, athleteData, athleteTotals, allTimePRs }: { comp: CompetitorProfile, athleteData: any, athleteTotals?: any, allTimePRs: any }) {
    const lifts = [
        {
            key: 'squat', label: 'Squat',
            color: '#7d87d2',
            compProj: comp.projectedSquat,
            compAvg: comp.progression?.averageSquatIncreaseKg || 2.5,
            athBest: allTimePRs?.squat?.value || 0,
            athCon: athleteTotals?.squat?.conservative || parseFloat(athleteData?.squat?.attempt3?.conservative?.kg || '0') || 0,
            athPln: athleteTotals?.squat?.planned || parseFloat(athleteData?.squat?.attempt3?.planned?.kg || '0') || 0,
            athRch: athleteTotals?.squat?.reach || parseFloat(athleteData?.squat?.attempt3?.reach?.kg || '0') || 0
        },
        {
            key: 'bench', label: 'Bench Press',
            color: '#a855f7',
            compProj: comp.projectedBench,
            compAvg: comp.progression?.averageBenchIncreaseKg || 2.5,
            athBest: allTimePRs?.bench?.value || 0,
            athCon: athleteTotals?.bench?.conservative || parseFloat(athleteData?.bench?.attempt3?.conservative?.kg || '0') || 0,
            athPln: athleteTotals?.bench?.planned || parseFloat(athleteData?.bench?.attempt3?.planned?.kg || '0') || 0,
            athRch: athleteTotals?.bench?.reach || parseFloat(athleteData?.bench?.attempt3?.reach?.kg || '0') || 0
        },
        {
            key: 'deadlift', label: 'Deadlift',
            color: '#10b981',
            compProj: comp.projectedDeadlift,
            compAvg: comp.progression?.averageDeadliftIncreaseKg || 2.5,
            athBest: allTimePRs?.deadlift?.value || 0,
            athCon: athleteTotals?.deadlift?.conservative || parseFloat(athleteData?.deadlift?.attempt3?.conservative?.kg || '0') || 0,
            athPln: athleteTotals?.deadlift?.planned || parseFloat(athleteData?.deadlift?.attempt3?.planned?.kg || '0') || 0,
            athRch: athleteTotals?.deadlift?.reach || parseFloat(athleteData?.deadlift?.attempt3?.reach?.kg || '0') || 0
        },
        { 
            key: 'total', label: 'Total', color: '#f59e0b', 
            compProj: comp.projectedTotal, compAvg: (comp.progression.averageSquatIncreaseKg + comp.progression.averageBenchIncreaseKg + comp.progression.averageDeadliftIncreaseKg),
            athBest: allTimePRs?.total?.value || 0,
            athCon: athleteTotals?.conservative || 0,
            athPln: athleteTotals?.planned || 0,
            athRch: athleteTotals?.reach || 0
        }
    ];

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                Per-Lift Matchup Grid
                <InfoTooltip text="Breaks down the competitor's average progression per meet for each lift to project their Meet Day numbers. Compares those projections directly against your athlete's PR and game plan targets." />
            </div>

            {lifts.map(lift => {
                const marginPln = lift.athPln > 0 ? lift.athPln - lift.compProj : 0;
                const marginBest = lift.athBest > 0 ? lift.athBest - lift.compProj : 0;
                
                const conMargin = lift.athCon > 0 ? lift.athCon - lift.compProj : 0;
                const plnMargin = lift.athPln > 0 ? lift.athPln - lift.compProj : 0;
                const rchMargin = lift.athRch > 0 ? lift.athRch - lift.compProj : 0;
                
                return (
                    <div key={lift.key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, borderLeft: `3px solid ${lift.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', textTransform: 'uppercase' }}>{lift.label}</div>
                            {lift.athPln > 0 && (
                                <div style={{ fontSize: 11, color: marginPln >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                                    {marginPln >= 0 ? '+' : ''}{marginPln.toFixed(1)}kg margin (Planned)
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                                <div style={{ color: 'var(--secondary-foreground)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Competitor Trend</div>
                                <div style={{ fontWeight: 700 }}>Proj: {lift.compProj} kg</div>
                                <div style={{ fontSize: 10, color: lift.compAvg >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                    {lift.compAvg >= 0 ? '+' : ''}{lift.compAvg.toFixed(1)}kg / meet avg
                                </div>
                            </div>
                            
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                                <div style={{ color: 'var(--secondary-foreground)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Athlete Current Best</div>
                                <div style={{ fontWeight: 700 }}>PR: {lift.athBest > 0 ? lift.athBest : '—'} kg</div>
                                {lift.athBest > 0 && (
                                    <div style={{ fontSize: 10, color: marginBest >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                        {marginBest >= 0 ? '+' : ''}{marginBest.toFixed(1)}kg vs Comp
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                                <div style={{ color: 'var(--secondary-foreground)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Athlete Game Plan vs Comp</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <div style={{ color: '#22d3ee', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>C: {lift.athCon > 0 ? lift.athCon : '—'}</span>
                                        {lift.athCon > 0 && <span style={{fontSize: 10, opacity: 0.8}}>{conMargin >= 0 ? '+' : ''}{conMargin.toFixed(1)}</span>}
                                    </div>
                                    <div style={{ color: '#f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>P: {lift.athPln > 0 ? lift.athPln : '—'}</span>
                                        {lift.athPln > 0 && <span style={{fontSize: 10, opacity: 0.8}}>{plnMargin >= 0 ? '+' : ''}{plnMargin.toFixed(1)}</span>}
                                    </div>
                                    <div style={{ color: '#f43f5e', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>R: {lift.athRch > 0 ? lift.athRch : '—'}</span>
                                        {lift.athRch > 0 && <span style={{fontSize: 10, opacity: 0.8}}>{rchMargin >= 0 ? '+' : ''}{rchMargin.toFixed(1)}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function HitRateCard({ comp }: { comp: CompetitorProfile }) {
    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                <Activity size={12} style={{ display: 'inline', marginRight: 4 }} /> Historical Hit Rates
                <InfoTooltip text="Shows the percentage of successful attempts the competitor has made in their career across all meets. A lower hit rate indicates inconsistency." />
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
        let advice = "No significant tactical patterns found.";
        let icon = <AlertTriangle size={16} color="var(--warning)" />;

        if (comp.hitRates.squat.percent < 60) {
            advice = `Force Attempts on Squat: Competitor only makes ${comp.hitRates.squat.percent}% of squat attempts. Consider opening heavier to force them into a risky 3rd attempt.`;
        } else if (comp.hitRates.deadlift.percent < 60) {
            advice = `Build a Lead Before Deadlift: Competitor only hits ${comp.hitRates.deadlift.percent}% of deadlifts. A solid sub-total puts them under immense pressure on their weakest lift.`;
        } else if (comp.tactics.opensHeavy) {
            advice = `Aggressive Opener: Competitor typically takes very small jumps on Squat. They open close to their max. Stay conservative to guarantee a total, they are prone to bombing out.`;
        } else {
            advice = `Consistent Performer: Hit rates are strong across the board. Stick to your athlete's planned 9/9 attempt strategy without reacting to the competitor.`;
            icon = <TrendingUp size={16} color="var(--success)" />;
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                    <div style={{ marginTop: 2 }}>{icon}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--foreground)' }}>
                        {advice}
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--secondary-foreground)', marginBottom: 8 }}>Average KG Jumps Between Attempts</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, fontSize: 12 }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                            <div style={{ color: '#7d87d2', fontWeight: 600, marginBottom: 4 }}>Squat</div>
                            <div style={{ marginBottom: 2 }}>1st→2nd: +{comp.tactics.avgSquatJump1to2.toFixed(1)}kg</div>
                            <div>2nd→3rd: +{comp.tactics.avgSquatJump2to3.toFixed(1)}kg</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                            <div style={{ color: '#a855f7', fontWeight: 600, marginBottom: 4 }}>Bench</div>
                            <div style={{ marginBottom: 2 }}>1st→2nd: +{comp.tactics.avgBenchJump1to2.toFixed(1)}kg</div>
                            <div>2nd→3rd: +{comp.tactics.avgBenchJump2to3.toFixed(1)}kg</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
                            <div style={{ color: '#10b981', fontWeight: 600, marginBottom: 4 }}>Deadlift</div>
                            <div style={{ marginBottom: 2 }}>1st→2nd: +{comp.tactics.avgDeadliftJump1to2.toFixed(1)}kg</div>
                            <div>2nd→3rd: +{comp.tactics.avgDeadliftJump2to3.toFixed(1)}kg</div>
                        </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', marginTop: 8, opacity: 0.8 }}>
                        <em>Note: A negative value (e.g. -250kg) in OpenPowerlifting means the attempt was missed. These jump calculations only factor in successful attempt jumps.</em>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                Tactical Engine
                <InfoTooltip text="Automatically analyzes their attempt history to identify their weakest lift and calculate how aggressively they jump between attempts. Uses this to suggest Meet Day strategies." />
            </div>
            {renderTactic()}
        </div>
    );
}


function InfoTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    
    return (
        <div 
            style={{ display: 'inline-flex', position: 'relative', marginLeft: 8 }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={12} color="var(--secondary-foreground)" />
            </div>
            {open && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    padding: '8px 12px',
                    background: '#27272a',
                    border: '1px solid var(--card-border)',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    color: 'var(--foreground)',
                    width: 220,
                    zIndex: 50,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    textAlign: 'left',
                    fontWeight: 400,
                    lineHeight: 1.4,
                    textTransform: 'none',
                    letterSpacing: 'normal'
                }}>
                    {text}
                </div>
            )}
        </div>
    );
}

function LiveMeetTrackerCard({ comp, onUpdate }: { comp: CompetitorProfile, onUpdate: (c: CompetitorProfile) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [liveData, setLiveData] = useState<CompetitorLiveData>(comp.liveData || { squat: {}, bench: {}, deadlift: {} });

    useEffect(() => {
        setLiveData(comp.liveData || { squat: {}, bench: {}, deadlift: {} });
    }, [comp.id, comp.liveData]);

    const handleUpdate = (lift: keyof CompetitorLiveData, attempt: 'attempt1'|'attempt2'|'attempt3', field: 'kg'|'status', value: any) => {
        const newData = { ...liveData };
        if (!newData[lift]) newData[lift] = {};
        if (!newData[lift][attempt]) newData[lift][attempt] = { kg: 0, status: 'pending' };
        (newData[lift] as any)[attempt][field] = value;
        setLiveData(newData);
        onUpdate({ ...comp, liveData: newData });
    };

    const renderAttempt = (lift: 'squat'|'bench'|'deadlift', attempt: 'attempt1'|'attempt2'|'attempt3', label: string) => {
        const data = (liveData[lift] as any)?.[attempt] || { kg: '', status: 'pending' };
        return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 30, fontSize: 12, color: 'var(--secondary-foreground)' }}>{label}</span>
                <input 
                    type="number" 
                    value={data.kg || ''} 
                    onChange={e => handleUpdate(lift, attempt, 'kg', parseFloat(e.target.value) || 0)}
                    style={{ width: 70, padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13 }}
                    placeholder="kg"
                />
                <select 
                    value={data.status}
                    onChange={e => handleUpdate(lift, attempt, 'status', e.target.value)}
                    style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', borderRadius: 4, color: data.status === 'made' ? 'var(--success)' : data.status === 'missed' ? 'var(--error)' : 'var(--foreground)', fontSize: 13 }}
                >
                    <option value="pending">Pending</option>
                    <option value="made">Made</option>
                    <option value="missed">Missed</option>
                </select>
            </div>
        );
    };

    return (
        <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12, overflow: 'hidden' }}>
            <div 
                style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? 'rgba(245, 158, 11, 0.1)' : 'transparent', transition: 'all 0.2s' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
                    <ActivitySquare size={16} style={{ display: 'inline', marginRight: 8 }} /> Live Meet Day Tracker
                </div>
                <div style={{ fontSize: 12, color: 'var(--secondary-foreground)', fontWeight: 600 }}>{isOpen ? 'HIDE' : 'EXPAND'}</div>
            </div>
            
            {isOpen && (
                <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(245, 158, 11, 0.1)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#7d87d2', textTransform: 'uppercase', marginBottom: 12 }}>Squat</div>
                        {renderAttempt('squat', 'attempt1', '1st')}
                        {renderAttempt('squat', 'attempt2', '2nd')}
                        {renderAttempt('squat', 'attempt3', '3rd')}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', marginBottom: 12 }}>Bench</div>
                        {renderAttempt('bench', 'attempt1', '1st')}
                        {renderAttempt('bench', 'attempt2', '2nd')}
                        {renderAttempt('bench', 'attempt3', '3rd')}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 12 }}>Deadlift</div>
                        {renderAttempt('deadlift', 'attempt1', '1st')}
                        {renderAttempt('deadlift', 'attempt2', '2nd')}
                        {renderAttempt('deadlift', 'attempt3', '3rd')}
                    </div>
                </div>
            )}
        </div>
    );
}

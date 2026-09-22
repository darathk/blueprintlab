'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Shuffle, Check, X, ArrowRight, Activity, Dumbbell, Sparkles, SlidersHorizontal, Info, Target, Calendar } from 'lucide-react';
import {
    generatePivotWeek,
    calculateWeekMovementStress,
    detectCompetitionStances,
    resolveCategory,
    PivotStanceConfig,
    MovementStressBreakdown,
    PivotGenerationResult
} from '@/lib/pivot-generator';
import { EXERCISE_CATEGORIES } from '@/lib/exercise-db';

interface PivotRandomizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    weeks: any[];
    currentWeekNum: number;
    exerciseDB?: Record<string, any>;
    liftTargets?: Record<string, { timeToPeak: string; stressTarget: string }>;
    onApplyPivot: (newSessions: any[], targetWeekNum: number, replaceExisting: boolean) => void;
}

export default function PivotRandomizerModal({
    isOpen,
    onClose,
    weeks = [],
    currentWeekNum = 1,
    exerciseDB,
    liftTargets,
    onApplyPivot,
}: PivotRandomizerModalProps) {
    // Determine default reference week (preceding week if available, else current week)
    const availableWeeks = useMemo(() => {
        return weeks
            .filter(w => (w.sessions || []).length > 0)
            .sort((a, b) => a.weekNumber - b.weekNumber);
    }, [weeks]);

    const defaultRefWeekNum = useMemo(() => {
        if (currentWeekNum > 1 && weeks.some(w => w.weekNumber === currentWeekNum - 1)) {
            return currentWeekNum - 1;
        }
        if (availableWeeks.length > 0) {
            return availableWeeks[0].weekNumber;
        }
        return currentWeekNum;
    }, [currentWeekNum, weeks, availableWeeks]);

    const [selectedRefWeekNum, setSelectedRefWeekNum] = useState<number>(defaultRefWeekNum);
    const [targetRatio, setTargetRatio] = useState<number>(0.5); // 50%
    const [stances, setStances] = useState<PivotStanceConfig>({
        squatStance: 'low_bar',
        deadliftStance: 'conventional',
        keepBenchGroove: true,
    });
    const [destinationMode, setDestinationMode] = useState<'replace' | 'append'>('replace');
    const [randomSeed, setRandomSeed] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    // Get current reference week object
    const referenceWeek = useMemo(() => {
        return weeks.find(w => w.weekNumber === selectedRefWeekNum) || weeks[0] || { weekNumber: 1, sessions: [] };
    }, [weeks, selectedRefWeekNum]);

    // Parse athlete Lift Targets by category
    const parsedLiftTargets = useMemo(() => {
        if (!liftTargets) return null;
        let knee = 0;
        let hip = 0;
        let pushH = 0;

        Object.entries(liftTargets).forEach(([lift, { stressTarget }]) => {
            const val = parseFloat(stressTarget) || 0;
            if (val <= 0) return;
            const cat = resolveCategory(lift, exerciseDB);
            if (cat === EXERCISE_CATEGORIES.KNEE) knee += val;
            else if (cat === EXERCISE_CATEGORIES.HIP) hip += val;
            else if (cat === EXERCISE_CATEGORIES.PUSH_HORIZONTAL) pushH += val;
        });

        if (knee === 0 && hip === 0 && pushH === 0) return null;
        return {
            knee: Math.round(knee * 10) / 10,
            hip: Math.round(hip * 10) / 10,
            pushH: Math.round(pushH * 10) / 10,
        };
    }, [liftTargets, exerciseDB]);

    // Calculate baseline stress directly from reference week sessions
    const referenceWeekCalculated = useMemo(() => {
        return calculateWeekMovementStress(referenceWeek.sessions || [], exerciseDB);
    }, [referenceWeek, exerciseDB]);

    // Stress source state: 'lift_targets' | 'reference_week' | 'custom'
    const [stressSource, setStressSource] = useState<'lift_targets' | 'reference_week' | 'custom'>(() => {
        return parsedLiftTargets ? 'lift_targets' : 'reference_week';
    });

    // Editable Baseline Stress Index inputs for Knee, Hip, Push-H
    const [inputKnee, setInputKnee] = useState<string>('');
    const [inputHip, setInputHip] = useState<string>('');
    const [inputPushH, setInputPushH] = useState<string>('');

    // Sync input values when reference week or parsedLiftTargets change
    useEffect(() => {
        if (!isOpen) return;

        if (stressSource === 'lift_targets' && parsedLiftTargets) {
            setInputKnee(String(parsedLiftTargets.knee || 9.0));
            setInputHip(String(parsedLiftTargets.hip || 7.0));
            setInputPushH(String(parsedLiftTargets.pushH || 11.0));
        } else if (stressSource === 'reference_week') {
            const baseKnee = referenceWeekCalculated.knee > 0 ? referenceWeekCalculated.knee : 9.0;
            const baseHip = referenceWeekCalculated.hip > 0 ? referenceWeekCalculated.hip : 7.0;
            const basePushH = referenceWeekCalculated.pushH > 0 ? referenceWeekCalculated.pushH : 11.0;
            setInputKnee(String(baseKnee));
            setInputHip(String(baseHip));
            setInputPushH(String(basePushH));
        }
    }, [isOpen, stressSource, parsedLiftTargets, referenceWeekCalculated]);

    // On initial open or reference week change, detect athlete stances from reference sessions
    useEffect(() => {
        if (isOpen && referenceWeek) {
            const detected = detectCompetitionStances(referenceWeek.sessions || []);
            setStances(detected);
            setSelectedRefWeekNum(defaultRefWeekNum);
        }
    }, [isOpen, referenceWeek, defaultRefWeekNum]);

    // Build custom baseline stress object from coach inputs
    const activeCustomBaseline = useMemo(() => {
        const k = parseFloat(inputKnee);
        const h = parseFloat(inputHip);
        const p = parseFloat(inputPushH);
        return {
            knee: !isNaN(k) && k > 0 ? k : 9.0,
            hip: !isNaN(h) && h > 0 ? h : 7.0,
            pushH: !isNaN(p) && p > 0 ? p : 11.0,
        };
    }, [inputKnee, inputHip, inputPushH]);

    // Procedural generation result based on settings, custom baseline stress & randomSeed
    const generationResult = useMemo<PivotGenerationResult>(() => {
        // randomSeed triggers re-computation
        void randomSeed;
        return generatePivotWeek({
            referenceWeek,
            targetRatio,
            stances,
            exerciseDB,
            customBaselineStress: activeCustomBaseline,
        });
    }, [referenceWeek, targetRatio, stances, exerciseDB, activeCustomBaseline, randomSeed]);

    const handleRandomize = useCallback(() => {
        setIsGenerating(true);
        setTimeout(() => {
            setRandomSeed(prev => prev + 1);
            setIsGenerating(false);
        }, 120);
    }, []);

    const handleApply = useCallback(() => {
        const targetWeek = destinationMode === 'replace' ? currentWeekNum : Math.max(...weeks.map(w => w.weekNumber), 0) + 1;
        onApplyPivot(generationResult.sessions, targetWeek, destinationMode === 'replace');
        onClose();
    }, [destinationMode, currentWeekNum, weeks, onApplyPivot, generationResult.sessions, onClose]);

    if (!isOpen) return null;

    const { baselineStress, targetStress, generatedStress, sessions } = generationResult;

    // Helper for percentage match
    const getMatchPercent = (gen: number, target: number) => {
        if (target <= 0) return 100;
        return Math.round((gen / target) * 100);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.82)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'var(--card-bg, #0f172a)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '1040px',
                    maxHeight: '94vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 60px -15px rgba(168, 85, 247, 0.25), 0 0 40px rgba(0, 0, 0, 0.6)',
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div
                    style={{
                        padding: '16px 22px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                            style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
                            }}
                        >
                            <Shuffle size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--foreground, #fff)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Pivot Week Randomizer
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                                    50% Deload SI
                                </span>
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--secondary-foreground, #94a3b8)', marginTop: '2px' }}>
                                Procedural variation generator • Opposite-stance desensitization • Editable lift SI inputs
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--secondary-foreground, #94a3b8)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                        onMouseOut={e => (e.currentTarget.style.color = 'var(--secondary-foreground, #94a3b8)')}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── Modal Body (Scrollable) ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* ── Top Settings Bar ── */}
                    <div
                        style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '14px',
                            alignItems: 'center',
                        }}
                    >
                        {/* Reference Week Selector */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--secondary-foreground, #94a3b8)', marginBottom: '5px' }}>
                                Schedule & Day Template
                            </label>
                            <select
                                value={selectedRefWeekNum}
                                onChange={e => setSelectedRefWeekNum(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0, 0, 0, 0.35)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '6px',
                                    color: 'var(--foreground, #fff)',
                                    padding: '6px 10px',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {weeks.map(w => (
                                    <option key={w.weekNumber} value={w.weekNumber} style={{ background: '#0f172a', color: '#fff' }}>
                                        Week {w.weekNumber} ({w.sessions?.length || 0} sessions) {w.weekNumber === currentWeekNum ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Squat Stance Selector */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--secondary-foreground, #94a3b8)', marginBottom: '5px' }}>
                                Squat Comp Stance
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStances(prev => ({ ...prev, squatStance: 'low_bar' }))}
                                    style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: stances.squatStance === 'low_bar' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: stances.squatStance === 'low_bar' ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                                        color: stances.squatStance === 'low_bar' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Low Bar ➔ High/SSB
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStances(prev => ({ ...prev, squatStance: 'high_bar' }))}
                                    style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: stances.squatStance === 'high_bar' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: stances.squatStance === 'high_bar' ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                                        color: stances.squatStance === 'high_bar' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    High Bar ➔ Low/SSB
                                </button>
                            </div>
                        </div>

                        {/* Deadlift Stance Selector */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--secondary-foreground, #94a3b8)', marginBottom: '5px' }}>
                                Deadlift Comp Stance
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStances(prev => ({ ...prev, deadliftStance: 'sumo' }))}
                                    style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: stances.deadliftStance === 'sumo' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: stances.deadliftStance === 'sumo' ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                                        color: stances.deadliftStance === 'sumo' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Sumo ➔ Conv/RDL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStances(prev => ({ ...prev, deadliftStance: 'conventional' }))}
                                    style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: stances.deadliftStance === 'conventional' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: stances.deadliftStance === 'conventional' ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                                        color: stances.deadliftStance === 'conventional' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Conv ➔ Sumo/RDL
                                </button>
                            </div>
                        </div>

                        {/* Bench Skill Toggle */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--secondary-foreground, #94a3b8)', marginBottom: '5px' }}>
                                Bench Barbell Skill Anchor
                            </label>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(168, 85, 247, 0.1)',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    fontSize: '0.76rem',
                                    color: '#c084fc',
                                    fontWeight: 600,
                                }}
                            >
                                <Check size={14} style={{ color: '#10b981' }} />
                                <span>Close Grip, Larsen & Spoto bar groove</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Stress Calibration & Baseline SI Inputs ── */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                Movement Pattern Stress Calibration (Target: 50% Deload)
                            </span>

                            {/* Source Quick Preset Switchers */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {parsedLiftTargets && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStressSource('lift_targets');
                                            setInputKnee(String(parsedLiftTargets.knee));
                                            setInputHip(String(parsedLiftTargets.hip));
                                            setInputPushH(String(parsedLiftTargets.pushH));
                                        }}
                                        style={{
                                            background: stressSource === 'lift_targets' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                            border: stressSource === 'lift_targets' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                            color: stressSource === 'lift_targets' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                            borderRadius: '6px',
                                            padding: '3px 8px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <Target size={12} /> Use Lift Targets ({parsedLiftTargets.knee}/{parsedLiftTargets.hip}/{parsedLiftTargets.pushH})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStressSource('reference_week');
                                        const baseK = referenceWeekCalculated.knee > 0 ? referenceWeekCalculated.knee : 9.0;
                                        const baseH = referenceWeekCalculated.hip > 0 ? referenceWeekCalculated.hip : 7.0;
                                        const baseP = referenceWeekCalculated.pushH > 0 ? referenceWeekCalculated.pushH : 11.0;
                                        setInputKnee(String(baseK));
                                        setInputHip(String(baseH));
                                        setInputPushH(String(baseP));
                                    }}
                                    style={{
                                        background: stressSource === 'reference_week' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                        border: stressSource === 'reference_week' ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: stressSource === 'reference_week' ? '#c084fc' : 'var(--secondary-foreground, #94a3b8)',
                                        borderRadius: '6px',
                                        padding: '3px 8px',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <Calendar size={12} /> Week {selectedRefWeekNum} Actual
                                </button>
                            </div>
                        </div>

                        {/* 4 Stress Cards with Direct Editable Inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {/* Knee Stress Card */}
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary, #06b6d4)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Knee (Squat)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', fontWeight: 600 }}>Base SI:</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={inputKnee}
                                        onChange={e => {
                                            setInputKnee(e.target.value);
                                            setStressSource('custom');
                                        }}
                                        style={{
                                            width: '68px',
                                            background: 'rgba(0, 0, 0, 0.45)',
                                            border: '1px solid rgba(6, 182, 212, 0.4)',
                                            borderRadius: '5px',
                                            color: '#fff',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            padding: '2px 6px',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                                        {generatedStress.knee}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                        / {targetStress.knee} target (50%)
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Target: 50%</span>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                                        {getMatchPercent(generatedStress.knee, targetStress.knee)}% match
                                    </span>
                                </div>
                            </div>

                            {/* Hip Stress Card */}
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Hip (Deadlift)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', fontWeight: 600 }}>Base SI:</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={inputHip}
                                        onChange={e => {
                                            setInputHip(e.target.value);
                                            setStressSource('custom');
                                        }}
                                        style={{
                                            width: '68px',
                                            background: 'rgba(0, 0, 0, 0.45)',
                                            border: '1px solid rgba(245, 158, 11, 0.4)',
                                            borderRadius: '5px',
                                            color: '#fff',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            padding: '2px 6px',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                                        {generatedStress.hip}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                        / {targetStress.hip} target (50%)
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Target: 50%</span>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                                        {getMatchPercent(generatedStress.hip, targetStress.hip)}% match
                                    </span>
                                </div>
                            </div>

                            {/* Push-H Stress Card */}
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Horizontal Push
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', fontWeight: 600 }}>Base SI:</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={inputPushH}
                                        onChange={e => {
                                            setInputPushH(e.target.value);
                                            setStressSource('custom');
                                        }}
                                        style={{
                                            width: '68px',
                                            background: 'rgba(0, 0, 0, 0.45)',
                                            border: '1px solid rgba(168, 85, 247, 0.4)',
                                            borderRadius: '5px',
                                            color: '#fff',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            padding: '2px 6px',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                                        {generatedStress.pushH}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                        / {targetStress.pushH} target (50%)
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Target: 50%</span>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                                        {getMatchPercent(generatedStress.pushH, targetStress.pushH)}% match
                                    </span>
                                </div>
                            </div>

                            {/* Total Deload Stress Card */}
                            <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Total Deload Stress
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', margin: '4px 0' }}>
                                    Base Sum: <strong style={{ color: '#fff' }}>{baselineStress.total} SI</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                                        {generatedStress.total}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                        / {targetStress.total} target (50%)
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Total: 50%</span>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                                        {getMatchPercent(generatedStress.total, targetStress.total)}% match
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Generated Week Sessions Preview ── */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                Generated Pivot Schedule ({sessions.length} Training Days)
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground, #94a3b8)', fontStyle: 'italic' }}>
                                Auto-regulated RPE 6–7.5 • Accessories left blank for coach prescription
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(sessions.length, 4))}, 1fr)`, gap: '10px' }}>
                            {sessions.map((sess: any) => (
                                <div
                                    key={sess.id || sess.day}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 255, 255, 0.07)',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {/* Session Header */}
                                    <div
                                        style={{
                                            padding: '8px 10px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--primary, #06b6d4)' }}>
                                            Day {sess.day}
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--secondary-foreground, #94a3b8)' }}>
                                            {sess.exercises.length} lifts
                                        </span>
                                    </div>

                                    {/* Exercises List */}
                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                        {sess.exercises.map((ex: any, exIdx: number) => {
                                            const isPrimary = ex.category === 'Knee' || ex.category === 'Hip' || ex.category === 'Horizontal Push';
                                            const setsWithData = (ex.sets || []).filter((s: any) => s.reps && s.rpe);

                                            return (
                                                <div
                                                    key={ex.id || exIdx}
                                                    style={{
                                                        background: isPrimary ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.2)',
                                                        border: isPrimary ? '1px solid rgba(255, 255, 255, 0.08)' : '1px dashed rgba(255, 255, 255, 0.05)',
                                                        borderRadius: '6px',
                                                        padding: '6px 8px',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isPrimary ? '#fff' : 'var(--secondary-foreground, #94a3b8)' }}>
                                                            {ex.name}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 600,
                                                            padding: '1px 5px',
                                                            borderRadius: '4px',
                                                            background: ex.category === 'Knee'
                                                                ? 'rgba(6, 182, 212, 0.15)'
                                                                : ex.category === 'Hip'
                                                                    ? 'rgba(245, 158, 11, 0.15)'
                                                                    : ex.category === 'Horizontal Push'
                                                                        ? 'rgba(168, 85, 247, 0.15)'
                                                                        : 'rgba(255, 255, 255, 0.06)',
                                                            color: ex.category === 'Knee'
                                                                ? 'var(--primary, #06b6d4)'
                                                                : ex.category === 'Hip'
                                                                    ? '#f59e0b'
                                                                    : ex.category === 'Horizontal Push'
                                                                        ? '#c084fc'
                                                                        : 'var(--secondary-foreground, #94a3b8)',
                                                        }}>
                                                            {ex.category}
                                                        </span>
                                                    </div>

                                                    {/* Sets Info */}
                                                    {isPrimary && setsWithData.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                                            {setsWithData.map((s: any, sIdx: number) => (
                                                                <span
                                                                    key={sIdx}
                                                                    style={{
                                                                        fontSize: '0.66rem',
                                                                        fontFamily: 'monospace',
                                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '3px',
                                                                        color: '#cbd5e1',
                                                                    }}
                                                                >
                                                                    {s.reps}r @ {s.rpe}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic', marginTop: '2px' }}>
                                                            3 sets • Coach sets reps & RPE
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Modal Footer ── */}
                <div
                    style={{
                        padding: '14px 22px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                    }}
                >
                    {/* Destination Selection */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground, #94a3b8)' }}>
                            Apply To:
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setDestinationMode('replace')}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: destinationMode === 'replace' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: destinationMode === 'replace' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                                    color: destinationMode === 'replace' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                    cursor: 'pointer',
                                }}
                            >
                                Replace Current Week ({currentWeekNum})
                            </button>
                            <button
                                type="button"
                                onClick={() => setDestinationMode('append')}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: destinationMode === 'append' ? '1px solid var(--primary, #06b6d4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: destinationMode === 'append' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                                    color: destinationMode === 'append' ? 'var(--primary, #06b6d4)' : 'var(--secondary-foreground, #94a3b8)',
                                    cursor: 'pointer',
                                }}
                            >
                                Append as Next Week
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleRandomize}
                            disabled={isGenerating}
                            style={{
                                background: 'rgba(168, 85, 247, 0.15)',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                color: '#c084fc',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                                transform: isGenerating ? 'scale(0.97)' : 'none',
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)';
                                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                            }}
                        >
                            <Shuffle size={15} style={{ animation: isGenerating ? 'spin 0.4s linear infinite' : 'none' }} />
                            <span>🎲 Randomize Again</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleApply}
                            style={{
                                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '8px',
                                padding: '8px 18px',
                                fontSize: '0.84rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseOver={e => (e.currentTarget.style.opacity = '0.92')}
                            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                        >
                            <Check size={16} />
                            <span>Apply Pivot Week</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

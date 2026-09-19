'use client';

import React, { useState, useMemo } from 'react';
import { calculateDots, calculateWilks, calculateWilks2020, calculateGL, lbsToKg } from '@/lib/calculators';
import { Trophy, Award, Shield, Zap } from 'lucide-react';

export default function PointsTab() {
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [equipment, setEquipment] = useState<'raw' | 'equipped'>('raw');
    const [liftType, setLiftType] = useState<'sbd' | 'bench_only'>('sbd');
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

    const [bodyweightStr, setBodyweightStr] = useState<string>('181');
    const [totalStr, setTotalStr] = useState<string>('1482');

    const bodyweight = parseFloat(bodyweightStr) || 0;
    const total = parseFloat(totalStr) || 0;

    // Convert to KG for standard formulas
    const bwKg = unit === 'lbs' ? lbsToKg(bodyweight) : bodyweight;
    const totalKg = unit === 'lbs' ? lbsToKg(total) : total;

    // Calculations
    const results = useMemo(() => {
        if (bwKg <= 0 || totalKg <= 0) {
            return { dots: 0, wilks: 0, wilks2020: 0, gl: 0 };
        }

        const isMale = gender === 'male';
        const isEquipped = equipment === 'equipped';
        const isBenchOnly = liftType === 'bench_only';

        const dots = calculateDots(totalKg, bwKg, isMale);
        const wilks = parseFloat(calculateWilks(totalKg, bwKg, isMale).toFixed(2));
        const wilks2020 = calculateWilks2020(totalKg, bwKg, isMale);
        const gl = parseFloat(calculateGL(totalKg, bwKg, isMale, isEquipped, isBenchOnly).toFixed(2));

        return { dots, wilks, wilks2020, gl };
    }, [bwKg, totalKg, gender, equipment, liftType]);

    // Qualitative classifications based on DOTS score
    const getDotsTier = (score: number) => {
        if (score >= 500) return { label: 'World Class / Elite Pro', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' };
        if (score >= 450) return { label: 'Elite', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
        if (score >= 400) return { label: 'Master / National', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' };
        if (score >= 350) return { label: 'Class I', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
        if (score >= 300) return { label: 'Class II', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
        if (score >= 250) return { label: 'Class III', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
        return { label: 'Novice', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)' };
    };

    const tier = getDotsTier(results.dots);

    return (
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto">
            {/* Header exact to Screenshots 8-12 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Powerlifting Points Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                    Calculate DOTS, Wilks, Wilks 2020, and IPF scores for powerlifting
                </p>
            </div>

            {/* Input Card exact to Screenshot 8 */}
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
                {/* 1. COMPETITION DETAILS */}
                <div className="flex flex-col gap-3">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', textAlign: 'center' }}>
                        Competition Details
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Gender */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Gender
                            </label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 12px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>

                        {/* Equipment */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Equipment
                            </label>
                            <select
                                value={equipment}
                                onChange={(e) => setEquipment(e.target.value as 'raw' | 'equipped')}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 12px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            >
                                <option value="raw">Raw</option>
                                <option value="equipped">Equipped</option>
                            </select>
                        </div>

                        {/* Lift Type */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Lift Type
                            </label>
                            <select
                                value={liftType}
                                onChange={(e) => setLiftType(e.target.value as 'sbd' | 'bench_only')}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 12px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            >
                                <option value="sbd">SBD Total</option>
                                <option value="bench_only">Bench Only</option>
                            </select>
                        </div>

                        {/* Unit */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Unit
                            </label>
                            <select
                                value={unit}
                                onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 12px',
                                    borderRadius: '12px',
                                    background: '#1a1a24',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            >
                                <option value="lbs">lbs</option>
                                <option value="kg">kg</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. COMPETITION PERFORMANCE */}
                <div className="flex flex-col gap-3">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', textAlign: 'center' }}>
                        Competition Performance
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bodyweight */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Bodyweight
                            </label>
                            <div
                                className="flex items-center px-4"
                                style={{
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                <input
                                    type="number"
                                    step="any"
                                    value={bodyweightStr}
                                    onChange={(e) => setBodyweightStr(e.target.value)}
                                    placeholder="181"
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 700 }}>
                                    {unit}
                                </span>
                            </div>
                        </div>

                        {/* Total */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '6px', textAlign: 'center' }}>
                                Total
                            </label>
                            <div
                                className="flex items-center px-4"
                                style={{
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                <input
                                    type="number"
                                    step="any"
                                    value={totalStr}
                                    onChange={(e) => setTotalStr(e.target.value)}
                                    placeholder="1482"
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 700 }}>
                                    {unit}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTS SECTION: 4 Formula Cards */}
            {results.dots > 0 && (
                <div className="w-full flex flex-col gap-4">
                    {/* Overall Classification Banner */}
                    <div
                        className="flex items-center justify-between px-6 py-3 rounded-xl"
                        style={{
                            background: tier.bg,
                            border: `1px solid ${tier.border}`,
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            <Trophy size={18} style={{ color: tier.color }} />
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                                Strength Classification:
                            </span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: tier.color }}>
                                {tier.label}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            {totalKg.toFixed(1)} kg / {bwKg.toFixed(1)} kg BW ({ (totalKg / bwKg).toFixed(2) }x BW)
                        </span>
                    </div>

                    {/* 4 Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. DOTS */}
                        <div
                            className="glass-panel flex flex-col p-5 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(16, 16, 24, 0.75)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    DOTS
                                </span>
                                <Zap size={15} className="text-red-400" />
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                {results.dots}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '8px' }}>
                                Primary USAPL, WRPF, PLU, USPA standard
                            </span>
                        </div>

                        {/* 2. IPF GL Points */}
                        <div
                            className="glass-panel flex flex-col p-5 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(16, 16, 24, 0.75)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    IPF GL Points
                                </span>
                                <Shield size={15} className="text-cyan-400" />
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                {results.gl}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '8px' }}>
                                Official International Powerlifting Fed standard
                            </span>
                        </div>

                        {/* 3. Wilks 2020 */}
                        <div
                            className="glass-panel flex flex-col p-5 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(16, 16, 24, 0.75)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Wilks 2020
                                </span>
                                <Award size={15} className="text-purple-400" />
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                {results.wilks2020}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '8px' }}>
                                Modern recalibrated Wilks polynomial
                            </span>
                        </div>

                        {/* 4. Classic Wilks */}
                        <div
                            className="glass-panel flex flex-col p-5 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(16, 16, 24, 0.75)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Classic Wilks
                                </span>
                                <Trophy size={15} className="text-amber-400" />
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                {results.wilks}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '8px' }}>
                                Historical standard across all divisions
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

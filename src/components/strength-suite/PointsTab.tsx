'use client';

import React, { useState, useMemo } from 'react';
import { calculateDots, calculateWilks, calculateWilks2020, calculateGL, lbsToKg } from '@/lib/calculators';
import StrengthSelect from './StrengthSelect';
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
        if (score >= 500) return { label: 'World Class / Elite Pro', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' };
        if (score >= 450) return { label: 'Elite', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
        if (score >= 400) return { label: 'Master / National', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' };
        if (score >= 350) return { label: 'Class I', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' };
        if (score >= 300) return { label: 'Class II', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
        if (score >= 250) return { label: 'Class III', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
        return { label: 'Novice', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    };

    const tier = getDotsTier(results.dots);

    return (
        <div className="w-full flex flex-col items-center gap-6 max-w-4xl mx-auto px-3 sm:px-4">
            {/* Header exact to Screenshots 8-12 */}
            <div className="text-center flex flex-col items-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Powerlifting Points Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                    Calculate DOTS, Wilks, Wilks 2020, and IPF scores for powerlifting
                </p>
            </div>

            {/* Input Card exact to Screenshot 8 */}
            <div
                className="w-full flex flex-col gap-6 p-4 sm:p-6 md:p-8 rounded-3xl"
                style={{
                    background: 'rgba(20, 20, 30, 0.65)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
            >
                {/* 1. COMPETITION DETAILS */}
                <div className="flex flex-col">
                    <h4
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: '16px',
                        }}
                    >
                        Competition Details
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Gender */}
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
                                Gender
                            </label>
                            <StrengthSelect
                                value={gender}
                                onChange={(val) => setGender(val as 'male' | 'female')}
                                options={[
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                ]}
                            />
                        </div>

                        {/* Equipment */}
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
                                Equipment
                            </label>
                            <StrengthSelect
                                value={equipment}
                                onChange={(val) => setEquipment(val as 'raw' | 'equipped')}
                                options={[
                                    { value: 'raw', label: 'Raw' },
                                    { value: 'equipped', label: 'Equipped' },
                                ]}
                            />
                        </div>

                        {/* Lift Type */}
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
                                Lift Type
                            </label>
                            <StrengthSelect
                                value={liftType}
                                onChange={(val) => setLiftType(val as 'sbd' | 'bench_only')}
                                options={[
                                    { value: 'sbd', label: 'SBD Total' },
                                    { value: 'bench_only', label: 'Bench Only' },
                                ]}
                            />
                        </div>

                        {/* Unit */}
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
                                Unit
                            </label>
                            <StrengthSelect
                                value={unit}
                                onChange={(val) => setUnit(val as 'lbs' | 'kg')}
                                options={[
                                    { value: 'lbs', label: 'lbs' },
                                    { value: 'kg', label: 'kg' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. COMPETITION PERFORMANCE */}
                <div className="flex flex-col mt-2">
                    <h4
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: '16px',
                        }}
                    >
                        Competition Performance
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Bodyweight */}
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
                                Bodyweight
                            </label>
                            <div
                                className="flex items-center justify-center px-4"
                                style={{
                                    height: '50px',
                                    borderRadius: '12px',
                                    background: 'rgba(10, 10, 16, 0.55)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
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
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Total */}
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
                                Total
                            </label>
                            <div
                                className="flex items-center justify-center px-4"
                                style={{
                                    height: '50px',
                                    borderRadius: '12px',
                                    background: 'rgba(10, 10, 16, 0.55)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
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
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTS SECTION: 4 Formula Cards */}
            {results.dots > 0 && (
                <div className="w-full flex flex-col gap-4 pb-32 md:pb-12">
                    {/* Overall Classification Banner */}
                    <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 rounded-2xl w-full"
                        style={{
                            background: tier.bg,
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: `1px solid ${tier.border}`,
                            boxShadow: `0 0 24px ${tier.bg}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
                        }}
                    >
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div
                                className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                                style={{ background: `${tier.color}22`, border: `1px solid ${tier.color}44` }}
                            >
                                <Trophy size={16} style={{ color: tier.color }} />
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-white/80">
                                Strength Classification:
                            </span>
                            <span
                                className="text-xs sm:text-sm font-black px-3 py-1 rounded-full"
                                style={{
                                    color: tier.color,
                                    background: `${tier.color}20`,
                                    border: `1px solid ${tier.color}40`,
                                    textShadow: `0 0 12px ${tier.color}66`,
                                }}
                            >
                                {tier.label}
                            </span>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-white/70 sm:text-right">
                            {totalKg.toFixed(1)} kg / {bwKg.toFixed(1)} kg BW{' '}
                            <span className="text-white/40">({(totalKg / bwKg).toFixed(2)}x BW)</span>
                        </div>
                    </div>

                    {/* 4 Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. DOTS */}
                        <div
                            className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(20, 20, 30, 0.65)',
                                backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                minHeight: '150px',
                            }}
                        >
                            <div className="flex items-center justify-between gap-2 w-full mb-3">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-red-500" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>
                                    DOTS
                                </span>
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-red-500/10 border border-red-500/20 text-red-400">
                                    <Zap size={14} />
                                </div>
                            </div>
                            <div className="my-1">
                                <span
                                    className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight"
                                    style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}
                                >
                                    {results.dots}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-white/50 mt-2 leading-tight">
                                Primary USAPL, WRPF, PLU, USPA standard
                            </span>
                        </div>

                        {/* 2. IPF GL Points */}
                        <div
                            className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(20, 20, 30, 0.65)',
                                backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                minHeight: '150px',
                            }}
                        >
                            <div className="flex items-center justify-between gap-2 w-full mb-3">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400" style={{ textShadow: '0 0 10px rgba(56, 189, 248, 0.3)' }}>
                                    IPF GL Points
                                </span>
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-sky-500/10 border border-sky-500/20 text-sky-400">
                                    <Shield size={14} />
                                </div>
                            </div>
                            <div className="my-1">
                                <span
                                    className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight"
                                    style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.3)' }}
                                >
                                    {results.gl}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-white/50 mt-2 leading-tight">
                                Official International Powerlifting Fed standard
                            </span>
                        </div>

                        {/* 3. Wilks 2020 */}
                        <div
                            className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(20, 20, 30, 0.65)',
                                backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(168, 85, 247, 0.25)',
                                boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                minHeight: '150px',
                            }}
                        >
                            <div className="flex items-center justify-between gap-2 w-full mb-3">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-400" style={{ textShadow: '0 0 10px rgba(168, 85, 247, 0.3)' }}>
                                    Wilks 2020
                                </span>
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                    <Award size={14} />
                                </div>
                            </div>
                            <div className="my-1">
                                <span
                                    className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight"
                                    style={{ textShadow: '0 0 20px rgba(168, 85, 247, 0.3)' }}
                                >
                                    {results.wilks2020}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-white/50 mt-2 leading-tight">
                                Modern recalibrated Wilks polynomial
                            </span>
                        </div>

                        {/* 4. Classic Wilks */}
                        <div
                            className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl relative overflow-hidden"
                            style={{
                                background: 'rgba(20, 20, 30, 0.65)',
                                backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(245, 158, 11, 0.1) 0%, transparent 70%)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                minHeight: '150px',
                            }}
                        >
                            <div className="flex items-center justify-between gap-2 w-full mb-3">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>
                                    Classic Wilks
                                </span>
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                    <Trophy size={14} />
                                </div>
                            </div>
                            <div className="my-1">
                                <span
                                    className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight"
                                    style={{ textShadow: '0 0 20px rgba(245, 158, 11, 0.3)' }}
                                >
                                    {results.wilks}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-white/50 mt-2 leading-tight">
                                Historical standard across all divisions
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

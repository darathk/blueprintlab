'use client';

import React, { useState } from 'react';
import BarbellTab from './BarbellTab';
import RpeTab from './RpeTab';
import PointsTab from './PointsTab';
import MaxTab from './MaxTab';
import CompareFedsTab from './CompareFedsTab';
import { Dumbbell, Activity, Award, Flame, Scale, X } from 'lucide-react';

export type StrengthSuiteTab = 'barbell' | 'rpe' | 'points' | 'max' | 'feds';

interface StrengthSuiteProps {
    initialTab?: StrengthSuiteTab;
    initialWeight?: number | string;
    initialUnit?: 'kg' | 'lb';
    onClose?: () => void;
    isModal?: boolean;
}

const TABS: { id: StrengthSuiteTab; label: string; icon: React.ReactNode }[] = [
    { id: 'barbell', label: 'Barbell', icon: <Dumbbell size={15} /> },
    { id: 'rpe', label: 'RPE', icon: <Activity size={15} /> },
    { id: 'points', label: 'Points', icon: <Award size={15} /> },
    { id: 'max', label: 'Max', icon: <Flame size={15} /> },
    { id: 'feds', label: 'Compare Feds', icon: <Scale size={15} /> },
];

export default function StrengthSuite({
    initialTab = 'barbell',
    initialWeight = 100,
    initialUnit = 'kg',
    onClose,
    isModal = false,
}: StrengthSuiteProps) {
    const [activeTab, setActiveTab] = useState<StrengthSuiteTab>(initialTab);
    const [barbellTargetWeight, setBarbellTargetWeight] = useState<number | string>(initialWeight);
    const [barbellUnit, setBarbellUnit] = useState<'kg' | 'lb'>(initialUnit);

    const handleSendToBarbell = (weight: number, unit: 'kg' | 'lb') => {
        setBarbellTargetWeight(weight);
        setBarbellUnit(unit);
        setActiveTab('barbell');
    };

    return (
        <div className="w-full flex flex-col items-center">
            {/* Top Navigation Capsule Pill Bar exact to Screenshots */}
            <div className="w-full max-w-4xl flex items-center justify-between mb-8 px-2">
                <div className="flex-1 flex justify-center">
                    <div
                        className="inline-flex items-center gap-1 p-1.5 rounded-2xl overflow-x-auto max-w-full"
                        style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className="chat-press flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer select-none"
                                    style={{
                                        background: isActive ? '#ef4444' : 'transparent',
                                        color: isActive ? '#ffffff' : 'var(--secondary-foreground)',
                                        fontWeight: isActive ? 800 : 600,
                                        fontSize: '0.85rem',
                                        border: isActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                        boxShadow: isActive ? '0 2px 14px rgba(239, 68, 68, 0.4)' : 'none',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <span style={{ opacity: isActive ? 1 : 0.75 }}>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Close Button if inside Modal */}
                {isModal && onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="chat-press flex items-center justify-center w-10 h-10 rounded-full"
                        style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            cursor: 'pointer',
                        }}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Active Tab Panel with Emil Kowalski subtle fade-in */}
            <div className="w-full transition-opacity duration-200 ease-out">
                {activeTab === 'barbell' && (
                    <BarbellTab
                        initialWeight={barbellTargetWeight}
                        initialUnit={barbellUnit}
                    />
                )}
                {activeTab === 'rpe' && (
                    <RpeTab onSendToBarbell={handleSendToBarbell} />
                )}
                {activeTab === 'points' && (
                    <PointsTab />
                )}
                {activeTab === 'max' && (
                    <MaxTab />
                )}
                {activeTab === 'feds' && (
                    <CompareFedsTab />
                )}
            </div>
        </div>
    );
}

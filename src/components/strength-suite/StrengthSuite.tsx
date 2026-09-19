'use client';

import React, { useState } from 'react';
import BarbellTab from './BarbellTab';
import RpeTab from './RpeTab';
import PointsTab from './PointsTab';
import MaxTab from './MaxTab';
import CompareFedsTab from './CompareFedsTab';
import { X } from 'lucide-react';

export type StrengthSuiteTab = 'barbell' | 'rpe' | 'points' | 'max' | 'feds';

interface StrengthSuiteProps {
    initialTab?: StrengthSuiteTab;
    initialWeight?: number | string;
    initialUnit?: 'kg' | 'lb';
    onClose?: () => void;
    isModal?: boolean;
}

const TABS: { id: StrengthSuiteTab; label: string }[] = [
    { id: 'barbell', label: 'Barbell' },
    { id: 'rpe', label: 'RPE' },
    { id: 'points', label: 'Points' },
    { id: 'max', label: 'Max' },
    { id: 'feds', label: 'Compare Feds' },
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
            {/* Top Navigation Capsule Pill Bar */}
            <div className="w-full relative flex items-center justify-center mb-5 sm:mb-6 px-1 sm:px-2">
                <div className="w-full flex justify-center overflow-x-auto no-scrollbar scroll-smooth py-1">
                    <div
                        className="inline-flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-full shrink-0 mx-auto"
                        style={{
                            background: 'rgba(20, 20, 30, 0.75)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                        }}
                    >
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className="chat-press flex items-center justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all cursor-pointer select-none whitespace-nowrap shrink-0 hover:text-white min-h-[38px] sm:min-h-[42px]"
                                    style={{
                                        background: isActive ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
                                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                                        fontWeight: isActive ? 800 : 600,
                                        fontSize: '0.8125rem',
                                        border: isActive ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                                        boxShadow: isActive ? '0 0 18px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : 'none',
                                    }}
                                >
                                    {tab.label}
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
                        className="chat-press absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full shrink-0 z-20"
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            cursor: 'pointer',
                        }}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Active Tab Panel */}
            <div className="w-full">
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

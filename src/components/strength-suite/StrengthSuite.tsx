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
            <div className="w-full flex items-center justify-center mb-8 px-2 relative">
                <div
                    className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl overflow-x-auto no-scrollbar max-w-full"
                    style={{
                        background: '#222328',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                    }}
                >
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className="chat-press flex items-center justify-center px-6 sm:px-7 py-2.5 rounded-xl transition-all cursor-pointer select-none whitespace-nowrap shrink-0"
                                style={{
                                    background: isActive ? '#ef4444' : 'transparent',
                                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                                    fontWeight: isActive ? 800 : 700,
                                    fontSize: '0.9rem',
                                    border: isActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                    boxShadow: isActive ? '0 2px 14px rgba(239, 68, 68, 0.45)' : 'none',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Close Button if inside Modal */}
                {isModal && onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="chat-press absolute right-0 sm:right-4 flex items-center justify-center w-10 h-10 rounded-full"
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            cursor: 'pointer',
                        }}
                        aria-label="Close"
                    >
                        <X size={18} />
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

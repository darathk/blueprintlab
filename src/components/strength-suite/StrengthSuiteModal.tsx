'use client';

import React, { useEffect } from 'react';
import StrengthSuite, { StrengthSuiteTab } from './StrengthSuite';

interface StrengthSuiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: StrengthSuiteTab;
    initialWeight?: number | string;
    initialUnit?: 'kg' | 'lb';
}

export default function StrengthSuiteModal({
    isOpen,
    onClose,
    initialTab = 'barbell',
    initialWeight,
    initialUnit,
}: StrengthSuiteModalProps) {
    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6"
            style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8"
                style={{
                    background: 'rgba(12, 12, 18, 0.96)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                }}
            >
                <StrengthSuite
                    initialTab={initialTab}
                    initialWeight={initialWeight}
                    initialUnit={initialUnit}
                    onClose={onClose}
                    isModal={true}
                />
            </div>
        </div>
    );
}

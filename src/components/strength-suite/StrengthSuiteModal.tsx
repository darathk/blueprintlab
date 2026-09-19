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
                background: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8"
                style={{
                    background: 'rgba(14, 14, 22, 0.92)',
                    backdropFilter: 'blur(32px)',
                    WebkitBackdropFilter: 'blur(32px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.05), 0 30px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
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

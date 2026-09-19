'use client';

import React from 'react';
import StrengthSuite from '@/components/strength-suite/StrengthSuite';

interface PlateLoaderProps {
    initialWeight?: string | number;
    initialUnit?: 'kg' | 'lb';
    inline?: boolean;
    onClose?: () => void;
}

export default function PlateLoader({
    initialWeight = '',
    initialUnit = 'kg',
    inline = false,
    onClose,
}: PlateLoaderProps) {
    const numericWeight = typeof initialWeight === 'number'
        ? initialWeight
        : parseFloat(initialWeight) || 100;

    return (
        <div className={inline ? 'w-full' : 'w-full max-w-6xl mx-auto py-6 px-4'}>
            <StrengthSuite
                initialTab="barbell"
                initialWeight={numericWeight}
                initialUnit={initialUnit}
                onClose={onClose}
                isModal={Boolean(onClose && !inline)}
            />
        </div>
    );
}

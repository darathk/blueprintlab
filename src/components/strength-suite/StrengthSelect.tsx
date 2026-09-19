'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
    value: string | number;
    label: string;
}

interface StrengthSelectProps {
    value: string | number;
    onChange: (value: string) => void;
    options: (SelectOption | string | number)[];
    placeholder?: string;
    center?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export default function StrengthSelect({
    value,
    onChange,
    options,
    placeholder,
    center = true,
    className = '',
    style,
}: StrengthSelectProps) {
    const formattedOptions: SelectOption[] = options.map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'value' in opt) {
            return opt;
        }
        return { value: opt, label: String(opt) };
    });

    return (
        <div className={`relative w-full ${className}`}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    width: '100%',
                    height: '50px',
                    borderRadius: '12px',
                    backgroundColor: '#141418',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    textAlign: center ? 'center' : 'left',
                    paddingLeft: center ? '32px' : '16px',
                    paddingRight: '36px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    ...style,
                }}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.4)';
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                {placeholder && (
                    <option value="" disabled className="bg-[#1a1a24] text-zinc-400">
                        {placeholder}
                    </option>
                )}
                {formattedOptions.map((opt) => (
                    <option
                        key={String(opt.value)}
                        value={opt.value}
                        className="bg-[#1a1a24] text-white py-1"
                    >
                        {opt.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 flex items-center justify-center">
                <ChevronDown size={16} strokeWidth={2.5} />
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';

const toDisplay = (val: any, unit: string) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (unit === 'lbs') return val.toString();
    return (num * 0.45359237).toFixed(1).replace(/\.0$/, '');
};

const toInternal = (val: any, unit: string) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (unit === 'lbs') return val.toString();
    return (num / 0.45359237).toFixed(1).replace(/\.0$/, '');
};

export default function WeightInput({ internalValue, unit, onChange, onFocus, placeholder, style }) {
    const [localValue, setLocalValue] = useState(() => toDisplay(internalValue, unit));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(toDisplay(internalValue, unit));
        }
    }, [internalValue, unit, isFocused]);

    const handleChange = (e) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(toInternal(val, unit));
    };

    return (
        <input
            type="number"
            inputMode="decimal"
            value={localValue}
            onChange={handleChange}
            onFocus={(e) => {
                setIsFocused(true);
                if (onFocus) onFocus(e);
            }}
            onBlur={() => {
                setIsFocused(false);
                setLocalValue(toDisplay(internalValue, unit));
            }}
            placeholder={placeholder}
            style={style}
        />
    );
}

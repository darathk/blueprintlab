import React, { useState, useEffect } from 'react';

const toDisplay = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    return val.toString();
};

export default function WeightInput({ internalValue, unit, onChange, onFocus, placeholder, style }) {
    const [localValue, setLocalValue] = useState(() => toDisplay(internalValue));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(toDisplay(internalValue));
        }
    }, [internalValue, isFocused]);

    const handleChange = (e) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(val);
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
                setLocalValue(toDisplay(internalValue));
            }}
            placeholder={placeholder}
            style={style}
        />
    );
}

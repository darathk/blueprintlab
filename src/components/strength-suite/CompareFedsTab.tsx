'use client';

import React, { useState } from 'react';
import { FEDERATIONS, RULE_CATEGORIES, FEDERATION_RULES_MATRIX } from '@/lib/federations-data';
import { AlertCircle, CheckSquare, Square, Check } from 'lucide-react';

export default function CompareFedsTab() {
    // Default all federations selected
    const [selectedFeds, setSelectedFeds] = useState<string[]>(FEDERATIONS.map((f) => f.id));

    const toggleFed = (id: string) => {
        setSelectedFeds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectAll = () => setSelectedFeds(FEDERATIONS.map((f) => f.id));
    const deselectAll = () => setSelectedFeds([]);

    const visibleFeds = FEDERATIONS.filter((f) => selectedFeds.includes(f.id));

    return (
        <div className="w-full flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Title exact to Screenshot 16 */}
            <div className="text-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Powerlifting Federations Comparison
                </h3>
            </div>

            {/* Note banner exact to Screenshot 16 */}
            <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
            >
                <AlertCircle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p style={{ fontSize: '0.8125rem', color: '#fef3c7', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 800, color: '#f59e0b' }}>Note: </span>
                    This information was last updated in Feb 2026 and may not reflect current rules. Please verify with each federation's official website for the most up-to-date information.
                </p>
            </div>

            {/* Select Federations to Compare Card */}
            <div
                className="glass-panel flex flex-col items-center gap-4 p-6 rounded-2xl"
                style={{
                    background: 'rgba(16, 16, 24, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                    Select Federations to Compare
                </h4>

                {/* Quick actions: [Select All] [Deselect All] */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="chat-press"
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        onClick={deselectAll}
                        className="chat-press"
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: 'var(--secondary-foreground)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Deselect All
                    </button>
                </div>

                {/* Federation Checkbox Badges exact to Screenshot 16 */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                    {FEDERATIONS.map((fed) => {
                        const isSelected = selectedFeds.includes(fed.id);
                        return (
                            <button
                                key={fed.id}
                                type="button"
                                onClick={() => toggleFed(fed.id)}
                                className="chat-press flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer"
                                style={{
                                    background: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                    border: isSelected ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                            >
                                <div
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        background: isSelected ? '#ef4444' : 'rgba(255, 255, 255, 0.06)',
                                        border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                    }}
                                >
                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: 800,
                                        color: isSelected ? '#ffffff' : 'var(--secondary-foreground)',
                                    }}
                                >
                                    {fed.shortName}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Comparison Matrix Table */}
            {visibleFeds.length === 0 ? (
                <div
                    className="glass-panel p-12 text-center rounded-2xl"
                    style={{ background: 'rgba(16, 16, 24, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                        No federations selected. Please select at least one federation above to compare rules.
                    </p>
                </div>
            ) : (
                <div
                    className="glass-panel rounded-2xl overflow-hidden"
                    style={{
                        background: 'rgba(16, 16, 24, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                                    <th
                                        style={{
                                            padding: '16px',
                                            minWidth: '200px',
                                            background: 'rgba(16, 16, 24, 0.95)',
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 2,
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            color: '#ffffff',
                                        }}
                                    >
                                        Category
                                    </th>
                                    {visibleFeds.map((fed) => (
                                        <th
                                            key={fed.id}
                                            style={{
                                                padding: '16px',
                                                minWidth: '150px',
                                                verticalAlign: 'top',
                                                borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>
                                                    {fed.fullName}
                                                </span>
                                                {fed.affiliate && (
                                                    <span style={{ fontSize: '0.7rem', color: '#f87171', fontStyle: 'italic', marginTop: '2px' }}>
                                                        {fed.affiliate}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {RULE_CATEGORIES.map((cat, rowIdx) => {
                                    const rowBg = rowIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.035)';
                                    return (
                                        <tr
                                            key={cat.id}
                                            style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                background: rowBg,
                                            }}
                                        >
                                            {/* Sticky Category Name Column */}
                                            <td
                                                style={{
                                                    padding: '14px 16px',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    color: '#ffffff',
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 1,
                                                    background: 'rgba(16, 16, 24, 0.95)',
                                                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                                                }}
                                            >
                                                {cat.label}
                                            </td>

                                            {/* Fed Rule Values */}
                                            {visibleFeds.map((fed) => {
                                                const value = FEDERATION_RULES_MATRIX[cat.id]?.[fed.id] || '—';
                                                const isYes = value.toLowerCase() === 'yes';
                                                const isRequired = value.toLowerCase().includes('required');
                                                const isNotPermitted = value.toLowerCase().includes('not permitted');

                                                let valColor = 'var(--foreground)';
                                                if (cat.id === 'approved_equipment' && isYes) {
                                                    valColor = '#ef4444'; // Red accent in screenshot
                                                } else if (isRequired) {
                                                    valColor = '#f87171';
                                                }

                                                return (
                                                    <td
                                                        key={fed.id}
                                                        style={{
                                                            padding: '14px 16px',
                                                            fontSize: '0.8125rem',
                                                            color: valColor,
                                                            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                                            fontWeight: isYes || isRequired || isNotPermitted ? 700 : 500,
                                                            lineHeight: 1.4,
                                                        }}
                                                    >
                                                        {value}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

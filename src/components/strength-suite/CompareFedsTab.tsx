'use client';

import React, { useState } from 'react';
import { FEDERATIONS, RULE_CATEGORIES, FEDERATION_RULES_MATRIX } from '@/lib/federations-data';
import { AlertCircle, Check } from 'lucide-react';

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
        <div className="w-full flex flex-col gap-6 max-w-7xl mx-auto px-3 sm:px-4 pb-32 md:pb-12">
            {/* Title exact to Screenshot 16 */}
            <div className="text-center">
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Powerlifting Federations Comparison
                </h3>
            </div>

            {/* Note banner exact to Screenshot 16 */}
            <div
                className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl"
                style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderLeft: '4px solid #f59e0b',
                    boxShadow: '0 0 20px rgba(245, 158, 11, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
            >
                <AlertCircle size={20} className="text-amber-400 mt-0.5 self-start shrink-0 mr-1" />
                <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-normal">
                    <strong className="font-bold text-amber-400 mr-1.5">Note:</strong>
                    This information was last updated in Feb 2026 and may not reflect current rules. Please verify with each federation&apos;s official website for the most up-to-date information.
                </p>
            </div>

            {/* Select Federations to Compare Card */}
            <div
                className="flex flex-col items-center gap-5 p-4 sm:p-6 md:p-7 rounded-3xl"
                style={{
                    background: 'rgba(20, 20, 30, 0.65)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
            >
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    Select Federations to Compare
                </h4>

                {/* Quick actions: [Select All] [Deselect All] */}
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="chat-press"
                        style={{
                            padding: '8px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            fontSize: '0.8rem',
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
                            padding: '8px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.65)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Deselect All
                    </button>
                </div>

                {/* Federation Checkbox Badges exact to Screenshot 16 */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-1">
                    {FEDERATIONS.map((fed) => {
                        const isSelected = selectedFeds.includes(fed.id);
                        return (
                            <button
                                key={fed.id}
                                type="button"
                                onClick={() => toggleFed(fed.id)}
                                className="chat-press flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all cursor-pointer"
                                style={{
                                    background: isSelected ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.15) 100%)' : 'rgba(10, 10, 16, 0.55)',
                                    backdropFilter: 'blur(8px)',
                                    border: isSelected ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                    boxShadow: isSelected ? '0 0 14px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
                                }}
                            >
                                <div
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        background: isSelected ? '#ef4444' : 'rgba(255, 255, 255, 0.04)',
                                        border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                    }}
                                >
                                    {isSelected && <Check size={13} strokeWidth={3.5} />}
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: 800,
                                        color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
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
                    className="p-12 text-center rounded-2xl"
                    style={{
                        background: 'rgba(20, 20, 30, 0.65)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem' }}>
                        No federations selected. Please select at least one federation above to compare rules.
                    </p>
                </div>
            ) : (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'rgba(20, 20, 30, 0.65)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.09)',
                        boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.04), 0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    }}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <th
                                        style={{
                                            padding: '16px 20px',
                                            minWidth: '220px',
                                            background: 'rgba(16, 16, 24, 0.96)',
                                            backdropFilter: 'blur(12px)',
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
                                                padding: '16px 20px',
                                                minWidth: '160px',
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
                                    const rowBg = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)';
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
                                                    padding: '16px 20px',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    color: '#ffffff',
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 1,
                                                    background: 'rgba(16, 16, 24, 0.96)',
                                                    backdropFilter: 'blur(12px)',
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

                                                let valColor = '#ffffff';
                                                if (cat.id === 'approved_equipment' && isYes) {
                                                    valColor = '#ef4444';
                                                } else if (isRequired) {
                                                    valColor = '#f87171';
                                                }

                                                return (
                                                    <td
                                                        key={fed.id}
                                                        style={{
                                                            padding: '16px 20px',
                                                            fontSize: '0.85rem',
                                                            color: valColor,
                                                            fontWeight: isYes || isRequired ? 800 : 500,
                                                            borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
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

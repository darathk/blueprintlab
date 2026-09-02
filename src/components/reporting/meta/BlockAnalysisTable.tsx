'use client';

import { useState } from 'react';
import Link from 'next/link';
import InfoTooltip from '@/components/ui/InfoTooltip';

export default function BlockAnalysisTable({ blocks, athleteId, onSelectBlock }) {
    const [sortBy, setSortBy] = useState('Date'); // Date, End E1RM, Peak E1RM, Gain

    if (!blocks || blocks.length === 0) return <div style={{ padding: '1rem', opacity: 0.7 }}>No blocks selected.</div>;

    // 1. Sorting Logic
    const sortedBlocks = [...blocks].sort((a, b) => {
        if (sortBy === 'Date') return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (sortBy === 'Start') return b.startE1RM - a.startE1RM;
        if (sortBy === 'Peak') return b.peakE1RM - a.peakE1RM;
        if (sortBy === 'End') return b.endE1RM - a.endE1RM;
        if (sortBy === 'Change') return b.gain - a.gain;
        return 0;
    });

    // 2. Max Value Calculation for bars
    const maxEndE1RM = Math.max(...blocks.map(b => b.endE1RM || 0));
    const maxPeakE1RM = Math.max(...blocks.map(b => b.peakE1RM || 0));
    const maxGain = Math.max(...blocks.map(b => Math.abs(b.gain || 0))); // Absolute for gain bars size

    const renderBar = (value, max, color = 'var(--primary)', isNegative = false) => {
        if (!value) return null;
        const width = Math.min((Math.abs(value) / max) * 100, 100);
        return (
            <div style={{
                position: 'absolute',
                top: '10%',
                bottom: '10%',
                left: isNegative ? 'auto' : 0,
                right: isNegative ? 0 : 'auto',
                width: `${width}%`,
                background: `linear-gradient(90deg, ${color}, transparent)`,
                opacity: 0.3,
                borderRadius: '2px',
                zIndex: 0
            }}></div>
        );
    };

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: 16 }}>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.4)' }}>///</span> Mission Telemetry Specs
                    <InfoTooltip text="Analyzes the Start, Peak, and End e1RM for each block you've done. 'Change' shows how much strength you gained or lost during that specific block." />
                </h3>

                <div style={{ background: 'var(--glass-surface-2)', border: '1px solid var(--glass-border)', padding: '6px 14px', borderRadius: '14px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--secondary-foreground)', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </span>
                    {['Date', 'Start', 'Peak', 'End', 'Change'].map(option => (
                        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: sortBy === option ? 'var(--foreground)' : 'var(--secondary-foreground)' }}>
                            <input
                                type="radio"
                                name="sortBy"
                                checked={sortBy === option}
                                onChange={() => setSortBy(option)}
                                style={{ accentColor: 'var(--primary)' }}
                            />
                            {option}
                        </label>
                    ))}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--glass-surface-3)', borderBottom: '1px solid var(--glass-border)', textAlign: 'left', color: 'var(--secondary-foreground)' }}>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Block Date</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Block Name</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Start</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Peak</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>End</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Change</th>
                            <th style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>CS Balance</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBlocks.map((block, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--secondary-foreground)' }}>{new Date(block.startDate).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--foreground)' }}>{block.name}</td>

                                <td style={{ padding: '0.75rem 1rem', position: 'relative' }}>
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.startE1RM ? `${block.startE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem 1rem', position: 'relative' }}>
                                    {renderBar(block.peakE1RM, maxPeakE1RM, 'var(--primary)')}
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.peakE1RM ? `${block.peakE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem 1rem', position: 'relative' }}>
                                    {renderBar(block.endE1RM, maxEndE1RM, 'var(--primary)')}
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.endE1RM ? `${block.endE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem 1rem', position: 'relative', color: block.gain > 0 ? 'var(--success)' : block.gain < 0 ? 'var(--danger)' : 'inherit', fontWeight: 'bold' }}>
                                    {block.gain !== undefined && block.gain !== null ? (
                                        <>
                                            {renderBar(block.gain, maxGain, block.gain >= 0 ? 'var(--success)' : 'var(--danger)', block.gain < 0)}
                                            <span style={{ position: 'relative', zIndex: 1 }}>
                                                {block.gain > 0 ? `+${block.gain}` : block.gain} lbs
                                            </span>
                                        </>
                                    ) : '-'}
                                </td>

                                <td style={{ padding: '0.75rem 1rem', color: 'var(--secondary-foreground)' }}>{block.csBalance || '0%'}</td>

                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    {onSelectBlock ? (
                                        <button
                                            onClick={() => onSelectBlock(block.id)}
                                            className="glass-button chat-press"
                                            style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--primary)' }}
                                            title="View Detailed Report"
                                        >
                                            View
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/dashboard/athletes/${athleteId}/programs/${block.id}/review`}
                                            className="glass-button chat-press"
                                            style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}
                                            title="View Detailed Report"
                                        >
                                            View
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

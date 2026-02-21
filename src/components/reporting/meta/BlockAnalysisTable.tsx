'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BlockAnalysisTable({ blocks, athleteId }) {
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
        <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '0.5rem', borderRadius: '4px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </span>
                    {['Date', 'Start', 'Peak', 'End', 'Change'].map(option => (
                        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="radio"
                                name="sortBy"
                                checked={sortBy === option}
                                onChange={() => setSortBy(option)}
                                style={{ accentColor: 'var(--accent)' }}
                            />
                            {option}
                        </label>
                    ))}
                </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem' }}>/// Mission Telemetry Specs</h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--card-border)', textAlign: 'left', color: 'var(--secondary-foreground)' }}>
                            <th style={{ padding: '0.75rem' }}>Block Date</th>
                            <th style={{ padding: '0.75rem' }}>Block Name</th>
                            <th style={{ padding: '0.75rem' }}>Start</th>
                            <th style={{ padding: '0.75rem' }}>Peak</th>
                            <th style={{ padding: '0.75rem' }}>End</th>
                            <th style={{ padding: '0.75rem' }}>Change</th>
                            <th style={{ padding: '0.75rem' }}>CS Balance</th>
                            <th style={{ padding: '0.75rem' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBlocks.map((block, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.75rem' }}>{new Date(block.startDate).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem' }}>{block.name}</td>

                                <td style={{ padding: '0.75rem', position: 'relative' }}>
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.startE1RM ? `${block.startE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem', position: 'relative' }}>
                                    {renderBar(block.peakE1RM, maxPeakE1RM, 'var(--primary)')}
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.peakE1RM ? `${block.peakE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem', position: 'relative' }}>
                                    {renderBar(block.endE1RM, maxEndE1RM, 'var(--primary)')}
                                    <span style={{ position: 'relative', zIndex: 1 }}>{block.endE1RM ? `${block.endE1RM} lbs` : '-'}</span>
                                </td>

                                <td style={{ padding: '0.75rem', position: 'relative' }}>
                                    {block.gain ? (
                                        <>
                                            {renderBar(block.gain, maxGain, block.gain > 0 ? 'var(--success)' : 'var(--error)', block.gain < 0)}
                                            <span style={{ position: 'relative', zIndex: 1, color: block.gain > 0 ? 'var(--success)' : (block.gain < 0 ? 'var(--error)' : 'inherit') }}>
                                                {block.gain > 0 ? '+' : ''}{block.gain} lbs
                                            </span>
                                        </>
                                    ) : '-'}
                                </td>

                                <td style={{ padding: '0.75rem' }}>{block.csBalance || '0%'}</td>

                                <td style={{ padding: '0.75rem' }}>
                                    <Link href={`/dashboard/athletes/${athleteId}/programs/${block.id}/review`} title="View Detailed Report">
                                        <span style={{ fontSize: '1.2rem', cursor: 'pointer' }}>🔍</span>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

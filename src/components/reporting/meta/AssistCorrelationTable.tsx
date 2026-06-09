'use client';

import { useState } from 'react';
import AssistForceGraph from './AssistForceGraph';
import InfoTooltip from '@/components/ui/InfoTooltip';

export default function AssistCorrelationTable({ assistData, primaryLift }) {
    const [viewMode, setViewMode] = useState('table');

    if (!assistData || assistData.length === 0) return null;

    return (
        <div className="solid-panel" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', margin: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="neon-text" style={{ color: 'var(--primary)' }}>///</span> Assist Exercises ({primaryLift})
                    <InfoTooltip text="Lists the accessory exercises you performed alongside this primary lift across all blocks. Compares how much volume you did vs. the actual strength gained, helping identify which accessories work best for you." />
                </h3>

                <div style={{ display: 'flex', background: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: '4px' }}>
                    <button
                        onClick={() => setViewMode('table')}
                        style={{ background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? '#000' : 'var(--secondary-foreground)', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                    >Table View</button>
                    <button
                        onClick={() => setViewMode('graph')}
                        style={{ background: viewMode === 'graph' ? 'var(--primary)' : 'transparent', color: viewMode === 'graph' ? '#000' : 'var(--secondary-foreground)', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                    >Graph View</button>
                </div>
            </div>

            {viewMode === 'table' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {assistData.map((item, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--card-border)',
                            borderRadius: 'var(--radius)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '0.75rem',
                                background: '#111111',
                                borderBottom: '1px solid var(--card-border)',
                                fontWeight: 600,
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}>
                                <span>{item.name}</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>
                                    Avg {primaryLift} Gain: {item.avgGain > 0 ? '+' : ''}{item.avgGain} lbs
                                </span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--secondary-foreground)' }}>
                                            <th style={{ padding: '0.5rem' }}>Block End Date</th>
                                            <th style={{ padding: '0.5rem' }}>{primaryLift} End E1RM</th>
                                            <th style={{ padding: '0.5rem' }}>{primaryLift} Peak E1RM</th>
                                            <th style={{ padding: '0.5rem' }}>{primaryLift} Gain</th>
                                            <th style={{ padding: '0.5rem' }}># Sets</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {item.blocks.map((b, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '0.5rem' }}>
                                                    {b.endDate === 'Ongoing' ? 'Ongoing' : new Date(b.endDate).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>{b.endE1RM} lbs</td>
                                                <td style={{ padding: '0.5rem' }}>{b.peakE1RM} lbs</td>
                                                <td style={{ padding: '0.5rem', color: b.gain > 0 ? 'var(--success)' : 'inherit' }}>
                                                    {b.gain > 0 ? '+' : ''}{b.gain} lbs
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>{b.sets}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <AssistForceGraph assistData={assistData} primaryLift={primaryLift} />
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import AssistForceGraph from './AssistForceGraph';
import InfoTooltip from '@/components/ui/InfoTooltip';

export default function AssistCorrelationTable({ assistData, primaryLift }) {
    const [viewMode, setViewMode] = useState('table');

    if (!assistData || assistData.length === 0) return null;

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.4)' }}>///</span> Assist Exercises ({primaryLift})
                    <InfoTooltip text="Lists the accessory exercises you performed alongside this primary lift across all blocks. Compares how much volume you did vs. the actual strength gained, helping identify which accessories work best for you." />
                </h3>

                <div style={{ display: 'flex', background: 'var(--glass-surface-2)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '3px' }}>
                    <button
                        onClick={() => setViewMode('table')}
                        className="chat-press"
                        style={{
                            background: viewMode === 'table' ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                            color: viewMode === 'table' ? '#ffffff' : 'var(--secondary-foreground)',
                            border: viewMode === 'table' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            padding: '0.4rem 1.1rem',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: viewMode === 'table' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                        }}
                    >Table View</button>
                    <button
                        onClick={() => setViewMode('graph')}
                        className="chat-press"
                        style={{
                            background: viewMode === 'graph' ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                            color: viewMode === 'graph' ? '#ffffff' : 'var(--secondary-foreground)',
                            border: viewMode === 'graph' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            padding: '0.4rem 1.1rem',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: viewMode === 'graph' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                        }}
                    >Graph View</button>
                </div>
            </div>

            {viewMode === 'table' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {assistData.map((item, i) => (
                        <div key={i} style={{
                            background: 'var(--glass-surface-1)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '14px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '0.85rem 1rem',
                                background: 'var(--glass-surface-2)',
                                borderBottom: '1px solid var(--glass-border)',
                                fontWeight: 700,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ color: 'var(--foreground)' }}>{item.name}</span>
                                <span className="glass-badge" style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>
                                    Avg {primaryLift} Gain: {item.avgGain > 0 ? '+' : ''}{item.avgGain} lbs
                                </span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--secondary-foreground)', background: 'var(--glass-surface-3)', borderBottom: '1px solid var(--glass-border)' }}>
                                            <th style={{ padding: '0.6rem 1rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>Block End Date</th>
                                            <th style={{ padding: '0.6rem 1rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>{primaryLift} End E1RM</th>
                                            <th style={{ padding: '0.6rem 1rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>{primaryLift} Peak E1RM</th>
                                            <th style={{ padding: '0.6rem 1rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>{primaryLift} Gain</th>
                                            <th style={{ padding: '0.6rem 1rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}># Sets</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {item.blocks.map((b, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '0.6rem 1rem', color: 'var(--secondary-foreground)' }}>
                                                    {b.endDate === 'Ongoing' ? 'Ongoing' : new Date(b.endDate).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.6rem 1rem', color: 'var(--foreground)' }}>{b.endE1RM} lbs</td>
                                                <td style={{ padding: '0.6rem 1rem', color: 'var(--foreground)' }}>{b.peakE1RM} lbs</td>
                                                <td style={{ padding: '0.6rem 1rem', color: b.gain > 0 ? 'var(--success)' : b.gain < 0 ? 'var(--danger)' : 'inherit', fontWeight: 'bold' }}>
                                                    {b.gain > 0 ? '+' : ''}{b.gain} lbs
                                                </td>
                                                <td style={{ padding: '0.6rem 1rem', color: 'var(--secondary-foreground)' }}>{b.sets}</td>
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

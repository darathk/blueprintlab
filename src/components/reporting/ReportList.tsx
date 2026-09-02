'use client';

import Link from 'next/link';

export default function ReportList({ reports, onView, onDelete }) {
    return (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ background: 'var(--glass-surface-3)', borderBottom: '1px solid var(--glass-border)', color: 'var(--foreground)' }}>
                    <tr>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report Type</th>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {reports.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>No reports generated yet.</td>
                        </tr>
                    ) : reports.map(report => (
                        <tr key={report.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}>
                            <td style={{ padding: '1rem 1.25rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>#{report.id}</td>
                            <td style={{ padding: '1rem 1.25rem', color: 'var(--foreground)' }}>{new Date(report.created).toLocaleDateString()}</td>
                            <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>{report.name}</td>
                            <td style={{ padding: '1rem 1.25rem' }}>
                                <span className="glass-badge" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>
                                    {report.type}
                                </span>
                            </td>
                            <td style={{ padding: '1rem 1.25rem' }}>
                                <span style={{
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'rgba(34, 197, 94, 0.12)',
                                    color: '#4ade80',
                                    border: '1px solid rgba(34, 197, 94, 0.25)'
                                }}>
                                    {report.status}
                                </span>
                            </td>
                            <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => onView(report)}
                                        title="View Report"
                                        className="glass-button chat-press"
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            color: 'var(--primary)'
                                        }}
                                    >
                                        View
                                    </button>
                                    <button
                                        title="Delete Report"
                                        onClick={() => onDelete(report.id)}
                                        className="glass-button chat-press"
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            color: '#ef4444'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

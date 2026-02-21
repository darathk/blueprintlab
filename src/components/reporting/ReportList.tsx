'use client';

import Link from 'next/link';

export default function ReportList({ reports, onView, onDelete }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ background: 'var(--accent)', color: 'black' }}>
                    <tr>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>ID</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Report Type</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {reports.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No reports generated yet.</td>
                        </tr>
                    ) : reports.map(report => (
                        <tr key={report.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <td style={{ padding: '1rem', opacity: 0.7 }}>#{report.id}</td>
                            <td style={{ padding: '1rem' }}>{new Date(report.created).toLocaleDateString()}</td>
                            <td style={{ padding: '1rem', fontWeight: 600 }}>{report.name}</td>
                            <td style={{ padding: '1rem' }}>{report.type}</td>
                            <td style={{ padding: '1rem' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem',
                                    background: 'rgba(78, 205, 196, 0.2)', color: 'var(--success)'
                                }}>
                                    {report.status}
                                </span>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => onView(report)}
                                        title="View"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                    >
                                        📄
                                    </button>
                                    <button
                                        title="Delete"
                                        onClick={() => onDelete(report.id)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--error)' }}
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

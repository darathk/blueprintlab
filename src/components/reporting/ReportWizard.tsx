'use client';

import { useState, useEffect } from 'react';

// Mock programs for now, or fetch from API
// We'll need to fetch programs for the athlete to populate the dropdown

export default function ReportWizard({ athleteId, onClose, onGenerate }) {
    const [step, setStep] = useState(1);
    const [reportType, setReportType] = useState('');
    const [programs, setPrograms] = useState([]);
    const [selectedPrograms, setSelectedPrograms] = useState([]); // Array of IDs
    const [dateRange, setDateRange] = useState('all'); // all, block, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [reportName, setReportName] = useState('New Report');

    useEffect(() => {
        // Fetch programs for this athlete to filter by
        fetch(`/api/programs?athleteId=${athleteId}`)
            .then(res => res.json())
            .then(data => setPrograms(data))
            .catch(err => console.error(err));
    }, [athleteId]);

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleGenerate = async () => {
        let finalStart = customStart;
        let finalEnd = customEnd;
        let finalDuration = '';

        if (dateRange === 'last4') {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 28); // 4 weeks
            finalStart = start.toISOString();
            finalEnd = end.toISOString();
            finalDuration = '4 Weeks';
        } else if (dateRange === 'all') {
            // Optional: leave empty to mean "all", or set broad range
            finalStart = '';
            finalEnd = '';
            finalDuration = 'All Time';
        } else {
            finalDuration = 'Custom';
        }

        const payload = {
            athleteId,
            name: reportName,
            type: reportType,
            parameters: {
                programIds: selectedPrograms,
                dateRange,
                startDate: finalStart,
                endDate: finalEnd,
                duration: finalDuration,
                // Keep raw values if needed
                customStart,
                customEnd
            }
        };

        await onGenerate(payload);
    };

    const toggleProgram = (id) => {
        if (selectedPrograms.includes(id)) {
            setSelectedPrograms(selectedPrograms.filter(pid => pid !== id));
        } else {
            setSelectedPrograms([...selectedPrograms, id]);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(9, 9, 15, 0.85)', backdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
            <div className="glass-panel-modal" style={{ width: '600px', maxWidth: '95vw', padding: '0', overflow: 'hidden', borderRadius: 20 }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', background: 'var(--glass-surface-2)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, color: 'var(--foreground)' }}>
                        Queue New <span style={{ color: 'var(--primary)' }}>Report</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="glass-button chat-press"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary-foreground)',
                            padding: 0
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Progress Bar */}
                <div style={{ padding: '2rem 3.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                        {/* Line */}
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'var(--glass-border)', zIndex: 0 }}></div>

                        {/* Steps */}
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: step >= s ? 'var(--primary)' : 'var(--glass-surface-2)',
                                border: `2px solid ${step >= s ? 'var(--primary)' : 'var(--glass-border)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: step >= s ? '#fff' : 'var(--secondary-foreground)',
                                fontWeight: 'bold', zIndex: 1,
                                marginLeft: s === 1 ? '0' : 'auto',
                                marginRight: s === 3 ? '0' : 'auto',
                                boxShadow: step >= s ? '0 0 12px rgba(125, 135, 210, 0.4)' : 'none',
                                transition: 'all 0.2s ease'
                            }}>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 3.25rem', marginTop: '-0.75rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '1.25rem' }}>
                    <span>Select Report</span>
                    <span>Enter Parameters</span>
                    <span>Review</span>
                </div>

                {/* Content */}
                <div style={{ padding: '1rem 2rem 2rem', minHeight: '300px' }}>
                    {step === 1 && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {['Meta Block Review', 'Block Review'].map(type => (
                                <div
                                    key={type}
                                    onClick={() => setReportType(type)}
                                    className="chat-press"
                                    style={{
                                        padding: '1.25rem',
                                        border: reportType === type ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        background: reportType === type ? 'rgba(125, 135, 210, 0.15)' : 'var(--glass-surface-2)',
                                        color: 'var(--foreground)',
                                        boxShadow: reportType === type ? '0 0 16px rgba(125, 135, 210, 0.25)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>{type}</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>
                                        {type === 'Meta Block Review' ? 'Cross-block analytics and accessory lift correlation across multiple programs' : 'In-depth performance trajectory, e1RM changes, and density data for a single block'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>Report Name</label>
                                <input className="glass-input" value={reportName} onChange={e => setReportName(e.target.value)} style={{ width: '100%' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>Programs (Context)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.75rem', background: 'var(--glass-surface-1)' }}>
                                    {programs.length === 0 && <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>No programs found.</span>}
                                    {programs.map(prog => (
                                        <div key={prog.id} style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPrograms.includes(prog.id)}
                                                onChange={() => toggleProgram(prog.id)}
                                                style={{ accentColor: 'var(--primary)' }}
                                            />
                                            <span style={{ fontSize: '0.88rem' }}>{prog.name} <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.78rem' }}>({new Date(prog.startDate).toLocaleDateString()})</span></span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--secondary-foreground)' }}>
                                    {selectedPrograms.length === 0 ? 'Analyzing ALL programs by default' : `${selectedPrograms.length} programs selected`}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary-foreground)' }}>Time Range</label>
                                <select className="glass-input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: '100%' }}>
                                    <option value="all" style={{ background: '#181824' }}>All Time</option>
                                    <option value="last4" style={{ background: '#181824' }}>Last 4 Weeks</option>
                                    <option value="custom" style={{ background: '#181824' }}>Custom Range</option>
                                </select>
                            </div>

                            {dateRange === 'custom' && (
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <input type="date" className="glass-input" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ flex: 1 }} />
                                    <input type="date" className="glass-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ flex: 1 }} />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Ready to Generate?</h3>
                            <div className="glass-panel" style={{ display: 'inline-block', textAlign: 'left', padding: '1.5rem 2rem', borderRadius: '16px', minWidth: '320px' }}>
                                <p style={{ margin: '0.4rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Type:</strong> <span style={{ fontWeight: 600 }}>{reportType}</span></p>
                                <p style={{ margin: '0.4rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Name:</strong> <span style={{ fontWeight: 600 }}>{reportName}</span></p>
                                <p style={{ margin: '0.4rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Scope:</strong> <span style={{ fontWeight: 600 }}>{selectedPrograms.length === 0 ? 'All Programs' : `${selectedPrograms.length} Specific Programs`}</span></p>
                                <p style={{ margin: '0.4rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Time:</strong> <span style={{ fontWeight: 600 }}>{dateRange}</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', background: 'var(--glass-surface-2)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    {step > 1 && (
                        <button onClick={handleBack} className="glass-button chat-press" style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}>Back</button>
                    )}
                    {step < 3 ? (
                        <button onClick={handleNext} disabled={!reportType} className="glass-button glass-button-primary chat-press" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', opacity: !reportType ? 0.5 : 1 }}>Next</button>
                    ) : (
                        <button onClick={handleGenerate} className="glass-button glass-button-primary chat-press" style={{ padding: '0.6rem 1.75rem', borderRadius: '12px', fontWeight: 700 }}>
                            Generate Report
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

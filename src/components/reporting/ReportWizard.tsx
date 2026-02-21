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
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '600px', maxWidth: '90vw', padding: '0', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--primary)' }}>Queue New Report</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer' }}>×</button>
                </div>

                {/* Progress Bar */}
                <div style={{ padding: '2rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                        {/* Line */}
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'var(--card-border)', zIndex: 0 }}></div>

                        {/* Steps */}
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{
                                width: '30px', height: '30px', borderRadius: '50%',
                                background: step >= s ? 'var(--accent)' : 'var(--card-bg)',
                                border: `2px solid ${step >= s ? 'var(--accent)' : 'var(--card-border)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: step >= s ? 'black' : 'var(--secondary-foreground)',
                                fontWeight: 'bold', zIndex: 1,
                                marginLeft: s === 1 ? '0' : 'auto',
                                marginRight: s === 3 ? '0' : 'auto'
                            }}>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 3.5rem', marginTop: '-1.5rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                    <span>Select Report</span>
                    <span>Enter Parameters</span>
                    <span>Review</span>
                </div>

                {/* Content */}
                <div style={{ padding: '2rem', minHeight: '300px' }}>
                    {step === 1 && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {['Meta Block Review', 'Block Review', 'Stress Balance', 'Multiple Lift Report', 'Single Lift Report'].map(type => (
                                <div
                                    key={type}
                                    onClick={() => setReportType(type)}
                                    style={{
                                        padding: '1rem',
                                        border: reportType === type ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                                        borderRadius: 'var(--radius)',
                                        cursor: 'pointer',
                                        background: reportType === type ? 'rgba(78, 205, 196, 0.1)' : 'transparent'
                                    }}
                                >
                                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{type}</h3>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="label">Report Name</label>
                                <input className="input" value={reportName} onChange={e => setReportName(e.target.value)} style={{ width: '100%' }} />
                            </div>

                            <div>
                                <label className="label">Programs (Context)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '0.5rem' }}>
                                    {programs.length === 0 && <span style={{ opacity: 0.5 }}>No programs found.</span>}
                                    {programs.map(prog => (
                                        <div key={prog.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPrograms.includes(prog.id)}
                                                onChange={() => toggleProgram(prog.id)}
                                            />
                                            <span>{prog.name} ({new Date(prog.startDate).toLocaleDateString()})</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                    {selectedPrograms.length === 0 ? 'Analyzing ALL programs by default' : `${selectedPrograms.length} programs selected`}
                                </div>
                            </div>

                            <div>
                                <label className="label">Time Range</label>
                                <select className="input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: '100%' }}>
                                    <option value="all">All Time</option>
                                    <option value="last4">Last 4 Weeks</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>

                            {dateRange === 'custom' && (
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <input type="date" className="input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <input type="date" className="input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ marginBottom: '2rem' }}>Ready to Generate?</h3>
                            <div style={{ display: 'inline-block', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '8px' }}>
                                <p><strong>Type:</strong> {reportType}</p>
                                <p><strong>Name:</strong> {reportName}</p>
                                <p><strong>Scope:</strong> {selectedPrograms.length === 0 ? 'All Programs' : `${selectedPrograms.length} Specific Programs`}</p>
                                <p><strong>Time:</strong> {dateRange}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    {step > 1 && (
                        <button onClick={handleBack} className="btn btn-secondary">Back</button>
                    )}
                    {step < 3 ? (
                        <button onClick={handleNext} disabled={!reportType} className="btn btn-primary">Next</button>
                    ) : (
                        <button onClick={handleGenerate} className="btn btn-primary" style={{ background: 'var(--success)', border: 'none', color: 'white' }}>Generate Report</button>
                    )}
                </div>
            </div>
        </div>
    );
}

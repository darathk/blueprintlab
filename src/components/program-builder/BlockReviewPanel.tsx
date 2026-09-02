'use client';

import { useState, useMemo, useEffect } from 'react';
import CompStats from '@/components/analytics/CompStats';
import BlockImprovements from '@/components/analytics/BlockImprovements';
import LiftDensity from '@/components/analytics/LiftDensity';
import MetaBlockReview from '@/components/reporting/meta/MetaBlockReview';
import { X, ExternalLink } from 'lucide-react';

interface BlockReviewPanelProps {
    athleteId: string;
    coachId: string;
    existingPrograms: any[];
    athleteLogs: any[];
    onClose: () => void;
}

export default function BlockReviewPanel({ athleteId, coachId, existingPrograms, athleteLogs, onClose }: BlockReviewPanelProps) {
    const [activeTab, setActiveTab] = useState<'block' | 'reports'>('block');
    const [selectedProgramId, setSelectedProgramId] = useState<string>(existingPrograms[0]?.id || '');
    
    // Notes state
    const [notes, setNotes] = useState('');
    const [noteId, setNoteId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Reports state
    const [reports, setReports] = useState<any[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string>('');
    const [fetchingReports, setFetchingReports] = useState(false);

    // Fetch reports when tab changes
    useEffect(() => {
        if (activeTab === 'reports' && reports.length === 0) {
            setFetchingReports(true);
            fetch(`/api/reports?athleteId=${athleteId}`)
                .then(res => res.json())
                .then(data => {
                    setReports(data || []);
                    if (data && data.length > 0) setSelectedReportId(data[0].id);
                })
                .catch(console.error)
                .finally(() => setFetchingReports(false));
        }
    }, [activeTab, athleteId, reports.length]);

    // Fetch notes for the selected program
    useEffect(() => {
        if (!athleteId || !selectedProgramId || activeTab !== 'block') return;
        
        let cancelled = false;
        setSaveStatus('idle');
        
        async function fetchNote() {
            try {
                const res = await fetch(`/api/coach-notes?athleteId=${athleteId}&programId=${selectedProgramId}`);
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setNotes(data[0].content);
                        setNoteId(data[0].id);
                    } else {
                        setNotes('');
                        setNoteId(null);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
        
        fetchNote();
        return () => { cancelled = true; };
    }, [athleteId, selectedProgramId, activeTab]);

    const programLogs = useMemo(() => {
        if (!selectedProgramId || !athleteLogs) return [];
        return athleteLogs
            .filter(l => l.programId === selectedProgramId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [selectedProgramId, athleteLogs]);

    const handleSaveNote = async () => {
        if (!notes.trim() && !noteId) return; // Nothing to save
        
        setSaving(true);
        setSaveStatus('saving');
        
        try {
            const method = noteId ? 'PUT' : 'POST';
            const body = noteId 
                ? { id: noteId, content: notes } 
                : { athleteId, programId: selectedProgramId, content: notes, category: 'general' };
                
            const res = await fetch('/api/coach-notes', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (res.ok) {
                const data = await res.json();
                if (!noteId) setNoteId(data.id);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        } catch (e) {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const selectedProgram = existingPrograms.find(p => p.id === selectedProgramId);

    return (
        <div style={{
            position: 'fixed', top: 'var(--header-height, 56px)', left: 0, bottom: 0, width: 'calc(100vw - 380px)', zIndex: 850,
            background: 'rgba(12, 14, 20, 0.85)', backdropFilter: 'blur(var(--glass-blur-lg))', WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex', flexDirection: 'column', boxShadow: 'var(--glass-shadow-lg), var(--glass-specular)',
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                    Meta Block Review
                </div>
                <button 
                    onClick={onClose}
                    className="chat-press"
                    style={{ background: 'transparent', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: '0.25rem' }}
                >
                    <X size={20} />
                </button>
            </div>

            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--glass-surface-2)', padding: '3px', borderRadius: '20px', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
                    <button 
                        onClick={() => setActiveTab('block')}
                        className="chat-press"
                        style={{ 
                            background: activeTab === 'block' ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                            color: activeTab === 'block' ? '#fff' : 'var(--secondary-foreground)',
                            border: activeTab === 'block' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            cursor: 'pointer', padding: '0.35rem 0.9rem',
                            fontWeight: 600, fontSize: '0.8rem', borderRadius: '16px',
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: activeTab === 'block' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                        }}
                    >
                        Block Summary
                    </button>
                    <button 
                        onClick={() => setActiveTab('reports')}
                        className="chat-press"
                        style={{ 
                            background: activeTab === 'reports' ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                            color: activeTab === 'reports' ? '#fff' : 'var(--secondary-foreground)',
                            border: activeTab === 'reports' ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            cursor: 'pointer', padding: '0.35rem 0.9rem',
                            fontWeight: 600, fontSize: '0.8rem', borderRadius: '16px',
                            transition: 'all 0.16s var(--ease-out)',
                            boxShadow: activeTab === 'reports' ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                        }}
                    >
                        Saved Reports
                    </button>
                </div>

                {activeTab === 'block' && (
                    <>
                        {/* Block Selector */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Select Block to Review
                            </label>
                            <select 
                                className="glass-input" 
                                value={selectedProgramId} 
                                onChange={e => setSelectedProgramId(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                            >
                                {existingPrograms.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                {selectedProgramId ? (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Block Notes & Takeaways
                                </label>
                                {saveStatus === 'saved' && <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Saved!</span>}
                                {saveStatus === 'error' && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Error saving</span>}
                            </div>
                            <textarea
                                className="input"
                                placeholder="What worked? What should change for the next block? (e.g. 'Responded well to 3x squat frequency, keep bench RPE under 9')"
                                value={notes}
                                onChange={e => {
                                    setNotes(e.target.value);
                                    if (saveStatus !== 'idle') setSaveStatus('idle');
                                }}
                                onBlur={handleSaveNote}
                                style={{ width: '100%', height: '100px', resize: 'vertical', fontSize: '0.85rem', padding: '0.75rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Comp Lifts Progression (E1RM)
                            </label>
                            <div style={{ minHeight: '200px', height: 'auto', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                {programLogs.length > 0 ? (
                                    <BlockImprovements logs={programLogs} dateRange="all" programs={existingPrograms} />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                                        No logs available for this block.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Comp Stats
                            </label>
                            <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                <CompStats logs={programLogs} programs={existingPrograms} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Rep Heatmap (Volume Distribution)
                            </label>
                            <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                <LiftDensity logs={programLogs} />
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <a 
                                href={`/dashboard/athletes/${athleteId}/reports`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                            >
                                Open Full Report <ExternalLink size={14} />
                            </a>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--secondary-foreground)', padding: '2rem', fontSize: '0.9rem' }}>
                        No past blocks found.
                    </div>
                )}
                    </>
                )}

                {/* Reports Tab Content */}
                {activeTab === 'reports' && (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Select Saved Report
                            </label>
                            {fetchingReports ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>Loading reports...</div>
                            ) : reports.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>No reports found. Generate one in the Analytics tab.</div>
                            ) : (
                                <select 
                                    className="input" 
                                    value={selectedReportId} 
                                    onChange={e => setSelectedReportId(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                                >
                                    {reports.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({new Date(r.created).toLocaleDateString()})</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {selectedReportId && (() => {
                            const report = reports.find(r => r.id === selectedReportId);
                            if (!report) return null;

                            // Filter logs for this report
                            let filtered = athleteLogs || [];
                            const { parameters } = report;

                            if (parameters.dateRange === 'custom' && parameters.customStart) {
                                filtered = filtered.filter(l => new Date(l.date) >= new Date(parameters.customStart));
                            }
                            if (parameters.dateRange === 'custom' && parameters.customEnd) {
                                filtered = filtered.filter(l => new Date(l.date) <= new Date(parameters.customEnd));
                            }
                            if (parameters.dateRange === 'last4') {
                                const cutoff = new Date();
                                cutoff.setDate(cutoff.getDate() - 28);
                                filtered = filtered.filter(l => new Date(l.date) >= cutoff);
                            }
                            if (parameters.programIds && parameters.programIds.length > 0) {
                                filtered = filtered.filter(l => parameters.programIds.includes(l.programId));
                            }

                            return (
                                <div style={{ marginTop: '1rem' }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--foreground)' }}>{report.name}</h4>
                                    
                                    {report.type === 'Meta Block Review' ? (
                                        <div style={{ overflowX: 'auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                                            <MetaBlockReview
                                                programs={existingPrograms}
                                                logs={filtered}
                                                reportParams={report.parameters}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div style={{ minHeight: '200px', height: 'auto', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                                <BlockImprovements logs={filtered} dateRange={report.parameters.dateRange} programs={existingPrograms} />
                                            </div>
                                            <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                                <CompStats logs={filtered} programs={existingPrograms} />
                                            </div>
                                            <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                                <LiftDensity logs={filtered} />
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                        <a 
                                            href={`/dashboard/athletes/${athleteId}/reports/${report.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-secondary"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                                        >
                                            View Full Screen <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
    );
}

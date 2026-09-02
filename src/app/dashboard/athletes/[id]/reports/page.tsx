'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import ReportList from '@/components/reporting/ReportList';
import ReportWizard from '@/components/reporting/ReportWizard';
import MetaBlockReview from '@/components/reporting/meta/MetaBlockReview';
import BlockReview from '@/components/reporting/meta/BlockReview';
import StressBalanceReport from '@/components/reporting/meta/StressBalanceReport';

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [reports, setReports] = useState([]);
    const [showWizard, setShowWizard] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?athleteId=${id}`);
            const data = await res.json();
            setReports(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [id]);

    const handleGenerate = async (payload) => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowWizard(false);
                fetchReports();
            } else {
                const errData = await res.json();
                alert(`Failed to generate report: ${errData.error || 'Server error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('A network error occurred while generating the report.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (reportId) => {
        if (!confirm('Are you sure you want to delete this report?')) return;
        try {
            const res = await fetch(`/api/reports?id=${reportId}`, { method: 'DELETE' });
            if (res.ok) {
                setReports(reports.filter((r: any) => r.id !== reportId));
            } else {
                alert('Failed to delete report');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting report');
        }
    };

    const [selectedReport, setSelectedReport] = useState(null);
    const [athleteData, setAthleteData] = useState({ logs: [], readiness: [], programs: [] });
    const [dataLoading, setDataLoading] = useState(true);

    const loadData = async () => {
        setDataLoading(true);
        try {
            const [l, r, p] = await Promise.all([
                fetch(`/api/logs?athleteId=${id}`).then(res => res.json()),
                fetch(`/api/readiness?athleteId=${id}`).then(res => res.json()),
                fetch(`/api/programs?athleteId=${id}`).then(res => res.json())
            ]);

            setAthleteData({
                logs: l,
                readiness: r,
                programs: p
            });
        } catch (error) {
            console.error("Failed to load athlete data", error);
        } finally {
            setDataLoading(false);
        }
    };

    // Fetch athlete data on mount
    useEffect(() => {
        loadData();
    }, [id]);

    const handleView = (report) => {
        setSelectedReport(report);
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link
                    href={`/dashboard/athletes/${id}`}
                    className="glass-button chat-press"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        padding: '6px 14px',
                        borderRadius: '16px',
                        textDecoration: 'none',
                        color: 'var(--secondary-foreground)',
                        marginBottom: '1rem'
                    }}
                >
                    ← Back to Athlete Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                        Meta-Analytics <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(125, 135, 210, 0.35)' }}>Reports</span>
                    </h1>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="glass-button glass-button-primary chat-press"
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '14px',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                        }}
                    >
                        + Queue New Report
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)', borderRadius: 16 }}>
                    Loading reports...
                </div>
            ) : (
                <ReportList reports={reports} onView={handleView} onDelete={handleDelete} />
            )}

            {showWizard && (
                <ReportWizard
                    athleteId={id}
                    onClose={() => setShowWizard(false)}
                    onGenerate={handleGenerate}
                />
            )}

            {/* Report Viewer Modal */}
            {selectedReport && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(9, 9, 15, 0.85)', backdropFilter: 'blur(20px)', zIndex: 2000,
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--glass-surface-2)',
                        backdropFilter: 'blur(16px)'
                    }}>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.25rem', fontWeight: 700 }}>{selectedReport.name}</h2>
                            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>
                                <span className="glass-badge" style={{ fontSize: '0.7rem', padding: '2px 8px', marginRight: '8px' }}>{selectedReport.type}</span>
                                {new Date(selectedReport.created).toLocaleDateString()}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedReport(null)}
                            className="glass-button chat-press"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--foreground)',
                                fontSize: '1.25rem',
                                padding: 0
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                        <div className="container">
                            {selectedReport.type === 'Meta Block Review' && (
                                dataLoading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>Loading report data...</div>
                                ) : (
                                    <MetaBlockReview
                                        programs={athleteData.programs}
                                        logs={athleteData.logs}
                                        reportParams={selectedReport.parameters}
                                    />
                                )
                            )}

                            {selectedReport.type === 'Block Review' && (
                                dataLoading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>Loading report data...</div>
                                ) : (
                                    <BlockReview
                                        programs={athleteData.programs}
                                        logs={athleteData.logs}
                                        reportParams={selectedReport.parameters}
                                    />
                                )
                            )}

                            {selectedReport.type === 'Stress Balance' && (
                                <StressBalanceReport
                                    readinessLogs={athleteData.readiness}
                                    reportParams={selectedReport.parameters}
                                />
                            )}

                            {/* Fallback / Default Charts */}
                            {!['Meta Block Review', 'Block Review', 'Stress Balance'].includes(selectedReport.type) && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                                    Report type not supported for detailed view.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

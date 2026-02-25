'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import ReportList from '@/components/reporting/ReportList';
import ReportWizard from '@/components/reporting/ReportWizard';
import AthleteCharts from '@/components/dashboard/AthleteCharts';
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

    const handleView = async (report) => {
        // ALWAYS fetch fresh data before viewing a report to ensure edits are reflected
        await loadData();
        setSelectedReport(report);
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <Link href={`/dashboard/athletes/${id}`} style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Dashboard</Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Meta-Analytics Reports</h1>
                    <button onClick={() => setShowWizard(true)} className="btn btn-primary" style={{ background: 'var(--success)', border: 'none', color: 'white' }}>
                        Queue New Report
                    </button>
                </div>
            </div>

            {loading ? <p>Loading reports...</p> : (
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
                    background: 'rgba(0,0,0,0.9)', zIndex: 2000,
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--foreground)' }}>{selectedReport.name}</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>{selectedReport.type} • {new Date(selectedReport.created).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => setSelectedReport(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
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
                                <AthleteCharts
                                    logs={athleteData.logs}
                                    readinessLogs={athleteData.readiness}
                                    programs={athleteData.programs}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

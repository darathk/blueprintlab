'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import BlockImprovements from '@/components/analytics/BlockImprovements';
import CompStats from '@/components/analytics/CompStats';
import LiftDensity from '@/components/analytics/LiftDensity';
import MetaBlockReview from '@/components/reporting/meta/MetaBlockReview';

export default function ReportDetailsPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
    const { id, reportId } = use(params);
    const [report, setReport] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // 1. Fetch Report Metadata
            const resReport = await fetch(`/api/reports?athleteId=${id}`);
            const reports = await resReport.json();
            const currentReport = reports.find((r: any) => r.id === reportId);
            setReport(currentReport);

            // Fetch Programs (needed for Meta Review)
            const resProgs = await fetch(`/api/programs?athleteId=${id}`);
            const allProgs = await resProgs.json();
            setPrograms(allProgs);

            if (currentReport) {
                // 2. Fetch Logs and Filter
                const resLogs = await fetch(`/api/logs?athleteId=${id}`);
                const allLogs = await resLogs.json();

                let filtered = allLogs;
                const { parameters } = currentReport;

                // Filter by Date
                if (parameters.dateRange === 'custom' && parameters.customStart) {
                    filtered = filtered.filter((l: any) => new Date(l.date) >= new Date(parameters.customStart));
                }
                if (parameters.dateRange === 'custom' && parameters.customEnd) {
                    filtered = filtered.filter((l: any) => new Date(l.date) <= new Date(parameters.customEnd));
                }
                if (parameters.dateRange === 'last4') {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 28);
                    filtered = filtered.filter((l: any) => new Date(l.date) >= cutoff);
                }

                // Filter by Programs
                if (parameters.programIds && parameters.programIds.length > 0) {
                    filtered = filtered.filter((l: any) => parameters.programIds.includes(l.programId));
                }

                setLogs(filtered);
            }
            setLoading(false);
        };
        loadData();
    }, [id, reportId]);

    if (loading) return <div style={{ padding: '2rem' }}>Loading Report...</div>;
    if (!report) return <div style={{ padding: '2rem' }}>Report not found.</div>;

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link
                    href={`/dashboard/athletes/${id}/reports`}
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
                    ← Back to Reports
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--foreground)' }}>
                            {report.name}
                        </h1>
                        <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="glass-badge" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{report.type}</span>
                            <span>Generated: {new Date(report.created).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button
                        className="glass-button chat-press"
                        onClick={() => window.print()}
                        style={{ padding: '0.65rem 1.25rem', borderRadius: '12px', fontWeight: 600, fontSize: '0.88rem' }}
                    >
                        Export / Print
                    </button>
                </div>
            </div>

            {report.type === 'Meta Block Review' ? (
                <MetaBlockReview
                    programs={programs}
                    logs={logs}
                    reportParams={report.parameters}
                />
            ) : (
                <>
                    {/* Block Improvements (Trends) */}
                    <BlockImprovements logs={logs} dateRange={report.parameters.dateRange} programs={programs} />

                    {/* Competition Stats */}
                    <CompStats logs={logs} programs={programs} />

                    {/* Lift Density Heatmap */}
                    <LiftDensity logs={logs} />
                </>
            )}

            {/* Notes Section */}
            <div className="glass-panel" style={{ marginTop: '2.5rem', padding: '1.75rem', borderRadius: 16 }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>Notes</h3>
                <textarea
                    className="glass-input"
                    style={{ width: '100%', height: '110px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    placeholder="Add notes about this block..."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button className="glass-button glass-button-primary chat-press" style={{ padding: '0.6rem 1.5rem', borderRadius: 12, fontWeight: 700 }}>
                        Save Notes
                    </button>
                </div>
            </div>
        </div>
    );
}

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
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <Link href={`/dashboard/athletes/${id}/reports`} style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Reports</Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{report.name}</h1>
                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginTop: '0.5rem' }}>
                            Type: {report.type} • Generated: {new Date(report.created).toLocaleDateString()}
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => window.print()}>Export / Print</button>
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

            {/* Notes Section (Mock) */}
            <div className="card" style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Notes</h3>
                <textarea
                    className="input"
                    style={{ width: '100%', height: '100px', background: 'transparent', color: 'var(--foreground)' }}
                    placeholder="Add notes about this block..."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--success)', border: 'none', color: 'white' }}>Save Notes</button>
                </div>
            </div>
        </div>
    );
}

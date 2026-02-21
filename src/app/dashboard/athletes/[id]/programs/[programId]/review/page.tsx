'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import BlockImprovements from '@/components/analytics/BlockImprovements';
import CompStats from '@/components/analytics/CompStats';
import LiftDensity from '@/components/analytics/LiftDensity';

export default function ProgramReviewPage({ params }: { params: Promise<{ id: string; programId: string }> }) {
    const { id, programId } = use(params);
    const [program, setProgram] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // 1. Fetch Program Details
            const resProg = await fetch(`/api/programs?athleteId=${id}`);
            const allProgs = await resProg.json();
            const currentProgram = allProgs.find((p: any) => p.id === programId);
            setProgram(currentProgram);

            if (currentProgram) {
                // 2. Fetch All Logs and Filter by Program ID
                const resLogs = await fetch(`/api/logs?athleteId=${id}`);
                const allLogs = await resLogs.json();
                const filtered = allLogs.filter((l: any) => l.programId === programId);
                setLogs(filtered);
            }
            setLoading(false);
        };
        loadData();
    }, [id, programId]);

    if (loading) return <div style={{ padding: '2rem' }}>Loading Review...</div>;
    if (!program) return <div style={{ padding: '2rem' }}>Program not found.</div>;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <Link href={`/dashboard/athletes/${id}/reports`} style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Reports</Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Block Review: {program.name}</h1>
                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginTop: '0.5rem' }}>
                            {new Date(program.startDate).toLocaleDateString()} - {program.endDate ? new Date(program.endDate).toLocaleDateString() : 'Ongoing'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Block Improvements (Trends) - Auto scoped to this block via logs */}
            <BlockImprovements logs={logs} dateRange="all" programs={[program]} />

            {/* Competition Stats */}
            <CompStats logs={logs} programs={[program]} />

            {/* Lift Density Heatmap */}
            <LiftDensity logs={logs} />
        </div>
    );
}

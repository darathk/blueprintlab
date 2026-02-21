'use client';

import { useMemo, useState } from 'react';
import BlockImprovements from '@/components/analytics/BlockImprovements';
import CompStats from '@/components/analytics/CompStats';
import LiftDensity from '@/components/analytics/LiftDensity';

export default function BlockReview({ programs, logs, reportParams }) {
    console.log('BlockReview Debug:', { programsCount: programs?.length, reportParams });

    // If no program selected, default to the most recent one (sorted by startDate desc)
    const sortedPrograms = [...(programs || [])].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    console.log('Sorted Programs:', sortedPrograms.map(p => `${p.name} (${p.id})`));

    const targetProgramId = reportParams?.programIds?.[0] || sortedPrograms[0]?.id;
    console.log('Target ID:', targetProgramId);

    const program = programs?.find(p => p.id === targetProgramId);

    if (!program) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
                <p>Please select a single program for Block Review.</p>
            </div>
        );
    }

    // Local state for notes
    const [notes, setNotes] = useState('');

    const programLogs = useMemo(() => {
        if (!program) return [];
        let filtered = logs.filter(l => l.programId === program.id);

        const params = reportParams?.parameters || reportParams;

        // Filter by reportParams date range if applicable
        if (params?.startDate) {
            const start = new Date(params.startDate);
            // Beginning of day
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(l => new Date(l.date) >= start);
        }
        if (params?.endDate) {
            const end = new Date(params.endDate);
            // End of day
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(l => new Date(l.date) <= end);
        }

        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [program, logs, reportParams]);

    const lookBackWeeks = useMemo(() => {
        const params = reportParams?.parameters || reportParams; // Handle both flattened and nested formats

        // 1. If explicit duration string provided (e.g. from dropdown "4 Weeks")
        if (params?.duration) {
            // Handle both string "4 Weeks" and number 4
            const match = String(params.duration).match(/(\d+)/);
            if (match) return parseInt(match[0], 10);
        }

        // 2. If explicit date range provided
        if (params?.startDate && params?.endDate) {
            const start = new Date(params.startDate);
            const end = new Date(params.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)) || 1;
        }

        // 3. Fallback: Calculate from logs found
        if (!programLogs.length) {
            // 4. Further fallback: Program duration if no logs
            if (program?.startDate && program?.endDate) {
                const start = new Date(program.startDate);
                const end = new Date(program.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)) || 1;
            }
            return 0;
        }

        const start = new Date(programLogs[0].date);
        const end = new Date(programLogs[programLogs.length - 1].date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)) || 1;
    }, [programLogs, reportParams, program]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', minHeight: '100%', background: 'var(--background)' }}>

            {/* Sidebar */}
            <div style={{
                background: '#f1f5f9', // Light gray background like screenshot
                borderRight: '1px solid #e2e8f0',
                padding: '1.5rem',
                color: '#0f172a',
                height: '100%',
                overflowY: 'auto'
            }}>
                <div style={{ background: '#0f3460', color: 'white', padding: '0.5rem 1rem', marginBottom: '1.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                    Block Review Report
                </div>

                <div style={{ marginBottom: '2rem', fontSize: '0.9rem' }}>
                    <p style={{ margin: '0.5rem 0' }}><strong>Program:</strong> {program.name}</p>
                    <p style={{ margin: '0.5rem 0' }}><strong>End Date:</strong> {program.endDate ? new Date(program.endDate).toLocaleDateString() : 'Ongoing'}</p>
                    <p style={{ margin: '0.5rem 0' }}><strong>Duration:</strong> {lookBackWeeks} Weeks</p>
                </div>

                <div style={{ background: '#0f3460', color: 'white', padding: '0.5rem 1rem', marginBottom: '0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    Comp Lifts
                </div>
                <div style={{ marginBottom: '2rem', fontSize: '0.85rem', color: '#475569' }}>
                    <p style={{ margin: '0.25rem 0' }}><strong>Squat:</strong> Competition Squat</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Bench:</strong> Competition Bench</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Deadlift:</strong> Competition Deadlift</p>
                </div>

                <div style={{ background: '#0f3460', color: 'white', padding: '0.5rem 1rem', marginBottom: '0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    Report Sections
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <button onClick={() => scrollToSection('improvements')} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Block Improvements</button>
                    <button onClick={() => scrollToSection('notes')} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Coach Notes</button>
                    <button onClick={() => scrollToSection('comp-stats')} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Competition Lift Stats</button>
                    <button onClick={() => scrollToSection('density')} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>All Lift Density Data</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ padding: '2rem', overflowY: 'auto' }}>

                {/* Block Improvements (Trends) */}
                <div id="improvements" style={{ marginBottom: '3rem' }}>
                    <BlockImprovements logs={programLogs} dateRange="all" programs={programs} />
                </div>

                {/* Notes */}
                <div id="notes" style={{ marginBottom: '1rem' }}>
                    <textarea
                        className="input"
                        placeholder="Enter block notes here..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        style={{ width: '100%', height: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                        <button className="btn btn-primary" style={{ background: '#16a34a', border: 'none' }}>Save Notes</button>
                    </div>
                </div>

                {/* Comp Stats */}
                <div id="comp-stats" style={{ marginBottom: '3rem' }}>
                    <CompStats logs={programLogs} programs={programs} />
                </div>

                {/* Lift Density */}
                <div id="density" style={{ marginBottom: '3rem' }}>
                    <LiftDensity logs={programLogs} />
                </div>

            </div>
        </div>
    );
}

'use client';

import { useMemo, useState } from 'react';
import BlockImprovements from '@/components/analytics/BlockImprovements';
import CompStats from '@/components/analytics/CompStats';
import LiftDensity from '@/components/analytics/LiftDensity';

export default function BlockReview({ programs, logs, reportParams }) {

    // If no program selected, default to the most recent one (sorted by startDate desc)
    const sortedPrograms = [...(programs || [])].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const targetProgramId = reportParams?.programIds?.[0] || sortedPrograms[0]?.id;

    const program = programs?.find(p => p.id === targetProgramId);

    // Local state for notes (Must be called before any early returns)
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
            if (params.duration === 'All Time') return 'All Time';

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

    if (!program) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
                <p>Please select a single program for Block Review.</p>
            </div>
        );
    }

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100%', background: 'var(--background)' }}>

            {/* Sidebar */}
            <div style={{
                background: 'var(--glass-surface-2)',
                backdropFilter: 'blur(16px)',
                borderRight: '1px solid var(--glass-border)',
                padding: '1.5rem',
                height: '100%',
                overflowY: 'auto'
            }}>
                <div style={{
                    background: 'rgba(125, 135, 210, 0.12)',
                    border: '1px solid rgba(125, 135, 210, 0.25)',
                    color: 'var(--primary)',
                    padding: '0.6rem 1rem',
                    marginBottom: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    boxShadow: '0 0 12px rgba(125, 135, 210, 0.15)'
                }}>
                    Block Review Report
                </div>

                <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0.35rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Program:</strong> <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{program.name}</span></p>
                    <p style={{ margin: '0.35rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>End Date:</strong> <span style={{ color: 'var(--foreground)' }}>{program.endDate ? new Date(program.endDate).toLocaleDateString() : 'Ongoing'}</span></p>
                    <p style={{ margin: '0.35rem 0' }}><strong style={{ color: 'var(--secondary-foreground)' }}>Duration:</strong> <span style={{ color: 'var(--foreground)' }}>{lookBackWeeks}{typeof lookBackWeeks === 'number' ? ' Weeks' : ''}</span></p>
                </div>

                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--primary)',
                    marginBottom: '0.6rem',
                    paddingLeft: '0.25rem'
                }}>
                    Comp Lifts
                </div>
                <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--secondary-foreground)' }}>
                    <p style={{ margin: '0.25rem 0' }}><strong style={{ color: 'var(--primary)' }}>Squat:</strong> Competition Squat</p>
                    <p style={{ margin: '0.25rem 0' }}><strong style={{ color: 'var(--primary)' }}>Bench:</strong> Competition Bench</p>
                    <p style={{ margin: '0.25rem 0' }}><strong style={{ color: 'var(--primary)' }}>Deadlift:</strong> Competition Deadlift</p>
                </div>

                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--primary)',
                    marginBottom: '0.6rem',
                    paddingLeft: '0.25rem'
                }}>
                    Report Sections
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {[
                        { id: 'improvements', label: 'Block Improvements' },
                        { id: 'notes', label: 'Coach Notes' },
                        { id: 'comp-stats', label: 'Competition Lift Stats' },
                        { id: 'density', label: 'All Lift Density Data' },
                    ].map(sec => (
                        <button
                            key={sec.id}
                            onClick={() => scrollToSection(sec.id)}
                            className="chat-press"
                            style={{
                                textAlign: 'left',
                                background: 'transparent',
                                border: '1px solid transparent',
                                color: 'var(--secondary-foreground)',
                                cursor: 'pointer',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--glass-surface-3)';
                                e.currentTarget.style.color = 'var(--foreground)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--secondary-foreground)';
                            }}
                        >
                            {sec.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ padding: '2rem', overflowY: 'auto' }}>

                {/* Block Improvements (Trends) */}
                <div id="improvements" style={{ marginBottom: '2.5rem' }}>
                    <BlockImprovements logs={programLogs} dateRange="all" programs={programs} />
                </div>

                {/* Notes */}
                <div id="notes" className="glass-panel" style={{ marginBottom: '2.5rem', padding: '1.5rem', borderRadius: 16 }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                        Coach Notes
                    </h3>
                    <textarea
                        className="glass-input"
                        placeholder="Enter block notes, takeaways, or modifications here..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        style={{ width: '100%', height: '110px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                        <button className="glass-button glass-button-primary chat-press" style={{ padding: '0.6rem 1.5rem', borderRadius: 12, fontWeight: 700 }}>
                            Save Notes
                        </button>
                    </div>
                </div>

                {/* Comp Stats */}
                <div id="comp-stats" style={{ marginBottom: '2.5rem' }}>
                    <CompStats logs={programLogs} programs={programs} />
                </div>

                {/* Lift Density */}
                <div id="density" style={{ marginBottom: '2.5rem' }}>
                    <LiftDensity logs={programLogs} />
                </div>

            </div>
        </div>
    );
}

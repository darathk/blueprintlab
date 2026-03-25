'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface AthleteSummary {
    athleteId: string;
    name: string;
    programName: string | null;
    sessionsTrained: number;
    expectedSessions: number;
    missedSessions: number;
    trainingDays: number;
    avgReadiness: number | null;
    readinessTrend: 'up' | 'down' | 'stable' | null;
    flagged: string[];
    hasCheckedIn: boolean;
    noProgram: boolean;
}

interface SummaryData {
    period: { from: string; to: string };
    overview: {
        totalAthletes: number;
        trained: number;
        missed: number;
        flaggedCount: number;
        noCheckinCount: number;
    };
    athletes: AthleteSummary[];
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' | null }) {
    if (trend === 'up') return <TrendingUp size={14} style={{ color: '#10b981' }} />;
    if (trend === 'down') return <TrendingDown size={14} style={{ color: '#ef4444' }} />;
    if (trend === 'stable') return <Minus size={14} style={{ color: 'var(--secondary-foreground)' }} />;
    return null;
}

function SectionHeader({ title, count, section, icon: Icon, color, expandedSection, toggleSection }: {
    title: string; count: number; section: string; icon: React.ElementType; color: string;
    expandedSection: string | null; toggleSection: (s: string) => void;
}) {
    return (
        <button
            onClick={() => toggleSection(section)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0', background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={16} style={{ color }} />
                {title}
                <span style={{
                    fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px',
                    background: `${color}20`, color,
                }}>
                    {count}
                </span>
            </div>
            {expandedSection === section ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
    );
}

export default function WeeklyCheckInSummary() {
    const router = useRouter();
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSection, setExpandedSection] = useState<string | null>('flagged');
    const loadSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/weekly-summary');
            if (res.ok) setData(await res.json());
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/weekly-summary');
                if (res.ok && !cancelled) setData(await res.json());
            } catch { /* ignore */ }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Generating weekly summary...</div>;
    }

    if (!data) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>Failed to load summary.</div>;
    }

    const { overview, athletes, period } = data;
    const flaggedAthletes = athletes.filter(a => a.flagged.length > 0);
    const missedAthletes = athletes.filter(a => a.missedSessions > 0 && !a.noProgram);
    const noCheckinAthletes = athletes.filter(a => !a.hasCheckedIn && !a.noProgram);

    const readinessColor = (avg: number | null) => {
        if (avg === null) return 'var(--secondary-foreground)';
        if (avg >= 4) return '#10b981';
        if (avg >= 3) return '#f59e0b';
        return '#ef4444';
    };

    const formatPeriod = () => {
        const from = new Date(period.from);
        const to = new Date(period.to);
        return `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${to.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const renderAthleteRow = (athlete: AthleteSummary) => (
        <div
            key={athlete.athleteId}
            onClick={() => router.push(`/dashboard/athletes/${athlete.athleteId}`)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.15s', flexWrap: 'wrap', gap: '0.5rem',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; e.currentTarget.style.background = 'rgba(6,182,212,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
        >
            <div style={{ minWidth: '120px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{athlete.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                    {athlete.programName || 'No program'}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ color: athlete.missedSessions > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {athlete.sessionsTrained}/{athlete.expectedSessions}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)' }}>sessions</div>
                </div>

                <div style={{ textAlign: 'center', minWidth: '60px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {athlete.avgReadiness !== null ? (
                        <>
                            <span style={{ color: readinessColor(athlete.avgReadiness), fontWeight: 600 }}>
                                {athlete.avgReadiness.toFixed(1)}
                            </span>
                            <TrendIcon trend={athlete.readinessTrend} />
                        </>
                    ) : (
                        <span style={{ color: 'var(--secondary-foreground)', fontSize: '0.75rem' }}>—</span>
                    )}
                </div>

                {athlete.flagged.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                        {athlete.flagged.map(flag => (
                            <span key={flag} style={{
                                fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px',
                                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}>
                                {flag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div>
            {/* Period & Refresh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>{formatPeriod()}</span>
                <button
                    onClick={loadSummary}
                    style={{
                        background: 'none', border: 'none', color: 'var(--secondary-foreground)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                    }}
                >
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Total Athletes', value: overview.totalAthletes, color: 'var(--primary)' },
                    { label: 'Trained', value: overview.trained, color: '#10b981' },
                    { label: 'Missed Sessions', value: overview.missed, color: overview.missed > 0 ? '#f59e0b' : '#10b981' },
                    { label: 'Flagged', value: overview.flaggedCount, color: overview.flaggedCount > 0 ? '#ef4444' : '#10b981' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        padding: '0.75rem', borderRadius: '10px', textAlign: 'center',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)',
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: '0.15rem' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Flagged Athletes */}
            {flaggedAthletes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                    <SectionHeader title="Flagged Athletes" count={flaggedAthletes.length} section="flagged" icon={AlertTriangle} color="#ef4444" expandedSection={expandedSection} toggleSection={toggleSection} />
                    {expandedSection === 'flagged' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.25rem' }}>
                            {flaggedAthletes.map(a => renderAthleteRow(a))}
                        </div>
                    )}
                </div>
            )}

            {/* Missed Sessions */}
            {missedAthletes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                    <SectionHeader title="Missed Sessions" count={missedAthletes.length} section="missed" icon={XCircle} color="#f59e0b" expandedSection={expandedSection} toggleSection={toggleSection} />
                    {expandedSection === 'missed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.25rem' }}>
                            {missedAthletes.map(a => renderAthleteRow(a))}
                        </div>
                    )}
                </div>
            )}

            {/* No Check-ins */}
            {noCheckinAthletes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                    <SectionHeader title="No Check-ins" count={noCheckinAthletes.length} section="nocheckin" icon={XCircle} color="var(--secondary-foreground)" expandedSection={expandedSection} toggleSection={toggleSection} />
                    {expandedSection === 'nocheckin' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.25rem' }}>
                            {noCheckinAthletes.map(a => renderAthleteRow(a))}
                        </div>
                    )}
                </div>
            )}

            {/* All Athletes */}
            <div>
                <SectionHeader title="All Athletes" count={athletes.length} section="all" icon={CheckCircle} color="var(--primary)" expandedSection={expandedSection} toggleSection={toggleSection} />
                {expandedSection === 'all' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.25rem' }}>
                        {athletes
                            .sort((a, b) => {
                                // Flagged first, then missed, then by readiness
                                if (a.flagged.length > 0 && b.flagged.length === 0) return -1;
                                if (a.flagged.length === 0 && b.flagged.length > 0) return 1;
                                if (a.missedSessions > 0 && b.missedSessions === 0) return -1;
                                if (a.missedSessions === 0 && b.missedSessions > 0) return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map(a => renderAthleteRow(a))
                        }
                    </div>
                )}
            </div>
        </div>
    );
}

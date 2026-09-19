import { Suspense } from 'react';
import { getAthleteById, getLogsByAthlete, getReadinessByAthlete, getProgramsByAthlete, getTravelEventsByAthlete } from '@/lib/storage';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

import {
    MessageSquare,
    CreditCard,
    TrendingUp,
    Activity,
    Calendar,
    Trophy,
    History,
    FileText,
    Layers,
    Target,
    Crosshair
} from 'lucide-react';

const DotsChart = dynamic(() => import('@/components/dashboard/DotsChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading DOTs chart...</div>
});

const FatigueChart = dynamic(() => import('@/components/dashboard/FatigueChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading fatigue chart...</div>
});

const ProgramList = dynamic(() => import('@/components/program-builder/ProgramList'), {
    loading: () => <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading programs...</div>
});

const BlockOrganizer = dynamic(() => import('@/components/dashboard/BlockOrganizer'), {
    loading: () => <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading periodization planner...</div>
});

const MeetAttempts = dynamic(() => import('@/components/dashboard/MeetAttempts'), {
    loading: () => <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading attempts...</div>
});

const HistoricalPerformance = dynamic(() => import('@/components/dashboard/HistoricalPerformance'), {
    loading: () => <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading historical performance...</div>
});

const CoachNotes = dynamic(() => import('@/components/dashboard/CoachNotes'), {
    loading: () => <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading coach notes...</div>
});

// Single data fetch — all child components receive pre-fetched data as props

async function AthleteData({ id }: { id: string }) {
    const [athlete, logs, programs, readiness, travelEvents] = await Promise.all([
        getAthleteById(id),
        getLogsByAthlete(id),
        getProgramsByAthlete(id),
        getReadinessByAthlete(id),
        getTravelEventsByAthlete(id),
    ]);

    if (!athlete) {
        return (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
                    Athlete Not Found
                </h2>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    This athlete record may have been removed or does not exist.
                </p>
                <Link href="/dashboard" className="glass-button glass-button-primary chat-press" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    ← Back to Command Center
                </Link>
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div style={{ marginBottom: '2rem', paddingTop: '1.5rem' }}>
                <Link href="/dashboard" className="chat-press" style={{ color: 'var(--secondary-foreground)', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem', textDecoration: 'none' }}>
                    <span>←</span> Back to Command Center
                </Link>
                <div className="athlete-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                        {athlete?.name || 'Athlete'} <span style={{ color: 'var(--primary)', textShadow: '0 0 16px rgba(125, 135, 210, 0.35)' }}>Analytics</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link 
                            href={`/dashboard/revenue?athlete=${encodeURIComponent(athlete.name)}`} 
                            className="glass-button chat-press" 
                            style={{ 
                                fontSize: '0.85rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.45rem', 
                                color: '#c4b5fd', 
                                borderColor: 'rgba(99, 91, 255, 0.4)',
                                background: 'rgba(99, 91, 255, 0.1)'
                            }}
                            title="Manage Stripe subscription & billing for this athlete"
                        >
                            <CreditCard size={15} style={{ color: '#a78bfa' }} />
                            <span>Stripe & Billing</span>
                        </Link>
                        <Link href={`/dashboard/messages?athleteId=${id}`} className="glass-button chat-press" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MessageSquare size={15} /> Chat
                        </Link>
                        <Link href={`/dashboard/athletes/${id}/reports`} className="glass-button chat-press" style={{ fontSize: '0.85rem' }}>
                            Meta-Analytics Reports
                        </Link>
                        <Link href={`/dashboard/athletes/${id}/new-program`} className="glass-button glass-button-primary chat-press" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            + New Program
                        </Link>
                    </div>
                </div>
            </div>

            {/* Charts & Modules */}
            <CollapsibleSection
                title="Athlete's Progress"
                icon={<TrendingUp size={18} style={{ color: '#38bdf8' }} />}
                subtitle="DOTs score & estimated 1RM trajectory"
                defaultOpen={true}
            >
                <DotsChart
                    athleteId={id}
                    logs={logs}
                    programs={programs}
                    initialGender={athlete?.gender ?? null}
                    initialWeightClass={athlete?.weightClass ?? null}
                    initialFederation={athlete?.federation ?? null}
                />
            </CollapsibleSection>

            <CollapsibleSection
                title="Fatigue & Readiness Metrics"
                icon={<Activity size={18} style={{ color: '#a855f7' }} />}
                subtitle="Daily check-ins & muscle soreness distribution"
                defaultOpen={true}
            >
                <FatigueChart readinessLogs={readiness} />
            </CollapsibleSection>

            <CollapsibleSection
                title="Training Calendar"
                icon={<Calendar size={18} style={{ color: '#10b981' }} />}
                subtitle="Scheduled workouts, travel events & periodization"
                defaultOpen={true}
            >
                <AthleteCalendarContainer
                    programs={programs}
                    athleteId={id}
                    currentProgramId={athlete?.currentProgramId}
                    logs={logs}
                    travelEvents={travelEvents}
                    nextMeetDate={athlete?.nextMeetDate}
                />
            </CollapsibleSection>

            <CollapsibleSection
                title="Meet Planner"
                icon={<Trophy size={18} style={{ color: '#f59e0b' }} />}
                subtitle={athlete?.nextMeetName ? `${athlete.nextMeetName} • Periodization & Attempts` : 'Target competition roadmap & attempt strategy'}
                defaultOpen={false}
            >
                <CollapsibleSection
                    variant="nested"
                    title="Periodization Planner"
                    icon={<Target size={16} style={{ color: '#38bdf8' }} />}
                    subtitle="Block timeline leading into competition day"
                    defaultOpen={true}
                >
                    <BlockOrganizer athlete={athlete} />
                </CollapsibleSection>
                <CollapsibleSection
                    variant="nested"
                    title="Attempt Selection"
                    icon={<Crosshair size={16} style={{ color: '#f43f5e' }} />}
                    subtitle="Conservative, planned, and reach targets"
                    defaultOpen={false}
                >
                    <MeetAttempts athlete={athlete} isReadOnly={false} />
                </CollapsibleSection>
            </CollapsibleSection>

            <CollapsibleSection
                title="Historical Performance"
                icon={<History size={18} style={{ color: '#ec4899' }} />}
                subtitle="All-time PRs, OpenPowerlifting imports & meet logs"
                defaultOpen={false}
            >
                <HistoricalPerformance athlete={athlete} />
            </CollapsibleSection>

            <CollapsibleSection
                title="Coach Notes"
                icon={<FileText size={18} style={{ color: '#7d87d2' }} />}
                subtitle="Private athlete notes, cues & observations"
                defaultOpen={false}
            >
                <CoachNotes athleteId={id} />
            </CollapsibleSection>

            <CollapsibleSection
                title="Program History"
                icon={<Layers size={18} style={{ color: '#06b6d4' }} />}
                subtitle="Assigned training programs & cycle archive"
                defaultOpen={false}
            >
                <ProgramList athleteId={id} initialPrograms={programs} />
            </CollapsibleSection>
        </>
    );
}

// Main Page — single Suspense boundary around one parallel data fetch
export default async function AthleteAnalyticsPage({ params }) {
    const { id } = await params;

    return (
        <div>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading athlete data...</div>}>
                <AthleteData id={id} />
            </Suspense>
        </div>
    );
}

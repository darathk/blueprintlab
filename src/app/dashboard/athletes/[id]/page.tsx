import { Suspense } from 'react';
import { getAthleteById, getLogsByAthlete, getReadinessByAthlete, getProgramsByAthlete, getTravelEventsByAthlete } from '@/lib/storage';
import Link from 'next/link';
import ProgramList from '@/components/program-builder/ProgramList';
import BlockOrganizer from '@/components/dashboard/BlockOrganizer';
import MeetAttempts from '@/components/dashboard/MeetAttempts';
import HistoricalPerformance from '@/components/dashboard/HistoricalPerformance';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import dynamic from 'next/dynamic';
import CoachNotes from '@/components/dashboard/CoachNotes';

import { MessageSquare } from 'lucide-react';

const DotsChart = dynamic(() => import('@/components/dashboard/DotsChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading DOTs chart...</div>
});

const FatigueChart = dynamic(() => import('@/components/dashboard/FatigueChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading fatigue chart...</div>
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

    return (
        <>
            {/* Header */}
            <div style={{ marginBottom: '2rem', paddingTop: '1.5rem' }}>
                <Link href="/dashboard" style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Command Center</Link>
                <div className="athlete-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{athlete?.name || 'Athlete'} Analytics</h1>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link href={`/dashboard/messages?athleteId=${id}`} className="btn btn-secondary" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MessageSquare size={16} /> Chat
                        </Link>
                        <Link href={`/dashboard/athletes/${id}/reports`} className="btn btn-secondary" style={{ fontSize: '0.9rem' }}>
                            View Meta-Analytics Reports
                        </Link>
                        <Link href={`/dashboard/athletes/${id}/new-program`} className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
                            + New Program (Builder)
                        </Link>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <CollapsibleSection title="Athlete's Progress" defaultOpen={true}>
                <DotsChart
                    athleteId={id}
                    logs={logs}
                    programs={programs}
                    initialGender={athlete?.gender ?? null}
                    initialWeightClass={athlete?.weightClass ?? null}
                    initialFederation={athlete?.federation ?? null}
                />
            </CollapsibleSection>

            <CollapsibleSection title="Fatigue & Readiness Metrics" defaultOpen={true}>
                <FatigueChart readinessLogs={readiness} />
            </CollapsibleSection>

            <CollapsibleSection title="Training Calendar" defaultOpen={false}>
                <AthleteCalendarContainer
                    programs={programs}
                    athleteId={id}
                    currentProgramId={athlete?.currentProgramId}
                    logs={logs}
                    travelEvents={travelEvents}
                />
            </CollapsibleSection>

            <CollapsibleSection title="Meet Planner" defaultOpen={false}>
                <CollapsibleSection title="Periodization Planner" defaultOpen={true}>
                    <BlockOrganizer athlete={athlete} />
                </CollapsibleSection>
                <CollapsibleSection title="Attempt Selection" defaultOpen={false}>
                    <MeetAttempts athlete={athlete} isReadOnly={false} />
                </CollapsibleSection>
            </CollapsibleSection>

            <CollapsibleSection title="Historical Performance" defaultOpen={false}>
                <HistoricalPerformance athlete={athlete} />
            </CollapsibleSection>

            <CollapsibleSection title="Coach Notes" defaultOpen={false}>
                <CoachNotes athleteId={id} />
            </CollapsibleSection>

            <CollapsibleSection title="Program History" defaultOpen={false}>
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

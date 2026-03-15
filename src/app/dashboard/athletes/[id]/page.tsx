import { Suspense } from 'react';
import { getAthleteById, getLogsByAthlete, getReadinessByAthlete, getProgramsByAthlete } from '@/lib/storage';
import Link from 'next/link';
import ProgramList from '@/components/program-builder/ProgramList';
import BlockOrganizer from '@/components/dashboard/BlockOrganizer';
import MeetAttempts from '@/components/dashboard/MeetAttempts';
import HistoricalPerformance from '@/components/dashboard/HistoricalPerformance';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import dynamic from 'next/dynamic';



import { MessageSquare } from 'lucide-react';

const DotsChart = dynamic(() => import('@/components/dashboard/DotsChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading DOTs chart...</div>
});

// Extracted Async Components for Granular Streaming

async function AthleteHeader({ id }) {
    const athlete = await getAthleteById(id);
    return (
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
    );
}

async function AsyncBlockOrganizer({ id }) {
    const athlete = await getAthleteById(id);
    return <BlockOrganizer athlete={athlete} />;
}

async function AsyncMeetAttempts({ id }) {
    const athlete = await getAthleteById(id);
    return <MeetAttempts athlete={athlete} isReadOnly={false} />;
}

async function AsyncHistoricalPerformance({ id }) {
    const athlete = await getAthleteById(id);
    return <HistoricalPerformance athlete={athlete} />;
}

async function AsyncCalendar({ id }) {
    const athlete = await getAthleteById(id);
    const programs = await getProgramsByAthlete(id);
    const athleteLogs = await getLogsByAthlete(id);
    return (
        <AthleteCalendarContainer
            programs={programs}
            athleteId={id}
            currentProgramId={athlete?.currentProgramId}
            logs={athleteLogs}
        />
    );
}



async function AsyncDotsChart({ id }) {
    const [athlete, logs, programs] = await Promise.all([
        getAthleteById(id),
        getLogsByAthlete(id),
        getProgramsByAthlete(id)
    ]);
    return (
        <DotsChart
            athleteId={id}
            logs={logs}
            programs={programs}
            initialGender={athlete?.gender ?? null}
            initialWeightClass={athlete?.weightClass ?? null}
        />
    );
}

// Main Page Skeleton Layout (Renders Instantly)
export default async function AthleteAnalyticsPage({ params }) {
    const { id } = await params;

    const Loader = () => <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading data...</div>;

    return (
        <div>
            <Suspense fallback={<div style={{ height: '100px' }} className="pulse">Loading Header...</div>}>
                <AthleteHeader id={id} />
            </Suspense>

            <CollapsibleSection title="Athlete's Progress" defaultOpen={true}>
                <Suspense fallback={<Loader />}>
                    <AsyncDotsChart id={id} />
                </Suspense>
            </CollapsibleSection>



            <CollapsibleSection title="Training Calendar" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <AsyncCalendar id={id} />
                </Suspense>
            </CollapsibleSection>

            <CollapsibleSection title="Meet Planner" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <AsyncMeetAttempts id={id} />
                    <AsyncBlockOrganizer id={id} />
                </Suspense>
            </CollapsibleSection>

            <CollapsibleSection title="Historical Performance" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <AsyncHistoricalPerformance id={id} />
                </Suspense>
            </CollapsibleSection>

            <CollapsibleSection title="Program History" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <ProgramList athleteId={id} />
                </Suspense>
            </CollapsibleSection>
        </div>
    );
}

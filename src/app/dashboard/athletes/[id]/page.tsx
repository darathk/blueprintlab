import { Suspense } from 'react';
import { getAthleteById, getLogsByAthlete, getReadinessByAthlete, getProgramsByAthlete } from '@/lib/storage';
import Link from 'next/link';
import ProgramList from '@/components/program-builder/ProgramList';
import BlockOrganizer from '@/components/dashboard/BlockOrganizer';
import MeetAttempts from '@/components/dashboard/MeetAttempts';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import dynamic from 'next/dynamic';

const AthleteCharts = dynamic(() => import('@/components/dashboard/AthleteCharts'), {
    loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading performance charts...</div>
});

import { MessageSquare } from 'lucide-react';

const DotsChart = dynamic(() => import('@/components/dashboard/DotsChart'), {
    loading: () => <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading DOTs chart...</div>
});

// Extracted Async Components for Granular Streaming

async function AthleteHeader({ id }) {
    const athlete = await getAthleteById(id);
    return (
        <div style={{ marginBottom: '2rem' }}>
            <Link href="/dashboard" style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Command Center</Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{athlete?.name || 'Athlete'} Analytics</h1>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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

async function AsyncCharts({ id }) {
    const athleteLogs = await getLogsByAthlete(id);
    const athleteReadiness = await getReadinessByAthlete(id);
    const programs = await getProgramsByAthlete(id);
    return <AthleteCharts logs={athleteLogs} readinessLogs={athleteReadiness} programs={programs} />;
}

async function AsyncDotsChart({ id }) {
    const [athlete, logs] = await Promise.all([
        getAthleteById(id),
        getLogsByAthlete(id),
    ]);
    return (
        <DotsChart
            athleteId={id}
            logs={logs}
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

            <CollapsibleSection title="DOTs Score Progress" defaultOpen={true}>
                <Suspense fallback={<Loader />}>
                    <AsyncDotsChart id={id} />
                </Suspense>
            </CollapsibleSection>

            <CollapsibleSection title="Performance Analytics" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <AsyncCharts id={id} />
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

            <CollapsibleSection title="Program History" defaultOpen={false}>
                <Suspense fallback={<Loader />}>
                    <ProgramList athleteId={id} />
                </Suspense>
            </CollapsibleSection>
        </div>
    );
}

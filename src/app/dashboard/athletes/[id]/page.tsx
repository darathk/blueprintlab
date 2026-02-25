import { Suspense } from 'react';
import { getAthleteById, getLogsByAthlete, getReadinessByAthlete, getProgramsByAthlete } from '@/lib/storage';
import Link from 'next/link';
import ProgramList from '@/components/program-builder/ProgramList';
import BlockOrganizer from '@/components/dashboard/BlockOrganizer';
import AthleteCalendarContainer from '@/components/dashboard/AthleteCalendarContainer';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import dynamic from 'next/dynamic';

const AthleteCharts = dynamic(() => import('@/components/dashboard/AthleteCharts'), {
    loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading performance charts...</div>
});

// Extracted Async Components for Granular Streaming

async function AthleteHeader({ id }) {
    const athlete = await getAthleteById(id);
    return (
        <div style={{ marginBottom: '2rem' }}>
            <Link href="/dashboard" style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>← Back to Command Center</Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{athlete?.name || 'Athlete'} Analytics</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link href={`/dashboard/athletes/${id}/chat`} className="btn btn-secondary" style={{ fontSize: '0.9rem' }}>
                        💬 Chat
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

// Main Page Skeleton Layout (Renders Instantly)
export default async function AthleteAnalyticsPage({ params }) {
    const { id } = await params;

    const Loader = () => <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading data...</div>;

    return (
        <div>
            <Suspense fallback={<div style={{ height: '100px' }} className="pulse">Loading Header...</div>}>
                <AthleteHeader id={id} />
            </Suspense>

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

import { redirect } from 'next/navigation';
import { getAthleteById, getProgramsByAthlete, getLogsByAthlete } from '@/lib/storage';
import dynamic from 'next/dynamic';

const TrainingHistory = dynamic(() => import('@/components/athlete/TrainingHistory'));

export default async function AthleteHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const athlete = await getAthleteById(id);

    if (!athlete) redirect('/');

    const [programs, logs] = await Promise.all([
        getProgramsByAthlete(id),
        getLogsByAthlete(id),
    ]);

    return <TrainingHistory logs={logs as any} programs={programs as any} />;
}

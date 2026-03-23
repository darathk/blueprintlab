import { redirect } from 'next/navigation';
import { getAthleteById } from '@/lib/storage';
import dynamic from 'next/dynamic';
const Leaderboard = dynamic(() => import('@/components/leaderboard/Leaderboard'));

export default async function AthleteLeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const athlete = await getAthleteById(id);

    if (!athlete) redirect('/');
    if (!athlete.coachId) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>Leaderboard requires a coach assignment.</p>
            </div>
        );
    }

    return <Leaderboard coachId={athlete.coachId} currentAthleteId={id} />;
}

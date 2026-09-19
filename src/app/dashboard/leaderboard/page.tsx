import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import { getCoachRecord } from '@/lib/auth-cache';

export default async function CoachLeaderboardPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await getCoachRecord(email);

    if (!coach) {
        redirect('/');
    }

    return <Leaderboard coachId={coach.id} />;
}

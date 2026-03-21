import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Leaderboard from '@/components/leaderboard/Leaderboard';

export default async function CoachLeaderboardPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, role: true } });

    if (!coach || coach.role !== 'coach') {
        redirect('/');
    }

    return <Leaderboard coachId={coach.id} />;
}

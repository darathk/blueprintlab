import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getAthletes } from '@/lib/storage';
import MeetDataTable from '@/components/dashboard/MeetDataTable';
import { getCoachRecord } from '@/lib/auth-cache';

export default async function MeetDataPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await getCoachRecord(email);

    if (!coach) redirect('/');

    const athletes = await getAthletes(coach.id);
    const athletesWithCoach = [...athletes, coach];

    return (
        <div style={{ padding: '1.5rem 0' }}>
            <MeetDataTable athletes={athletesWithCoach} coachId={coach.id} />
        </div>
    );
}

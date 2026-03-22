import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getAthletes } from '@/lib/storage';
import MeetDataTable from '@/components/dashboard/MeetDataTable';

export default async function MeetDataPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true }
    });

    if (!coach || coach.role !== 'coach') redirect('/');

    const athletes = await getAthletes(coach.id);

    return (
        <div style={{ padding: '1.5rem 0' }}>
            <MeetDataTable athletes={athletes} coachId={coach.id} />
        </div>
    );
}

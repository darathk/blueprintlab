import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { CoachInbox } from '@/components/chat/ClientCoachInbox';
import { getCoachInbox, getMessagesByAthlete } from '@/lib/storage';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ athleteId?: string }> }) {
    const params = await searchParams;
    const initialAthleteId = params?.athleteId;

    // Use the currently authenticated user — NOT the hardcoded admin email
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    let coach = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, name: true, email: true, role: true }
    });

    if (!coach) {
        // Shouldn't happen — dashboard layout already guards this — but handle gracefully
        redirect('/sign-in');
    }

    // Pre-fetch in parallel: inbox list + initial athlete's messages (avoids a second round-trip on the client)
    const [initialConvos, initialMessages] = await Promise.all([
        getCoachInbox(coach.id) as Promise<any[]>,
        initialAthleteId ? getMessagesByAthlete(initialAthleteId) : Promise.resolve([]),
    ]);

    return (
        <div>
            <div className="dashboard-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="dashboard-heading" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Messages</span>
                </h1>
            </div>

            <CoachInbox coachId={coach.id} coachName={coach.name} initialConvos={initialConvos} initialAthleteId={initialAthleteId} initialMessages={initialMessages as any} />
        </div>
    );
}

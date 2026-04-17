import { prisma } from '@/lib/prisma';
import { CoachInbox } from '@/components/chat/ClientCoachInbox';
import { getCoachInbox, getMessagesByAthlete } from '@/lib/storage';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ athleteId?: string }> }) {
    const params = await searchParams;
    const initialAthleteId = params?.athleteId;
    // Look up coach's Athlete record for the inbox
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase();
    let coach = await prisma.athlete.findFirst({
        where: { email: { equals: adminEmail, mode: 'insensitive' } },
        select: { id: true, name: true, email: true, role: true }
    });
    if (!coach) {
        coach = await prisma.athlete.create({ data: { name: 'Coach', email: adminEmail, role: 'coach' }, select: { id: true, name: true, email: true, role: true } });
    } else if (coach.role !== 'coach') {
        coach = await prisma.athlete.update({ where: { id: coach.id }, data: { role: 'coach', email: adminEmail }, select: { id: true, name: true, email: true, role: true } });
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

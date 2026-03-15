import { prisma } from '@/lib/prisma';
import { CoachInbox } from '@/components/chat/ClientCoachInbox';
import { getCoachInbox } from '@/lib/storage';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ athleteId?: string }> }) {
    const params = await searchParams;
    const initialAthleteId = params?.athleteId;
    // Look up coach's Athlete record for the inbox
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    let coach = await prisma.athlete.findUnique({
        where: { email: adminEmail },
        select: { id: true, name: true, email: true, role: true }
    });
    if (!coach) {
        coach = await prisma.athlete.create({ data: { name: 'Coach', email: adminEmail }, select: { id: true, name: true, email: true, role: true } });
    }

    const initialConvos = (await getCoachInbox(coach.id)) as any[];

    return (
        <div>
            <div className="dashboard-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="dashboard-heading" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Coach <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Messages</span>
                </h1>
            </div>

            <CoachInbox coachId={coach.id} coachName={coach.name} initialConvos={initialConvos} initialAthleteId={initialAthleteId} />
        </div>
    );
}

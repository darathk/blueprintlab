import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/chat/ClientChatInterface';
import { getMessagesByAthlete } from '@/lib/storage';

export default async function AthleteChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: athleteId } = await params;

    // Fetch the athlete first so we can look up THEIR coach (not a hardcoded admin email).
    // Using ADMIN_EMAIL would cross-wire athletes from different coaches into one inbox.
    const [athlete, initialMessages] = await Promise.all([
        prisma.athlete.findUnique({
            where: { id: athleteId },
            select: { id: true, name: true, email: true, coachId: true }
        }),
        getMessagesByAthlete(athleteId),
    ]);
    if (!athlete) return <div>Athlete not found</div>;

    const coach = athlete.coachId
        ? await prisma.athlete.findUnique({
            where: { id: athlete.coachId },
            select: { id: true, name: true, email: true }
        })
        : null;

    if (!coach) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>You don&apos;t have a coach assigned yet. Ask your coach to invite you first!</p>
            </div>
        );
    }

    return (
        <div className="chat-full-screen">
            <ChatInterface
                currentUserId={athlete.id}
                otherUserId={coach.id}
                currentUserName={athlete.name}
                otherUserName="Coach"
                athleteId={athlete.id}
                initialMessages={initialMessages}
                isEmbedded={true}
            />
        </div>
    );
}

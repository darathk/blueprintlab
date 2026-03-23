import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/chat/ClientChatInterface';
import { getMessagesByAthlete } from '@/lib/storage';

export default async function AthleteChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: athleteId } = await params;

    // Parallel fetch: athlete, coach, and messages
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase();
    const [athlete, coach, initialMessages] = await Promise.all([
        prisma.athlete.findUnique({
            where: { id: athleteId },
            select: { id: true, name: true, email: true, coachId: true }
        }),
        prisma.athlete.findFirst({
            where: { email: { equals: adminEmail, mode: 'insensitive' } },
            select: { id: true, name: true, email: true }
        }),
        getMessagesByAthlete(athleteId),
    ]);
    if (!athlete) return <div>Athlete not found</div>;
    if (!coach) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>Your coach hasn&apos;t set up messaging yet. Ask them to open the chat first!</p>
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

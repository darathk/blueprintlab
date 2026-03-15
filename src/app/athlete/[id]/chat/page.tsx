import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/chat/ClientChatInterface';
import { getMessagesByAthlete } from '@/lib/storage';

export default async function AthleteChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: athleteId } = await params;

    // Look up athlete
    const athlete = await prisma.athlete.findUnique({
        where: { id: athleteId },
        select: { id: true, name: true, email: true, coachId: true }
    });
    if (!athlete) return <div>Athlete not found</div>;

    // Find coach's record
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const coach = await prisma.athlete.findUnique({
        where: { email: adminEmail },
        select: { id: true, name: true, email: true }
    });

    if (!coach) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>Your coach hasn&apos;t set up messaging yet. Ask them to open the chat first!</p>
            </div>
        );
    }

    const initialMessages = await getMessagesByAthlete(athlete.id);

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

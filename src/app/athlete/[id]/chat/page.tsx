import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/chat/ClientChatInterface';

export default async function AthleteChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: athleteId } = await params;

    // Look up athlete
    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) return <div>Athlete not found</div>;

    // Find coach's record
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const coach = await prisma.athlete.findUnique({ where: { email: adminEmail } });

    if (!coach) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>Your coach hasn&apos;t set up messaging yet. Ask them to open the chat first!</p>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <ChatInterface
                currentUserId={athlete.id}
                otherUserId={coach.id}
                currentUserName={athlete.name}
                otherUserName="Coach"
                athleteId={athlete.id}
            />
        </div>
    );
}

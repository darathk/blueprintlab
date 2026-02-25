import { prisma } from '@/lib/prisma';
import ChatInterface from '@/components/chat/ChatInterface';

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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
            }}>
                <span style={{ color: 'var(--primary)' }}>💬</span>
                Chat with Coach
            </h1>

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

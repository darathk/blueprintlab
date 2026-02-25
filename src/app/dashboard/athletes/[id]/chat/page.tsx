import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/chat/ClientChatInterface';

export default async function CoachChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: athleteId } = await params;

    // Look up athlete
    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) return <div>Athlete not found</div>;

    // Find or create the coach's Athlete record for messaging
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    let coach = await prisma.athlete.findUnique({ where: { email: adminEmail } });

    if (!coach) {
        coach = await prisma.athlete.create({
            data: {
                name: 'Coach',
                email: adminEmail
            }
        });
    }

    return (
        <div>
            <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
            }}>
                <span style={{ color: 'var(--primary)' }}>💬</span>
                Chat with {athlete.name}
            </h1>

            <ChatInterface
                currentUserId={coach.id}
                otherUserId={athlete.id}
                currentUserName="Coach"
                otherUserName={athlete.name}
                athleteId={athlete.id}
            />
        </div>
    );
}

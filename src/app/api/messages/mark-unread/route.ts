import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/messages/mark-unread — mark the last message from a sender as unread
export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { senderId, receiverId } = await request.json();

        if (!senderId || !receiverId) {
            return NextResponse.json({ error: 'senderId and receiverId are required' }, { status: 400 });
        }

        // Only the receiver can mark messages as unread
        if (receiverId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Find the most recent message from that sender to this receiver and mark it unread
        const lastMessage = await prisma.message.findFirst({
            where: { senderId, receiverId, read: true },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });

        if (lastMessage) {
            await prisma.message.update({
                where: { id: lastMessage.id },
                data: { read: false }
            });
        }

        // Also persist a coach-side "manually marked unread" flag on the athlete
        // so the unread state survives even when no read messages exist to flip,
        // and isn't wiped by a subsequent mark-as-read PATCH for the same convo.
        try {
            await prisma.athlete.update({
                where: { id: senderId },
                data: { coachMarkedUnread: true }
            });
        } catch {
            // Field may not exist yet on prod — fail silently, the message-flip
            // above is still the primary mechanism.
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('POST /api/messages/mark-unread error:', error);
        return NextResponse.json({ error: 'Failed to mark as unread' }, { status: 500 });
    }
}

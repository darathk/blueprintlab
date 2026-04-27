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
        // Don't filter by read:true — the message might already be unread or the coach
        // may have read everything; we still need a message to flip for the unread badge
        const lastMessage = await prisma.message.findFirst({
            where: { senderId, receiverId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, read: true }
        });

        if (lastMessage) {
            // Always set to unread so the badge shows up
            await prisma.message.update({
                where: { id: lastMessage.id },
                data: { read: false }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('POST /api/messages/mark-unread error:', error);
        return NextResponse.json({ error: 'Failed to mark as unread' }, { status: 500 });
    }
}

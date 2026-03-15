import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/messages/mark-unread — mark the last message from a sender as unread
export async function POST(request: Request) {
    try {
        const { senderId, receiverId } = await request.json();

        if (!senderId || !receiverId) {
            return NextResponse.json({ error: 'senderId and receiverId are required' }, { status: 400 });
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('POST /api/messages/mark-unread error:', error);
        return NextResponse.json({ error: 'Failed to mark as unread' }, { status: 500 });
    }
}

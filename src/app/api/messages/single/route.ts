import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/messages/single?id=X — fetch a single message by ID (used by realtime to avoid refetching all 100)
export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const message = await prisma.message.findUnique({
            where: { id },
            select: {
                id: true, senderId: true, receiverId: true, content: true,
                mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true, reactions: true,
                sender: { select: { id: true, name: true, email: true } },
                receiver: { select: { id: true, name: true, email: true } },
                replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
            }
        });

        if (!message) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // Verify the requester is a participant
        if (message.senderId !== auth.user.id && message.receiverId !== auth.user.id && !auth.isCoach) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(message);
    } catch (error) {
        console.error('GET /api/messages/single error:', error);
        return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
    }
}

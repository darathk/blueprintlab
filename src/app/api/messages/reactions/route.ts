import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/messages/reactions — Toggle a reaction on a message
export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { messageId, userId, emoji } = body;

        if (!messageId || !userId || !emoji) {
            return NextResponse.json({ error: 'messageId, userId, and emoji are required' }, { status: 400 });
        }

        // Verify the userId matches the authenticated user
        if (userId !== auth.user.id) {
            return NextResponse.json({ error: 'Cannot react as another user' }, { status: 403 });
        }

        // Validate emoji (basic check — single emoji or short string)
        if (typeof emoji !== 'string' || emoji.length > 10) {
            return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
        }

        // Fetch current message reactions
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { reactions: true, senderId: true, receiverId: true }
        });

        if (!message) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // Only participants in the conversation may react — prevents a coach
        // from reacting to another coach's messages.
        if (message.senderId !== auth.user.id && message.receiverId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let reactions = (message.reactions as Record<string, string[]>) || {};

        // Ensure reactions is an object
        if (typeof reactions !== 'object' || Array.isArray(reactions)) {
            reactions = {};
        }

        const userIds = reactions[emoji] || [];

        let updatedUserIds: string[];
        if (userIds.includes(userId)) {
            // Remove reaction
            updatedUserIds = userIds.filter(id => id !== userId);
        } else {
            // Add reaction
            updatedUserIds = [...userIds, userId];
        }

        const updatedReactions = { ...reactions };
        if (updatedUserIds.length > 0) {
            updatedReactions[emoji] = updatedUserIds;
        } else {
            delete updatedReactions[emoji];
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { reactions: updatedReactions },
            select: {
                id: true,
                reactions: true
            }
        });

        return NextResponse.json(updatedMessage);
    } catch (error) {
        console.error('POST /api/messages/reactions error:', error);
        return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 });
    }
}

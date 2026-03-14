import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/messages/reactions — Toggle a reaction on a message
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { messageId, userId, emoji } = body;

        if (!messageId || !userId || !emoji) {
            return NextResponse.json({ error: 'messageId, userId, and emoji are required' }, { status: 400 });
        }

        // Fetch current message reactions
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { reactions: true }
        });

        if (!message) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
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

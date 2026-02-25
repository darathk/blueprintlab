import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/messages/inbox?coachId=X — lightweight: returns conversation list with unread counts only
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachId = searchParams.get('coachId');

        if (!coachId) {
            return NextResponse.json({ error: 'coachId is required' }, { status: 400 });
        }

        // Get only the latest message per conversation + unread counts using raw aggregation
        const messages = await prisma.message.findMany({
            where: {
                OR: [{ senderId: coachId }, { receiverId: coachId }]
            },
            select: {
                senderId: true,
                receiverId: true,
                content: true,
                createdAt: true,
                read: true,
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' }
        });

        // Build lightweight conversation summaries (no full message payloads)
        const convMap: Record<string, {
            athleteId: string;
            athleteName: string;
            lastMessage: string;
            lastMessageAt: string;
            unreadCount: number;
        }> = {};

        for (const msg of messages) {
            const otherId = msg.senderId === coachId ? msg.receiverId : msg.senderId;
            const otherName = msg.senderId === coachId ? msg.receiver.name : msg.sender.name;

            if (!convMap[otherId]) {
                convMap[otherId] = {
                    athleteId: otherId,
                    athleteName: otherName,
                    lastMessage: msg.content,
                    lastMessageAt: msg.createdAt.toISOString(),
                    unreadCount: 0
                };
            }

            if (msg.receiverId === coachId && !msg.read) {
                convMap[otherId].unreadCount++;
            }
        }

        const sorted = Object.values(convMap).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );

        return NextResponse.json(sorted);
    } catch (error) {
        console.error('GET /api/messages/inbox error:', error);
        return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }
}

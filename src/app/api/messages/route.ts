import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/messages?athleteId=X — fetch conversation messages (last 100)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const athleteId = searchParams.get('athleteId');

        if (!athleteId) {
            return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
        }

        // Two indexed queries are faster than one OR query
        const [sent, received] = await Promise.all([
            prisma.message.findMany({
                where: { senderId: athleteId },
                select: {
                    id: true, senderId: true, receiverId: true, content: true,
                    mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true,
                    sender: { select: { id: true, name: true, email: true } },
                    receiver: { select: { id: true, name: true, email: true } },
                    replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                take: 100
            }),
            prisma.message.findMany({
                where: { receiverId: athleteId },
                select: {
                    id: true, senderId: true, receiverId: true, content: true,
                    mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true,
                    sender: { select: { id: true, name: true, email: true } },
                    receiver: { select: { id: true, name: true, email: true } },
                    replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                take: 100
            })
        ]);

        // Merge, deduplicate, sort, take last 100
        const merged = new Map<string, typeof sent[0]>();
        for (const m of sent) merged.set(m.id, m);
        for (const m of received) merged.set(m.id, m);
        const all = [...merged.values()].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ).slice(-100);

        return NextResponse.json(all);
    } catch (error) {
        console.error('GET /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

// POST /api/messages — send a new message
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { senderId, receiverId, content, mediaUrl, mediaType, replyToId } = body;

        if (!senderId || !receiverId || !content) {
            return NextResponse.json({ error: 'senderId, receiverId, and content are required' }, { status: 400 });
        }

        const message = await prisma.message.create({
            data: { senderId, receiverId, content, mediaUrl: mediaUrl || null, mediaType: mediaType || null, replyToId: replyToId || null },
            select: {
                id: true, senderId: true, receiverId: true, content: true,
                mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true,
                sender: { select: { id: true, name: true, email: true } },
                receiver: { select: { id: true, name: true, email: true } },
                replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
            }
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error('POST /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

// PATCH /api/messages — mark messages as read
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { athleteId, readerId } = body;

        if (!athleteId || !readerId) {
            return NextResponse.json({ error: 'athleteId and readerId are required' }, { status: 400 });
        }

        await prisma.message.updateMany({
            where: { receiverId: readerId, senderId: athleteId, read: false },
            data: { read: true }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
    }
}

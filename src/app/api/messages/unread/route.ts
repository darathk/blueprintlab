import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/messages/unread?userId=X — lightweight unread count
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        const count = await prisma.message.count({
            where: { receiverId: userId, read: false }
        });

        return NextResponse.json({ unread: count });
    } catch (error) {
        console.error('GET /api/messages/unread error:', error);
        return NextResponse.json({ unread: 0 });
    }
}

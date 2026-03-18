import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/messages/unread?userId=X — lightweight unread count
export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        // Users can only check their own unread count
        if (userId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

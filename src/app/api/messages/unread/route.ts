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

        // Check if this user is a coach — if so, only count messages from their
        // assigned athletes to match what the inbox displays. This prevents phantom
        // badges from orphaned messages or athletes reassigned to a different coach.
        const user = await prisma.athlete.findUnique({
            where: { id: userId },
            select: { role: true, email: true }
        });

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
        const isCoach = user?.role === 'coach' ||
            (adminEmail && user?.email?.toLowerCase() === adminEmail.toLowerCase());

        let count: number;
        if (isCoach) {
            // Only count unread messages from athletes assigned to this coach
            count = await prisma.message.count({
                where: {
                    receiverId: userId,
                    read: false,
                    sender: { coachId: userId }
                }
            });
        } else {
            count = await prisma.message.count({
                where: { receiverId: userId, read: false }
            });
        }

        return NextResponse.json({ unread: count });
    } catch (error) {
        console.error('GET /api/messages/unread error:', error);
        return NextResponse.json({ unread: 0 });
    }
}

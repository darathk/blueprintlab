import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { endpoint } = await req.json();
        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
        }

        const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 400 });

        const athlete = await prisma.athlete.findUnique({
            where: { email },
            select: { id: true }
        });

        if (!athlete) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Only delete the subscription if it belongs to this user
        await prisma.pushSubscription.deleteMany({
            where: { endpoint, athleteId: athlete.id }
        });

        console.log(`[Push Unsubscribe] Removed subscription for ${athlete.id}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Push Unsubscribe] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

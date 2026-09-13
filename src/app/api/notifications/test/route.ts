import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { sendPushToUser } from '@/lib/push-utils';

export const dynamic = 'force-dynamic';

// GET /api/notifications/test — send a test push notification to the current user
export async function GET() {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

        const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

        const athlete = await prisma.athlete.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, name: true } });
        if (!athlete) return NextResponse.json({ error: 'User not in DB', email }, { status: 404 });

        const { sent, failed } = await sendPushToUser(athlete.id, {
            title: 'Test Notification',
            body: 'Push notifications are working!',
            url: '/'
        });

        if (sent === 0 && failed === 0) {
            return NextResponse.json({
                error: 'No push subscriptions found for your account',
                userId: athlete.id,
                userName: athlete.name,
                hint: 'Tap "Enable Notifications" button and allow the permission prompt'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            userId: athlete.id,
            userName: athlete.name,
            sent,
            failed
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

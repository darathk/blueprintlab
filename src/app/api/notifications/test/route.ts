import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

// GET /api/notifications/test — send a test push notification to the current user
export async function GET() {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

        const athlete = await prisma.athlete.findUnique({ where: { email }, select: { id: true, name: true } });
        if (!athlete) return NextResponse.json({ error: 'User not in DB', email }, { status: 404 });

        const subscriptions = await prisma.pushSubscription.findMany({ where: { athleteId: athlete.id } });

        if (subscriptions.length === 0) {
            return NextResponse.json({
                error: 'No push subscriptions found for your account',
                userId: athlete.id,
                userName: athlete.name,
                hint: 'Tap "Enable Notifications" button and allow the permission prompt'
            }, { status: 404 });
        }

        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublic || !vapidPrivate) {
            return NextResponse.json({
                error: 'VAPID keys not configured on server',
                hasPublic: !!vapidPublic,
                hasPrivate: !!vapidPrivate
            }, { status: 500 });
        }

        webpush.setVapidDetails('mailto:darathkhon@gmail.com', vapidPublic, vapidPrivate);

        const payload = JSON.stringify({
            title: 'Test Notification',
            body: 'Push notifications are working!',
            url: '/'
        });

        const results = [];
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                results.push({ endpoint: sub.endpoint.slice(-30), status: 'sent' });
            } catch (err: any) {
                results.push({
                    endpoint: sub.endpoint.slice(-30),
                    status: 'failed',
                    statusCode: err.statusCode,
                    body: err.body
                });
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                }
            }
        }

        return NextResponse.json({
            success: true,
            userId: athlete.id,
            userName: athlete.name,
            subscriptionCount: subscriptions.length,
            results
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

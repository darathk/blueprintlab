import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

function initVapid() {
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return false;
    webpush.setVapidDetails('mailto:darathkhon@gmail.com', vapidPublic, vapidPrivate);
    return true;
}

/**
 * Send a push notification to a specific user (by their athlete/coach ID).
 * Automatically cleans up stale subscriptions.
 */
export async function sendPushToUser(
    userId: string,
    payload: { title: string; body: string; url: string }
): Promise<{ sent: number; failed: number }> {
    if (!initVapid()) {
        console.warn('[Push] VAPID keys not configured');
        return { sent: 0, failed: 0 };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { athleteId: userId },
    });

    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const payloadStr = JSON.stringify(payload);
    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
        subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payloadStr,
                    { TTL: 60 * 60 }
                );
                sent++;
            } catch (err: any) {
                failed++;
                if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                }
            }
        })
    );

    return { sent, failed };
}

/**
 * Send push notifications to multiple users in parallel.
 */
export async function sendPushToUsers(
    notifications: Array<{ userId: string; title: string; body: string; url: string }>
): Promise<{ totalSent: number; totalFailed: number }> {
    const results = await Promise.allSettled(
        notifications.map(({ userId, ...payload }) => sendPushToUser(userId, payload))
    );

    let totalSent = 0;
    let totalFailed = 0;
    for (const r of results) {
        if (r.status === 'fulfilled') {
            totalSent += r.value.sent;
            totalFailed += r.value.failed;
        }
    }
    return { totalSent, totalFailed };
}

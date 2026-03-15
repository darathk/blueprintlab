import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import webpush from 'web-push';

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:darathkhon@gmail.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export const dynamic = 'force-dynamic';

// GET /api/messages?athleteId=X — fetch conversation messages (last 100)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const athleteId = searchParams.get('athleteId');

        if (!athleteId) {
            return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
        }

        // Single query with OR — much faster than two queries + JS merge
        const all = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: athleteId },
                    { receiverId: athleteId }
                ]
            },
            select: {
                id: true, senderId: true, receiverId: true, content: true,
                mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true, reactions: true,
                sender: { select: { id: true, name: true, email: true } },
                receiver: { select: { id: true, name: true, email: true } },
                replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        return NextResponse.json(all.reverse());
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

        if (!senderId || !receiverId || (content === undefined && !mediaUrl)) {
            return NextResponse.json({ error: 'senderId, receiverId, and content or mediaUrl are required' }, { status: 400 });
        }

        const message = await prisma.message.create({
            data: { senderId, receiverId, content: content || '', mediaUrl: mediaUrl || null, mediaType: mediaType || null, replyToId: replyToId || null },
            select: {
                id: true, senderId: true, receiverId: true, content: true,
                mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true, reactions: true,
                sender: { select: { id: true, name: true, email: true, role: true } },
                receiver: { select: { id: true, name: true, email: true, role: true } },
                replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
            }
        });

        // Send push notifications BEFORE returning response
        // (Vercel serverless kills the function after response is sent, so fire-and-forget doesn't work)
        try {
            if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                const subscriptions = await prisma.pushSubscription.findMany({
                    where: { athleteId: receiverId }
                });

                if (subscriptions.length > 0) {
                    const receiver = await prisma.athlete.findUnique({
                        where: { id: receiverId },
                        select: { role: true, email: true }
                    });

                    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
                    const isReceiverCoach = receiver?.role === 'coach' ||
                        (adminEmail && receiver?.email.toLowerCase() === adminEmail.toLowerCase());

                    const redirectUrl = isReceiverCoach
                        ? `/dashboard/messages?athleteId=${senderId}`
                        : `/athlete/${receiverId}/chat`;

                    const notifBody = content && content.trim()
                        ? (content.length > 50 ? content.substring(0, 47) + '...' : content)
                        : mediaUrl ? (mediaType?.startsWith('video') ? 'Video' : mediaType?.startsWith('audio') ? 'Voice Message' : 'Photo') : 'New message';

                    const payload = JSON.stringify({
                        title: `New Message from ${message.sender.name}`,
                        body: notifBody,
                        url: redirectUrl
                    });

                    console.log(`[Push] Sending to ${subscriptions.length} subscription(s) for receiver ${receiverId}`);

                    await Promise.allSettled(
                        subscriptions.map(async (sub) => {
                            try {
                                await webpush.sendNotification(
                                    {
                                        endpoint: sub.endpoint,
                                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                                    },
                                    payload
                                );
                                console.log(`[Push] Sent successfully to ${sub.endpoint.slice(-20)}`);
                            } catch (pushError: any) {
                                console.error(`[Push] Failed for ${sub.endpoint.slice(-20)}:`, pushError.statusCode, pushError.body);
                                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                                }
                            }
                        })
                    );
                } else {
                    console.log(`[Push] No subscriptions found for receiver ${receiverId}`);
                }
            } else {
                console.warn('[Push] VAPID keys not configured — skipping push notifications');
            }
        } catch (pushErr) {
            console.error('[Push] Error in push notification flow:', pushErr);
        }

        return NextResponse.json(message);
    } catch (error) {
        console.error('POST /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

// PATCH /api/messages — mark messages as read OR edit a message
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Edit message content
        if (body.messageId && body.content !== undefined) {
            const { messageId, content } = body;
            const updated = await prisma.message.update({
                where: { id: messageId },
                data: { content },
                select: {
                    id: true, senderId: true, receiverId: true, content: true,
                    mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true, reactions: true,
                    sender: { select: { id: true, name: true, email: true } },
                    receiver: { select: { id: true, name: true, email: true } },
                    replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
                }
            });
            return NextResponse.json(updated);
        }

        // Mark as read
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
        return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
    }
}
// DELETE /api/messages — delete a message
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
        }

        // 1. Get message info to check for media
        const msg = await prisma.message.findUnique({
            where: { id },
            select: { mediaUrl: true }
        });

        if (!msg) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // 2. Delete media from Supabase if it exists
        if (msg.mediaUrl) {
            try {
                // Extract path from public URL
                // URL looks like: https://.../storage/v1/object/public/lift-videos/ATHLETE_ID/FILENAME
                const urlParts = msg.mediaUrl.split('/lift-videos/');
                if (urlParts.length > 1) {
                    const filePath = urlParts[1];
                    const { error } = await supabase.storage.from('lift-videos').remove([filePath]);
                    if (error) console.error('Supabase media deletion error:', error);
                }
            } catch (mediaError) {
                console.error('Failed to parse media URL for deletion:', mediaError);
            }
        }

        // 3. Delete from DB
        await prisma.message.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }
}

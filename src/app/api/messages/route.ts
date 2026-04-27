import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import webpush from 'web-push';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/messages?athleteId=X — fetch conversation messages (last 100)
export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const athleteId = searchParams.get('athleteId');

        if (!athleteId) {
            return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
        }

        // Coaches can only access messages for their own athletes; athletes can only access their own
        if (auth.user.id !== athleteId) {
            const access = await requireAccessToAthlete(athleteId, auth);
            if ('error' in access) return access.error;
        }

        // Optional: only fetch messages newer than a timestamp (for incremental polling)
        const since = searchParams.get('since');
        // Optional: filter to a specific session's messages (for session video review)
        const sessionId = searchParams.get('sessionId');

        // Coaches: only show messages between themselves and this athlete
        // Athletes: show all their messages (with their coach)
        const whereClause: any = auth.isCoach
            ? { OR: [
                { senderId: athleteId, receiverId: auth.user.id },
                { senderId: auth.user.id, receiverId: athleteId }
            ] }
            : { OR: [
                { senderId: athleteId },
                { receiverId: athleteId }
            ] };

        if (since) {
            whereClause.createdAt = { gt: new Date(since) };
        }
        // sessionId filter disabled until `prisma db push` adds the column
        // if (sessionId) {
        //     whereClause.sessionId = sessionId;
        // }

        const all = await prisma.message.findMany({
            where: whereClause,
            select: {
                id: true, senderId: true, receiverId: true, content: true,
                mediaUrl: true, mediaType: true, createdAt: true, read: true, replyToId: true, reactions: true,
                sender: { select: { id: true, name: true, email: true } },
                receiver: { select: { id: true, name: true, email: true } },
                replyTo: { select: { id: true, content: true, mediaUrl: true, mediaType: true, sender: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take: since ? 50 : 100
        });

        return NextResponse.json(all.reverse());
    } catch (error) {
        console.error('GET /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

// POST /api/messages — send a new message
export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { senderId, receiverId, content, mediaUrl, mediaType, replyToId, sessionId } = body;

        if (!senderId || !receiverId || (content === undefined && !mediaUrl)) {
            return NextResponse.json({ error: 'senderId, receiverId, and content or mediaUrl are required' }, { status: 400 });
        }

        // Verify the sender is the authenticated user
        if (senderId !== auth.user.id) {
            return NextResponse.json({ error: 'Cannot send messages as another user' }, { status: 403 });
        }

        // Coaches can only message their own athletes; athletes can only message their coach
        if (auth.isCoach) {
            const access = await requireAccessToAthlete(receiverId, auth);
            if ('error' in access) return access.error;
        } else {
            const sender = await prisma.athlete.findUnique({ where: { id: senderId }, select: { coachId: true } });
            if (!sender || sender.coachId !== receiverId) {
                return NextResponse.json({ error: 'You can only message your coach' }, { status: 403 });
            }
        }

        // Validate content length
        if (content && typeof content === 'string' && content.length > 5000) {
            return NextResponse.json({ error: 'Message too long' }, { status: 400 });
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
        // (Vercel serverless kills the function after response is sent)
        try {
            const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

            if (vapidPublic && vapidPrivate) {
                webpush.setVapidDetails('mailto:darathkhon@gmail.com', vapidPublic, vapidPrivate);

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
                        title: `${message.sender.name}`,
                        body: notifBody,
                        url: redirectUrl
                    });

                    console.log(`[Push] Sending to ${subscriptions.length} sub(s) for ${receiverId}`);

                    const results = await Promise.allSettled(
                        subscriptions.map(async (sub) => {
                            try {
                                await webpush.sendNotification(
                                    {
                                        endpoint: sub.endpoint,
                                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                                    },
                                    payload,
                                    { TTL: 60 * 60 } // 1 hour TTL
                                );
                                console.log(`[Push] Sent to ...${sub.endpoint.slice(-20)}`);
                            } catch (pushError: any) {
                                console.error(`[Push] Failed ...${sub.endpoint.slice(-20)}:`, pushError.statusCode, pushError.body);
                                // Clean up expired/invalid subscriptions
                                if (pushError.statusCode === 410 || pushError.statusCode === 404 || pushError.statusCode === 403) {
                                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                                    console.log(`[Push] Deleted stale subscription ${sub.id}`);
                                }
                            }
                        })
                    );
                    console.log(`[Push] Results: ${results.filter(r => r.status === 'fulfilled').length}/${results.length} sent`);
                } else {
                    console.log(`[Push] No subscriptions for receiver ${receiverId}`);
                }
            } else {
                console.warn('[Push] VAPID keys not configured');
            }
        } catch (pushErr) {
            console.error('[Push] Error:', pushErr);
        }

        return NextResponse.json(message);
    } catch (error) {
        console.error('POST /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

// PATCH /api/messages — mark messages as read OR edit a message
export async function PATCH(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();

        // Edit message content
        if (body.messageId && body.content !== undefined) {
            const { messageId, content } = body;

            // Verify sender owns this message
            const msg = await prisma.message.findUnique({
                where: { id: messageId },
                select: { senderId: true }
            });
            if (!msg || msg.senderId !== auth.user.id) {
                return NextResponse.json({ error: 'Can only edit your own messages' }, { status: 403 });
            }

            if (typeof content === 'string' && content.length > 5000) {
                return NextResponse.json({ error: 'Message too long' }, { status: 400 });
            }

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

        // Only the receiver can mark messages as read
        if (readerId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.message.updateMany({
            where: { receiverId: readerId, senderId: athleteId, read: false },
            data: { read: true }
        });

        // Clear any coach-side manual-unread flag for this athlete.
        try {
            await prisma.athlete.update({
                where: { id: athleteId },
                data: { coachMarkedUnread: false }
            });
        } catch {
            // Field may not exist yet on prod — fail silently.
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
    }
}
// DELETE /api/messages — delete a message
export async function DELETE(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
        }

        // 1. Get message info to check ownership and media
        const msg = await prisma.message.findUnique({
            where: { id },
            select: { mediaUrl: true, senderId: true }
        });

        if (!msg) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // Only the sender can delete their own messages
        if (msg.senderId !== auth.user.id) {
            return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 });
        }

        // 2. Delete media from Supabase if it exists
        if (msg.mediaUrl) {
            try {
                // Extract path from public URL
                // URL looks like: https://.../storage/v1/object/public/lift-videos/ATHLETE_ID/FILENAME
                const urlParts = msg.mediaUrl.split('/lift-videos/');
                if (urlParts.length > 1) {
                    // Strip media fragment URI (#t=...) if present
                    const filePath = urlParts[1].split('#')[0];
                    const { error } = await supabase.storage.from('lift-videos').remove([filePath]);
                    if (error) console.error('Supabase media deletion error:', error);
                }
            } catch (mediaError) {
                console.error('Failed to parse media URL for deletion:', mediaError);
            }
        }

        // 3. Nullify any replies pointing to this message so FK doesn't block deletion
        await prisma.message.updateMany({
            where: { replyToId: id },
            data: { replyToId: null }
        });

        // 4. Delete from DB
        await prisma.message.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/messages error:', error);
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }
}

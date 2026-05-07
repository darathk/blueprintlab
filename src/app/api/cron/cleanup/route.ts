import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

// Helper to extract bucket path from the public Supabase URL
function extractStoragePath(publicUrl: string): string | null {
    if (!publicUrl) return null;
    const marker = '/storage/v1/object/public/lift-videos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    // Strip media fragment URI (#t=...) if present
    return publicUrl.substring(idx + marker.length).split('#')[0];
}

export async function GET(request: Request) {
    try {
        // Authorize the cron request
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        // Allow localhost bypassing for easy local testing
        if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        let messagesDeleted = 0;
        let messageMediaDeleted = 0;
        let prsDeleted = 0;
        let prVideosDeleted = 0;

        // ═══ 1. MESSAGE CLEANUP (older than 101 days) ═══
        const messageCutoff = new Date();
        messageCutoff.setDate(messageCutoff.getDate() - 101);

        const oldMessages = await prisma.message.findMany({
            where: { createdAt: { lt: messageCutoff } },
            select: { id: true, mediaUrl: true }
        });

        if (oldMessages.length > 0) {
            // Extract media paths to delete from Supabase
            const pathsToDelete: string[] = [];
            for (const msg of oldMessages) {
                if (msg.mediaUrl) {
                    const path = extractStoragePath(msg.mediaUrl);
                    if (path) pathsToDelete.push(path);
                }
            }

            // Delete media from Supabase bucket in chunks
            if (pathsToDelete.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
                    const chunk = pathsToDelete.slice(i, i + chunkSize);
                    const { error } = await supabase.storage.from('lift-videos').remove(chunk);
                    if (error) {
                        console.error('Failed to delete some media from Supabase:', error);
                    }
                }
                messageMediaDeleted = pathsToDelete.length;
            }

            // Delete messages from Prisma
            const ids = oldMessages.map(m => m.id);

            await prisma.message.updateMany({
                where: { replyToId: { in: ids } },
                data: { replyToId: null }
            });

            await prisma.message.deleteMany({
                where: { id: { in: ids } }
            });

            messagesDeleted = ids.length;
        }

        // ═══ 2. PR / HIGHLIGHTS CLEANUP (older than 28 days) ═══
        const prCutoff = new Date();
        prCutoff.setDate(prCutoff.getDate() - 28);
        const prCutoffStr = prCutoff.toISOString().split('T')[0]; // YYYY-MM-DD

        const oldPRs = await prisma.personalRecord.findMany({
            where: { date: { lt: prCutoffStr } },
            select: { id: true, videoUrl: true }
        });

        if (oldPRs.length > 0) {
            // Delete PR videos from Supabase
            const prPaths: string[] = [];
            for (const pr of oldPRs) {
                if (pr.videoUrl) {
                    const path = extractStoragePath(pr.videoUrl);
                    if (path) prPaths.push(path);
                }
            }

            if (prPaths.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < prPaths.length; i += chunkSize) {
                    const chunk = prPaths.slice(i, i + chunkSize);
                    const { error } = await supabase.storage.from('lift-videos').remove(chunk);
                    if (error) {
                        console.error('Failed to delete PR videos from Supabase:', error);
                    }
                }
                prVideosDeleted = prPaths.length;
            }

            // Delete PR records from Prisma
            await prisma.personalRecord.deleteMany({
                where: { id: { in: oldPRs.map(p => p.id) } }
            });

            prsDeleted = oldPRs.length;
        }

        return NextResponse.json({
            success: true,
            messages: { deleted: messagesDeleted, mediaDeleted: messageMediaDeleted },
            prs: { deleted: prsDeleted, videosDeleted: prVideosDeleted },
        });

    } catch (error) {
        console.error('Cron Cleanup Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

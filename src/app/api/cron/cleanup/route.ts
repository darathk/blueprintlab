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

        // Calculate 101 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 101);

        // 1. Find all messages older than 101 days
        const oldMessages = await prisma.message.findMany({
            where: { createdAt: { lt: cutoffDate } },
            select: { id: true, mediaUrl: true }
        });

        if (oldMessages.length === 0) {
            return NextResponse.json({ success: true, message: 'No messages to clean up.' });
        }

        // 2. Extract media paths to delete from Supabase
        const pathsToDelete: string[] = [];
        for (const msg of oldMessages) {
            if (msg.mediaUrl) {
                const path = extractStoragePath(msg.mediaUrl);
                if (path) pathsToDelete.push(path);
            }
        }

        // 3. Delete media from Supabase bucket in chunks (if any)
        if (pathsToDelete.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
                const chunk = pathsToDelete.slice(i, i + chunkSize);
                const { error } = await supabase.storage.from('lift-videos').remove(chunk);
                if (error) {
                    console.error('Failed to delete some media from Supabase:', error);
                }
            }
        }

        // 4. Delete messages from Prisma
        // First delete all the child replies to avoid FK cascade errors if the DB didn't apply SetNull correctly
        const ids = oldMessages.map(m => m.id);

        await prisma.message.updateMany({
            where: { replyToId: { in: ids } },
            data: { replyToId: null }
        });

        await prisma.message.deleteMany({
            where: { id: { in: ids } }
        });

        return NextResponse.json({
            success: true,
            deletedCount: ids.length,
            mediaDeletedCount: pathsToDelete.length
        });

    } catch (error) {
        console.error('Cron Cleanup Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

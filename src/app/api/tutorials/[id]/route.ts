import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';

function detectPlatform(url: string): string {
    const lower = (url || '').toLowerCase();
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return 'other';
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { id } = await params;
        const body = await request.json();
        const { title, videoUrl, category, description, tags } = body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = String(title).trim();
        if (category !== undefined) updateData.category = String(category).trim().toLowerCase();
        if (description !== undefined) updateData.description = description ? String(description).trim() : null;
        if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
        if (videoUrl !== undefined) {
            updateData.videoUrl = String(videoUrl).trim();
            updateData.platform = detectPlatform(videoUrl);
        }

        const tutorial = await prisma.videoTutorial.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ success: true, tutorial });
    } catch (error) {
        console.error('Error updating tutorial:', error);
        return NextResponse.json({ error: 'Failed to update tutorial' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { id } = await params;
        await prisma.videoTutorial.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting tutorial:', error);
        return NextResponse.json({ error: 'Failed to delete tutorial' }, { status: 500 });
    }
}

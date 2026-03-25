import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (!athleteId) {
        return NextResponse.json({ error: 'Missing athleteId' }, { status: 400 });
    }

    const access = await requireAccessToAthlete(athleteId);
    if ('error' in access) return access.error;

    try {
        const notes = await prisma.coachNote.findMany({
            where: { coachId: auth.user.id, athleteId },
            orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        });
        return NextResponse.json(notes);
    } catch (error) {
        console.error('GET /api/coach-notes error:', error);
        return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { athleteId, content, category } = await request.json();

        if (!athleteId || !content) {
            return NextResponse.json({ error: 'Missing athleteId or content' }, { status: 400 });
        }

        if (typeof content !== 'string' || content.length > 5000) {
            return NextResponse.json({ error: 'Content too long (max 5000 chars)' }, { status: 400 });
        }

        const access = await requireAccessToAthlete(athleteId);
        if ('error' in access) return access.error;

        const note = await prisma.coachNote.create({
            data: {
                coachId: auth.user.id,
                athleteId,
                content,
                category: category || 'general',
            },
        });
        return NextResponse.json(note, { status: 201 });
    } catch (error) {
        console.error('POST /api/coach-notes error:', error);
        return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { id, content, category, pinned } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing note ID' }, { status: 400 });
        }

        const existing = await prisma.coachNote.findUnique({
            where: { id },
            select: { coachId: true },
        });
        if (!existing || existing.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        const updated = await prisma.coachNote.update({
            where: { id },
            data: {
                ...(content !== undefined && { content }),
                ...(category !== undefined && { category }),
                ...(pinned !== undefined && { pinned }),
            },
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT /api/coach-notes error:', error);
        return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing note ID' }, { status: 400 });
    }

    try {
        const existing = await prisma.coachNote.findUnique({
            where: { id },
            select: { coachId: true },
        });
        if (!existing || existing.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        await prisma.coachNote.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/coach-notes error:', error);
        return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }
}

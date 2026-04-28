import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();

        if (!body.athleteId || !body.sessionId || !body.exerciseName || !body.programId) {
            return NextResponse.json({ error: 'athleteId, sessionId, exerciseName, and programId are required' }, { status: 400 });
        }

        // Verify access
        const access = await requireAccessToAthlete(body.athleteId, auth);
        if ('error' in access) return access.error;

        const topSet = await prisma.plannedTopSet.upsert({
            where: {
                athleteId_sessionId_exerciseName: {
                    athleteId: body.athleteId,
                    sessionId: body.sessionId,
                    exerciseName: body.exerciseName,
                },
            },
            create: {
                athleteId: body.athleteId,
                coachId: body.coachId || null,
                exerciseName: body.exerciseName,
                weight: body.weight || null,
                reps: body.reps || null,
                rpe: body.rpe || null,
                unit: body.unit || 'lbs',
                sessionId: body.sessionId,
                programId: body.programId,
                weekNum: parseInt(body.weekNum) || 1,
                dayNum: parseInt(body.dayNum) || 1,
                note: body.note || null,
                date: body.date || null,
            },
            update: {
                weight: body.weight || null,
                reps: body.reps || null,
                rpe: body.rpe || null,
                unit: body.unit || 'lbs',
                note: body.note || null,
                date: body.date || null,
            },
        });

        return NextResponse.json(topSet);
    } catch (error) {
        console.error('Top set save error:', error);
        return NextResponse.json({ error: 'Failed to save planned top set' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');
    const sessionId = searchParams.get('sessionId');

    try {
        let where: any = {};

        if (athleteId) {
            const access = await requireAccessToAthlete(athleteId, auth);
            if ('error' in access) return access.error;
            where.athleteId = athleteId;
        } else if (auth.isCoach) {
            const athletes = await prisma.athlete.findMany({
                where: { coachId: auth.user.id },
                select: { id: true },
            });
            where.athleteId = { in: athletes.map(a => a.id) };
        } else {
            where.athleteId = auth.user.id;
        }

        if (sessionId) where.sessionId = sessionId;

        const topSets = await prisma.plannedTopSet.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                athlete: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(topSets);
    } catch (error) {
        console.error('Top set fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch planned top sets' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    try {
        const topSet = await prisma.plannedTopSet.findUnique({ where: { id } });
        if (!topSet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const access = await requireAccessToAthlete(topSet.athleteId, auth);
        if ('error' in access) return access.error;

        await prisma.plannedTopSet.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Top set delete error:', error);
        return NextResponse.json({ error: 'Failed to delete planned top set' }, { status: 500 });
    }
}

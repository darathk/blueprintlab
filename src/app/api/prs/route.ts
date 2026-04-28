import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();

        if (!body.athleteId || !body.exerciseName || body.weight === undefined || body.reps === undefined || !body.date) {
            return NextResponse.json({ error: 'athleteId, exerciseName, weight, reps, and date are required' }, { status: 400 });
        }

        // Verify access
        const access = await requireAccessToAthlete(body.athleteId, auth);
        if ('error' in access) return access.error;

        const pr = await prisma.personalRecord.create({
            data: {
                athleteId: body.athleteId,
                exerciseName: body.exerciseName,
                weight: parseFloat(body.weight),
                reps: parseInt(body.reps),
                rpe: body.rpe ? parseFloat(body.rpe) : null,
                unit: body.unit || 'lbs',
                videoUrl: body.videoUrl || null,
                videoType: body.videoType || null,
                sessionId: body.sessionId || null,
                programName: body.programName || null,
                weekNum: body.weekNum ? parseInt(body.weekNum) : null,
                dayNum: body.dayNum ? parseInt(body.dayNum) : null,
                note: body.note || null,
                date: body.date,
            },
        });

        return NextResponse.json(pr);
    } catch (error) {
        console.error('PR create error:', error);
        return NextResponse.json({ error: 'Failed to create PR' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');
    const coachId = searchParams.get('coachId');

    try {
        let where: any = {};

        if (athleteId) {
            const access = await requireAccessToAthlete(athleteId, auth);
            if ('error' in access) return access.error;
            where.athleteId = athleteId;
        } else if (coachId || auth.isCoach) {
            // Coach fetching all their athletes' PRs
            const athletes = await prisma.athlete.findMany({
                where: { coachId: auth.user.id },
                select: { id: true },
            });
            where.athleteId = { in: athletes.map(a => a.id) };
        } else {
            // Athlete fetching own PRs
            where.athleteId = auth.user.id;
        }

        const prs = await prisma.personalRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                athlete: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(prs);
    } catch (error) {
        console.error('PR fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch PRs' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    try {
        const pr = await prisma.personalRecord.findUnique({ where: { id } });
        if (!pr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Verify access
        const access = await requireAccessToAthlete(pr.athleteId, auth);
        if ('error' in access) return access.error;

        await prisma.personalRecord.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PR delete error:', error);
        return NextResponse.json({ error: 'Failed to delete PR' }, { status: 500 });
    }
}

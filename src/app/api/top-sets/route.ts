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

        // If athlete cleared all fields, delete the planned top set
        if (!body.weight && !body.reps && !body.rpe) {
            await prisma.plannedTopSet.deleteMany({
                where: {
                    athleteId: body.athleteId,
                    sessionId: body.sessionId,
                    exerciseName: body.exerciseName,
                },
            });
            return NextResponse.json({ success: true, deleted: true });
        }

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

        // AUTOMATION: Update the prescribed top set for the target session in the program
        if (body.weight) {
            const program = await prisma.program.findUnique({
                where: { id: body.programId }
            });
            if (program && program.weeks) {
                let updated = false;
                // Note: body.weekNum is ALREADY the target week number (do NOT add +1 again)
                const targetWeekNum = parseInt(body.weekNum) || 1;
                const targetDayNum = parseInt(body.dayNum) || 1;
                const weeks = program.weeks as any[];
                
                for (const w of weeks) {
                    if (w.weekNumber === targetWeekNum && w.sessions) {
                        for (const s of w.sessions) {
                            const isMatchSession = (s.day === targetDayNum) || 
                                (s.id && s.id === body.sessionId) || 
                                (`${program.id}_w${w.weekNumber}_d${s.day}` === body.sessionId);
                            if (isMatchSession && s.exercises) {
                                for (const e of s.exercises) {
                                    if (e.name === body.exerciseName && Array.isArray(e.sets) && e.sets.length > 0) {
                                        // ONLY update Set 1 (index 0 / top set) — NEVER touch back-off sets!
                                        const topSetObj = e.sets[0];
                                        topSetObj.weight = String(body.weight);
                                        topSetObj.target = topSetObj.target || {};
                                        topSetObj.target.weight = String(body.weight);
                                        if (body.reps) {
                                            topSetObj.reps = String(body.reps);
                                            topSetObj.target.reps = String(body.reps);
                                        }
                                        if (body.rpe) {
                                            topSetObj.rpe = String(body.rpe);
                                            topSetObj.target.rpe = String(body.rpe);
                                        }
                                        updated = true;
                                    }
                                }
                            }
                        }
                    }
                }

                if (updated) {
                    await prisma.program.update({
                        where: { id: body.programId },
                        data: { weeks: weeks }
                    });
                }
            }
        }

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
        const where: any = {};

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
    const athleteId = searchParams.get('athleteId');
    const sessionId = searchParams.get('sessionId');
    const exerciseName = searchParams.get('exerciseName');

    if (!id && (!athleteId || !sessionId)) {
        return NextResponse.json({ error: 'id or (athleteId and sessionId) required' }, { status: 400 });
    }

    try {
        if (id) {
            const topSet = await prisma.plannedTopSet.findUnique({ where: { id } });
            if (!topSet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

            const access = await requireAccessToAthlete(topSet.athleteId, auth);
            if ('error' in access) return access.error;

            await prisma.plannedTopSet.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

        if (athleteId && sessionId) {
            const access = await requireAccessToAthlete(athleteId, auth);
            if ('error' in access) return access.error;

            const deleteWhere: any = { athleteId, sessionId };
            if (exerciseName) deleteWhere.exerciseName = exerciseName;

            await prisma.plannedTopSet.deleteMany({ where: deleteWhere });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    } catch (error) {
        console.error('Top set delete error:', error);
        return NextResponse.json({ error: 'Failed to delete planned top set' }, { status: 500 });
    }
}

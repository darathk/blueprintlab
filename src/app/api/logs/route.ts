import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();

        if (!body.programId || !body.sessionId) {
            return NextResponse.json({ error: 'programId and sessionId are required' }, { status: 400 });
        }

        // Ensure program exists and verify access
        const programRecord = await prisma.program.findUnique({
            where: { id: body.programId },
            select: { id: true, athleteId: true }
        });

        if (!programRecord) {
            return NextResponse.json({ error: 'Linked program not found' }, { status: 404 });
        }

        // Verify user has access to this athlete's data
        const access = await requireAccessToAthlete(programRecord.athleteId);
        if ('error' in access) return access.error;

        // Check if log already exists for this session
        const existingLog = await prisma.log.findFirst({
            where: {
                sessionId: body.sessionId,
                programId: body.programId
            }
        });

        if (existingLog) {
            await prisma.log.update({
                where: { id: existingLog.id },
                data: {
                    date: body.date,
                    exercises: body.exercises,
                }
            });
        } else {
            await prisma.log.create({
                data: {
                    id: body.id || Math.random().toString(36).substring(7),
                    programId: body.programId,
                    sessionId: body.sessionId,
                    date: body.date,
                    exercises: body.exercises,
                }
            });
        }

        // Revalidate coach dashboard paths so updates reflect instantly
        revalidatePath(`/dashboard/athletes/${programRecord.athleteId}`);
        revalidatePath(`/dashboard`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    try {
        let where: any;
        if (athleteId) {
            // Verify access
            const access = await requireAccessToAthlete(athleteId);
            if ('error' in access) return access.error;
            where = { program: { athleteId } };
        } else if (auth.isCoach) {
            where = { program: { athlete: { coachId: auth.user.id } } };
        } else {
            where = { program: { athleteId: auth.user.id } };
        }

        const logs = await prisma.log.findMany({
            where,
            include: {
                program: {
                    select: { athleteId: true }
                }
            }
        });

        const formattedLogs = logs.map(l => {
            const { program, ...rest } = l;
            return {
                ...rest,
                athleteId: program ? program.athleteId : null
            };
        });

        return NextResponse.json(formattedLogs);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}

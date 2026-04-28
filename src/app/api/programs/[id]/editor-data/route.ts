import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';
import { getExerciseLibrary } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { id: programId } = await context.params;

        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
        });

        if (!program) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }

        const access = await requireAccessToAthlete(program.athleteId, auth);
        if ('error' in access) return access.error;

        const [initialExercises, athlete, existingPrograms, initialCoachNotes] = await Promise.all([
            getExerciseLibrary(),
            prisma.athlete.findUnique({
                where: { id: program.athleteId },
                select: { id: true, name: true, liftTargets: true, trainingSchedule: true }
            }),
            prisma.program.findMany({
                where: { athleteId: program.athleteId, status: { not: 'draft' }, id: { not: programId } },
                orderBy: { startDate: 'desc' },
                select: { id: true, name: true, startDate: true, weeks: true, status: true }
            }),
            prisma.coachNote.findMany({
                where: { athleteId: program.athleteId },
                orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
            })
        ]);

        return NextResponse.json({
            program,
            initialExercises,
            athlete,
            existingPrograms,
            initialCoachNotes
        });
    } catch (error) {
        console.error('Failed to fetch editor data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';



export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { athleteId, programId } = body;

        if (!athleteId || !programId) {
            return NextResponse.json({ error: 'Missing athleteId or programId' }, { status: 400 });
        }

        // Verify coach owns this athlete
        const access = await requireAccessToAthlete(athleteId);
        if ('error' in access) return access.error;

        // First, check if athlete exists
        const athlete = await prisma.athlete.findUnique({
            where: { id: athleteId },
            select: { id: true }
        });

        if (!athlete) {
            return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
        }

        // Verify the program exists AND the current assignee belongs to this coach
        // (prevents stealing programs assigned to athletes owned by another coach).
        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: {
                id: true,
                athleteId: true,
                athlete: { select: { coachId: true, id: true } }
            }
        });

        if (!program) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }

        const programCoachId = program.athlete?.coachId;
        const programOwnerId = program.athlete?.id;
        // Allow reassignment only if the program currently belongs to:
        //   - the coach themselves (a template program), OR
        //   - an athlete whose coach is the current coach, OR
        //   - the 'unassigned' bucket (shared import target).
        const isOwnedByCoach = programCoachId === auth.user.id
            || programOwnerId === auth.user.id
            || program.athleteId === 'unassigned';
        if (!isOwnedByCoach) {
            return NextResponse.json({ error: 'Program not accessible' }, { status: 403 });
        }

        // Only deactivate programs that are OLDER than the one being assigned.
        // If a coach assigns a past program (e.g. a retroactive pivot block),
        // we must NOT deactivate programs with a later startDate — those are the
        // athlete's current or future blocks.
        const assignedProgram = await prisma.program.findUnique({
            where: { id: programId },
            select: { startDate: true }
        });
        const assignedStart = assignedProgram?.startDate || null;

        // Fetch all other active programs for this athlete
        const otherActive = await prisma.program.findMany({
            where: { athleteId, status: 'active', id: { not: programId } },
            select: { id: true, startDate: true }
        });

        // Only deactivate programs with an earlier or same startDate (or no startDate).
        // Programs with a later startDate stay active — they're future/current blocks.
        const toDeactivate = otherActive
            .filter(p => {
                if (!assignedStart) return true; // no date on new → deactivate all older
                if (!p.startDate) return true;    // no date on old → treat as older
                return p.startDate <= assignedStart;
            })
            .map(p => p.id);

        const ops: any[] = [];
        if (toDeactivate.length > 0) {
            ops.push(prisma.program.updateMany({
                where: { id: { in: toDeactivate } },
                data: { status: 'completed' }
            }));
        }
        ops.push(prisma.program.update({
            where: { id: programId },
            data: { status: 'active', athleteId }
        }));
        await prisma.$transaction(ops);

        // Fetch fresh athlete data mapping for the frontend wrapper
        const updatedAthlete = await prisma.athlete.findUnique({
            where: { id: athleteId },
            include: { programs: { where: { status: 'active' }, select: { id: true } } }
        });

        const frontendAthlete = {
            ...updatedAthlete,
            currentProgramId: programId // The frontend expects this synthesized property
        };

        return NextResponse.json({ success: true, athlete: frontendAthlete });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to assign program' }, { status: 500 });
    }
}

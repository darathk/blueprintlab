import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { programId, targetAthleteId } = await request.json();

        if (!programId || !targetAthleteId) {
            return NextResponse.json({ error: 'Missing programId or targetAthleteId' }, { status: 400 });
        }

        // Verify program exists and coach owns it
        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: { id: true, athleteId: true }
        });
        if (!program) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        const sourceAccess = await requireAccessToAthlete(program.athleteId);
        if ('error' in sourceAccess) return sourceAccess.error;

        // Verify coach owns target athlete
        const targetAccess = await requireAccessToAthlete(targetAthleteId);
        if ('error' in targetAccess) return targetAccess.error;

        if (program.athleteId === targetAthleteId) {
            return NextResponse.json({ error: 'Program already belongs to this athlete' }, { status: 400 });
        }

        // Transfer: Logs are linked via programId foreign key, so they follow automatically
        await prisma.program.update({
            where: { id: programId },
            data: { athleteId: targetAthleteId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error transferring program:', error);
        return NextResponse.json({ error: 'Failed to transfer program' }, { status: 500 });
    }
}

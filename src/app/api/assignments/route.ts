import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { athleteId, programId } = body;

        if (!athleteId || !programId) {
            return NextResponse.json({ error: 'Missing athleteId or programId' }, { status: 400 });
        }

        // First, check if athlete exists
        const athlete = await prisma.athlete.findUnique({
            where: { id: athleteId }
        });

        if (!athlete) {
            return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
        }

        // Deactivate old active programs
        await prisma.program.updateMany({
            where: { athleteId, status: 'active', id: { not: programId } },
            data: { status: 'completed' }
        });

        // Activate the new assigned program
        await prisma.program.update({
            where: { id: programId },
            data: { status: 'active', athleteId } // Ensuring it belongs to them
        });

        // Fetch fresh athlete data mapping for the frontend wrapper
        const updatedAthlete = await prisma.athlete.findUnique({
            where: { id: athleteId },
            include: { programs: { where: { status: 'active' } } }
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

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { getProgramsByAthlete } from '@/lib/storage';
import { requireAuth, requireAccessToAthlete, requireCoach } from '@/lib/api-auth';

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    try {
        if (athleteId) {
            // Verify access to this athlete
            const access = await requireAccessToAthlete(athleteId);
            if ('error' in access) return access.error;

            const programs = await getProgramsByAthlete(athleteId);
            return NextResponse.json(programs);
        }

        // Coaches see all their athletes' programs; athletes see only their own
        if (auth.isCoach) {
            const programs = await prisma.program.findMany({
                where: {
                    athlete: { coachId: auth.user.id }
                },
                select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
            });
            return NextResponse.json(programs);
        }

        const programs = await prisma.program.findMany({
            where: { athleteId: auth.user.id },
            select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
        });
        return NextResponse.json(programs);
    } catch (error) {
        console.error('API GET /programs error:', error);
        return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const program = await request.json();

        if (!program.name || !program.weeks || !program.athleteId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate name length
        if (typeof program.name !== 'string' || program.name.length > 200) {
            return NextResponse.json({ error: 'Invalid program name' }, { status: 400 });
        }

        // Verify coach owns this athlete
        const access = await requireAccessToAthlete(program.athleteId);
        if ('error' in access) return access.error;

        const newProgram = await prisma.program.create({
            data: {
                id: program.id || undefined, // Prisma auto-generates uuid if undefined
                athleteId: program.athleteId,
                name: program.name,
                startDate: program.startDate || new Date().toISOString(),
                endDate: program.endDate || null,
                weeks: program.weeks,
                status: program.status || 'active'
            }
        });

        // Set all other programs for this athlete to completed if a new active one is pushed
        if (newProgram.status === 'active') {
            await prisma.program.updateMany({
                where: {
                    athleteId: program.athleteId,
                    id: { not: newProgram.id },
                    status: 'active'
                },
                data: { status: 'completed' }
            });
        }

        return NextResponse.json(newProgram, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const program = await request.json();

        if (!program.id) {
            return NextResponse.json({ error: 'Missing program ID' }, { status: 400 });
        }

        // Verify coach owns the program's athlete
        const existing = await prisma.program.findUnique({
            where: { id: program.id },
            select: { athleteId: true }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        const access = await requireAccessToAthlete(existing.athleteId);
        if ('error' in access) return access.error;

        const updatedProgram = await prisma.program.update({
            where: { id: program.id },
            data: {
                name: program.name !== undefined ? program.name : undefined,
                startDate: program.startDate !== undefined ? program.startDate : undefined,
                endDate: program.endDate !== undefined ? program.endDate : undefined,
                weeks: program.weeks !== undefined ? program.weeks : undefined,
                status: program.status !== undefined ? program.status : undefined,
            }
        });

        return NextResponse.json(updatedProgram, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing program ID' }, { status: 400 });
    }

    try {
        // Verify coach owns the program's athlete
        const existing = await prisma.program.findUnique({
            where: { id },
            select: { athleteId: true }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        const access = await requireAccessToAthlete(existing.athleteId);
        if ('error' in access) return access.error;

        // First delete associated logs due to foreign key constraints
        await prisma.log.deleteMany({ where: { programId: id } });

        // Then delete the program
        await prisma.program.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}

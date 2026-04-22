import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { revalidatePath } from 'next/cache';
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

        // Create the new program; if it's active, deactivate previously-active programs
        // for the same athlete in the same transaction so we never have two actives
        // or leave the athlete with zero active programs on partial failure.
        const status = program.status || 'active';
        const createData = {
            id: program.id || undefined, // Prisma auto-generates uuid if undefined
            athleteId: program.athleteId,
            name: program.name,
            startDate: program.startDate || new Date().toISOString(),
            endDate: program.endDate || null,
            weeks: program.weeks,
            status
        };

        // Deactivate first (before create) so the new program is never caught by the updateMany.
        const ops: any[] = [];
        if (status === 'active') {
            ops.push(prisma.program.updateMany({
                where: {
                    athleteId: program.athleteId,
                    status: 'active'
                },
                data: { status: 'completed' }
            }));
        }
        ops.push(prisma.program.create({ data: createData }));

        const results = await prisma.$transaction(ops);
        const newProgram = results[results.length - 1];

        // Invalidate the athlete's dashboard so a redirect after Save & Assign
        // gets fresh program data without needing a client-side router.refresh().
        revalidatePath(`/dashboard/athletes/${program.athleteId}`);

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

        // When promoting a draft (or any program) to 'active', deactivate the
        // athlete's other active programs first — same as the POST handler.
        // Without this, "Save & Assign" on an auto-saved draft leaves stale
        // active programs in the DB, which confuses the dashboard "needs update"
        // filter and auto-advance logic.
        const ops: any[] = [];
        if (program.status === 'active') {
            ops.push(prisma.program.updateMany({
                where: {
                    athleteId: existing.athleteId,
                    status: 'active',
                    id: { not: program.id },
                },
                data: { status: 'completed' },
            }));
        }
        ops.push(prisma.program.update({
            where: { id: program.id },
            data: {
                name: program.name !== undefined ? program.name : undefined,
                startDate: program.startDate !== undefined ? program.startDate : undefined,
                endDate: program.endDate !== undefined ? program.endDate : undefined,
                weeks: program.weeks !== undefined ? program.weeks : undefined,
                status: program.status !== undefined ? program.status : undefined,
            }
        }));

        const results = await prisma.$transaction(ops);
        const updatedProgram = results[results.length - 1];

        // Invalidate the athlete dashboard cache so post-edit redirects don't
        // need a client-side router.refresh() to see the latest program state.
        revalidatePath(`/dashboard/athletes/${existing.athleteId}`);

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

        // Transactionally delete associated logs (FK constraint) and detach any
        // Readiness check-ins that referenced this program so they aren't orphaned.
        await prisma.$transaction([
            prisma.log.deleteMany({ where: { programId: id } }),
            prisma.readiness.updateMany({ where: { programId: id }, data: { programId: null } }),
            prisma.program.delete({ where: { id } })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}

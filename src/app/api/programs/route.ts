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
            const access = await requireAccessToAthlete(athleteId, auth);
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

function sanitizeProgramWeeks(weeks: any[], startDateStr?: string) {
    if (!Array.isArray(weeks) || !startDateStr) return weeks;
    const [sy, sm, sd] = startDateStr.split('T')[0].split('-').map(Number);
    if (!sy || !sm || !sd) return weeks;
    const start = new Date(sy, sm - 1, sd);
    start.setHours(0, 0, 0, 0);

    return weeks.map((w, wIdx) => {
        const wn = w.weekNumber || (wIdx + 1);
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (wn - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const sanitizedSessions = (w.sessions || []).map((s: any) => {
            if (!s.scheduledDate) return s;
            const candStr = String(s.scheduledDate).split('T')[0];
            const [cy, cm, cd] = candStr.split('-').map(Number);
            const candDate = new Date(cy, cm - 1, cd);
            candDate.setHours(0, 0, 0, 0);

            if (candDate < weekStart || candDate > weekEnd) {
                // Out of bounds for this week! Realign to this week and day
                const exp = new Date(start);
                exp.setDate(exp.getDate() + (wn - 1) * 7 + (Number(s.day || 1) - 1));
                const newDateStr = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;
                return { ...s, scheduledDate: newDateStr };
            }
            return s;
        });

        return { ...w, sessions: sanitizedSessions };
    });
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
        const access = await requireAccessToAthlete(program.athleteId, auth);
        if ('error' in access) return access.error;

        // Create the new program; if it's active, deactivate previously-active programs
        // for the same athlete in the same transaction so we never have two actives
        // or leave the athlete with zero active programs on partial failure.
        const status = program.status || 'active';
        const rawStartDate = program.startDate || new Date().toISOString();
        const createData = {
            id: program.id || undefined, // Prisma auto-generates uuid if undefined
            athleteId: program.athleteId,
            name: program.name,
            startDate: rawStartDate,
            endDate: program.endDate || null,
            weeks: sanitizeProgramWeeks(program.weeks, rawStartDate),
            status
        };

        // Deactivate first (before create) so the new program is never caught by the updateMany.
        const ops: any[] = [];
        if (status === 'active') {
            // Only deactivate if the new program starts today or in the past
            let shouldDeactivate = true;
            if (createData.startDate) {
                const assignedDateStr = createData.startDate.split('T')[0];
                const todayStr = new Date().toISOString().split('T')[0];
                if (assignedDateStr > todayStr) shouldDeactivate = false;
            }

            if (shouldDeactivate) {
                ops.push(prisma.program.updateMany({
                    where: {
                        athleteId: program.athleteId,
                        status: 'active'
                    },
                    data: { status: 'completed' }
                }));
            }
        }
        ops.push(prisma.program.create({ data: createData }));

        const results = await prisma.$transaction(ops);
        const newProgram = results[results.length - 1];

        // Invalidate the athlete's dashboard so a redirect after Save & Assign
        // gets fresh program data without needing a client-side router.refresh().
        revalidatePath(`/dashboard/athletes/${program.athleteId}`);
        revalidatePath(`/athlete/${program.athleteId}/dashboard`);
        revalidatePath(`/athlete/${program.athleteId}`);

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
            select: { athleteId: true, startDate: true }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        const access = await requireAccessToAthlete(existing.athleteId, auth);
        if ('error' in access) return access.error;

        // When promoting a draft (or any program) to 'active', deactivate the
        // athlete's other active programs first — same as the POST handler.
        // Without this, "Save & Assign" on an auto-saved draft leaves stale
        // active programs in the DB, which confuses the dashboard "needs update"
        // filter and auto-advance logic.
        const ops: any[] = [];
        if (program.status === 'active') {
            // Only deactivate if the program being activated starts today or in the past
            const assignedStart = program.startDate;
            let shouldDeactivate = true;
            if (assignedStart) {
                const assignedDateStr = (typeof assignedStart === 'string') ? assignedStart.split('T')[0] : new Date(assignedStart).toISOString().split('T')[0];
                const todayStr = new Date().toISOString().split('T')[0];
                if (assignedDateStr > todayStr) shouldDeactivate = false;
            }

            if (shouldDeactivate) {
                ops.push(prisma.program.updateMany({
                    where: {
                        athleteId: existing.athleteId,
                        status: 'active',
                        id: { not: program.id },
                    },
                    data: { status: 'completed' },
                }));
            }
        }
        const rawStartDate = program.startDate !== undefined ? program.startDate : existing.startDate;
        const sanitizedWeeks = program.weeks !== undefined ? sanitizeProgramWeeks(program.weeks, rawStartDate) : undefined;

        ops.push(prisma.program.update({
            where: { id: program.id },
            data: {
                name: program.name !== undefined ? program.name : undefined,
                startDate: program.startDate !== undefined ? program.startDate : undefined,
                endDate: program.endDate !== undefined ? program.endDate : undefined,
                weeks: sanitizedWeeks,
                status: program.status !== undefined ? program.status : undefined,
            }
        }));

        const results = await prisma.$transaction(ops);
        const updatedProgram = results[results.length - 1];

        // Invalidate the athlete dashboard cache so post-edit redirects don't
        // need a client-side router.refresh() to see the latest program state.
        revalidatePath(`/dashboard/athletes/${existing.athleteId}`);
        revalidatePath(`/athlete/${existing.athleteId}/dashboard`);
        revalidatePath(`/athlete/${existing.athleteId}`);

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
        const access = await requireAccessToAthlete(existing.athleteId, auth);
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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const templates = await prisma.programTemplate.findMany({
            where: { coachId: auth.user.id },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                weeks: true,
                tags: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return NextResponse.json(templates);
    } catch (error: any) {
        console.error('GET /api/templates error:', error);
        if (error?.code === 'P2021') {
            // Table doesn't exist yet — return empty array instead of error
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { name, description, weeks, tags, programId } = body;

        // If programId is provided, save from an existing program
        if (programId) {
            const program = await prisma.program.findUnique({
                where: { id: programId },
                select: {
                    name: true,
                    weeks: true,
                    athleteId: true,
                    athlete: { select: { coachId: true, id: true } },
                },
            });
            if (!program) {
                return NextResponse.json({ error: 'Program not found' }, { status: 404 });
            }

            // Prevent a coach from cloning another coach's program into a template.
            // The program must belong either to one of this coach's athletes, or to the coach themselves.
            const ownerCoachId = program.athlete?.coachId ?? program.athlete?.id;
            if (ownerCoachId !== auth.user.id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Deep-clone weeks with fresh UUIDs
            const clonedWeeks = Array.isArray(program.weeks)
                ? (program.weeks as any[]).map(week => ({
                    ...week,
                    id: randomUUID(),
                    sessions: Array.isArray(week.sessions)
                        ? week.sessions.map((session: any) => ({
                            ...session,
                            id: randomUUID(),
                            exercises: Array.isArray(session.exercises)
                                ? session.exercises.map((ex: any) => ({ ...ex, id: randomUUID() }))
                                : [],
                        }))
                        : [],
                }))
                : program.weeks;

            const template = await prisma.programTemplate.create({
                data: {
                    coachId: auth.user.id,
                    name: name || `${program.name} (Template)`,
                    description: description || null,
                    weeks: clonedWeeks,
                    tags: tags || null,
                },
            });
            return NextResponse.json(template, { status: 201 });
        }

        // Direct creation
        if (!name || !weeks) {
            return NextResponse.json({ error: 'Name and weeks are required' }, { status: 400 });
        }

        if (typeof name !== 'string' || name.length > 200) {
            return NextResponse.json({ error: 'Invalid template name' }, { status: 400 });
        }

        const template = await prisma.programTemplate.create({
            data: {
                coachId: auth.user.id,
                name,
                description: description || null,
                weeks,
                tags: tags || null,
            },
        });
        return NextResponse.json(template, { status: 201 });
    } catch (error: any) {
        console.error('POST /api/templates error:', error);
        // Surface Prisma-specific errors for easier debugging
        const message = error?.code === 'P2021'
            ? 'Template table not found — please run "npx prisma db push" to sync the database schema'
            : error?.code === 'P2003'
            ? 'Foreign key constraint failed — coach record not found'
            : error?.message || 'Failed to create template';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { id, name, description, tags } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
        }

        const existing = await prisma.programTemplate.findUnique({
            where: { id },
            select: { coachId: true },
        });
        if (!existing || existing.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const updated = await prisma.programTemplate.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(tags !== undefined && { tags }),
            },
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT /api/templates error:', error);
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    try {
        const existing = await prisma.programTemplate.findUnique({
            where: { id },
            select: { coachId: true },
        });
        if (!existing || existing.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        await prisma.programTemplate.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/templates error:', error);
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }
}

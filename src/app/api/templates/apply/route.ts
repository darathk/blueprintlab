import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { templateId, athleteId, programName, startDate } = await request.json();

        if (!templateId || !athleteId) {
            return NextResponse.json({ error: 'Missing templateId or athleteId' }, { status: 400 });
        }

        const access = await requireAccessToAthlete(athleteId, auth);
        if ('error' in access) return access.error;

        const template = await prisma.programTemplate.findUnique({
            where: { id: templateId },
            select: { name: true, weeks: true, coachId: true },
        });
        if (!template || template.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Deep-clone weeks with fresh UUIDs
        const clonedWeeks = Array.isArray(template.weeks)
            ? (template.weeks as any[]).map(week => ({
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
            : template.weeks;

        const ops: any[] = [];
        let shouldDeactivate = true;
        const newStartDate = startDate || new Date().toISOString();
        const assignedDateStr = newStartDate.split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        if (assignedDateStr > todayStr) shouldDeactivate = false;

        if (shouldDeactivate) {
            ops.push(prisma.program.updateMany({
                where: {
                    athleteId,
                    status: 'active',
                },
                data: { status: 'completed' },
            }));
        }

        ops.push(prisma.program.create({
            data: {
                athleteId,
                name: programName || template.name,
                startDate: newStartDate,
                weeks: clonedWeeks,
                status: 'active',
                templateId: template.id
            },
        }));

        const results = await prisma.$transaction(ops);
        const newProgram = results[results.length - 1];

        return NextResponse.json({ success: true, programId: newProgram.id }, { status: 201 });
    } catch (error) {
        console.error('POST /api/templates/apply error:', error);
        return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
    }
}

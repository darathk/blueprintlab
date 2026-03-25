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

        const access = await requireAccessToAthlete(athleteId);
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

        const newProgram = await prisma.program.create({
            data: {
                athleteId,
                name: programName || template.name,
                startDate: startDate || new Date().toISOString(),
                weeks: clonedWeeks,
                status: 'active',
            },
        });

        // Deactivate other active programs
        await prisma.program.updateMany({
            where: {
                athleteId,
                id: { not: newProgram.id },
                status: 'active',
            },
            data: { status: 'completed' },
        });

        return NextResponse.json({ success: true, programId: newProgram.id }, { status: 201 });
    } catch (error) {
        console.error('POST /api/templates/apply error:', error);
        return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach, requireAccessToAthlete } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

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
            select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
        });
        if (!program) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        const sourceAccess = await requireAccessToAthlete(program.athleteId, auth);
        if ('error' in sourceAccess) return sourceAccess.error;

        // Verify coach owns target athlete
        const targetAccess = await requireAccessToAthlete(targetAthleteId, auth);
        if ('error' in targetAccess) return targetAccess.error;

        const isDuplicate = program.athleteId === targetAthleteId;

        // Deep-clone weeks with fresh UUIDs for all nested objects
        const clonedWeeks = Array.isArray(program.weeks) ? (program.weeks as any[]).map(week => ({
            ...week,
            id: randomUUID(),
            sessions: Array.isArray(week.sessions) ? week.sessions.map(session => ({
                ...session,
                id: randomUUID(),
                exercises: Array.isArray(session.exercises) ? session.exercises.map(ex => ({
                    ...ex,
                    id: randomUUID(),
                })) : [],
            })) : [],
        })) : program.weeks;

        let targetStartDate = new Date().toISOString().split('T')[0];
        if (isDuplicate) {
            const existingPrograms = await prisma.program.findMany({
                where: { athleteId: targetAthleteId, status: { not: 'draft' } },
                select: { startDate: true, weeks: true }
            });

            let maxEndDate = new Date();
            maxEndDate.setHours(0, 0, 0, 0);

            for (const p of existingPrograms) {
                if (p.startDate) {
                    const raw = typeof p.startDate === 'string' ? p.startDate : p.startDate.toISOString();
                    const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
                    const start = new Date(y, m - 1, d);
                    const weekCount = Array.isArray(p.weeks) ? Math.max(1, p.weeks.length) : 1;
                    start.setDate(start.getDate() + weekCount * 7);
                    if (start > maxEndDate) {
                        maxEndDate = start;
                    }
                }
            }
            // Add leading zeroes if needed
            targetStartDate = `${maxEndDate.getFullYear()}-${String(maxEndDate.getMonth() + 1).padStart(2, '0')}-${String(maxEndDate.getDate()).padStart(2, '0')}`;
        } else {
            targetStartDate = program.startDate;
        }

        const newProgram = await prisma.program.create({
            data: {
                athleteId: targetAthleteId,
                name: isDuplicate ? `${program.name} (Copy)` : program.name,
                startDate: targetStartDate,
                endDate: isDuplicate ? null : program.endDate,
                weeks: clonedWeeks,
                status: 'completed', // Don't auto-activate the copy
            }
        });

        return NextResponse.json({ success: true, programId: newProgram.id });
    } catch (error) {
        console.error('Error copying program:', error);
        return NextResponse.json({ error: 'Failed to copy program' }, { status: 500 });
    }
}

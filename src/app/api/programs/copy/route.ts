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

        // Detect source program start weekday (0=Sun, 1=Mon, ..., 6=Sat)
        let sourceStartDay = 1;
        if (program.startDate) {
            const raw = ((program.startDate as any) instanceof Date) ? (program.startDate as any).toISOString() : String(program.startDate);
            const [sy, sm, sd] = raw.slice(0, 10).split('-').map(Number);
            const sDate = new Date(sy, sm - 1, sd);
            sourceStartDay = sDate.getDay();
        }

        // Deep-clone weeks with fresh UUIDs for all nested objects
        let rawWeeks = Array.isArray(program.weeks) ? (program.weeks as any[]).map(week => ({
            ...week,
            id: randomUUID(),
            sessions: Array.isArray(week.sessions) ? week.sessions.map(session => ({
                ...session,
                id: randomUUID(),
                exercises: Array.isArray(session.exercises) ? session.exercises.map(ex => ({
                    ...ex,
                    id: randomUUID(),
                    sets: Array.isArray(ex.sets) ? ex.sets.map((set: any) => ({
                        ...set,
                        id: randomUUID(),
                    })) : [],
                })) : [],
            })) : [],
        })) : [];

        // Sort by weekNumber
        rawWeeks.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));

        // Strip leading empty weeks so the duplicate program always starts with Week 1 content
        const firstPopulatedIdx = rawWeeks.findIndex(w => Array.isArray(w.sessions) && w.sessions.some((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0));
        if (firstPopulatedIdx > 0) {
            rawWeeks = rawWeeks.slice(firstPopulatedIdx);
        }

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
                    const raw = ((p.startDate as any) instanceof Date) ? (p.startDate as any).toISOString() : String(p.startDate);
                    const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
                    const start = new Date(y, m - 1, d);
                    const weekCount = Array.isArray(p.weeks) ? Math.max(1, p.weeks.length) : 1;
                    start.setDate(start.getDate() + weekCount * 7);
                    if (start > maxEndDate) {
                        maxEndDate = start;
                    }
                }
            }

            // Always start new program on MONDAY following previous program
            const dayOfWeek = maxEndDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const daysUntilMonday = (8 - dayOfWeek) % 7; // Sun(0)->1, Mon(1)->0, Tue(2)->6, etc.
            maxEndDate.setDate(maxEndDate.getDate() + daysUntilMonday);

            targetStartDate = `${maxEndDate.getFullYear()}-${String(maxEndDate.getMonth() + 1).padStart(2, '0')}-${String(maxEndDate.getDate()).padStart(2, '0')}`;
        } else {
            if (program.startDate) {
                const raw = ((program.startDate as any) instanceof Date) ? (program.startDate as any).toISOString() : String(program.startDate);
                const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const dayOfWeek = dt.getDay();
                const daysUntilMonday = (8 - dayOfWeek) % 7;
                dt.setDate(dt.getDate() + daysUntilMonday);
                targetStartDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
        }

        // Target start date starts on Monday (day 1).
        // If source program was Sunday-start (day 0), convert session days:
        // Sunday (1) -> 7, Monday (2) -> 1, Tuesday (3) -> 2, etc.
        const shouldRemapSundayDays = sourceStartDay === 0;

        const [ty, tm, td] = targetStartDate.split('-').map(Number);
        const tStart = new Date(ty, tm - 1, td);
        tStart.setHours(0, 0, 0, 0);

        // Renumber weeks sequentially 1, 2, 3... and update session days & scheduled dates
        const clonedWeeks = rawWeeks.map((week, idx) => {
            const weekNumber = idx + 1;
            const updatedSessions = (week.sessions || []).map((s: any) => {
                const rawDay = Number(s.day || 1);
                const dayNum = shouldRemapSundayDays ? (rawDay === 1 ? 7 : rawDay - 1) : rawDay;

                const sessDate = new Date(tStart);
                sessDate.setDate(sessDate.getDate() + (weekNumber - 1) * 7 + (dayNum - 1));
                const scheduledDate = `${sessDate.getFullYear()}-${String(sessDate.getMonth() + 1).padStart(2, '0')}-${String(sessDate.getDate()).padStart(2, '0')}`;

                return {
                    ...s,
                    day: dayNum,
                    scheduledDate,
                };
            });

            return {
                ...week,
                weekNumber,
                sessions: updatedSessions,
            };
        });

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

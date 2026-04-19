import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { requireCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';


export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { csvData, filename } = await request.json();

        if (!csvData || !Array.isArray(csvData)) {
            return NextResponse.json({ error: 'Invalid CSV data' }, { status: 400 });
        }

        // Limit import size
        if (csvData.length > 1000) {
            return NextResponse.json({ error: 'CSV too large (max 1000 rows)' }, { status: 400 });
        }

        const programId = uuidv4();
        const weeksMap = new Map();

        csvData.forEach((row) => {
            const weekNum = row.week || 1;
            const dayNum = row.day || 1;

            if (!weeksMap.has(weekNum)) {
                weeksMap.set(weekNum, {
                    id: uuidv4(),
                    weekNumber: weekNum,
                    sessions: new Map()
                });
            }

            const week = weeksMap.get(weekNum);

            if (!week.sessions.has(dayNum)) {
                week.sessions.set(dayNum, {
                    id: uuidv4(),
                    day: dayNum,
                    name: `Day ${dayNum}`,
                    exercises: []
                });
            }

            const session = week.sessions.get(dayNum);

            if (row.exercise) {
                session.exercises.push({
                    id: uuidv4(),
                    name: String(row.exercise).slice(0, 100),
                    sets: row.sets,
                    reps: row.reps,
                    rpeTarget: row.rpe,
                    notes: row.notes ? String(row.notes).slice(0, 500) : ''
                });
            }
        });

        const weeks = Array.from(weeksMap.values()).map((week: any) => ({
            ...week,
            sessions: Array.from(week.sessions.values())
        }));

        // In order to satisfy the foreign key, either we need an athleteId or we leave it if we change schema.
        // Use a per-coach 'Unassigned' athlete so imports are scoped to the importing coach
        // and never leak across coaches (the legacy shared 'unassigned' record would have).
        let defaultAthleteId = `unassigned-${auth.user.id}`;
        const existingUnassigned = await prisma.athlete.findUnique({ where: { id: defaultAthleteId }, select: { id: true } });
        if (!existingUnassigned) {
            await prisma.athlete.create({
                data: {
                    id: defaultAthleteId,
                    name: 'Unassigned Programs',
                    email: `unassigned-${auth.user.id}@example.com`,
                    coachId: auth.user.id
                }
            });
        }

        await prisma.program.create({
            data: {
                id: programId,
                name: filename ? String(filename).slice(0, 200) : 'Imported Program',
                startDate: new Date().toISOString().split('T')[0],
                weeks: weeks,
                athleteId: defaultAthleteId
            }
        });

        return NextResponse.json({ success: true, programId });

    } catch (error) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: 'Failed to import program' }, { status: 500 });
    }
}

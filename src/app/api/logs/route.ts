import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();

        if (!body.programId || !body.sessionId) {
            return NextResponse.json({ error: 'programId and sessionId are required' }, { status: 400 });
        }

        if (!Array.isArray(body.exercises)) {
            return NextResponse.json({ error: 'exercises must be an array' }, { status: 400 });
        }

        // Validate or normalize date if provided
        let normalizedDate: string | undefined;
        if (typeof body.date === 'string' && body.date.trim()) {
            const parsed = new Date(body.date);
            if (!isNaN(parsed.getTime())) {
                normalizedDate = parsed.toISOString();
            }
        }

        // Ensure program exists and verify access
        const programRecord = await prisma.program.findUnique({
            where: { id: body.programId },
            select: { id: true, athleteId: true, weeks: true }
        });

        if (!programRecord) {
            return NextResponse.json({ error: 'Linked program not found' }, { status: 404 });
        }

        // Verify user has access to this athlete's data
        const access = await requireAccessToAthlete(programRecord.athleteId, auth);
        if ('error' in access) return access.error;

        // Resolve canonical sessionId and legacyKey to prevent dual log divergence
        let targetSessionId = body.sessionId;
        let alternateKey: string | null = null;

        if (Array.isArray(programRecord.weeks)) {
            for (const w of (programRecord.weeks as any[])) {
                for (const s of (w.sessions || [])) {
                    const legacyKey = `${body.programId}_w${w.weekNumber}_d${s.day}`;
                    if (s.id === body.sessionId) {
                        // Saving with modern sKey; track legacyKey to clean up duplicate
                        alternateKey = legacyKey !== s.id ? legacyKey : null;
                        break;
                    } else if (legacyKey === body.sessionId && s.id) {
                        // Saving with legacyKey; redirect to modern sKey
                        targetSessionId = s.id;
                        alternateKey = legacyKey;
                        break;
                    }
                }
                if (alternateKey) break;
            }
        }

        const logId = body.id || randomUUID();
        await prisma.log.upsert({
            where: {
                programId_sessionId: {
                    programId: body.programId,
                    sessionId: targetSessionId
                }
            },
            update: {
                ...(normalizedDate ? { date: normalizedDate } : {}),
                exercises: body.exercises,
                ...(body.warmupDrills !== undefined && { warmupDrills: body.warmupDrills })
            },
            create: {
                id: logId,
                programId: body.programId,
                sessionId: targetSessionId,
                date: normalizedDate || new Date().toISOString(),
                exercises: body.exercises,
                ...(body.warmupDrills !== undefined && { warmupDrills: body.warmupDrills })
            }
        });

        // Clean up any stale duplicate log stored under alternate key
        if (alternateKey && alternateKey !== targetSessionId) {
            await prisma.log.deleteMany({
                where: {
                    programId: body.programId,
                    sessionId: alternateKey
                }
            }).catch(() => {});
        }

        // Revalidate coach dashboard and athlete dashboard paths
        revalidatePath(`/dashboard/athletes/${programRecord.athleteId}`);
        revalidatePath(`/dashboard`);
        revalidatePath(`/athlete/${programRecord.athleteId}/dashboard`);
        revalidatePath(`/athlete/${programRecord.athleteId}`);
        revalidatePath(`/athlete/${programRecord.athleteId}/workout/${body.sessionId}`);
        if (targetSessionId !== body.sessionId) {
            revalidatePath(`/athlete/${programRecord.athleteId}/workout/${targetSessionId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    try {
        let where: any;
        if (athleteId) {
            // Verify access
            const access = await requireAccessToAthlete(athleteId, auth);
            if ('error' in access) return access.error;
            where = { program: { athleteId } };
        } else if (auth.isCoach) {
            where = { program: { athlete: { coachId: auth.user.id } } };
        } else {
            where = { program: { athleteId: auth.user.id } };
        }

        const logs = await prisma.log.findMany({
            where,
            include: {
                program: {
                    select: { athleteId: true }
                }
            }
        });

        const formattedLogs = logs.map(l => {
            const { program, ...rest } = l;
            return {
                ...rest,
                athleteId: program ? program.athleteId : null
            };
        });

        return NextResponse.json(formattedLogs);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}

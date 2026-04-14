import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getReadiness, saveReadiness, getReadinessByAthlete } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAccessToAthlete } from '@/lib/api-auth';

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const data = await request.json();
        // data should be { athleteId, programId, date, scores: { ... } }

        if (!data.athleteId) {
            return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
        }

        // Verify user has access to this athlete
        const access = await requireAccessToAthlete(data.athleteId);
        if ('error' in access) return access.error;

        // If a programId is supplied, make sure it actually belongs to this athlete
        // so a caller can't attach readiness data to an unrelated athlete's program.
        if (data.programId) {
            const prog = await prisma.program.findUnique({
                where: { id: data.programId },
                select: { athleteId: true }
            });
            if (!prog || prog.athleteId !== data.athleteId) {
                return NextResponse.json({ error: 'programId does not belong to athlete' }, { status: 403 });
            }
        }

        const newLog = await saveReadiness(data);
        return NextResponse.json(newLog);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to save readiness' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (athleteId) {
        const access = await requireAccessToAthlete(athleteId);
        if ('error' in access) return access.error;

        const logs = await getReadinessByAthlete(athleteId);
        return NextResponse.json(logs);
    }

    // Without athleteId: coaches see all their athletes' readiness, athletes see their own
    if (auth.isCoach) {
        const logs = await getReadiness();
        return NextResponse.json(logs);
    }

    const logs = await getReadinessByAthlete(auth.user.id);
    return NextResponse.json(logs);
}

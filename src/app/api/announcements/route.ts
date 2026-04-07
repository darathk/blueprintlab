import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireCoach } from '@/lib/api-auth';

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** GET /api/announcements?coachId=  → returns active announcement or null */
export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const coachId = req.nextUrl.searchParams.get('coachId');
    if (!coachId) return NextResponse.json({ announcement: null });

    const today = todayStr();
    const announcement = await prisma.announcement.findFirst({
        where: {
            coachId,
            startDate: { lte: today },
            endDate:   { gte: today },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ announcement: announcement ?? null });
}

/** POST /api/announcements  → upsert (one active announcement per coach) */
export async function POST(req: NextRequest) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { coachId, message, startDate, endDate } = await req.json();
        if (!coachId || !message || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Delete any existing announcements for this coach, then create fresh
        await prisma.announcement.deleteMany({ where: { coachId } });

        const announcement = await prisma.announcement.create({
            data: { coachId, message, startDate, endDate },
        });

        return NextResponse.json({ announcement });
    } catch (e: any) {
        console.error('[announcements POST]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/** DELETE /api/announcements?coachId=  → remove all announcements for coach */
export async function DELETE(req: NextRequest) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const coachId = req.nextUrl.searchParams.get('coachId');
    if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 });

    await prisma.announcement.deleteMany({ where: { coachId } });
    return NextResponse.json({ ok: true });
}

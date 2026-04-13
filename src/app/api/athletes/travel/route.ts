import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/athletes/travel?athleteId=X — fetch all travel dates for an athlete
export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (!athleteId) {
        return NextResponse.json({ error: 'athleteId required' }, { status: 400 });
    }

    // Auth check: coach of this athlete OR the athlete themselves
    if (auth.user.id !== athleteId && !auth.isCoach) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const events = await prisma.travelEvent.findMany({
            where: { athleteId },
            orderBy: { date: 'asc' }
        });
        return NextResponse.json(events);
    } catch (error) {
        console.error('GET /api/athletes/travel error:', error);
        return NextResponse.json({ error: 'Failed to fetch travel events' }, { status: 500 });
    }
}

// POST /api/athletes/travel — toggle a travel date
export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    // Only coaches can mark travel for athletes (or athletes themselves)
    // For this app, coaches are the primary managers of the calendar.
    if (!auth.isCoach && !auth.user.id) {
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { athleteId, date, note } = await request.json();

        if (!athleteId || !date) {
            return NextResponse.json({ error: 'athleteId and date are required' }, { status: 400 });
        }

        // Check if exists
        const existing = await prisma.travelEvent.findUnique({
            where: {
                athleteId_date: { athleteId, date }
            }
        });

        if (existing) {
            // Delete if exists (toggle off)
            await prisma.travelEvent.delete({
                where: { id: existing.id }
            });
            return NextResponse.json({ success: true, action: 'deleted' });
        } else {
            // Create if not exists (toggle on)
            const event = await prisma.travelEvent.create({
                data: { athleteId, date, note: note || null }
            });
            return NextResponse.json({ success: true, action: 'created', event });
        }
    } catch (error) {
        console.error('POST /api/athletes/travel error:', error);
        return NextResponse.json({ error: 'Failed to toggle travel event' }, { status: 500 });
    }
}

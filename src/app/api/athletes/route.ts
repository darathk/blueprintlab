import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET() {
    try {
        const athletes = await prisma.athlete.findMany();
        return NextResponse.json(athletes);
    } catch (error) {
        console.error('Error fetching athletes:', error);
        return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, name, email, nextMeetName, nextMeetDate, periodization, coachId, role } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing Athlete ID' }, { status: 400 });
        }

        const athlete = await prisma.athlete.upsert({
            where: { id: id || 'new-uuid-placeholder' }, // Hack to force create if no ID
            update: {
                name: name !== undefined ? name : undefined,
                email: email !== undefined ? email : undefined,
                nextMeetName: nextMeetName !== undefined ? nextMeetName : undefined,
                nextMeetDate: nextMeetDate !== undefined ? nextMeetDate : undefined,
                periodization: periodization !== undefined ? periodization : undefined,
            },
            create: {
                id, // undefined means prisma will generate uuid
                name: name || 'New Athlete',
                email: email || `${Date.now()}@example.com`,
                nextMeetName: nextMeetName || null,
                nextMeetDate: nextMeetDate || null,
                periodization: periodization || null,
                coachId: coachId || null,
                role: role || 'athlete'
            }
        });

        return NextResponse.json(athlete);
    } catch (error) {
        console.error('Error updating athlete:', error);
        return NextResponse.json({ error: 'Failed to update athlete' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { requireAuth, requireCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';


export async function GET() {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        // Coaches see only their athletes; athletes see nothing from this endpoint
        const where = auth.isCoach
            ? { coachId: auth.user.id }
            : { id: auth.user.id };

        const athletes = await prisma.athlete.findMany({
            where,
            select: {
                id: true, name: true, email: true, role: true, coachId: true,
                nextMeetName: true, nextMeetDate: true, weightClass: true, gender: true,
                periodization: true, meetAttempts: true, pastMeets: true
            }
        });
        return NextResponse.json(athletes);
    } catch (error) {
        console.error('Error fetching athletes:', error);
        return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const coachEmail = user.primaryEmailAddress?.emailAddress || '';
        const coach = await prisma.athlete.findUnique({
            where: { email: coachEmail },
            select: { id: true, role: true }
        });

        if (!coach || coach.role !== 'coach') {
            return NextResponse.json({ error: 'Only coaches can add athletes' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, email, nextMeetName, nextMeetDate, periodization, meetAttempts, pastMeets } = body;

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        let athlete;

        // If an email is provided, check if that user already exists
        if (email) {
            // Basic email format validation
            if (typeof email !== 'string' || !email.includes('@')) {
                return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
            }

            const existingUser = await prisma.athlete.findUnique({
                where: { email },
                select: { id: true, role: true, name: true, nextMeetName: true, nextMeetDate: true, periodization: true, meetAttempts: true, pastMeets: true }
            });

            if (existingUser) {
                // If they exist and are a coach, don't let them be added as an athlete
                if (existingUser.role === 'coach') {
                    return NextResponse.json({ error: 'Cannot add another coach as an athlete' }, { status: 400 });
                }

                // If they exist, just update their coachId to link them to the current coach
                athlete = await prisma.athlete.update({
                    where: { email },
                    data: {
                        coachId: coach.id,
                        name: name !== undefined ? name : existingUser.name,
                        nextMeetName: nextMeetName !== undefined ? nextMeetName : existingUser.nextMeetName,
                        nextMeetDate: nextMeetDate !== undefined ? nextMeetDate : existingUser.nextMeetDate,
                        periodization: periodization !== undefined ? periodization : existingUser.periodization,
                        meetAttempts: meetAttempts !== undefined ? meetAttempts : existingUser.meetAttempts,
                        pastMeets: pastMeets !== undefined ? pastMeets : existingUser.pastMeets,
                    }
                });
                return NextResponse.json(athlete);
            }
        }

        // Otherwise, it's a brand new athlete.
        const athleteId = id || Math.random().toString(36).substring(7);

        athlete = await prisma.athlete.upsert({
            where: { id: athleteId },
            update: {
                name: name !== undefined ? name : undefined,
                email: email !== undefined ? email : undefined,
                nextMeetName: nextMeetName !== undefined ? nextMeetName : undefined,
                nextMeetDate: nextMeetDate !== undefined ? nextMeetDate : undefined,
                periodization: periodization !== undefined ? periodization : undefined,
                meetAttempts: meetAttempts !== undefined ? meetAttempts : undefined,
                pastMeets: pastMeets !== undefined ? pastMeets : undefined,
            },
            create: {
                id: athleteId,
                name: name || 'New Athlete',
                email: email || `${Date.now()}@example.com`,
                nextMeetName: nextMeetName || null,
                nextMeetDate: nextMeetDate || null,
                periodization: periodization || null,
                meetAttempts: meetAttempts || null,
                pastMeets: pastMeets || null,
                coachId: coach.id, // Forcefully link to the logged-in coach
                role: 'athlete'
            }
        });

        return NextResponse.json(athlete);
    } catch (error) {
        console.error('Error updating athlete:', error);
        return NextResponse.json({ error: 'Failed to update athlete' }, { status: 500 });
    }
}

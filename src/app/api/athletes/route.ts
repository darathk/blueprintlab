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

        const coachEmail = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
        const coach = await prisma.athlete.findFirst({
            where: { email: { equals: coachEmail, mode: 'insensitive' } },
            select: { id: true, role: true }
        });

        if (!coach || coach.role !== 'coach') {
            return NextResponse.json({ error: 'Only coaches can add athletes' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, email: rawEmail, nextMeetName, nextMeetDate, periodization, meetAttempts, pastMeets } = body;
        const email = rawEmail ? rawEmail.toLowerCase() : rawEmail;

        let athlete;

        // If an ID is provided, check if this is an update to an existing athlete
        if (id) {
            const existingById = await prisma.athlete.findUnique({
                where: { id },
                select: { id: true, coachId: true }
            });

            if (existingById && existingById.coachId === coach.id) {
                // This is an update to an existing athlete (e.g. meet planner, block organizer)
                athlete = await prisma.athlete.update({
                    where: { id },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(nextMeetName !== undefined && { nextMeetName }),
                        ...(nextMeetDate !== undefined && { nextMeetDate }),
                        ...(periodization !== undefined && { periodization }),
                        ...(meetAttempts !== undefined && { meetAttempts }),
                        ...(pastMeets !== undefined && { pastMeets }),
                    }
                });
                return NextResponse.json(athlete);
            }
        }

        // --- New athlete creation flow below ---

        // Validate required fields for creation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Email is required to prevent orphan duplicate records
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
        }

        // Check if that user already exists by email (case-insensitive)
        const existingUser = await prisma.athlete.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, role: true, name: true, coachId: true, email: true, nextMeetName: true, nextMeetDate: true, periodization: true, meetAttempts: true, pastMeets: true }
        });

        if (existingUser) {
            // If they exist and are a coach, don't let them be added as an athlete
            if (existingUser.role === 'coach') {
                return NextResponse.json({ error: 'Cannot add another coach as an athlete' }, { status: 400 });
            }

            // If already linked to this coach, just update their info
            if (existingUser.coachId === coach.id) {
                athlete = await prisma.athlete.update({
                    where: { id: existingUser.id },
                    data: {
                        email, // normalize to lowercase
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

            // If already linked to a DIFFERENT coach, refuse — a coach cannot claim another coach's athlete
            if (existingUser.coachId && existingUser.coachId !== coach.id) {
                return NextResponse.json({ error: 'An athlete with that email already belongs to another coach' }, { status: 409 });
            }

            // Unclaimed athlete (no coachId) — safe to link to the requesting coach
            athlete = await prisma.athlete.update({
                where: { id: existingUser.id },
                data: {
                    email, // normalize to lowercase
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

        // Brand new athlete — create with the provided email
        const athleteId = id || Math.random().toString(36).substring(7);

        athlete = await prisma.athlete.create({
            data: {
                id: athleteId,
                name: name || 'New Athlete',
                email,
                nextMeetName: nextMeetName || null,
                nextMeetDate: nextMeetDate || null,
                periodization: periodization || null,
                meetAttempts: meetAttempts || null,
                pastMeets: pastMeets || null,
                coachId: coach.id,
                role: 'athlete'
            }
        });

        return NextResponse.json(athlete);
    } catch (error) {
        console.error('Error updating athlete:', error);
        return NextResponse.json({ error: 'Failed to update athlete' }, { status: 500 });
    }
}

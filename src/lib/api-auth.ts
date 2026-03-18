import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Authenticates the current user and returns their identity + role.
 * Returns a 401/403 NextResponse on failure, or the user's DB record on success.
 */
export async function requireAuth() {
    const user = await currentUser();
    if (!user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const email = user.primaryEmailAddress?.emailAddress || '';
    const dbUser = await prisma.athlete.findUnique({
        where: { email },
        select: { id: true, role: true, coachId: true, email: true }
    });

    if (!dbUser) {
        return { error: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
    }

    return { user: dbUser, isCoach: dbUser.role === 'coach' };
}

/**
 * Requires the caller to be a coach. Returns 403 if not.
 */
export async function requireCoach() {
    const result = await requireAuth();
    if ('error' in result) return result;
    if (!result.isCoach) {
        return { error: NextResponse.json({ error: 'Coach access required' }, { status: 403 }) };
    }
    return result;
}

/**
 * Checks if the authenticated user can access data for the given athleteId.
 * Coaches can access their own athletes; athletes can only access themselves.
 */
export async function requireAccessToAthlete(athleteId: string) {
    const result = await requireAuth();
    if ('error' in result) return result;

    if (result.isCoach) {
        // Coach can access athletes they coach
        const athlete = await prisma.athlete.findUnique({
            where: { id: athleteId },
            select: { coachId: true }
        });
        if (!athlete || athlete.coachId !== result.user.id) {
            return { error: NextResponse.json({ error: 'Not your athlete' }, { status: 403 }) };
        }
        return result;
    }

    // Athletes can only access themselves
    if (result.user.id !== athleteId) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return result;
}

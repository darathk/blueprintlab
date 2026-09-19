import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { MASTER_COACH_ID, SELF_ATHLETE_ID, SELF_COACH_EMAILS } from '@/lib/auth-cache';

/**
 * Authenticates the current user and returns their identity + role.
 * Returns a 401/403 NextResponse on failure, or the user's DB record on success.
 */
export async function requireAuth() {
    const user = await currentUser();
    if (!user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase().trim();
    let dbUser = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true, coachId: true, email: true }
    });

    if (!dbUser) {
        return { error: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
    }

    // Auto-normalize stored email to lowercase
    if (dbUser.email !== email) {
        await prisma.athlete.update({ where: { id: dbUser.id }, data: { email } });
        dbUser = { ...dbUser, email };
    }

    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const isSelfCoach = SELF_COACH_EMAILS.includes(email);
    const isCoach = dbUser.role === 'coach' || (adminEmail && email === adminEmail) || isSelfCoach;
    return { user: dbUser, isCoach, isSelfCoach };
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

    // If self-coach, resolve master coach record so that coachId/auth.user.id aligns with coach data in DB
    if (result.isSelfCoach && result.user.id !== MASTER_COACH_ID) {
        const masterCoach = await prisma.athlete.findUnique({
            where: { id: MASTER_COACH_ID },
            select: { id: true, role: true, coachId: true, email: true }
        });
        if (masterCoach) {
            return { ...result, user: masterCoach };
        }
    }

    return result;
}

/**
 * Strict Master Coach / Owner Authorization Guard.
 * Only the owner account matching ADMIN_EMAIL or self-coach emails can access financial data.
 * All athletes, sub-coaches, and unauthenticated callers are strictly blocked and audited.
 */
export async function requireMasterCoach() {
    const result = await requireAuth();
    if ('error' in result) return result;

    const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
    const userEmail = (result.user.email || '').toLowerCase().trim();

    // 1. Role verification
    if (!result.isCoach) {
        console.warn(`[SECURITY ALERT] Non-coach (${userEmail}, ID: ${result.user.id}) attempted to access financial revenue endpoint.`);
        return { error: NextResponse.json({ error: 'Access Denied: Forbidden.' }, { status: 403 }) };
    }

    // 2. Owner Identity verification
    if (!SELF_COACH_EMAILS.includes(userEmail) && (!adminEmail || userEmail !== adminEmail)) {
        console.warn(`[SECURITY ALERT] Sub-coach (${userEmail}, ID: ${result.user.id}) attempted to access owner financial revenue endpoint.`);
        return { error: NextResponse.json({ error: 'Access Denied: Forbidden.' }, { status: 403 }) };
    }

    // If self-coach, resolve master coach record
    if (result.isSelfCoach && result.user.id !== MASTER_COACH_ID) {
        const masterCoach = await prisma.athlete.findUnique({
            where: { id: MASTER_COACH_ID },
            select: { id: true, role: true, coachId: true, email: true }
        });
        if (masterCoach) {
            return { ...result, user: masterCoach };
        }
    }

    return result;
}

/**
 * Checks if the authenticated user can access data for the given athleteId.
 * Coaches can access their own athletes; athletes can only access themselves.
 * Self-coaches can access their own athlete account and all athletes they coach.
 *
 * Pass an already-resolved `auth` to skip the redundant Clerk + DB round-trip
 * when the caller has already authenticated (significant perf win for chat).
 */
export async function requireAccessToAthlete(
    athleteId: string,
    auth?: Awaited<ReturnType<typeof requireAuth>>
) {
    const result = auth ?? await requireAuth();
    if ('error' in result) return result;

    const email = (result.user.email || '').toLowerCase().trim();
    const isSelfCoach = result.isSelfCoach || SELF_COACH_EMAILS.includes(email);

    if (isSelfCoach) {
        // Self-coach has access to Seng's athlete account
        if (athleteId === SELF_ATHLETE_ID) {
            return result;
        }
        // And also has access to any athletes coached by MASTER_COACH_ID or themselves
        const athlete = await prisma.athlete.findUnique({
            where: { id: athleteId },
            select: { coachId: true }
        });
        if (athlete && (athlete.coachId === MASTER_COACH_ID || athlete.coachId === result.user.id)) {
            return result;
        }
        return { error: NextResponse.json({ error: 'Not your athlete' }, { status: 403 }) };
    }

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

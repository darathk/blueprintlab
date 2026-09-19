import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

export const MASTER_COACH_ID = 'b22a629c-aa72-4bfa-ba39-5f3e8d4f8ccd';
export const SELF_ATHLETE_ID = '34e1fad4-5c1b-40e4-9173-5a0f63d1c547';
export const SELF_COACH_EMAILS = ['darathkhon@gmail.com', 'jayseng123@gmail.com'];

export interface CoachAuthState {
    isCoach: boolean;
    isOwner: boolean;
    isSelfCoach: boolean;
    user: any;
    athleteId: string | null;
    selfAthleteId: string | null;
    unreadCount: number;
}

/**
 * Cache the auth check so it only runs once per request lifecycle across layout and pages.
 */
export const getCoachAuthState = cache(async (): Promise<CoachAuthState> => {
    const user = await currentUser();
    if (!user) return { isCoach: false, isOwner: false, isSelfCoach: false, user: null, athleteId: null, selfAthleteId: null, unreadCount: 0 };

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
    const isSelfCoach = SELF_COACH_EMAILS.includes(email);

    // Check if they exist in the DB — case-insensitive to handle legacy mixed-case emails
    let athlete = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true, email: true }
    });

    // Auto-normalize stored email to lowercase
    if (athlete && athlete.email !== email) {
        await prisma.athlete.update({ where: { id: athlete.id }, data: { email } });
        athlete = { ...athlete, email };
    }

    // If this is a self-coach (jayseng123@gmail.com or darathkhon@gmail.com), grant full coach + owner access
    if (isSelfCoach) {
        const unreadCount = await prisma.message.count({
            where: {
                receiverId: MASTER_COACH_ID,
                read: false,
                sender: { status: { not: 'archived' } }
            }
        });
        return {
            isCoach: true,
            isOwner: true,
            isSelfCoach: true,
            user,
            athleteId: MASTER_COACH_ID,
            selfAthleteId: SELF_ATHLETE_ID,
            unreadCount
        };
    }

    // In multi-coach system, coaches are just Athlete records with role === 'coach'
    const isCoach = athlete?.role === 'coach';
    const isOwner = Boolean(isCoach && adminEmail && email === adminEmail);
    const athleteId = athlete ? athlete.id : null;

    // Fallback for the original admin if they somehow got demoted
    if (!isCoach && adminEmail && email === adminEmail) {
        let adminAthleteId = athlete?.id;
        if (athlete) {
            await prisma.athlete.update({ where: { id: athlete.id }, data: { role: 'coach', email } });
        } else {
            const newAdmin = await prisma.athlete.create({ data: { name: 'Admin Coach', email, role: 'coach' } });
            adminAthleteId = newAdmin.id;
        }

        const unreadCount = adminAthleteId ? await prisma.message.count({
            where: {
                receiverId: adminAthleteId,
                read: false,
                sender: { status: { not: 'archived' } },
            }
        }) : 0;
        return { isCoach: true, isOwner: true, isSelfCoach: false, user, athleteId: adminAthleteId, selfAthleteId: null, unreadCount };
    }

    const unreadCount = athleteId ? await prisma.message.count({ where: { receiverId: athleteId, read: false } }) : 0;
    return { isCoach, isOwner, isSelfCoach: false, user, athleteId, selfAthleteId: null, unreadCount };
});

export async function getCoachRecord(email: string) {
    const normalized = email.toLowerCase().trim();
    if (SELF_COACH_EMAILS.includes(normalized)) {
        const coach = await prisma.athlete.findUnique({
            where: { id: MASTER_COACH_ID },
            select: { id: true, name: true, email: true, role: true }
        });
        if (coach) return coach;
    }
    return prisma.athlete.findFirst({
        where: { email: { equals: normalized, mode: 'insensitive' }, role: 'coach' },
        select: { id: true, name: true, email: true, role: true }
    });
}

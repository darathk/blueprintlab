import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

export interface CoachAuthState {
    isCoach: boolean;
    user: any;
    athleteId: string | null;
    unreadCount: number;
}

/**
 * Cache the auth check so it only runs once per request lifecycle across layout and pages.
 */
export const getCoachAuthState = cache(async (): Promise<CoachAuthState> => {
    const user = await currentUser();
    if (!user) return { isCoach: false, user: null, athleteId: null, unreadCount: 0 };

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();

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

    // In multi-coach system, coaches are just Athlete records with role === 'coach'
    const isCoach = athlete?.role === 'coach';
    const athleteId = athlete ? athlete.id : null;

    // Fallback for the original admin if they somehow got demoted
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    if (!isCoach && adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
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
        return { isCoach: true, user, athleteId: adminAthleteId, unreadCount };
    }

    const unreadCount = athleteId ? await prisma.message.count({ where: { receiverId: athleteId, read: false } }) : 0;
    return { isCoach, user, athleteId, unreadCount };
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/athletes/normalize-emails
 *
 * Finds athlete records that differ only by email casing, merges duplicates
 * (transferring all data to the record the coach owns), and lowercases all emails.
 */
export async function POST() {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        // Only operate on athletes owned by the requesting coach (plus the coach themselves)
        // so one coach cannot see, merge, or steal another coach's athletes.
        const allAthletes = await prisma.athlete.findMany({
            where: {
                OR: [
                    { coachId: auth.user.id },
                    { id: auth.user.id },
                ],
            },
            select: { id: true, email: true, name: true, role: true, coachId: true },
            orderBy: { email: 'asc' },
        });

        // Group by lowercased email
        const groups = new Map<string, typeof allAthletes>();
        for (const a of allAthletes) {
            const key = a.email.toLowerCase();
            const group = groups.get(key) || [];
            group.push(a);
            groups.set(key, group);
        }

        const merged: { kept: string; removed: string[]; email: string }[] = [];

        for (const [lowerEmail, group] of groups) {
            if (group.length > 1) {
                // Pick the best record to keep:
                // 1. Prefer one linked to this coach
                // 2. Prefer one with role=athlete (the real sign-up)
                // 3. Otherwise first one
                const keep =
                    group.find(a => a.coachId === auth.user.id) ||
                    group.find(a => a.role === 'athlete' && a.coachId) ||
                    group[0];

                const toRemove = group.filter(a => a.id !== keep.id);

                for (const dup of toRemove) {
                    await prisma.$transaction(async (tx) => {
                        // Transfer programs
                        await tx.program.updateMany({
                            where: { athleteId: dup.id },
                            data: { athleteId: keep.id },
                        });

                        // Transfer reports
                        await tx.report.updateMany({
                            where: { athleteId: dup.id },
                            data: { athleteId: keep.id },
                        });

                        // Transfer readiness
                        await tx.readiness.updateMany({
                            where: { athleteId: dup.id },
                            data: { athleteId: keep.id },
                        });

                        // Transfer messages
                        await tx.message.updateMany({
                            where: { senderId: dup.id },
                            data: { senderId: keep.id },
                        });
                        await tx.message.updateMany({
                            where: { receiverId: dup.id },
                            data: { receiverId: keep.id },
                        });

                        // Transfer push subscriptions
                        await tx.pushSubscription.updateMany({
                            where: { athleteId: dup.id },
                            data: { athleteId: keep.id },
                        });

                        // Transfer coached athletes (if the dup was a coach to others)
                        await tx.athlete.updateMany({
                            where: { coachId: dup.id },
                            data: { coachId: keep.id },
                        });

                        // Delete the duplicate
                        await tx.athlete.delete({ where: { id: dup.id } });
                    });
                }

                merged.push({
                    kept: keep.name,
                    removed: toRemove.map(a => `${a.name} (${a.email})`),
                    email: lowerEmail,
                });
            }

            // Normalize email to lowercase on the surviving record
            const surviving = group.find(a =>
                !merged.some(m => m.removed.some(r => r.includes(a.id)))
            ) || group[0];

            if (surviving.email !== lowerEmail) {
                await prisma.athlete.update({
                    where: { id: surviving.id },
                    data: { email: lowerEmail },
                });
            }
        }

        // Also lowercase any remaining emails that weren't part of a duplicate group
        // (still scoped to this coach's athletes)
        const remaining = await prisma.athlete.findMany({
            where: {
                OR: [
                    { coachId: auth.user.id },
                    { id: auth.user.id },
                ],
            },
            select: { id: true, email: true },
        });
        let normalizedCount = 0;
        for (const a of remaining) {
            const lower = a.email.toLowerCase();
            if (a.email !== lower) {
                await prisma.athlete.update({
                    where: { id: a.id },
                    data: { email: lower },
                });
                normalizedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            merged,
            normalizedCount,
            message: merged.length > 0
                ? `Merged ${merged.length} duplicate(s) and normalized ${normalizedCount} email(s) to lowercase.`
                : `No duplicates found. Normalized ${normalizedCount} email(s) to lowercase.`,
        });
    } catch (error) {
        console.error('Error normalizing emails:', error);
        return NextResponse.json({ error: 'Failed to normalize emails' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { requireAccessToAthlete, requireCoach } from '@/lib/api-auth';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // User must be the athlete themselves or their coach
        const auth = await requireAccessToAthlete(id);
        if ('error' in auth) return auth.error;

        const body = await request.json();
        const { weightClass, gender, federation, liftTargets, email: rawEmail, trainingSchedule } = body;
        const email = rawEmail !== undefined ? (typeof rawEmail === 'string' ? rawEmail.toLowerCase() : rawEmail) : undefined;

        // Validate inputs
        if (weightClass !== undefined && weightClass !== null) {
            const parsed = typeof weightClass === 'string' ? parseFloat(weightClass) : weightClass;
            if (typeof parsed !== 'number' || isNaN(parsed)) {
                return NextResponse.json({ error: 'Invalid weightClass' }, { status: 400 });
            }
        }
        if (gender !== undefined && gender !== null && !['male', 'female', 'M', 'F', ''].includes(gender)) {
            return NextResponse.json({ error: 'Invalid gender' }, { status: 400 });
        }
        if (federation !== undefined && federation !== null && !['IPF', 'USAPL'].includes(federation)) {
            return NextResponse.json({ error: 'Invalid federation' }, { status: 400 });
        }
        if (email !== undefined) {
            if (typeof email !== 'string' || !email.includes('@')) {
                return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
            }
            // Check uniqueness (case-insensitive)
            const existing = await prisma.athlete.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
            if (existing && existing.id !== id) {
                return NextResponse.json({ error: 'Email already in use by another athlete' }, { status: 409 });
            }
        }

        await prisma.athlete.update({
            where: { id },
            data: {
                ...(weightClass !== undefined && { weightClass: weightClass === null ? null : (typeof weightClass === 'string' ? parseFloat(weightClass) : weightClass) }),
                ...(gender !== undefined && { gender }),
                ...(federation !== undefined && { federation }),
                ...(liftTargets !== undefined && { liftTargets }),
                ...(trainingSchedule !== undefined && { trainingSchedule }),
                ...(email !== undefined && { email }),
            },
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating athlete dots profile:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Only coaches can delete athletes
        const auth = await requireCoach();
        if ('error' in auth) return auth.error;

        // Verify the athlete belongs to this coach
        const athlete = await prisma.athlete.findUnique({
            where: { id },
            select: { coachId: true }
        });
        if (!athlete || athlete.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Not your athlete' }, { status: 403 });
        }

        // Perform a safe deletion of the athlete and all related records inside a transaction
        await prisma.$transaction(async (tx) => {
            // Find all programs associated with the athlete
            const programs = await tx.program.findMany({
                where: { athleteId: id },
                select: { id: true }
            });
            const programIds = programs.map(p => p.id);

            // Delete Logs
            if (programIds.length > 0) {
                await tx.log.deleteMany({
                    where: { programId: { in: programIds } }
                });
            }

            // Delete Programs
            await tx.program.deleteMany({
                where: { athleteId: id }
            });

            // Delete Reports
            await tx.report.deleteMany({
                where: { athleteId: id }
            });

            // Delete Readiness check-ins
            await tx.readiness.deleteMany({
                where: { athleteId: id }
            });

            // Delete Messages (both sent and received)
            await tx.message.deleteMany({
                where: {
                    OR: [
                        { senderId: id },
                        { receiverId: id }
                    ]
                }
            });

            // Finally, delete the athlete
            await tx.athlete.delete({
                where: { id: id }
            });
        });

        return NextResponse.json({ success: true, message: 'Athlete and all associated data deleted successfully.' });
    } catch (error: any) {
        console.error('Error deleting athlete:', error);
        return NextResponse.json({
            error: 'Failed to delete athlete',
        }, { status: 500 });
    }
}

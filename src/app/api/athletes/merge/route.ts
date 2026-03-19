import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';

export async function POST(request: Request) {
    try {
        const auth = await requireCoach();
        if ('error' in auth) return auth.error;

        const { keepId, removeId } = await request.json();

        if (!keepId || !removeId || keepId === removeId) {
            return NextResponse.json({ error: 'Must provide two different athlete IDs: keepId and removeId' }, { status: 400 });
        }

        // Verify both athletes belong to this coach
        const [keep, remove] = await Promise.all([
            prisma.athlete.findUnique({ where: { id: keepId }, select: { id: true, coachId: true, name: true, email: true } }),
            prisma.athlete.findUnique({ where: { id: removeId }, select: { id: true, coachId: true, name: true, email: true } }),
        ]);

        if (!keep || keep.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Keep athlete not found or not yours' }, { status: 404 });
        }
        if (!remove || remove.coachId !== auth.user.id) {
            return NextResponse.json({ error: 'Remove athlete not found or not yours' }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            // Transfer all programs from remove -> keep
            await tx.program.updateMany({
                where: { athleteId: removeId },
                data: { athleteId: keepId },
            });

            // Transfer reports
            await tx.report.updateMany({
                where: { athleteId: removeId },
                data: { athleteId: keepId },
            });

            // Transfer readiness check-ins
            await tx.readiness.updateMany({
                where: { athleteId: removeId },
                data: { athleteId: keepId },
            });

            // Transfer messages (sent by the duplicate)
            await tx.message.updateMany({
                where: { senderId: removeId },
                data: { senderId: keepId },
            });

            // Transfer messages (received by the duplicate)
            await tx.message.updateMany({
                where: { receiverId: removeId },
                data: { receiverId: keepId },
            });

            // Transfer push subscriptions
            await tx.pushSubscription.updateMany({
                where: { athleteId: removeId },
                data: { athleteId: keepId },
            });

            // Delete the duplicate athlete record
            await tx.athlete.delete({ where: { id: removeId } });
        });

        return NextResponse.json({
            success: true,
            message: `Merged "${remove.name}" into "${keep.name}". All data transferred.`,
            kept: { id: keep.id, name: keep.name, email: keep.email },
        });
    } catch (error: any) {
        console.error('Error merging athletes:', error);
        return NextResponse.json({ error: 'Failed to merge athletes' }, { status: 500 });
    }
}

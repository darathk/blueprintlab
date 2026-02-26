import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
        const userEmail = user.primaryEmailAddress?.emailAddress || '';

        if (userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
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
            details: error.message
        }, { status: 500 });
    }
}

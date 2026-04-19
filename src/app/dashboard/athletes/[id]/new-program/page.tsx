import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { getExerciseLibrary } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export default async function NewProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [initialExercises, athlete, existingPrograms, initialCoachNotes] = await Promise.all([
        getExerciseLibrary(),
        prisma.athlete.findUnique({
            where: { id },
            select: { id: true, name: true, liftTargets: true, trainingSchedule: true }
        }),
        prisma.program.findMany({
            where: { athleteId: id, status: { not: 'draft' } },
            orderBy: { startDate: 'desc' },
            select: { id: true, name: true, startDate: true, weeks: true, status: true }
        }),
        prisma.coachNote.findMany({
            where: { athleteId: id },
            orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        })
    ]);
    return <ProgramBuilder athleteId={id} initialExercises={initialExercises} athleteLiftTargets={athlete?.liftTargets} athleteTrainingSchedule={athlete?.trainingSchedule} athleteName={athlete?.name} existingPrograms={existingPrograms} initialCoachNotes={initialCoachNotes as any} />;
}

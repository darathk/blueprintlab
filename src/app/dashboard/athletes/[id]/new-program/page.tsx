import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { getExerciseLibrary } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export default async function NewProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [initialExercises, athlete] = await Promise.all([
        getExerciseLibrary(),
        prisma.athlete.findUnique({
            where: { id },
            select: { id: true, name: true, liftTargets: true, trainingSchedule: true }
        })
    ]);
    return <ProgramBuilder athleteId={id} initialExercises={initialExercises} athleteLiftTargets={athlete?.liftTargets} athleteTrainingSchedule={athlete?.trainingSchedule} athleteName={athlete?.name} />;
}

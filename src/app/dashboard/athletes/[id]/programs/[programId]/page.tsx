import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { prisma } from '@/lib/prisma';
import { getExerciseLibrary } from '@/lib/storage';

export default async function EditProgramPage({ params }: { params: Promise<{ id: string; programId: string }> }) {
    const { id, programId } = await params;

    // Server-side fetch
    const [program, initialExercises, athlete] = await Promise.all([
        prisma.program.findUnique({
            where: { id: programId },
            select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
        }),
        getExerciseLibrary(),
        prisma.athlete.findUnique({
            where: { id },
            select: { id: true, name: true, liftTargets: true }
        })
    ]);

    if (!program) return <div style={{ padding: '2rem' }}>Program not found.</div>;

    return <ProgramBuilder athleteId={id} initialData={program} initialExercises={initialExercises} athleteLiftTargets={athlete?.liftTargets} athleteName={athlete?.name} />;
}

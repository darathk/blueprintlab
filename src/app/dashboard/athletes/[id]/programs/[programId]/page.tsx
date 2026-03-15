import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { prisma } from '@/lib/prisma';
import { getExerciseLibrary } from '@/lib/storage';

export default async function EditProgramPage({ params }: { params: Promise<{ id: string; programId: string }> }) {
    const { id, programId } = await params;

    // Server-side fetch
    const program = await prisma.program.findUnique({
        where: { id: programId },
        select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true }
    });

    if (!program) return <div style={{ padding: '2rem' }}>Program not found.</div>;

    const initialExercises = await getExerciseLibrary();
    return <ProgramBuilder athleteId={id} initialData={program} initialExercises={initialExercises} />;
}

import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { getExerciseLibrary } from '@/lib/storage';

export default async function NewProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const initialExercises = await getExerciseLibrary();
    return <ProgramBuilder athleteId={id} initialExercises={initialExercises} />;
}

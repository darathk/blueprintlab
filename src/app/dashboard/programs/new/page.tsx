import { getAthletes, getExerciseLibrary } from '@/lib/storage';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { getCoachAuthState } from '@/lib/auth-cache';

export default async function NewProgramPage() {
    const { athleteId: coachId } = await getCoachAuthState();

    const [athletes, initialExercises] = await Promise.all([
        getAthletes(coachId || undefined),
        getExerciseLibrary()
    ]);

    return (
        <div>
            <ProgramBuilder athletes={athletes} initialExercises={initialExercises} coachId={coachId || undefined} />
        </div>
    );
}

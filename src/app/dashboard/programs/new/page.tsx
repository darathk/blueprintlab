import { getAthletes, getExerciseLibrary } from '@/lib/storage';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export default async function NewProgramPage() {
    const user = await currentUser();
    const email = (user?.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findUnique({ where: { email }, select: { id: true } });

    const athletes = await getAthletes(coach?.id);
    const initialExercises = await getExerciseLibrary();

    return (
        <div>
            <ProgramBuilder athletes={athletes} initialExercises={initialExercises} />
        </div>
    );
}

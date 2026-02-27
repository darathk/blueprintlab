import { getAthletes } from '@/lib/storage';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export default async function NewProgramPage() {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || '';
    const coach = await prisma.athlete.findUnique({ where: { email } });

    const athletes = await getAthletes(coach?.id);

    return (
        <div>
            <ProgramBuilder athletes={athletes} />
        </div>
    );
}

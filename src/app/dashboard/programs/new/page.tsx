import { getAthletes } from '@/lib/storage';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

export default async function NewProgramPage() {
    const athletes = await getAthletes();

    return (
        <div>
            <ProgramBuilder athletes={athletes} />
        </div>
    );
}

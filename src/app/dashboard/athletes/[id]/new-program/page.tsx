import ProgramBuilder from '@/components/program-builder/ProgramBuilder';
import { getExerciseLibrary } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export default async function NewProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [initialExercises, athlete, existingPrograms, initialCoachNotes, latestDraft] = await Promise.all([
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
        }),
        // Auto-resume the most recent unfinished draft for this athlete so a
        // coach who accidentally navigates away doesn't lose their progress.
        prisma.program.findFirst({
            where: { athleteId: id, status: 'draft' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, startDate: true, endDate: true, weeks: true, status: true, createdAt: true }
        }),
    ]);

    // Only resume a draft if it has actual content (at least one exercise).
    // Drafts with empty weeks/sessions are indistinguishable from "no draft"
    // and would otherwise leak stale weeks into a fresh new-program view.
    const draftHasContent = latestDraft && Array.isArray(latestDraft.weeks)
        && (latestDraft.weeks as any[]).some(w =>
            Array.isArray(w?.sessions) && w.sessions.some((s: any) =>
                Array.isArray(s?.exercises) && s.exercises.length > 0
            )
        );

    // Clean up any empty drafts so they don't accumulate.
    if (latestDraft && !draftHasContent) {
        await prisma.program.deleteMany({
            where: { athleteId: id, status: 'draft' },
        }).catch(() => {});
    }

    return (
        <ProgramBuilder
            athleteId={id}
            initialData={draftHasContent ? latestDraft : null}
            initialExercises={initialExercises}
            athleteLiftTargets={athlete?.liftTargets}
            athleteTrainingSchedule={athlete?.trainingSchedule}
            athleteName={athlete?.name}
            existingPrograms={existingPrograms}
            initialCoachNotes={initialCoachNotes as any}
        />
    );
}

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCoachAuthState } from '@/lib/auth-cache';
import VideoCatalog from '@/components/tutorials/VideoCatalog';

export default async function CoachTutorialsPage() {
    const auth = await getCoachAuthState();
    if (!auth.isCoach) redirect('/sign-in');

    const tutorials = await prisma.videoTutorial.findMany({
        orderBy: { createdAt: 'desc' },
    });

    const serializedTutorials = tutorials.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        videoUrl: t.videoUrl,
        platform: t.platform,
        category: t.category,
        tags: Array.isArray(t.tags) ? (t.tags as string[]) : null,
        coachId: t.coachId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }));

    return (
        <div style={{ paddingTop: '1.5rem' }}>
            <VideoCatalog initialTutorials={serializedTutorials} isCoach={true} />
        </div>
    );
}

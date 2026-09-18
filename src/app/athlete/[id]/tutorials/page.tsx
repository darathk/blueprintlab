import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import VideoCatalog from '@/components/tutorials/VideoCatalog';

export default async function AthleteTutorialsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const { id } = await params;

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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
            <VideoCatalog initialTutorials={serializedTutorials} isCoach={false} athleteId={id} />
        </div>
    );
}

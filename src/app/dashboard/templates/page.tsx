import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { Suspense } from 'react';
import { getAthletes } from '@/lib/storage';
import dynamic from 'next/dynamic';

const TemplateLibrary = dynamic(() => import('@/components/dashboard/TemplateLibrary'), {
    loading: () => <div style={{ textAlign: 'center', padding: '50px', color: 'var(--muted)' }}>Loading templates...</div>
});

async function TemplateData({ coachId }: { coachId: string }) {
    const athletes = await getAthletes(coachId);

    return (
        <TemplateLibrary
            athletes={athletes.map(a => ({ id: a.id, name: a.name }))}
        />
    );
}

export default async function TemplatesPage() {
    const user = await currentUser();
    if (!user) return null;

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true }
    });

    if (!coach || coach.role !== 'coach') return null;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    Program <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>Templates</span>
                </h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Reusable program structures you can apply to any athlete.
                </p>
            </div>

            <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', color: 'var(--secondary-foreground)' }} className="pulse">Loading templates...</div>}>
                <TemplateData coachId={coach.id} />
            </Suspense>
        </div>
    );
}

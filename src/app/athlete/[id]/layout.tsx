import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';
import { UserButton } from '@clerk/nextjs';

const prisma = new PrismaClient();

export default async function AthletePortalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = user.primaryEmailAddress?.emailAddress || '';

    // Look up the requested athlete
    const { id } = await params;
    const requestedAthlete = await prisma.athlete.findUnique({
        where: { id }
    });

    if (!requestedAthlete) {
        redirect('/athlete'); // Not found
    }

    // Is the logged in user actually THIS athlete?
    if (requestedAthlete.email !== email) {
        // If not this athlete, check if they are the coach (i.e. not an athlete at all)
        const loggedInAsAthlete = await prisma.athlete.findUnique({
            where: { email }
        });

        // If they are an athlete trying to snoop on another athlete, block them
        if (loggedInAsAthlete) {
            redirect(`/athlete/${loggedInAsAthlete.id}/dashboard`);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <header className="glass-panel" style={{
                height: 'var(--header-height)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2rem',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderBottom: '1px solid var(--card-border)',
                borderRadius: 0,
                borderTop: 'none', borderLeft: 'none', borderRight: 'none'
            }}>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{requestedAthlete.name}'s Portal</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <UserButton afterSignOutUrl="/" />
                </div>
            </header>
            <main style={{ flex: 1, padding: '2rem' }}>
                {children}
            </main>
        </div>
    );
}

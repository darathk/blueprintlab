import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';



export default async function AthleteLoginPage() {
    const user = await currentUser();

    if (!user) {
        redirect('/sign-in');
    }

    const email = user.primaryEmailAddress?.emailAddress || '';
    const athlete = await prisma.athlete.findUnique({
        where: { email }
    });

    if (athlete) {
        redirect(`/athlete/${athlete.id}/dashboard`);
    }

    // Role fallback / Self-Registration Flow
    // If they aren't an athlete in the DB, allow them to register or proceed as Coach

    async function registerAthlete() {
        'use server';

        const registeringUser = await currentUser();
        if (!registeringUser) return;

        const uEmail = registeringUser.primaryEmailAddress?.emailAddress || '';
        const uName = registeringUser.firstName && registeringUser.lastName
            ? `${registeringUser.firstName} ${registeringUser.lastName}`
            : (registeringUser.firstName || 'New Athlete');

        // Verify they don't already exist (race condition protection)
        const existingAthlete = await prisma.athlete.findUnique({
            where: { email: uEmail }
        });

        if (!existingAthlete) {
            const newAthlete = await prisma.athlete.create({
                data: {
                    name: uName,
                    email: uEmail,
                }
            });
            redirect(`/athlete/${newAthlete.id}/dashboard`);
        } else {
            redirect(`/athlete/${existingAthlete.id}/dashboard`);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--background)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <UserButton afterSignOutUrl="/" />
                </div>

                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Welcome to BlueprintLab</h1>
                <p style={{ marginBottom: '2rem', color: 'var(--secondary-foreground)' }}>
                    Your email <strong>{email}</strong> is not connected to any active profile. How would you like to proceed?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <form action={registerAthlete}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                            Join as an Athlete
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }}></div>
                        <span style={{ margin: '0 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }}></div>
                    </div>

                    <Link href="/dashboard" className="btn btn-secondary" style={{ width: '100%' }}>
                        Proceed to Coach Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}

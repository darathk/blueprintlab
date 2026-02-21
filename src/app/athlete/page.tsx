import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

const prisma = new PrismaClient();

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

    // Role fallback: If they aren't an athlete in the DB, they might be the coach
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--background)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <UserButton afterSignOutUrl="/" />
                </div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Unauthorized</h1>
                <p style={{ marginBottom: '2rem', color: 'var(--secondary-foreground)' }}>
                    Your email <strong>{email}</strong> is not connected to any active Athlete profile.
                </p>

                <Link href="/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
                    Proceed to Coach Dashboard
                </Link>
            </div>
        </div>
    );
}

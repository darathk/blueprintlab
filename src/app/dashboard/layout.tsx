import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserButton } from '@clerk/nextjs';



export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = user.primaryEmailAddress?.emailAddress || '';

    // Check if this user is explicitly designated as the Coach/Admin via Env Var
    // Vercel deployment allows setting NEXT_PUBLIC_ADMIN_EMAIL
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const isCoach = adminEmail && email.toLowerCase() === adminEmail.toLowerCase();

    // If they are not the designated coach, see if they are an athlete
    if (!isCoach) {
        const athlete = await prisma.athlete.findUnique({
            where: { email }
        });

        // Redirect athletes out of the Coach Dashboard
        if (athlete) {
            redirect(`/athlete/${athlete.id}/dashboard`);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top center, #1e293b 0%, #020617 100%)' }}>
            <header className="glass-panel" style={{
                height: 'var(--header-height)',
                borderBottom: '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2rem',
                marginBottom: '0',
                borderRadius: '0',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                    <span>Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 10px rgba(6,182,212,0.5)' }}>Lab</span></span>
                </div>

                <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <Link href="/dashboard" className="nav-link" style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Command Center
                    </Link>
                    <Link href="/dashboard/programs/new" className="nav-link" style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Program Builder
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                </nav>
            </header>

            <main style={{ flex: 1, padding: '2rem', position: 'relative' }}>
                <div className="container">
                    {children}
                </div>
            </main>
            <footer style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', borderTop: '1px solid var(--card-border)', background: 'rgba(2, 6, 23, 0.5)' }}>
                BlueprintLab v2.0 <span style={{ color: 'var(--primary)' }}>///</span> Meta-Engine Active
            </footer>
        </div>
    );
}

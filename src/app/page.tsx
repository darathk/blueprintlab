import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import styles from './page.module.css';

export default async function Home() {
  const user = await currentUser();

  // If the user is logged in, redirect them immediately to their proper portal
  if (user) {
    const email = user.primaryEmailAddress?.emailAddress || '';
    const athlete = await prisma.athlete.findUnique({ where: { email } });

    // If they are a coach, redirect to coach dashboard
    if (athlete?.role === 'coach') {
      redirect('/dashboard');
    }
    // If they are an athlete with a valid ID, redirect to their specific dashboard
    if (athlete?.role === 'athlete' && athlete?.id) {
      redirect(`/athlete/${athlete.id}/dashboard`);
    }
    // If they have no DB record, redirect to the onboarding screen (Image 1)
    redirect('/athlete');
  }

  return (
    <div className={styles.page} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)' }}>
      <main className={styles.main} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: -1
        }}></div>


        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
          Blueprint<span className="neon-text" style={{ color: 'var(--primary)' }}>Lab</span>
        </h1>
        <p style={{ marginBottom: '3rem', color: 'var(--secondary-foreground)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 3rem' }}>
          Next-Generation Performance Telemetry & Mission Planning
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
          <Link href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem', boxShadow: '0 0 30px rgba(6,182,212,0.2)' }}>
            Coach Portal
          </Link>
          <Link href="/athlete" className="btn btn-secondary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>
            Athlete Portal
          </Link>
        </div>
      </main>
    </div>
  );
}

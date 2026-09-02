import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import styles from './page.module.css';

export default async function Home() {
  const user = await currentUser();

  // If the user is logged in, redirect them immediately to their proper portal
  if (user) {
    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const athlete = await prisma.athlete.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, role: true, email: true } });

    // Auto-normalize stored email to lowercase
    if (athlete && athlete.email !== email) {
      await prisma.athlete.update({ where: { id: athlete.id }, data: { email } });
    }

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
    <div className={styles.page} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)', padding: '1.5rem' }}>
      <main className={styles.main} style={{ textAlign: 'center', position: 'relative', zIndex: 1, width: '100%', maxWidth: '640px' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(125, 135, 210, 0.22) 0%, rgba(168, 85, 247, 0.1) 45%, transparent 70%)',
          pointerEvents: 'none', zIndex: -1, filter: 'blur(30px)'
        }}></div>

        <div className="glass-panel" style={{ padding: '3.5rem 2rem', borderRadius: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: '3.25rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem', lineHeight: 1.15 }}>
            Blueprint<span style={{ color: 'var(--primary)', textShadow: '0 0 32px rgba(125, 135, 210, 0.5)' }}>Lab</span>
          </h1>
          <p style={{ marginBottom: '2.5rem', color: 'var(--secondary-foreground)', fontSize: '1.1rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.5 }}>
            Next-Generation Performance Telemetry & Mission Planning
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              className="glass-button glass-button-primary chat-press"
              style={{
                padding: '0.875rem 2.25rem',
                fontSize: '1rem',
                borderRadius: 14,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Coach Portal
            </Link>
            <Link
              href="/athlete"
              className="glass-button chat-press"
              style={{
                padding: '0.875rem 2.25rem',
                fontSize: '1rem',
                borderRadius: 14,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Athlete Portal
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

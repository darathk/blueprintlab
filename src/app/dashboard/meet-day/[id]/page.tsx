import { redirect, notFound } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import MeetDayClient from './MeetDayClient';
import MeetAttempts from '@/components/dashboard/MeetAttempts';
import { getCoachRecord } from '@/lib/auth-cache';
import { cleanupExpiredMeetData } from '@/lib/date-utils';

export default async function LifterMeetDayPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await getCoachRecord(email);

    if (!coach) redirect('/');

    const [athlete, allAthletes] = await Promise.all([
        prisma.athlete.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                meetAttempts: true,
                pastMeets: true,
                nextMeetName: true,
                nextMeetDate: true,
                weightClass: true,
                gender: true,
                federation: true,
                competitors: true,
                coachId: true,
            },
        }),
        prisma.athlete.findMany({
            where: { coachId: coach.id },
            select: { id: true, name: true, nextMeetName: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    if (!athlete) notFound();

    const cleaned = cleanupExpiredMeetData(athlete);
    if (cleaned) {
        await prisma.athlete.update({
            where: { id: athlete.id },
            data: {
                nextMeetDate: cleaned.nextMeetDate,
                nextMeetName: cleaned.nextMeetName,
                meetAttempts: cleaned.meetAttempts,
                pastMeets: cleaned.pastMeets,
            },
        });
        athlete.nextMeetDate = cleaned.nextMeetDate;
        athlete.nextMeetName = cleaned.nextMeetName;
        athlete.meetAttempts = cleaned.meetAttempts;
        athlete.pastMeets = cleaned.pastMeets;
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 0' }}>
            {/* Top bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <Link
                        href="/dashboard/meet-day"
                        className="chat-press"
                        style={{
                            color: 'var(--secondary-foreground)',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '16px',
                            background: 'var(--glass-surface-2)',
                            border: '1px solid var(--glass-border)',
                            transition: 'all 0.16s var(--ease-out)',
                        }}
                    >
                        ← All Meets
                    </Link>
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        color: 'var(--foreground)',
                    }}>
                        {athlete.name}
                    </h1>
                </div>

                {/* Quick switcher (client component) */}
                <MeetDayClient
                    allAthletes={allAthletes}
                    currentAthleteId={id}
                />
            </div>

            {/* Meet info banner */}
            {(athlete.nextMeetName || athlete.nextMeetDate) && (
                <div className="glass-panel" style={{
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {athlete.nextMeetName && (
                            <span style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: 'var(--foreground)',
                            }}>
                                {athlete.nextMeetName}
                            </span>
                        )}
                        {athlete.nextMeetDate && (
                            <span style={{
                                fontSize: '0.85rem',
                                color: 'var(--secondary-foreground)',
                            }}>
                                {new Date(athlete.nextMeetDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {athlete.weightClass && (
                            <span className="glass-badge" style={{ color: 'var(--foreground)' }}>
                                {athlete.weightClass}kg
                            </span>
                        )}
                        {athlete.gender && (
                            <span className="glass-badge" style={{ color: 'var(--foreground)', textTransform: 'capitalize' }}>
                                {athlete.gender}
                            </span>
                        )}
                        {athlete.federation && (
                            <span className="glass-badge" style={{ color: 'var(--foreground)', textTransform: 'uppercase' }}>
                                {athlete.federation}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Main content: MeetAttempts */}
            <MeetAttempts athlete={athlete} isReadOnly={false} meetDayMode={true} />
        </div>
    );
}


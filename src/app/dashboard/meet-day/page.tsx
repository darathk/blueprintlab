import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

function getDaysOut(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const meetDate = new Date(dateStr);
    if (isNaN(meetDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    meetDate.setHours(0, 0, 0, 0);
    return Math.ceil((meetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysOutLabel(daysOut: number | null): string {
    if (daysOut === null) return '';
    if (daysOut === 0) return 'TODAY';
    if (daysOut === 1) return 'TOMORROW';
    if (daysOut < 0) return `${Math.abs(daysOut)}d ago`;
    return `${daysOut}d out`;
}

function getDaysOutColor(daysOut: number | null): string {
    if (daysOut === null) return 'var(--secondary-foreground)';
    if (daysOut <= 0) return '#f87171';
    if (daysOut <= 3) return '#fb923c';
    if (daysOut <= 7) return '#fbbf24';
    if (daysOut <= 14) return 'var(--primary)';
    return 'var(--secondary-foreground)';
}

export default async function MeetDayPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    const email = (user.primaryEmailAddress?.emailAddress || '').toLowerCase();
    const coach = await prisma.athlete.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true },
    });

    if (!coach || coach.role !== 'coach') redirect('/');

    const allAthletes = await prisma.athlete.findMany({
        where: { coachId: coach.id },
        select: {
            id: true,
            name: true,
            nextMeetName: true,
            nextMeetDate: true,
            meetAttempts: true,
        },
        orderBy: { name: 'asc' },
    });

    // Filter to athletes with meet data
    const meetAthletes = allAthletes.filter(
        (a) => a.nextMeetName || a.meetAttempts
    );

    // Sort by proximity to meet date (closest first), nulls at end
    meetAthletes.sort((a, b) => {
        const dA = getDaysOut(a.nextMeetDate);
        const dB = getDaysOut(b.nextMeetDate);
        if (dA === null && dB === null) return 0;
        if (dA === null) return 1;
        if (dB === null) return -1;
        return dA - dB;
    });

    return (
        <div style={{ padding: '1.5rem 0', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Back link */}
            <Link
                href="/dashboard"
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
                    marginBottom: '1.5rem',
                    transition: 'all 0.16s var(--ease-out)',
                }}
            >
                ← Back to Command Center
            </Link>

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{
                    fontSize: '2.25rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    margin: 0,
                    lineHeight: 1.2,
                }}>
                    Meet Day{' '}
                    <span style={{
                        color: 'var(--primary)',
                        textShadow: '0 0 24px rgba(125, 135, 210, 0.4)',
                    }}>
                        Command Center
                    </span>
                </h1>
                <p style={{
                    color: 'var(--secondary-foreground)',
                    fontSize: '1rem',
                    marginTop: '0.5rem',
                    margin: '0.5rem 0 0',
                }}>
                    Quick access to attempt selections and meet day plans
                </p>
            </div>

            {/* Athlete cards */}
            {meetAthletes.length === 0 ? (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 16,
                    padding: '3rem 2rem',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏋️</div>
                    <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--foreground)',
                        margin: '0 0 0.5rem',
                    }}>
                        No Upcoming Meets
                    </h2>
                    <p style={{
                        color: 'var(--secondary-foreground)',
                        fontSize: '0.95rem',
                        margin: '0 0 1.5rem',
                        maxWidth: '400px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                    }}>
                        None of your athletes have a meet name or attempt selections set up yet.
                        Set them up from each athlete&apos;s profile page.
                    </p>
                    <Link
                        href="/dashboard"
                        style={{
                            display: 'inline-block',
                            padding: '0.75rem 1.5rem',
                            background: 'var(--primary)',
                            color: '#000',
                            borderRadius: 10,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            textDecoration: 'none',
                        }}
                    >
                        Go to Athletes
                    </Link>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem',
                }}>
                    {meetAthletes.map((athlete) => {
                        const daysOut = getDaysOut(athlete.nextMeetDate);
                        const daysLabel = getDaysOutLabel(daysOut);
                        const daysColor = getDaysOutColor(daysOut);
                        const isToday = daysOut === 0;
                        const isPast = daysOut !== null && daysOut < 0;

                        return (
                            <div
                                key={athlete.id}
                                className="glass-panel chat-press"
                                style={{
                                    border: `1px solid ${isToday ? 'rgba(125, 135, 210, 0.6)' : 'var(--glass-border)'}`,
                                    borderRadius: 16,
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    transition: 'all 0.2s var(--ease-out)',
                                    boxShadow: isToday ? '0 0 24px rgba(125, 135, 210, 0.3)' : 'var(--glass-shadow-sm)',
                                }}
                            >
                                {/* Top row: Name + Days out badge */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                }}>
                                    <h2 style={{
                                        fontSize: '1.35rem',
                                        fontWeight: 700,
                                        color: 'var(--foreground)',
                                        margin: 0,
                                        letterSpacing: '-0.02em',
                                        lineHeight: 1.3,
                                    }}>
                                        {athlete.name}
                                    </h2>
                                    {daysLabel && (
                                        <span className="glass-badge" style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            color: daysColor,
                                            borderColor: `${daysColor}40`,
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                        }}>
                                            {daysLabel}
                                        </span>
                                    )}
                                </div>

                                {/* Meet info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {athlete.nextMeetName && (
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: 'var(--primary)',
                                        }}>
                                            {athlete.nextMeetName}
                                        </div>
                                    )}
                                    {athlete.nextMeetDate && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--secondary-foreground)',
                                        }}>
                                            {new Date(athlete.nextMeetDate).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </div>
                                    )}
                                    {!athlete.nextMeetName && !athlete.nextMeetDate && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--secondary-foreground)',
                                            fontStyle: 'italic',
                                        }}>
                                            Attempts set — no meet date assigned
                                        </div>
                                    )}
                                </div>

                                {/* Status indicators */}
                                <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap',
                                }}>
                                    {athlete.meetAttempts && (
                                        <span className="glass-badge" style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            color: '#34d399',
                                            borderColor: 'rgba(52,211,153,0.3)',
                                            background: 'rgba(52,211,153,0.1)',
                                        }}>
                                            ✓ Attempts Set
                                        </span>
                                    )}
                                    {isPast && (
                                        <span className="glass-badge" style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            color: '#f87171',
                                            borderColor: 'rgba(248,113,113,0.3)',
                                            background: 'rgba(248,113,113,0.1)',
                                        }}>
                                            Meet Passed
                                        </span>
                                    )}
                                </div>

                                {/* CTA */}
                                <Link
                                    href={`/dashboard/meet-day/${athlete.id}`}
                                    className="glass-button glass-button-primary chat-press"
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 12,
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        textAlign: 'center',
                                        textDecoration: 'none',
                                        marginTop: 'auto',
                                    }}
                                >
                                    Open Meet Day →
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

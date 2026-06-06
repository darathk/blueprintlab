import { prisma } from '@/lib/prisma';
import MeetAttempts from '@/components/dashboard/MeetAttempts';

export default async function AthleteMeetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const athlete = await prisma.athlete.findUnique({
        where: { id },
        select: { id: true, name: true, meetAttempts: true, pastMeets: true, nextMeetName: true, nextMeetDate: true, weightClass: true, gender: true, federation: true },
    });

    if (!athlete) return <div style={{ padding: '2rem' }}>Athlete not found.</div>;

    return (
        <div style={{ minHeight: '100vh', padding: '1.25rem 1rem', maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
            {/* Meet info banner (only if a meet is named) */}
            {athlete.nextMeetName && (
                <div style={{
                    marginBottom: '1.5rem',
                    padding: '12px 16px',
                    background: 'rgba(6,182,212,0.06)',
                    border: '1px solid rgba(6,182,212,0.2)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary)', opacity: 0.7 }}>
                        Upcoming Meet
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>
                        {athlete.nextMeetName}
                        {athlete.nextMeetDate && (
                            <span style={{ fontWeight: 400, color: 'var(--secondary-foreground)', marginLeft: 8 }}>
                                · {athlete.nextMeetDate}
                            </span>
                        )}
                    </span>
                </div>
            )}

            <MeetAttempts athlete={athlete} isReadOnly={false} />
        </div>
    );
}

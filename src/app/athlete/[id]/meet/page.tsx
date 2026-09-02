import { prisma } from '@/lib/prisma';
import MeetAttempts from '@/components/dashboard/MeetAttempts';

export default async function AthleteMeetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const athlete = await prisma.athlete.findUnique({
        where: { id },
        select: { id: true, name: true, meetAttempts: true, pastMeets: true, nextMeetName: true, nextMeetDate: true, weightClass: true, gender: true, federation: true, competitors: true },
    });

    if (!athlete) return <div style={{ padding: '2rem' }}>Athlete not found.</div>;

    return (
        <div style={{ minHeight: '100vh', padding: '1.25rem 1rem', maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
            {/* Meet info banner (only if a meet is named) */}
            {athlete.nextMeetName && (
                <div className="glass-panel" style={{
                    marginBottom: '1.5rem',
                    padding: '14px 18px',
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary)' }}>
                        Upcoming Meet
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--foreground)' }}>
                        {athlete.nextMeetName}
                        {athlete.nextMeetDate && (
                            <span style={{ fontWeight: 500, color: 'var(--secondary-foreground)', marginLeft: 8 }}>
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

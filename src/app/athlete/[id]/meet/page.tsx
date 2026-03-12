import { getAthleteById } from '@/lib/storage';
import MeetAttempts from '@/components/dashboard/MeetAttempts';
import Link from 'next/link';

export default async function AthleteMeetPage({ params }) {
    const { id } = await params;
    const athlete = await getAthleteById(id);

    if (!athlete || !athlete.meetAttempts) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
                <p>No meet planned currently.</p>
                <Link href={`/athlete/${id}/dashboard`} style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block' }}>Return to Dashboard</Link>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 600, margin: '0 auto', paddingBottom: '100px' }}>
            <header style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', padding: '0 4px', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                    Meet Planner
                </h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem', marginTop: '0.25rem', fontWeight: 500 }}>
                    {athlete.nextMeetName ? `${athlete.nextMeetName} ${athlete.nextMeetDate ? `• ${athlete.nextMeetDate}` : ''}` : 'Upcoming Meet'}
                </p>
            </header>

            <MeetAttempts athlete={athlete} isReadOnly={true} />
        </div>
    );
}

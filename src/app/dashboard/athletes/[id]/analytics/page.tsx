import { getLogs } from '@/lib/storage';
import AnalyticsClient from './analytics-client';

export default async function AnalyticsPage({ params }) {
    // Await params as per Next.js 15+ requirements
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Fetch logs server-side
    const allLogs = await getLogs();
    const athleteLogs = allLogs.filter(l => l.athleteId === id);

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Meta-Analytics Engine</h1>
            <AnalyticsClient logs={athleteLogs} />
        </div>
    );
}

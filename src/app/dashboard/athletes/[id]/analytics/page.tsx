import { getLogsByAthlete } from '@/lib/storage';
import dynamic from 'next/dynamic';

const AnalyticsClient = dynamic(() => import('./analytics-client'), {
    loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="pulse">Loading analytics engine...</div>
});

export default async function AnalyticsPage({ params }) {
    // Await params as per Next.js 15+ requirements
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Fetch logs server-side
    const athleteLogs = await getLogsByAthlete(id);

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Meta-Analytics Engine</h1>
            <AnalyticsClient logs={athleteLogs} />
        </div>
    );
}

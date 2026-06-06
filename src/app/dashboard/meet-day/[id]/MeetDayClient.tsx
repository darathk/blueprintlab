'use client';

import { useRouter } from 'next/navigation';

interface AthleteOption {
    id: string;
    name: string;
    nextMeetName: string | null;
}

export default function MeetDayClient({
    allAthletes,
    currentAthleteId,
}: {
    allAthletes: AthleteOption[];
    currentAthleteId: string;
}) {
    const router = useRouter();

    return (
        <select
            value={currentAthleteId}
            onChange={(e) => {
                router.push(`/dashboard/meet-day/${e.target.value}`);
            }}
            style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--card-border)',
                borderRadius: 10,
                padding: '0.6rem 2rem 0.6rem 0.75rem',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                minWidth: '160px',
                maxWidth: '250px',
            }}
        >
            {allAthletes.map((a) => (
                <option
                    key={a.id}
                    value={a.id}
                    style={{ background: '#1a1a1a', color: '#e5e5e5' }}
                >
                    {a.name}
                    {a.nextMeetName ? ` — ${a.nextMeetName}` : ''}
                </option>
            ))}
        </select>
    );
}

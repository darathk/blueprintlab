import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getReadiness, saveReadiness, getReadinessByAthlete } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        // data should be { athleteId, programId, date, scores: { ... } }

        const newLog = await saveReadiness(data);
        return NextResponse.json(newLog);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to save readiness' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (athleteId) {
        const logs = await getReadinessByAthlete(athleteId);
        return NextResponse.json(logs);
    }
    const logs = await getReadiness();
    return NextResponse.json(logs);
}

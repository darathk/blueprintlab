import { NextResponse } from 'next/server';
import { getAthletes, readData, writeData } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { athleteId, programId } = body;

        if (!athleteId || !programId) {
            return NextResponse.json({ error: 'Missing athleteId or programId' }, { status: 400 });
        }

        const athletes = await getAthletes();
        const athleteIndex = athletes.findIndex(a => a.id === athleteId);

        if (athleteIndex === -1) {
            return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
        }

        // Update athlete's current program
        athletes[athleteIndex].currentProgramId = programId;

        // Write back to file
        await writeData('athletes.json', athletes);

        return NextResponse.json({ success: true, athlete: athletes[athleteIndex] });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to assign program' }, { status: 500 });
    }
}

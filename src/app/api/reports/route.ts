import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import fs from 'fs';
import path from 'path';

const REPORTS_PATH = path.join(process.cwd(), 'data', 'reports.json');

function getReports() {
    if (!fs.existsSync(REPORTS_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(REPORTS_PATH, 'utf8'));
    } catch {
        return [];
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get('athleteId');

    let reports = getReports();
    if (athleteId) {
        reports = reports.filter((r: any) => r.athleteId === athleteId);
    }

    // Sort by date desc
    reports.sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return NextResponse.json(reports);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const reports = getReports();

        const newReport = {
            id: Math.random().toString(36).substr(2, 9),
            created: new Date().toISOString(),
            status: 'Complete', // Simulating instant generation
            ...body
        };

        reports.push(newReport);
        fs.writeFileSync(REPORTS_PATH, JSON.stringify(reports, null, 2));

        return NextResponse.json(newReport);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }
}
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
    }

    try {
        const reports = getReports();
        const newReports = reports.filter((r: any) => r.id !== id);
        fs.writeFileSync(REPORTS_PATH, JSON.stringify(newReports, null, 2));

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
}

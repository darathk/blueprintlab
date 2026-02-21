import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const athleteId = searchParams.get('athleteId');

        const where = athleteId ? { athleteId } : {};

        const reports = await prisma.report.findMany({
            where,
            orderBy: { created: 'desc' },
        });

        // Convert Dates back to ISO strings and spread config for UI compatibility
        const formattedReports = reports.map(r => {
            const config = r.config as any || {};
            return {
                id: r.id,
                athleteId: r.athleteId,
                status: r.status,
                created: r.created.toISOString(),
                ...config
            };
        });

        return NextResponse.json(formattedReports);
    } catch (error) {
        console.error("GET /api/reports Error:", error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { athleteId, ...config } = body;

        if (!athleteId || !config.name || !config.type) {
            return NextResponse.json({ error: 'Missing athleteId, name, or type' }, { status: 400 });
        }

        const newReport = await prisma.report.create({
            data: {
                athleteId,
                config,
                status: 'Complete'
            }
        });

        return NextResponse.json({
            id: newReport.id,
            athleteId: newReport.athleteId,
            status: newReport.status,
            created: newReport.created.toISOString(),
            ...config
        });
    } catch (e) {
        console.error("POST /api/reports Error:", e);
        return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
        }

        await prisma.report.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/reports Error:", e);
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
}

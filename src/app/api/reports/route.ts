import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAccessToAthlete, requireCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const athleteId = searchParams.get('athleteId');

        let where: any;
        if (athleteId) {
            const access = await requireAccessToAthlete(athleteId);
            if ('error' in access) return access.error;
            where = { athleteId };
        } else if (auth.isCoach) {
            where = { athlete: { coachId: auth.user.id } };
        } else {
            where = { athleteId: auth.user.id };
        }

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
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const body = await req.json();
        const { athleteId, ...config } = body;

        if (!athleteId || !config.name || !config.type) {
            return NextResponse.json({ error: 'Missing athleteId, name, or type' }, { status: 400 });
        }

        // Verify coach owns this athlete
        const access = await requireAccessToAthlete(athleteId);
        if ('error' in access) return access.error;

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
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
        }

        // Verify coach owns this report's athlete
        const report = await prisma.report.findUnique({
            where: { id },
            select: { athleteId: true }
        });
        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }
        const access = await requireAccessToAthlete(report.athleteId);
        if ('error' in access) return access.error;

        await prisma.report.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/reports Error:", e);
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
}

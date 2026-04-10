import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Temporary debug endpoint - no auth required
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';

    try {
        const athletes = await prisma.athlete.findMany({
            select: { id: true, name: true },
        });

        if (!name) {
            return NextResponse.json({
                athletes: athletes.map(a => ({ id: a.id, name: a.name })),
            });
        }

        const target = athletes.find(a => a.name && a.name.toLowerCase().includes(name.toLowerCase()));
        if (!target) return NextResponse.json({ error: `No athlete matching "${name}"`, available: athletes.map(a => a.name) });

        const programs = await prisma.program.findMany({
            where: { athleteId: target.id },
            select: { id: true, name: true, startDate: true, status: true, weeks: true, createdAt: true },
            orderBy: { startDate: 'asc' },
        });

        const result = programs.map(p => {
            let weeks: any[] = [];
            if (typeof p.weeks === 'string') {
                try { weeks = JSON.parse(p.weeks); } catch(e) {}
            } else if (Array.isArray(p.weeks)) {
                weeks = p.weeks;
            }

            const weekSummary = weeks.map((w: any) => {
                const sessions = Array.isArray(w.sessions) ? w.sessions : [];
                return {
                    weekNumber: w.weekNumber,
                    sessionCount: sessions.length,
                    sessions: sessions.map((s: any) => ({
                        name: s.name,
                        day: s.day,
                        exerciseCount: Array.isArray(s.exercises) ? s.exercises.length : 0,
                    }))
                };
            });

            // Check what day of week startDate falls on
            let startDayOfWeek = null;
            if (p.startDate) {
                const s = String(p.startDate).split('T')[0];
                const [y, m, d] = s.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                startDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            }

            return {
                id: p.id.slice(0, 8),
                name: p.name,
                status: p.status,
                startDate: p.startDate,
                startDayOfWeek,
                createdAt: p.createdAt,
                weeksCount: weeks.length,
                weekSummary,
            };
        });

        return NextResponse.json({ athlete: target.name, programs: result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

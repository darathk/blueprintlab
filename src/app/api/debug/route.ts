import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'sebastian';

    try {
        const athletes = await prisma.athlete.findMany({ include: { programs: true } });
        const target = athletes.find(a => a.name && a.name.toLowerCase().includes(name.toLowerCase()));
        if (!target) return NextResponse.json({ error: `Athlete matching "${name}" not found`, available: athletes.map(a => a.name) });

        const logs = await prisma.log.findMany({
            where: { program: { athleteId: target.id } }
        });

        const programData = target.programs
            .sort((a: any, b: any) => new Date(a.startDate || a.createdAt || 0).getTime() - new Date(b.startDate || b.createdAt || 0).getTime())
            .map((p: any) => {
                let ts = 0;
                let wks = typeof p.weeks === 'string' ? JSON.parse(p.weeks) : p.weeks;
                (wks || []).forEach((w: any) => ts += (w.sessions?.length || 0));

                const progLogs = logs.filter((l: any) => l.programId === p.id);
                const uniqueSessions = new Set(progLogs.map((l: any) => l.sessionId));

                return {
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    startDate: p.startDate,
                    createdAt: p.createdAt,
                    totalSessions: ts,
                    loggedSessions: uniqueSessions.size,
                    loggedSessionIds: Array.from(uniqueSessions),
                };
            });

        // Simulate auto-advance logic
        const activeSorted = programData.filter((p: any) => p.status !== 'draft');
        let resolvedProgramId = null;
        let resolvedProgramName = null;

        for (let i = 0; i < activeSorted.length; i++) {
            const prog = activeSorted[i];
            resolvedProgramId = prog.id;
            resolvedProgramName = prog.name;

            if (i === activeSorted.length - 1) break;

            const nextProg = activeSorted[i + 1];
            let nextStarted = false;
            if (nextProg?.startDate) {
                const s = String(nextProg.startDate).split('T')[0];
                const [y, m, d] = s.split('-').map(Number);
                const nextStart = new Date(y, m - 1, d);
                nextStart.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                nextStarted = now >= nextStart;
            }

            const isComplete = prog.totalSessions > 0 && prog.loggedSessions >= prog.totalSessions;

            if (!isComplete && !nextStarted) break;
        }

        return NextResponse.json({
            athlete: { id: target.id, name: target.name },
            programs: programData,
            resolvedProgram: { id: resolvedProgramId, name: resolvedProgramName },
            serverTime: new Date().toISOString(),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}

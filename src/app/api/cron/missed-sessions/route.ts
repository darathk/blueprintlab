import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push-utils';

export const dynamic = 'force-dynamic';

// Default: alert the coach if an athlete hasn't logged in 3 days
const DEFAULT_THRESHOLD_DAYS = 3;

/**
 * GET /api/cron/missed-sessions?days=3
 *
 * Checks all athletes with active programs and notifies the coach
 * if any athlete hasn't logged a session in X days (default 3).
 *
 * Auth: Bearer token via CRON_SECRET env var.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
        if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const thresholdDays = parseInt(searchParams.get('days') || '') || DEFAULT_THRESHOLD_DAYS;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Get all athletes with active programs, grouped by coach
        const athletes = await prisma.athlete.findMany({
            where: {
                coachId: { not: null },
                programs: { some: { status: 'active' } },
            },
            select: {
                id: true,
                name: true,
                coachId: true,
                programs: {
                    where: { status: 'active' },
                    select: {
                        id: true,
                        startDate: true,
                        weeks: true,
                        logs: {
                            select: { date: true },
                            orderBy: { date: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        // Group inactive athletes by coach
        const coachAlerts = new Map<string, string[]>(); // coachId → athlete names

        for (const athlete of athletes) {
            const activeProgram = athlete.programs[0];
            if (!activeProgram) continue;

            // Check if the program has actually started
            const startDate = parseLocalDate(activeProgram.startDate);
            if (!startDate || startDate > now) continue;

            // Check if the program has sessions (not an empty program)
            const weeks = activeProgram.weeks as any[];
            if (!weeks || weeks.length === 0) continue;
            const hasSessions = weeks.some((w: any) => w.sessions && w.sessions.length > 0);
            if (!hasSessions) continue;

            // Find the most recent log date
            const lastLog = activeProgram.logs[0];
            let daysSinceLastLog: number;

            if (lastLog) {
                const lastLogDate = parseLocalDate(lastLog.date);
                if (!lastLogDate) continue;
                daysSinceLastLog = Math.floor(
                    (now.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24)
                );
            } else {
                // Never logged — count from program start
                daysSinceLastLog = Math.floor(
                    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
                );
            }

            if (daysSinceLastLog >= thresholdDays) {
                const coachId = athlete.coachId!;
                const existing = coachAlerts.get(coachId) || [];
                existing.push(`${athlete.name} (${daysSinceLastLog}d)`);
                coachAlerts.set(coachId, existing);
            }
        }

        if (coachAlerts.size === 0) {
            return NextResponse.json({
                success: true,
                message: 'All athletes are logging on schedule',
                coachesNotified: 0,
            });
        }

        // Send one notification per coach
        let totalSent = 0;
        let totalFailed = 0;

        for (const [coachId, athleteNames] of coachAlerts) {
            const body =
                athleteNames.length === 1
                    ? `${athleteNames[0]} hasn't logged a session recently`
                    : `${athleteNames.length} athletes haven't logged recently: ${athleteNames.join(', ')}`;

            const result = await sendPushToUser(coachId, {
                title: 'Missed Sessions',
                body,
                url: '/dashboard',
            });
            totalSent += result.sent;
            totalFailed += result.failed;
        }

        console.log(
            `[Missed Sessions] Alerted ${coachAlerts.size} coach(es) about ${[...coachAlerts.values()].reduce((sum, arr) => sum + arr.length, 0)} inactive athletes`
        );

        return NextResponse.json({
            success: true,
            coachesNotified: coachAlerts.size,
            inactiveAthletes: [...coachAlerts.values()].reduce((sum, arr) => sum + arr.length, 0),
            pushSent: totalSent,
            pushFailed: totalFailed,
        });
    } catch (error) {
        console.error('[Missed Sessions] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

function parseLocalDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
}

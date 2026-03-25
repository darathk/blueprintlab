import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUsers } from '@/lib/push-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/session-reminders
 *
 * Sends push notifications to athletes who have a training session scheduled today.
 * Intended to be called once daily (e.g., 7-8 AM) via an external cron scheduler.
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // JavaScript: 0=Sun, 1=Mon, ..., 6=Sat → convert to 1=Mon, ..., 7=Sun
        const jsDow = today.getDay();
        const todayDow = jsDow === 0 ? 7 : jsDow;

        // Fetch all active programs with their athlete info
        const activePrograms = await prisma.program.findMany({
            where: { status: 'active' },
            select: {
                id: true,
                startDate: true,
                weeks: true,
                name: true,
                athleteId: true,
                athlete: { select: { id: true, name: true } },
            },
        });

        // Determine which athletes have sessions today and haven't already logged them
        const notifications: Array<{ userId: string; title: string; body: string; url: string }> = [];
        const athleteSessionMap = new Map<string, string[]>(); // athleteId → session names

        for (const program of activePrograms) {
            const startDate = parseLocalDate(program.startDate);
            if (!startDate) continue;

            const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) continue; // Program hasn't started yet

            const currentWeekIndex = Math.floor(diffDays / 7);
            const weeks = program.weeks as any[];
            if (!weeks || currentWeekIndex >= weeks.length) continue;

            const week = weeks[currentWeekIndex];
            if (!week || !week.sessions) continue;

            // Find sessions scheduled for today's day of week
            const todaySessions = week.sessions.filter((s: any) => s.day === todayDow);
            if (todaySessions.length === 0) continue;

            // Check if any of these sessions are already logged
            const sessionIds = todaySessions.map((s: any) =>
                `${program.id}_w${currentWeekIndex + 1}_d${s.day}`
            );

            const existingLogs = await prisma.log.findMany({
                where: {
                    programId: program.id,
                    sessionId: { in: sessionIds },
                },
                select: { sessionId: true },
            });
            const loggedIds = new Set(existingLogs.map((l) => l.sessionId));

            const unloggedSessions = todaySessions.filter(
                (s: any) => !loggedIds.has(`${program.id}_w${currentWeekIndex + 1}_d${s.day}`)
            );
            if (unloggedSessions.length === 0) continue;

            const names = unloggedSessions.map(
                (s: any) => s.sessionName || `Session ${s.day}`
            );

            const existing = athleteSessionMap.get(program.athleteId) || [];
            athleteSessionMap.set(program.athleteId, [...existing, ...names]);
        }

        // Build notification payloads
        for (const [athleteId, sessionNames] of athleteSessionMap) {
            const body =
                sessionNames.length === 1
                    ? `${sessionNames[0]} is on the schedule today`
                    : `You have ${sessionNames.length} sessions today: ${sessionNames.join(', ')}`;

            notifications.push({
                userId: athleteId,
                title: 'Training Day',
                body,
                url: `/athlete/${athleteId}/dashboard`,
            });
        }

        if (notifications.length === 0) {
            return NextResponse.json({ success: true, message: 'No sessions scheduled today', notified: 0 });
        }

        const { totalSent, totalFailed } = await sendPushToUsers(notifications);

        console.log(`[Session Reminders] Notified ${notifications.length} athletes (${totalSent} sent, ${totalFailed} failed)`);

        return NextResponse.json({
            success: true,
            athletesNotified: notifications.length,
            pushSent: totalSent,
            pushFailed: totalFailed,
        });
    } catch (error) {
        console.error('[Session Reminders] Error:', error);
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

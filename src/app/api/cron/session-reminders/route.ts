import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUsers } from '@/lib/push-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/session-reminders
 *
 * Sends push notifications to athletes who have a training session scheduled today.
 * Intended to be called once daily (e.g., 8 AM) via Vercel Cron.
 * Supports both sessions with explicit `scheduledDate` and day-of-week scheduling.
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
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        // JavaScript: 0=Sun, 1=Mon, ..., 6=Sat → convert to 1=Mon, ..., 7=Sun
        const jsDow = today.getDay();
        const todayDow = jsDow === 0 ? 7 : jsDow;

        // Fetch all active programs with athlete info
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

        const athleteSessionMap = new Map<string, string[]>(); // athleteId → session names

        for (const program of activePrograms) {
            const startDate = parseLocalDate(program.startDate);
            const weeks = program.weeks as any[];
            if (!weeks) continue;

            for (let wi = 0; wi < weeks.length; wi++) {
                const week = weeks[wi];
                if (!week || !week.sessions) continue;
                const weekNumber = week.weekNumber || (wi + 1);

                for (const session of week.sessions) {
                    let isToday = false;

                    // Method 1: explicit scheduledDate on the session
                    if (session.scheduledDate) {
                        const sDate = String(session.scheduledDate).split('T')[0];
                        isToday = sDate === todayStr;
                    }

                    // Method 2: fall back to day-of-week based on program startDate
                    if (!isToday && startDate) {
                        const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays >= 0) {
                            const currentWeekIndex = Math.floor(diffDays / 7);
                            if (currentWeekIndex === wi && session.day === todayDow) {
                                isToday = true;
                            }
                        }
                    }

                    if (!isToday) continue;

                    // Check if this session has already been logged
                    const sessionId = `${program.id}_w${weekNumber}_d${session.day}`;
                    const existing = await prisma.log.findFirst({
                        where: { programId: program.id, sessionId },
                        select: { id: true },
                    });
                    if (existing) continue; // already logged, skip

                    const sessionName = session.name || session.sessionName || `Session ${session.day}`;
                    const existing2 = athleteSessionMap.get(program.athleteId) || [];
                    athleteSessionMap.set(program.athleteId, [...existing2, sessionName]);
                }
            }
        }

        // Build notification payloads
        const notifications: Array<{ userId: string; title: string; body: string; url: string }> = [];
        for (const [athleteId, sessionNames] of athleteSessionMap) {
            const body =
                sessionNames.length === 1
                    ? `${sessionNames[0]} is on the schedule today`
                    : `You have ${sessionNames.length} sessions today: ${sessionNames.join(', ')}`;

            notifications.push({
                userId: athleteId,
                title: '🏋️ Training Day',
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

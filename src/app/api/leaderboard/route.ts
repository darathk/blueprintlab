import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

/** Returns the start/end of the current 30-day leaderboard cycle and days remaining. */
function getLeaderboardCycle() {
    const now = new Date();
    // Cycle starts on the 1st of the current month
    const cycleStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // Cycle ends on the 1st of the next month
    const cycleEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const daysRemaining = Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
        start: cycleStart.toISOString().split('T')[0],
        end: cycleEnd.toISOString().split('T')[0],
        daysRemaining,
    };
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
        return NextResponse.json({ error: 'coachId required' }, { status: 400 });
    }

    // User must be the coach or one of their athletes
    if (auth.isCoach && auth.user.id !== coachId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!auth.isCoach && auth.user.coachId !== coachId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const cycle = getLeaderboardCycle();

        // Lightweight query: only get log counts per athlete within the current cycle
        const athletes = await prisma.athlete.findMany({
            where: { coachId, role: 'athlete' },
            select: {
                id: true,
                name: true,
                programs: {
                    select: {
                        _count: {
                            select: {
                                logs: {
                                    where: {
                                        date: { gte: cycle.start, lt: cycle.end }
                                    }
                                }
                            }
                        }
                    }
                },
            }
        });

        // Build initial leaderboard from counts only
        const leaderboard = athletes.map(a => ({
            id: a.id,
            name: a.name,
            totalLogs: a.programs.reduce((sum, p) => sum + p._count.logs, 0),
            totalSessions: 0,
            completionRate: 0,
            currentStreak: 0,
            longestStreak: 0,
        }));

        // Sort by total logs (primary)
        leaderboard.sort((a, b) => b.totalLogs - a.totalLogs);

        // Fetch detailed data (streaks, completion) only for athletes that have logs
        // This avoids pulling massive weeks JSON for inactive athletes
        const activeIds = leaderboard.filter(a => a.totalLogs > 0).map(a => a.id);

        if (activeIds.length > 0) {
            const activeAthletes = await prisma.athlete.findMany({
                where: { id: { in: activeIds } },
                select: {
                    id: true,
                    programs: {
                        select: {
                            weeks: true,
                            logs: {
                                select: { date: true },
                                where: {
                                    date: { gte: cycle.start, lt: cycle.end }
                                }
                            }
                        }
                    }
                }
            });

            const detailMap = new Map<string, { totalSessions: number; currentStreak: number; longestStreak: number }>();

            for (const athlete of activeAthletes) {
                let totalSessions = 0;
                const allLogDates: string[] = [];

                for (const program of athlete.programs) {
                    program.logs.forEach(log => allLogDates.push(log.date));

                    const weeks = program.weeks as any;
                    if (Array.isArray(weeks)) {
                        for (const week of weeks) {
                            if (week.sessions && Array.isArray(week.sessions)) {
                                totalSessions += week.sessions.length;
                            } else if (week.days && Array.isArray(week.days)) {
                                totalSessions += week.days.length;
                            }
                        }
                    }
                }

                let currentStreak = 0;
                let longestStreak = 0;

                if (allLogDates.length > 0) {
                    const sortedDates = [...new Set(
                        allLogDates.map(d => new Date(d).toISOString().split('T')[0])
                    )].sort();

                    let streak = 1;
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prev = new Date(sortedDates[i - 1]);
                        const curr = new Date(sortedDates[i]);
                        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
                        if (diffDays <= 7) {
                            streak++;
                        } else {
                            longestStreak = Math.max(longestStreak, streak);
                            streak = 1;
                        }
                    }
                    longestStreak = Math.max(longestStreak, streak);

                    const lastLogDate = new Date(sortedDates[sortedDates.length - 1]);
                    const daysSinceLast = (Date.now() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceLast <= 7) {
                        currentStreak = streak;
                    }
                }

                detailMap.set(athlete.id, { totalSessions, currentStreak, longestStreak });
            }

            for (const entry of leaderboard) {
                const detail = detailMap.get(entry.id);
                if (detail) {
                    entry.totalSessions = detail.totalSessions;
                    entry.currentStreak = detail.currentStreak;
                    entry.longestStreak = detail.longestStreak;
                    entry.completionRate = detail.totalSessions > 0
                        ? Math.min(Math.round((entry.totalLogs / detail.totalSessions) * 100), 100)
                        : 0;
                }
            }

            // Re-sort with completion rate as tiebreaker
            leaderboard.sort((a, b) => {
                if (b.totalLogs !== a.totalLogs) return b.totalLogs - a.totalLogs;
                return b.completionRate - a.completionRate;
            });
        }

        // Add rank and tier
        const ranked = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
            tier: getTier(index + 1, leaderboard.length),
        }));

        return NextResponse.json({
            entries: ranked,
            cycle: {
                start: cycle.start,
                end: cycle.end,
                daysRemaining: cycle.daysRemaining,
            },
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}

function getTier(rank: number, total: number): string {
    if (total <= 1) return 'champion';
    const percentile = rank / total;
    if (rank === 1) return 'champion';
    if (percentile <= 0.25) return 'gold';
    if (percentile <= 0.5) return 'silver';
    if (percentile <= 0.75) return 'bronze';
    return 'iron';
}

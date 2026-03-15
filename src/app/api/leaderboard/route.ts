import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
        return NextResponse.json({ error: 'coachId required' }, { status: 400 });
    }

    try {
        // Get all athletes under this coach with their log counts
        const athletes = await prisma.athlete.findMany({
            where: { coachId, role: 'athlete' },
            select: {
                id: true,
                name: true,
                programs: {
                    select: {
                        id: true,
                        weeks: true,
                        logs: {
                            select: { id: true, date: true }
                        }
                    }
                }
            }
        });

        // Calculate total sessions available and completed for each athlete
        const leaderboard = athletes.map(athlete => {
            let totalLogs = 0;
            let totalSessions = 0;
            let currentStreak = 0;
            let longestStreak = 0;

            // Collect all log dates for streak calculation
            const allLogDates: string[] = [];

            athlete.programs.forEach(program => {
                totalLogs += program.logs.length;
                program.logs.forEach(log => allLogDates.push(log.date));

                // Count total sessions from program weeks JSON
                const weeks = program.weeks as any;
                if (Array.isArray(weeks)) {
                    weeks.forEach((week: any) => {
                        if (week.sessions && Array.isArray(week.sessions)) {
                            totalSessions += week.sessions.length;
                        } else if (week.days && Array.isArray(week.days)) {
                            totalSessions += week.days.length;
                        }
                    });
                }
            });

            // Calculate streaks based on log dates (consecutive days with logs)
            if (allLogDates.length > 0) {
                const sortedDates = [...new Set(allLogDates)]
                    .map(d => new Date(d).toISOString().split('T')[0])
                    .filter((d, i, arr) => arr.indexOf(d) === i)
                    .sort();

                let streak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const prev = new Date(sortedDates[i - 1]);
                    const curr = new Date(sortedDates[i]);
                    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
                    if (diffDays <= 7) { // Within a week counts as maintaining streak (training programs aren't daily)
                        streak++;
                    } else {
                        longestStreak = Math.max(longestStreak, streak);
                        streak = 1;
                    }
                }
                longestStreak = Math.max(longestStreak, streak);

                // Current streak: check if most recent log is within last 7 days
                const lastLogDate = new Date(sortedDates[sortedDates.length - 1]);
                const daysSinceLast = (Date.now() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceLast <= 7) {
                    currentStreak = streak;
                }
            }

            const completionRate = totalSessions > 0
                ? Math.round((totalLogs / totalSessions) * 100)
                : 0;

            return {
                id: athlete.id,
                name: athlete.name,
                totalLogs,
                totalSessions,
                completionRate: Math.min(completionRate, 100),
                currentStreak,
                longestStreak,
            };
        });

        // Sort by total logs (primary), then completion rate (secondary)
        leaderboard.sort((a, b) => {
            if (b.totalLogs !== a.totalLogs) return b.totalLogs - a.totalLogs;
            return b.completionRate - a.completionRate;
        });

        // Add rank and tier
        const ranked = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
            tier: getTier(index + 1, leaderboard.length),
        }));

        return NextResponse.json(ranked);
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

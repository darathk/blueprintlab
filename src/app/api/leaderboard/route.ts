import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/** Returns the start/end of the current 30-day leaderboard cycle and days remaining. */
function getLeaderboardCycle() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    // Cycle starts on the 1st of the current month
    const cycleStart = new Date(Date.UTC(year, month, 1));
    // Cycle ends on the 1st of the next month
    const cycleEnd = new Date(Date.UTC(year, month + 1, 1));
    const daysRemaining = Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthName = `${MONTH_NAMES[month]} ${year}`;

    return {
        start: cycleStart.toISOString().split('T')[0],
        end: cycleEnd.toISOString().split('T')[0],
        daysRemaining,
        monthKey,
        monthName,
        year,
        month,
    };
}

function calculateStreaks(dates: string[]): { currentStreak: number; longestStreak: number } {
    if (!dates || dates.length === 0) return { currentStreak: 0, longestStreak: 0 };
    const validDates = dates.map(d => {
        try {
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return null;
            return dt.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }).filter(Boolean) as string[];

    if (validDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedDates = Array.from(new Set(validDates)).sort();

    let streak = 1;
    let longestStreak = 1;
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
    const currentStreak = daysSinceLast <= 7 ? streak : 0;

    return { currentStreak, longestStreak };
}

export const MONTHLY_TIERS = [
    { key: 'iron', name: 'Iron', minLogs: 0, icon: '⚙️', color: '#64748b' },
    { key: 'bronze', name: 'Bronze', minLogs: 4, icon: '🥉', color: '#d97706' },
    { key: 'silver', name: 'Silver', minLogs: 8, icon: '🥈', color: '#94a3b8' },
    { key: 'gold', name: 'Gold', minLogs: 12, icon: '🥇', color: '#f59e0b' },
    { key: 'platinum', name: 'Platinum', minLogs: 16, icon: '🛡️', color: '#10b981' },
    { key: 'diamond', name: 'Diamond', minLogs: 20, icon: '💎', color: '#38bdf8' },
    { key: 'master', name: 'Master', minLogs: 24, icon: '⚔️', color: '#a855f7' },
];

export const ALL_TIME_TIERS = [
    { key: 'iron', name: 'Iron', minLogs: 0, icon: '⚙️', color: '#64748b' },
    { key: 'bronze', name: 'Bronze', minLogs: 10, icon: '🥉', color: '#d97706' },
    { key: 'silver', name: 'Silver', minLogs: 25, icon: '🥈', color: '#94a3b8' },
    { key: 'gold', name: 'Gold', minLogs: 50, icon: '🥇', color: '#f59e0b' },
    { key: 'platinum', name: 'Platinum', minLogs: 80, icon: '🛡️', color: '#10b981' },
    { key: 'diamond', name: 'Diamond', minLogs: 120, icon: '💎', color: '#38bdf8' },
    { key: 'master', name: 'Master', minLogs: 170, icon: '⚔️', color: '#a855f7' },
    { key: 'grandmaster', name: 'Grandmaster', minLogs: 230, icon: '🔥', color: '#ef4444' },
];

function getLoLTier(logs: number, rank: number, isMonthly: boolean) {
    if (rank === 1 && logs >= (isMonthly ? 10 : 40)) {
        return {
            tier: 'challenger',
            tierName: 'Challenger',
            icon: '👑',
            nextTierName: null,
            nextTierLogs: null,
            progressPercent: 100,
        };
    }
    if ((rank === 2 || rank === 3) && logs >= (isMonthly ? 10 : 40)) {
        return {
            tier: 'grandmaster',
            tierName: 'Grandmaster',
            icon: '🔥',
            nextTierName: 'Challenger',
            nextTierLogs: null,
            progressPercent: 90,
        };
    }

    const thresholds = isMonthly ? MONTHLY_TIERS : ALL_TIME_TIERS;
    let currentIdx = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (logs >= thresholds[i].minLogs) {
            currentIdx = i;
            break;
        }
    }

    const current = thresholds[currentIdx];
    const next = thresholds[currentIdx + 1] || null;

    let progressPercent = 100;
    if (next) {
        const span = next.minLogs - current.minLogs;
        const gained = logs - current.minLogs;
        progressPercent = Math.min(Math.round((gained / span) * 100), 100);
    }

    return {
        tier: current.key,
        tierName: current.name,
        icon: current.icon,
        nextTierName: next ? next.name : (isMonthly ? 'Grandmaster' : 'Challenger'),
        nextTierLogs: next ? next.minLogs : null,
        progressPercent,
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

        // Fetch all athletes and their programs + logs in a single query
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

        // 1. Compute per-athlete metrics (Current Month, All-Time, Monthly Buckets)
        const athleteMonthlyMap = new Map<string, {
            id: string;
            name: string;
            totalLogs: number;
            totalSessions: number;
            completionRate: number;
            currentStreak: number;
            longestStreak: number;
        }>();

        const athleteAllTimeMap = new Map<string, {
            id: string;
            name: string;
            totalLogs: number;
            totalSessions: number;
            completionRate: number;
            currentStreak: number;
            longestStreak: number;
            firstLogDate: string | null;
            lastLogDate: string | null;
        }>();

        // Historical buckets by monthKey (e.g. "2026-07" -> { athleteId: logsCount })
        const historicalMonthlyLogs: Record<string, Record<string, { athleteId: string; name: string; logsCount: number }>> = {};

        for (const athlete of athletes) {
            let allTimeLogsCount = 0;
            let currentMonthLogsCount = 0;
            let allTimeSessionsCount = 0;
            let currentMonthSessionsCount = 0;

            const allLogDates: string[] = [];
            const currentMonthLogDates: string[] = [];

            for (const program of athlete.programs) {
                // Count program sessions
                let progSessions = 0;
                const weeks = program.weeks as any;
                if (Array.isArray(weeks)) {
                    for (const week of weeks) {
                        if (week.sessions && Array.isArray(week.sessions)) {
                            progSessions += week.sessions.length;
                        } else if (week.days && Array.isArray(week.days)) {
                            progSessions += week.days.length;
                        }
                    }
                }
                allTimeSessionsCount += progSessions;

                // Process logs
                for (const log of program.logs) {
                    if (!log.date) continue;
                    allTimeLogsCount++;
                    allLogDates.push(log.date);

                    const dt = new Date(log.date);
                    if (isNaN(dt.getTime())) continue;

                    const dateStr = dt.toISOString().split('T')[0];
                    const logMonthKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;

                    // Check if within current month cycle
                    if (dateStr >= cycle.start && dateStr < cycle.end) {
                        currentMonthLogsCount++;
                        currentMonthLogDates.push(log.date);
                        currentMonthSessionsCount += progSessions;
                    }

                    // Track in historical buckets
                    if (!historicalMonthlyLogs[logMonthKey]) {
                        historicalMonthlyLogs[logMonthKey] = {};
                    }
                    if (!historicalMonthlyLogs[logMonthKey][athlete.id]) {
                        historicalMonthlyLogs[logMonthKey][athlete.id] = {
                            athleteId: athlete.id,
                            name: athlete.name,
                            logsCount: 0
                        };
                    }
                    historicalMonthlyLogs[logMonthKey][athlete.id].logsCount++;
                }
            }

            const allTimeStreaks = calculateStreaks(allLogDates);
            const currentMonthStreaks = calculateStreaks(allLogDates);

            const sortedLogDates = allLogDates.map(d => new Date(d).toISOString().split('T')[0]).sort();
            const firstLogDate = sortedLogDates.length > 0 ? sortedLogDates[0] : null;
            const lastLogDate = sortedLogDates.length > 0 ? sortedLogDates[sortedLogDates.length - 1] : null;

            athleteMonthlyMap.set(athlete.id, {
                id: athlete.id,
                name: athlete.name,
                totalLogs: currentMonthLogsCount,
                totalSessions: currentMonthSessionsCount,
                completionRate: currentMonthSessionsCount > 0
                    ? Math.min(Math.round((currentMonthLogsCount / currentMonthSessionsCount) * 100), 100)
                    : (currentMonthLogsCount > 0 ? 100 : 0),
                currentStreak: currentMonthStreaks.currentStreak,
                longestStreak: currentMonthStreaks.longestStreak,
            });

            athleteAllTimeMap.set(athlete.id, {
                id: athlete.id,
                name: athlete.name,
                totalLogs: allTimeLogsCount,
                totalSessions: allTimeSessionsCount,
                completionRate: allTimeSessionsCount > 0
                    ? Math.min(Math.round((allTimeLogsCount / allTimeSessionsCount) * 100), 100)
                    : (allTimeLogsCount > 0 ? 100 : 0),
                currentStreak: allTimeStreaks.currentStreak,
                longestStreak: allTimeStreaks.longestStreak,
                firstLogDate,
                lastLogDate,
            });
        }

        // 2. Build and Sort Current Month Leaderboard
        const monthlyList = Array.from(athleteMonthlyMap.values());
        monthlyList.sort((a, b) => {
            if (b.totalLogs !== a.totalLogs) return b.totalLogs - a.totalLogs;
            return b.completionRate - a.completionRate;
        });
        const monthlyRanked = monthlyList.map((entry, index) => {
            const tierInfo = getLoLTier(entry.totalLogs, index + 1, true);
            return {
                ...entry,
                rank: index + 1,
                tier: tierInfo.tier,
                tierName: tierInfo.tierName,
                tierIcon: tierInfo.icon,
                nextTierName: tierInfo.nextTierName,
                nextTierLogs: tierInfo.nextTierLogs,
                progressPercent: tierInfo.progressPercent,
            };
        });

        // 3. Build and Sort All-Time Leaderboard
        const allTimeList = Array.from(athleteAllTimeMap.values());
        allTimeList.sort((a, b) => {
            if (b.totalLogs !== a.totalLogs) return b.totalLogs - a.totalLogs;
            return b.completionRate - a.completionRate;
        });
        const allTimeRanked = allTimeList.map((entry, index) => {
            const tierInfo = getLoLTier(entry.totalLogs, index + 1, false);
            return {
                ...entry,
                rank: index + 1,
                tier: tierInfo.tier,
                tierName: tierInfo.tierName,
                tierIcon: tierInfo.icon,
                nextTierName: tierInfo.nextTierName,
                nextTierLogs: tierInfo.nextTierLogs,
                progressPercent: tierInfo.progressPercent,
            };
        });

        // 4. Build Past Monthly History & Champions
        // Filter out current month so only completed past months are shown
        const pastMonthKeys = Object.keys(historicalMonthlyLogs)
            .filter(key => key < cycle.monthKey)
            .sort(); // Oldest to newest for charts

        const pastMonthsList = [];
        const chartData = [];
        const hallOfFameMap = new Map<string, {
            athleteId: string;
            name: string;
            titlesCount: number;
            monthsWon: string[];
            totalAllTimeLogs: number;
        }>();

        for (const mKey of pastMonthKeys) {
            const [yStr, mStr] = mKey.split('-');
            const year = parseInt(yStr, 10);
            const monthIdx = parseInt(mStr, 10) - 1;
            const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;
            const shortLabel = `${SHORT_MONTH_NAMES[monthIdx]} '${String(year).slice(2)}`;

            const monthAthletes = Object.values(historicalMonthlyLogs[mKey] || {});
            monthAthletes.sort((a, b) => b.logsCount - a.logsCount);

            if (monthAthletes.length === 0) continue;

            const totalTeamLogs = monthAthletes.reduce((sum, a) => sum + a.logsCount, 0);
            const winner = monthAthletes[0] || null;
            const runnerUp = monthAthletes[1] || null;
            const thirdPlace = monthAthletes[2] || null;

            // Track hall of fame championship title for winner
            if (winner && winner.logsCount > 0) {
                const existing = hallOfFameMap.get(winner.athleteId) || {
                    athleteId: winner.athleteId,
                    name: winner.name,
                    titlesCount: 0,
                    monthsWon: [],
                    totalAllTimeLogs: athleteAllTimeMap.get(winner.athleteId)?.totalLogs || 0,
                };
                existing.titlesCount += 1;
                existing.monthsWon.push(monthLabel);
                hallOfFameMap.set(winner.athleteId, existing);
            }

            const standings = monthAthletes.map((a, idx) => {
                const tierInfo = getLoLTier(a.logsCount, idx + 1, true);
                return {
                    rank: idx + 1,
                    id: a.athleteId,
                    name: a.name,
                    totalLogs: a.logsCount,
                    tier: tierInfo.tier,
                    tierName: tierInfo.tierName,
                    tierIcon: tierInfo.icon,
                };
            });

            const monthData = {
                monthKey: mKey,
                monthLabel,
                shortLabel,
                year,
                totalLogs: totalTeamLogs,
                activeAthletesCount: monthAthletes.length,
                winner: winner ? { id: winner.athleteId, name: winner.name, totalLogs: winner.logsCount } : null,
                runnerUp: runnerUp ? { id: runnerUp.athleteId, name: runnerUp.name, totalLogs: runnerUp.logsCount } : null,
                thirdPlace: thirdPlace ? { id: thirdPlace.athleteId, name: thirdPlace.name, totalLogs: thirdPlace.logsCount } : null,
                standings,
            };

            pastMonthsList.push(monthData);

            // Chart data item for Recharts
            chartData.push({
                monthKey: mKey,
                monthLabel: shortLabel,
                fullMonthLabel: monthLabel,
                winnerName: winner?.name || 'N/A',
                winnerLogs: winner?.logsCount || 0,
                runnerUpName: runnerUp?.name || 'N/A',
                runnerUpLogs: runnerUp?.logsCount || 0,
                thirdName: thirdPlace?.name || 'N/A',
                thirdLogs: thirdPlace?.logsCount || 0,
                totalTeamLogs,
                activeAthletes: monthAthletes.length,
            });
        }

        // Sort pastMonthsList descending (newest past month first for UI cards)
        const pastMonthsDesc = [...pastMonthsList].reverse();

        // Sort Hall of Fame (most titles first)
        const hallOfFame = Array.from(hallOfFameMap.values()).sort((a, b) => {
            if (b.titlesCount !== a.titlesCount) return b.titlesCount - a.titlesCount;
            return b.totalAllTimeLogs - a.totalAllTimeLogs;
        });

        const totalMonthlyLogs = monthlyRanked.reduce((sum, a) => sum + a.totalLogs, 0);
        const totalAllTimeLogs = allTimeRanked.reduce((sum, a) => sum + a.totalLogs, 0);

        return NextResponse.json({
            // Backward compatibility
            entries: monthlyRanked,
            cycle: {
                start: cycle.start,
                end: cycle.end,
                daysRemaining: cycle.daysRemaining,
                monthName: cycle.monthName,
                monthKey: cycle.monthKey,
            },
            // Expanded new structure
            monthly: {
                entries: monthlyRanked,
                cycle: {
                    start: cycle.start,
                    end: cycle.end,
                    daysRemaining: cycle.daysRemaining,
                    monthName: cycle.monthName,
                    monthKey: cycle.monthKey,
                },
                totalLogs: totalMonthlyLogs,
                activeAthletes: monthlyRanked.filter(a => a.totalLogs > 0).length,
            },
            allTime: {
                entries: allTimeRanked,
                totalLogs: totalAllTimeLogs,
                activeAthletes: allTimeRanked.filter(a => a.totalLogs > 0).length,
            },
            history: {
                pastMonths: pastMonthsDesc,
                chartData,
                hallOfFame,
                totalPastMonths: pastMonthsDesc.length,
            },
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}

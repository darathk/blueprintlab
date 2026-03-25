import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const coachId = auth.user.id;

    try {
        // Get date range for last 7 days
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        // Get all athletes
        const athletes = await prisma.athlete.findMany({
            where: { coachId },
            select: {
                id: true,
                name: true,
                programs: {
                    where: { status: 'active' },
                    select: { id: true, name: true, weeks: true },
                },
            },
        });

        // Get logs from last 7 days for all coach's athletes
        const recentLogs = await prisma.log.findMany({
            where: {
                program: { athlete: { coachId } },
                date: { gte: weekAgoStr },
            },
            select: {
                sessionId: true,
                date: true,
                program: {
                    select: { athleteId: true, id: true },
                },
            },
        });

        // Get readiness from last 7 days
        const recentReadiness = await prisma.readiness.findMany({
            where: {
                athlete: { coachId },
                date: { gte: weekAgoStr },
            },
            select: {
                athleteId: true,
                date: true,
                scores: true,
            },
        });

        // Build per-athlete summaries
        const athleteSummaries = athletes.map(athlete => {
            const activeProgram = athlete.programs[0] || null;

            // Sessions trained this week
            const athleteLogs = recentLogs.filter(
                l => l.program.athleteId === athlete.id
            );
            const uniqueSessions = new Set(athleteLogs.map(l => l.sessionId));
            const sessionsTrained = uniqueSessions.size;
            const trainingDays = new Set(athleteLogs.map(l => l.date));

            // Expected sessions (from active program's current week)
            let expectedSessions = 0;
            if (activeProgram && Array.isArray(activeProgram.weeks)) {
                const totalSessions = (activeProgram.weeks as any[]).reduce(
                    (sum, w) => sum + (Array.isArray(w.sessions) ? w.sessions.length : 0),
                    0
                );
                const totalWeeks = (activeProgram.weeks as any[]).filter(
                    w => Array.isArray(w.sessions) && w.sessions.length > 0
                ).length;
                expectedSessions = totalWeeks > 0 ? Math.round(totalSessions / totalWeeks) : 0;
            }

            // Readiness trends
            const athleteReadiness = recentReadiness.filter(
                r => r.athleteId === athlete.id
            );
            let avgReadiness: number | null = null;
            let readinessTrend: 'up' | 'down' | 'stable' | null = null;
            const flagged: string[] = [];

            if (athleteReadiness.length > 0) {
                // Calculate average overall readiness
                const allScores = athleteReadiness.map(r => {
                    const scores = r.scores as Record<string, number>;
                    const vals = Object.values(scores).filter(v => typeof v === 'number');
                    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                });
                avgReadiness = Math.round(
                    (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10
                ) / 10;

                // Trend: compare first half vs second half of the week
                if (allScores.length >= 2) {
                    const mid = Math.floor(allScores.length / 2);
                    const firstHalf = allScores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
                    const secondHalf = allScores.slice(mid).reduce((a, b) => a + b, 0) / (allScores.length - mid);
                    const diff = secondHalf - firstHalf;
                    readinessTrend = diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'stable';
                }

                // Flag concerning scores (any metric averaging below 3)
                const metricSums: Record<string, { sum: number; count: number }> = {};
                athleteReadiness.forEach(r => {
                    const scores = r.scores as Record<string, number>;
                    Object.entries(scores).forEach(([key, val]) => {
                        if (typeof val === 'number') {
                            if (!metricSums[key]) metricSums[key] = { sum: 0, count: 0 };
                            metricSums[key].sum += val;
                            metricSums[key].count++;
                        }
                    });
                });
                Object.entries(metricSums).forEach(([key, { sum, count }]) => {
                    if (sum / count < 3) {
                        flagged.push(key.replace(/_/g, ' '));
                    }
                });
            }

            const missedSessions = Math.max(0, expectedSessions - sessionsTrained);

            return {
                athleteId: athlete.id,
                name: athlete.name,
                programName: activeProgram?.name || null,
                sessionsTrained,
                expectedSessions,
                missedSessions,
                trainingDays: trainingDays.size,
                avgReadiness,
                readinessTrend,
                flagged,
                hasCheckedIn: athleteReadiness.length > 0,
                noProgram: !activeProgram,
            };
        });

        // Summary stats
        const totalAthletes = athletes.length;
        const trained = athleteSummaries.filter(a => a.sessionsTrained > 0).length;
        const missed = athleteSummaries.filter(a => a.missedSessions > 0 && !a.noProgram).length;
        const flaggedAthletes = athleteSummaries.filter(a => a.flagged.length > 0);
        const noCheckins = athleteSummaries.filter(a => !a.hasCheckedIn && !a.noProgram);

        return NextResponse.json({
            period: { from: weekAgoStr, to: now.toISOString().split('T')[0] },
            overview: {
                totalAthletes,
                trained,
                missed,
                flaggedCount: flaggedAthletes.length,
                noCheckinCount: noCheckins.length,
            },
            athletes: athleteSummaries,
        });
    } catch (error) {
        console.error('GET /api/weekly-summary error:', error);
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * ONE-TIME MIGRATION: Fix logs where kg weights were stored without proper unit tag.
 * 
 * Strategy:
 * 1. For each athlete, group all logged sets by competition lift
 * 2. Compute the median weight across all sets for that lift (this represents the "normal" lbs range)
 * 3. Any set whose weight is roughly 1/2.2 of the median (±20% tolerance) is likely a kg value
 * 4. For those sets, convert weight from kg to lbs (multiply by 2.20462)
 * 
 * GET  = dry run (preview changes)
 * POST = apply fixes
 */

const COMPETITION_LIFTS = ['squat', 'competition squat', 'competition bench', 'competition bench press', 'deadlift', 'competition deadlift'];
const LIFT_GROUPS: Record<string, string[]> = {
    squat: ['squat', 'competition squat'],
    bench: ['competition bench', 'competition bench press'],
    deadlift: ['deadlift', 'competition deadlift'],
};

const KG_TO_LBS = 2.20462262185;

function getMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function looksLikeKg(weight: number, medianLbs: number): boolean {
    if (medianLbs <= 0 || weight <= 0) return false;
    // If the weight is roughly the median divided by 2.2 (within 25% tolerance),
    // it's likely a kg value that should have been converted
    const expectedKg = medianLbs / KG_TO_LBS;
    const ratio = weight / expectedKg;
    // Weight should be within 75%-125% of expected kg value
    return ratio >= 0.6 && ratio <= 1.4;
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    if (!auth.isCoach) {
        return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    try {
        // Get all logs grouped by athlete
        const athletes = await prisma.athlete.findMany({
            where: { coachId: auth.user.id },
            select: { id: true, name: true },
        });

        const allFixes: any[] = [];

        for (const athlete of athletes) {
            const logs = await prisma.log.findMany({
                where: { program: { athleteId: athlete.id } },
                include: { program: { select: { name: true } } },
            });

            // Collect all weights per lift group, separating "likely lbs" from "likely kg"
            const weightsByLift: Record<string, number[]> = { squat: [], bench: [], deadlift: [] };

            for (const log of logs) {
                const exercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
                for (const ex of exercises) {
                    const name = (ex.name ?? '').toLowerCase().trim();
                    let liftGroup: string | null = null;
                    for (const [group, names] of Object.entries(LIFT_GROUPS)) {
                        if (names.includes(name)) { liftGroup = group; break; }
                    }
                    if (!liftGroup) continue;

                    const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
                    for (const set of sets) {
                        const weight = parseFloat(set.weight ?? 0);
                        if (weight > 0 && set.unit !== 'kg') {
                            weightsByLift[liftGroup].push(weight);
                        }
                    }
                }
            }

            // Compute medians for each lift (using only the lbs-tagged sets)
            const medians: Record<string, number> = {};
            for (const [lift, weights] of Object.entries(weightsByLift)) {
                // Filter out suspiciously low values before computing median
                // to avoid them pulling the median down
                if (weights.length < 3) {
                    medians[lift] = 0;
                    continue;
                }
                // Use the upper half of values as they're more likely to be correct lbs values
                const sorted = [...weights].sort((a, b) => a - b);
                const upperHalf = sorted.slice(Math.floor(sorted.length / 2));
                medians[lift] = getMedian(upperHalf);
            }

            // Now scan all logs again to find sets that look like kg
            for (const log of logs) {
                const exercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
                let logModified = false;

                for (const ex of exercises) {
                    const name = (ex.name ?? '').toLowerCase().trim();
                    let liftGroup: string | null = null;
                    for (const [group, names] of Object.entries(LIFT_GROUPS)) {
                        if (names.includes(name)) { liftGroup = group; break; }
                    }
                    if (!liftGroup) continue;

                    const median = medians[liftGroup];
                    if (median <= 0) continue;

                    const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
                    for (let i = 0; i < sets.length; i++) {
                        const set = sets[i];
                        const weight = parseFloat(set.weight ?? 0);
                        if (weight <= 0) continue;

                        // Skip sets already tagged as kg (they'll be converted properly)
                        if (set.unit === 'kg') continue;

                        if (looksLikeKg(weight, median)) {
                            const convertedWeight = Math.round(weight * KG_TO_LBS * 10) / 10;
                            allFixes.push({
                                athleteName: athlete.name,
                                athleteId: athlete.id,
                                logId: log.id,
                                sessionId: log.sessionId,
                                date: log.date,
                                programName: (log as any).program?.name,
                                exercise: ex.name,
                                setIndex: i,
                                originalWeight: weight,
                                convertedWeight: convertedWeight,
                                originalUnit: set.unit || 'missing',
                                medianLbs: Math.round(median),
                                reps: set.reps,
                                rpe: set.rpe,
                            });
                            logModified = true;
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            message: `Found ${allFixes.length} sets to fix across ${new Set(allFixes.map(f => f.athleteId)).size} athletes`,
            fixes: allFixes,
            totalSets: allFixes.length,
            affectedAthletes: [...new Set(allFixes.map(f => f.athleteName))],
            affectedLogs: [...new Set(allFixes.map(f => f.logId))].length,
        });
    } catch (error) {
        console.error('Fix kg logs error:', error);
        return NextResponse.json({ error: 'Failed to analyze logs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    if (!auth.isCoach) {
        return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    try {
        const athletes = await prisma.athlete.findMany({
            where: { coachId: auth.user.id },
            select: { id: true, name: true },
        });

        let totalFixed = 0;
        let logsUpdated = 0;
        const fixedDetails: any[] = [];

        for (const athlete of athletes) {
            const logs = await prisma.log.findMany({
                where: { program: { athleteId: athlete.id } },
                include: { program: { select: { name: true } } },
            });

            // Collect weights per lift group (same logic as GET)
            const weightsByLift: Record<string, number[]> = { squat: [], bench: [], deadlift: [] };
            for (const log of logs) {
                const exercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
                for (const ex of exercises) {
                    const name = (ex.name ?? '').toLowerCase().trim();
                    let liftGroup: string | null = null;
                    for (const [group, names] of Object.entries(LIFT_GROUPS)) {
                        if (names.includes(name)) { liftGroup = group; break; }
                    }
                    if (!liftGroup) continue;
                    const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
                    for (const set of sets) {
                        const weight = parseFloat(set.weight ?? 0);
                        if (weight > 0 && set.unit !== 'kg') {
                            weightsByLift[liftGroup].push(weight);
                        }
                    }
                }
            }

            const medians: Record<string, number> = {};
            for (const [lift, weights] of Object.entries(weightsByLift)) {
                if (weights.length < 3) { medians[lift] = 0; continue; }
                const sorted = [...weights].sort((a, b) => a - b);
                const upperHalf = sorted.slice(Math.floor(sorted.length / 2));
                medians[lift] = getMedian(upperHalf);
            }

            // Fix affected logs
            for (const log of logs) {
                const exercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
                let logModified = false;

                for (const ex of exercises) {
                    const name = (ex.name ?? '').toLowerCase().trim();
                    let liftGroup: string | null = null;
                    for (const [group, names] of Object.entries(LIFT_GROUPS)) {
                        if (names.includes(name)) { liftGroup = group; break; }
                    }
                    if (!liftGroup) continue;

                    const median = medians[liftGroup];
                    if (median <= 0) continue;

                    const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
                    for (let i = 0; i < sets.length; i++) {
                        const set = sets[i];
                        const weight = parseFloat(set.weight ?? 0);
                        if (weight <= 0) continue;
                        if (set.unit === 'kg') continue;

                        if (looksLikeKg(weight, median)) {
                            // Convert kg to lbs and set unit to 'lbs'
                            const convertedWeight = Math.round(weight * KG_TO_LBS * 10) / 10;
                            set.weight = String(convertedWeight);
                            set.unit = 'lbs';
                            logModified = true;
                            totalFixed++;

                            fixedDetails.push({
                                athlete: athlete.name,
                                logId: log.id,
                                exercise: ex.name,
                                setIndex: i,
                                from: weight,
                                to: convertedWeight,
                            });
                        }
                    }
                }

                if (logModified) {
                    await prisma.log.update({
                        where: { id: log.id },
                        data: { exercises: exercises },
                    });
                    logsUpdated++;
                }
            }
        }

        return NextResponse.json({
            message: `Fixed ${totalFixed} sets across ${logsUpdated} logs`,
            totalFixed,
            logsUpdated,
            details: fixedDetails,
        });
    } catch (error) {
        console.error('Fix kg logs error:', error);
        return NextResponse.json({ error: 'Failed to fix logs' }, { status: 500 });
    }
}

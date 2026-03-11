/**
 * DOTs score utility
 * Only exact competition lift names count: "Squat", "Bench Press", "Deadlift"
 */

// Exact names that qualify as competition lifts
export const COMPETITION_LIFTS = {
    squat: 'Squat',
    bench: 'Bench Press',
    deadlift: 'Deadlift',
} as const;

// Official DOTs formula coefficients
const DOTS_COEFFICIENTS = {
    male: [-307.75076, 24.0900756, -0.1918759221, 0.0009878769, -2.3334613884e-7, 4.6938560833e-10],
    female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -1.0706390e-7, 9.793927979e-10],
};

/**
 * Calculate DOTs score
 * @param totalKg  - total of SBD in kg
 * @param bwKg     - athlete bodyweight / weight class in kg
 * @param gender   - "male" | "female"
 */
export function calculateDots(totalKg: number, bwKg: number, gender: 'male' | 'female'): number {
    if (totalKg <= 0 || bwKg <= 0) return 0;
    const [a0, a1, a2, a3, a4, a5] = DOTS_COEFFICIENTS[gender];
    const bw = bwKg;
    const denominator = a0 + a1 * bw + a2 * bw ** 2 + a3 * bw ** 3 + a4 * bw ** 4 + a5 * bw ** 5;
    if (denominator <= 0) return 0;
    return parseFloat(((500 / denominator) * totalKg).toFixed(2));
}

/**
 * Convert lbs to kg
 */
export function lbsToKg(lbs: number): number {
    return lbs / 2.20462;
}

/**
 * Simple E1RM formula (same as stress-index.js)
 * Rybicki formula: E1RM = weight × (1 + reps / 30) for RPE < 10 adjustments omitted for simplicity
 */
function simpleE1RM(weight: number, reps: number, rpe: number): number {
    if (!weight || !reps) return 0;
    // Adjust reps to account for reps in reserve
    const repsInReserve = 10 - rpe;
    const totalReps = reps + repsInReserve;
    return weight * (1 + totalReps / 30);
}

export interface CompetitionDataPoint {
    date: string;
    squat: number;      // E1RM in lbs (0 if not logged)
    bench: number;
    deadlift: number;
    total: number;      // squat + bench + deadlift in kg (for DOTs)
    dots: number;       // 0 if incomplete or no weight class/gender
}

/**
 * Extract competition lift E1RMs from all workout logs.
 * Only "Squat", "Bench Press", and "Deadlift" — exact name match.
 * Returns one data point per session that has at least one competition lift logged.
 */
export function getCompetitionDataPoints(
    logs: any[],
    weightClassKg: number,
    gender: 'male' | 'female' | null,
): CompetitionDataPoint[] {
    if (!logs?.length) return [];

    // Sort logs by date ascending
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const points: CompetitionDataPoint[] = [];

    for (const log of sorted) {
        const exercises: any[] = log.exercises ?? [];
        let squatE1rm = 0;
        let benchE1rm = 0;
        let deadliftE1rm = 0;

        for (const ex of exercises) {
            const name: string = ex.name ?? '';
            const sets: any[] = ex.sets ?? [];

            // Strict exact-name match only
            const isSquat = name === COMPETITION_LIFTS.squat;
            const isBench = name === COMPETITION_LIFTS.bench;
            const isDeadlift = name === COMPETITION_LIFTS.deadlift;

            if (!isSquat && !isBench && !isDeadlift) continue;

            // Find best E1RM across all sets of this exercise
            let bestE1rm = 0;
            for (const set of sets) {
                const w = parseFloat(set.weight ?? set.actual?.weight ?? 0);
                const r = parseFloat(set.reps ?? set.actual?.reps ?? 0);
                const rpe = parseFloat(set.rpe ?? set.actual?.rpe ?? 0);
                if (w > 0 && r > 0 && rpe > 0) {
                    const e1 = simpleE1RM(w, r, rpe);
                    if (e1 > bestE1rm) bestE1rm = e1;
                }
            }

            if (isSquat && bestE1rm > squatE1rm) squatE1rm = bestE1rm;
            if (isBench && bestE1rm > benchE1rm) benchE1rm = bestE1rm;
            if (isDeadlift && bestE1rm > deadliftE1rm) deadliftE1rm = bestE1rm;
        }

        // Skip sessions with no competition lifts
        if (squatE1rm === 0 && benchE1rm === 0 && deadliftE1rm === 0) continue;

        // Convert lbs → kg for total
        const sqKg = lbsToKg(squatE1rm);
        const bnKg = lbsToKg(benchE1rm);
        const dlKg = lbsToKg(deadliftE1rm);
        const totalKg = sqKg + bnKg + dlKg;

        const dots = (gender && weightClassKg > 0 && totalKg > 0)
            ? calculateDots(totalKg, weightClassKg, gender)
            : 0;

        points.push({
            date: log.date ? new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown',
            squat: Math.round(squatE1rm),
            bench: Math.round(benchE1rm),
            deadlift: Math.round(deadliftE1rm),
            total: Math.round(totalKg),
            dots,
        });
    }

    return points;
}

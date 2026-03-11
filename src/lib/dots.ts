/**
 * DOTs score utility
 * Matches AthleteCharts name variants for competition lifts (case-insensitive).
 * Exact competition lift names per user request — no variations.
 */

// Accepted name variants for each competition lift (lowercase, matching AthleteCharts)
const COMPETITION_LIFT_NAMES: Record<'squat' | 'bench' | 'deadlift', string[]> = {
    squat: ['squat', 'competition squat'],
    bench: ['bench press', 'bench', 'competition bench', 'competition bench press'],
    deadlift: ['deadlift', 'competition deadlift'],
};

// Official DOTs formula coefficients
const DOTS_COEFFICIENTS = {
    male: [-307.75076, 24.0900756, -0.1918759221, 0.0009878769, -2.3334613884e-7, 4.6938560833e-10],
    female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -1.0706390e-7, 9.793927979e-10],
};

/**
 * Official DOTs formula: Returns DOTs score.
 * @param totalKg   - SBD total in kg
 * @param bwKg      - Athlete bodyweight / weight class in kg
 * @param gender    - "male" | "female"
 */
export function calculateDots(totalKg: number, bwKg: number, gender: 'male' | 'female'): number {
    if (totalKg <= 0 || bwKg <= 0) return 0;
    const [a0, a1, a2, a3, a4, a5] = DOTS_COEFFICIENTS[gender];
    const bw = bwKg;
    const denominator = a0 + a1 * bw + a2 * bw ** 2 + a3 * bw ** 3 + a4 * bw ** 4 + a5 * bw ** 5;
    if (denominator <= 0) return 0;
    return parseFloat(((500 / denominator) * totalKg).toFixed(2));
}

/** Convert lbs to kg */
export function lbsToKg(lbs: number): number {
    return lbs / 2.20462;
}

/**
 * E1RM formula matching the app's AthleteCharts / stress-index.js:
 * weight × (1 + (reps + (10 - rpe)) / 30)
 * RPE defaults to 10 if missing (conservative estimate).
 */
function calcE1RM(weight: number, reps: number, rpe: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    const safeRpe = rpe > 0 ? rpe : 10;
    return weight * (1 + (reps + (10 - safeRpe)) / 30);
}

/** Get the best E1RM for a given lift from one log entry */
function getBestE1RMForLift(log: any, liftKey: 'squat' | 'bench' | 'deadlift'): number {
    const exercises: any[] = Array.isArray(log.exercises) ? log.exercises : [];
    const accepted = COMPETITION_LIFT_NAMES[liftKey];
    let best = 0;

    for (const ex of exercises) {
        const name = (ex.name ?? '').toLowerCase().trim();
        if (!accepted.includes(name)) continue;

        const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
        for (const set of sets) {
            const weight = parseFloat(set.weight ?? set.actual?.weight ?? 0);
            const reps = parseFloat(set.reps ?? set.actual?.reps ?? 0);
            const rpe = parseFloat(set.rpe ?? set.actual?.rpe ?? 0);
            if (weight > 0 && reps > 0) {
                const e1 = calcE1RM(weight, reps, rpe);
                if (e1 > best) best = e1;
            }
        }
    }
    return best;
}

export interface CompetitionDataPoint {
    date: string;
    squat: number;    // E1RM lbs
    bench: number;    // E1RM lbs
    deadlift: number; // E1RM lbs
    total: number;    // SBD total kg
    dots: number;     // 0 if no weight class / gender
}

/**
 * Build one data point per log session that has at least one competition lift logged.
 * Keeps running best for each lift if athlete only logs one lift per session.
 */
export function getCompetitionDataPoints(
    logs: any[],
    weightClassKg: number,
    gender: 'male' | 'female' | null,
): CompetitionDataPoint[] {
    if (!Array.isArray(logs) || logs.length === 0) return [];

    // Sort ascending by date
    const sorted = [...logs].sort((a, b) =>
        new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
    );

    const points: CompetitionDataPoint[] = [];
    // Running best — so DOTs chart advances even if athlete only logged one lift that day
    let runningBest = { squat: 0, bench: 0, deadlift: 0 };

    for (const log of sorted) {
        const squatE1rm = getBestE1RMForLift(log, 'squat');
        const benchE1rm = getBestE1RMForLift(log, 'bench');
        const deadliftE1rm = getBestE1RMForLift(log, 'deadlift');

        // Update running bests
        if (squatE1rm > runningBest.squat) runningBest.squat = squatE1rm;
        if (benchE1rm > runningBest.bench) runningBest.bench = benchE1rm;
        if (deadliftE1rm > runningBest.deadlift) runningBest.deadlift = deadliftE1rm;

        // Skip sessions with no competition lift data at all
        if (squatE1rm === 0 && benchE1rm === 0 && deadliftE1rm === 0) continue;

        // Use THIS session's values for per-session lines; running best for DOTs total
        const sqKg = lbsToKg(runningBest.squat);
        const bnKg = lbsToKg(runningBest.bench);
        const dlKg = lbsToKg(runningBest.deadlift);
        const totalKg = sqKg + bnKg + dlKg;

        const dots = (gender && weightClassKg > 0 && totalKg > 0)
            ? calculateDots(totalKg, weightClassKg, gender)
            : 0;

        const dateLabel = log.date
            ? new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Unknown';

        points.push({
            date: dateLabel,
            squat: squatE1rm > 0 ? Math.round(squatE1rm) : (runningBest.squat > 0 ? Math.round(runningBest.squat) : 0),
            bench: benchE1rm > 0 ? Math.round(benchE1rm) : (runningBest.bench > 0 ? Math.round(runningBest.bench) : 0),
            deadlift: deadliftE1rm > 0 ? Math.round(deadliftE1rm) : (runningBest.deadlift > 0 ? Math.round(runningBest.deadlift) : 0),
            total: Math.round(totalKg),
            dots,
        });
    }

    return points;
}

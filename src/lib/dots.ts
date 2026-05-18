/**
 * DOTs score utility
 * Matches AthleteCharts name variants for competition lifts (case-insensitive).
 * Exact competition lift names per user request — no variations.
 */

// Accepted name variants for each competition lift (lowercase, matching AthleteCharts)
const COMPETITION_LIFT_NAMES: Record<'squat' | 'bench' | 'deadlift', string[]> = {
    squat: ['squat', 'competition squat'],
    bench: ['competition bench', 'competition bench press'],
    deadlift: ['deadlift', 'competition deadlift'],
};

// Official DOTs formula coefficients
const DOTS_COEFFICIENTS = {
    // [a0, a1, a2, a3, a4, a5] where denominator = a0 + a1*bw + a2*bw^2 + a3*bw^3 + a4*bw^4 + a5*bw^5
    male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093, 0],
    female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706, 0],
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
 * weight * (36 / (37 - (reps + (10 - RPE))))
 * RPE defaults to 10 if missing (conservative estimate).
 */
function calcE1RM(weight: number, reps: number, rpe: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    const safeRpe = rpe > 0 ? rpe : 10;
    return weight * (36 / (37 - (reps + (10 - safeRpe))));
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
    session: string;  // "Session 1", "Session 2", etc.
    squat: number | null;    // E1RM lbs, null when not logged this session
    bench: number | null;    // E1RM lbs, null when not logged this session
    deadlift: number | null; // E1RM lbs, null when not logged this session
    totalLbs: number; // squat + bench + deadlift E1RM in lbs
    total: number;    // SBD total kg (for DOTs)
    dots: number;     // 0 if no weight class / gender
}

/**
 * Compute the scheduled date for a session from its sessionId and program startDate.
 * sessionId format: programId_wX_dY
 * Returns a Date object (midnight local) or null if it can't be determined.
 */
function getScheduledDate(log: any, programMap: Map<string, any>): Date | null {
    const match = (log.sessionId ?? '').match(/_w(\d+)_d(\d+)$/);
    if (!match) return null;
    const weekNum = parseInt(match[1], 10);
    const dayNum  = parseInt(match[2], 10);

    const program = programMap.get(log.programId);
    if (!program?.startDate) return null;

    // startDate may be a Date object or ISO string
    const raw = typeof program.startDate === 'string' ? program.startDate : program.startDate.toISOString();
    const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
    const start = new Date(y, m - 1, d); // midnight local
    start.setDate(start.getDate() + (weekNum - 1) * 7 + (dayNum - 1));
    return start;
}

/**
 * Build one data point per unique session (sessionId) that has at least one
 * competition lift logged. X-axis uses the SCHEDULED date computed from the
 * program's startDate + weekNum + dayNum so sessions logged late still appear
 * at their intended position. Multiple logs for the same sessionId are merged
 * by taking the best e1RM across all of them.
 */
export function getCompetitionDataPoints(
    logs: any[],
    weightClassKg: number,
    gender: 'male' | 'female' | null,
    programs?: any[],
): CompetitionDataPoint[] {
    if (!Array.isArray(logs) || logs.length === 0) return [];

    // Build a quick lookup map for programs
    const programMap = new Map<string, any>();
    (programs ?? []).forEach(p => programMap.set(p.id, p));

    // Group logs by sessionId. If there are multiple logs for the same session
    // (e.g. auto-save + manual save), we merge them by taking the best e1RM.
    const bySession = new Map<string, any[]>();
    for (const log of logs) {
        const key = log.sessionId ?? log.id ?? String(Math.random());
        if (!bySession.has(key)) bySession.set(key, []);
        bySession.get(key)!.push(log);
    }

    // Build unsorted entries: compute e1RM and scheduled date for each session
    const entries: Array<{
        scheduledDate: Date;
        dateLabel: string;
        squatE1rm: number;
        benchE1rm: number;
        deadliftE1rm: number;
    }> = [];

    for (const [, sessionLogs] of bySession) {
        let squatE1rm = 0, benchE1rm = 0, deadliftE1rm = 0;
        let representativeLog = sessionLogs[0];

        for (const log of sessionLogs) {
            const s = getBestE1RMForLift(log, 'squat');
            const b = getBestE1RMForLift(log, 'bench');
            const d = getBestE1RMForLift(log, 'deadlift');
            if (s > squatE1rm) squatE1rm = s;
            if (b > benchE1rm) benchE1rm = b;
            if (d > deadliftE1rm) deadliftE1rm = d;
            if (b > 0 || s > 0 || d > 0) representativeLog = log;
        }

        // Skip sessions with no competition lift data at all
        if (squatE1rm === 0 && benchE1rm === 0 && deadliftE1rm === 0) continue;

        // Prefer scheduled date; fall back to logged date
        const scheduled = getScheduledDate(representativeLog, programMap);
        const fallbackDate = representativeLog.date ? new Date(representativeLog.date) : new Date(0);
        const scheduledDate = scheduled ?? fallbackDate;

        const dateLabel = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        entries.push({ scheduledDate, dateLabel, squatE1rm, benchE1rm, deadliftE1rm });
    }

    // Sort by scheduled date ascending
    entries.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    const points: CompetitionDataPoint[] = [];
    let lastKnown = { squat: 0, bench: 0, deadlift: 0 };

    for (const { dateLabel, squatE1rm, benchE1rm, deadliftE1rm } of entries) {
        if (squatE1rm > 0) lastKnown.squat = squatE1rm;
        if (benchE1rm > 0) lastKnown.bench = benchE1rm;
        if (deadliftE1rm > 0) lastKnown.deadlift = deadliftE1rm;

        const sqKg = lbsToKg(lastKnown.squat);
        const bnKg = lbsToKg(lastKnown.bench);
        const dlKg = lbsToKg(lastKnown.deadlift);
        const totalKg = sqKg + bnKg + dlKg;

        const dots = (gender && weightClassKg > 0 && totalKg > 0)
            ? calculateDots(totalKg, weightClassKg, gender)
            : 0;

        points.push({
            date: dateLabel,
            session: `Session ${points.length + 1}`,
            squat:    squatE1rm    > 0 ? Math.round(squatE1rm)    : null,
            bench:    benchE1rm    > 0 ? Math.round(benchE1rm)    : null,
            deadlift: deadliftE1rm > 0 ? Math.round(deadliftE1rm) : null,
            totalLbs: Math.round(
                (squatE1rm    > 0 ? squatE1rm    : lastKnown.squat) +
                (benchE1rm    > 0 ? benchE1rm    : lastKnown.bench) +
                (deadliftE1rm > 0 ? deadliftE1rm : lastKnown.deadlift)
            ),
            total: Math.round(totalKg),
            dots,
        });
    }

    return points;
}


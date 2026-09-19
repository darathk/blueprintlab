/**
 * calculateWilks
 * Uses the pre-2020 Wilks formula coefficients.
 */
export function calculateWilks(totalKg: number, bwKg: number, isMale: boolean): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    const x = bwKg;
    const x2 = Math.pow(x, 2);
    const x3 = Math.pow(x, 3);
    const x4 = Math.pow(x, 4);
    const x5 = Math.pow(x, 5);

    let a, b, c, d, e, f;

    if (isMale) {
        a = -216.0475144;
        b = 16.2606339;
        c = -0.002388645;
        d = -0.00113732;
        e = 7.01863e-06;
        f = -1.291e-08;
    } else {
        a = 594.31747775582;
        b = -27.23842536447;
        c = 0.82112226871;
        d = -0.00930733913;
        e = 4.731582e-05;
        f = -9.054e-08;
    }

    const denominator = a + (b * x) + (c * x2) + (d * x3) + (e * x4) + (f * x5);
    if (denominator === 0) return 0;

    // Original Wilks formulation gives coefficient as 500 / denominator
    const coeff = 500 / denominator;
    return totalKg * coeff;
}

/**
 * Unit conversions
 */
export function lbsToKg(lbs: number): number {
    return lbs / 2.20462;
}

export function kgToLbs(kg: number): number {
    return kg * 2.20462;
}

/**
 * calculateDots
 * Uses the exact DOTS (2020) formula coefficients.
 * Formula: SCORE = TOTAL * (500 / (a + b(BW) + c(BW^2) + d(BW^3) + e(BW^4)))
 * Where BW is purely in Kilograms.
 */
export function calculateDots(totalKg: number, bwKg: number, gender: 'male' | 'female' | boolean): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    const isMale = typeof gender === 'boolean' ? gender : gender === 'male';
    const bw2 = Math.pow(bwKg, 2);
    const bw3 = Math.pow(bwKg, 3);
    const bw4 = Math.pow(bwKg, 4);

    let denominator = 0;

    if (isMale) {
        const a = -307.75076;
        const b = 24.0900756;
        const c = -0.1918759221;
        const d = 0.0007391293;
        const e = -0.000001093;
        denominator = a + (b * bwKg) + (c * bw2) + (d * bw3) + (e * bw4);
    } else {
        const a = -57.96288;
        const b = 13.6175032;
        const c = -0.1126655495;
        const d = 0.0005158568;
        const e = -0.0000010706;
        denominator = a + (b * bwKg) + (c * bw2) + (d * bw3) + (e * bw4);
    }

    if (denominator <= 0) return 0;

    // Standard DOTS multiplier is 500 / denominator
    const multiplier = 500 / denominator;
    return parseFloat((totalKg * multiplier).toFixed(2));
}

/**
 * calculateGL
 * Uses the exact IPF Goodlift (GL) Points formula.
 * Points = Total * (100 / (A - B * e^(-C * BW)))
 */
export function calculateGL(totalKg: number, bwKg: number, isMale: boolean, isEquipped: boolean, isBenchOnly: boolean): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    let A, B, C;

    if (isMale) {
        if (isBenchOnly) {
            if (isEquipped) { A = 381.22073; B = 733.79378; C = 0.02398; }
            else { A = 320.98041; B = 281.40258; C = 0.01008; }
        } else {
            if (isEquipped) { A = 1236.25115; B = 1449.21864; C = 0.01644; }
            else { A = 1199.72839; B = 1025.18162; C = 0.00921; }
        }
    } else {
        if (isBenchOnly) {
            if (isEquipped) { A = 221.82209; B = 357.00377; C = 0.02937; }
            else { A = 142.40398; B = 442.52671; C = 0.04724; }
        } else {
            if (isEquipped) { A = 758.63878; B = 949.31382; C = 0.02435; }
            else { A = 610.32796; B = 1045.59282; C = 0.03048; }
        }
    }

    const denominator = A - B * Math.exp(-C * bwKg);
    if (denominator === 0) return 0;

    // Step C: IPF Protocol is to round the coefficient to 6 decimal places
    const rawCoefficient = 100 / denominator;
    const roundedCoefficient = Math.round(rawCoefficient * 1000000) / 1000000;

    // Multiply by total, then round final points to 6 decimal places
    const finalPoints = totalKg * roundedCoefficient;
    return Math.round(finalPoints * 1000000) / 1000000;
}

/**
 * solveForRequiredTotal
 * Uses the Bisection Method to numerically solve for the 'Total' required to hit a 'targetScore'.
 * Because formulas like DOTS are monotonically increasing with respect to Total, 
 * Bisection is guaranteed to find the root quickly and safely.
 */
export function solveForRequiredTotal(
    targetScore: number,
    bwKg: number,
    isMale: boolean,
    formulaType: 'dots' | 'gl' | 'wilks' = 'dots',
    isEquipped: boolean = false,
    isBenchOnly: boolean = false
): number {
    if (targetScore <= 0 || bwKg <= 0) return 0;

    const tolerance = 0.01; // We want to be accurate within 10 grams
    const maxIterations = 100;

    let lowTotal = 0;
    let highTotal = 2000; // Unlikely anyone hits a 2000kg total
    let midTotal = 0;

    for (let i = 0; i < maxIterations; i++) {
        midTotal = (lowTotal + highTotal) / 2;

        // Use the selected formula
        let currentScore = 0;
        if (formulaType === 'dots') {
            currentScore = calculateDots(midTotal, bwKg, isMale);
        } else if (formulaType === 'gl') {
            currentScore = calculateGL(midTotal, bwKg, isMale, isEquipped, isBenchOnly);
        } else if (formulaType === 'wilks') {
            currentScore = calculateWilks(midTotal, bwKg, isMale);
        }

        const diff = currentScore - targetScore;

        if (Math.abs(diff) < tolerance) {
            return midTotal; // Found a close enough score
        }

        // If the calculated score is too tight, we need a higher total
        if (currentScore < targetScore) {
            lowTotal = midTotal;
        } else {
            // Calculated score is too high, lower the total ceiling
            highTotal = midTotal;
        }
    }

    // If it reaches maxIterations, return best guess
    return midTotal;
}

/**
 * calculateWilks2020
 * Uses the updated 2020 Wilks formula coefficients.
 */
export function calculateWilks2020(totalKg: number, bwKg: number, isMale: boolean): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    const x = bwKg;
    const x2 = Math.pow(x, 2);
    const x3 = Math.pow(x, 3);
    const x4 = Math.pow(x, 4);
    const x5 = Math.pow(x, 5);

    let a: number, b: number, c: number, d: number, e: number, f: number;

    if (isMale) {
        a = 47.4617885411949;
        b = 8.47252971288316;
        c = 0.0736941034626354;
        d = -0.00139583381091811;
        e = 7.07665973070743e-06;
        f = -1.20804336482357e-08;
    } else {
        a = -125.425539779;
        b = 13.71219419406;
        c = -0.03307250481;
        d = -0.00105040005;
        e = 9.38773884e-06;
        f = -2.333461388e-08;
    }

    const denominator = a + (b * x) + (c * x2) + (d * x3) + (e * x4) + (f * x5);
    if (denominator <= 0) return 0;

    const coeff = 600 / denominator;
    return parseFloat((totalKg * coeff).toFixed(2));
}

export type OneRepMaxFormula = 'brzycki' | 'epley' | 'lander' | 'lombardi' | 'mayhew' | 'oconner' | 'wathan';

/**
 * calculate1RM
 * Computes 1RM from weight and reps using the specified formula.
 */
export function calculate1RM(weight: number, reps: number, formula: OneRepMaxFormula = 'brzycki'): number {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return weight;

    let max = 0;
    switch (formula) {
        case 'brzycki':
            max = reps < 37 ? weight * (36 / (37 - reps)) : weight * 1.5;
            break;
        case 'epley':
            max = weight * (1 + reps / 30);
            break;
        case 'lander':
            max = (100 * weight) / (101.3 - 2.67123 * reps);
            break;
        case 'lombardi':
            max = weight * Math.pow(reps, 0.10);
            break;
        case 'mayhew':
            max = (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
            break;
        case 'oconner':
            max = weight * (1 + 0.025 * reps);
            break;
        case 'wathan':
            max = (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps));
            break;
        default:
            max = weight * (1 + reps / 30);
    }
    return Math.max(weight, parseFloat(max.toFixed(2)));
}

/**
 * RTS RPE Table (Mike Tuchscherer)
 * Rows: RPE 10 down to 6.5 in 0.5 increments.
 * Cols: Reps 1 to 10.
 */
export const RTS_RPE_TABLE: Record<number, number[]> = {
    10.0: [1.000, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739],
    9.5:  [0.978, 0.939, 0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723],
    9.0:  [0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707],
    8.5:  [0.939, 0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694],
    8.0:  [0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680],
    7.5:  [0.907, 0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667],
    7.0:  [0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680, 0.653],
    6.5:  [0.878, 0.850, 0.824, 0.799, 0.774, 0.751, 0.723, 0.694, 0.667, 0.640],
    6.0:  [0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.680, 0.653, 0.626],
};

/**
 * Get the percentage of 1RM corresponding to a given (reps, rpe).
 * Extrapolates gracefully for RPE < 6.0.
 */
export function getRpePercentage(reps: number, rpe: number): number {
    const clampedReps = Math.min(Math.max(Math.round(reps), 1), 10);
    const col = clampedReps - 1;

    // Direct lookup if >= 6.0 and in table
    const roundedRpe = Math.round(rpe * 2) / 2;
    if (RTS_RPE_TABLE[roundedRpe]) {
        return RTS_RPE_TABLE[roundedRpe][col];
    }

    // Extrapolate below 6.0: subtract approx 2.5% per 0.5 RPE decrement
    const base6 = RTS_RPE_TABLE[6.0][col];
    const stepsBelow = (6.0 - rpe) * 2;
    const extrapolated = base6 - (stepsBelow * 0.026);
    return Math.max(0.2, extrapolated);
}

/**
 * Estimate 1RM from a completed set
 */
export function estimate1RMFromRpe(weight: number, reps: number, rpe: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    const pct = getRpePercentage(reps, rpe);
    if (pct <= 0) return weight;
    return weight / pct;
}

/**
 * Project target weight for next set
 */
export function calculateTargetWeightFromRpe(
    lastWeight: number,
    lastReps: number,
    lastRpe: number,
    targetReps: number,
    targetRpe: number
): { e1rm: number; targetWeight: number; targetPct: number } {
    const e1rm = estimate1RMFromRpe(lastWeight, lastReps, lastRpe);
    if (e1rm <= 0) return { e1rm: 0, targetWeight: 0, targetPct: 0 };
    const targetPct = getRpePercentage(targetReps, targetRpe);
    const targetWeight = e1rm * targetPct;
    return {
        e1rm: parseFloat(e1rm.toFixed(2)),
        targetWeight: parseFloat(targetWeight.toFixed(2)),
        targetPct: parseFloat((targetPct * 100).toFixed(1)),
    };
}


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
 * calculateDots
 * Uses the exact DOTS (2020) formula coefficients.
 * Formula: SCORE = TOTAL * (500 / (a + b(BW) + c(BW^2) + d(BW^3) + e(BW^4)))
 * Where BW is purely in Kilograms.
 */
export function calculateDots(totalKg: number, bwKg: number, isMale: boolean): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    const bw2 = Math.pow(bwKg, 2);
    const bw3 = Math.pow(bwKg, 3);
    const bw4 = Math.pow(bwKg, 4);

    let denominator = 0;

    if (isMale) {
        const a = -307.75076;
        const b = 24.09007;
        const c = -0.19187;
        const d = 0.00073917;
        const e = -0.000001093;
        denominator = a + (b * bwKg) + (c * bw2) + (d * bw3) + (e * bw4);
    } else {
        const a = -57.96288;
        const b = 13.61750;
        const c = -0.11266;
        const d = 0.00051585;
        const e = -0.0000010706;
        denominator = a + (b * bwKg) + (c * bw2) + (d * bw3) + (e * bw4);
    }

    if (denominator === 0) return 0;

    // Standard DOTS multiplier is 500 / denominator
    const multiplier = 500 / denominator;
    return totalKg * multiplier;
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

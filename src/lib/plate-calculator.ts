/**
 * plate-calculator.ts
 * Given a total barbell weight in lbs, returns the plates needed on each side.
 * Bar weight = 45 lbs (standard Olympic barbell).
 */

export interface Plate {
    weightLbs: number;
    label: string;
    color: string;          // hex fill color
    borderColor: string;    // slightly lighter border
    height: number;         // relative height (1 = base unit, scales with card)
    width: number;          // relative width
}

const LB_PLATES: Plate[] = [
    { weightLbs: 45,  label: '45',  color: '#8B1A1A', borderColor: '#B22222', height: 5.2, width: 1.1 },
    { weightLbs: 35,  label: '35',  color: '#92620A', borderColor: '#B8860B', height: 4.6, width: 1.0 },
    { weightLbs: 25,  label: '25',  color: '#14532D', borderColor: '#16A34A', height: 4.0, width: 1.0 },
    { weightLbs: 10,  label: '10',  color: '#94A3B8', borderColor: '#CBD5E1', height: 3.2, width: 0.85 },
    { weightLbs: 5,   label: '5',   color: '#991B1B', borderColor: '#DC2626', height: 2.6, width: 0.8  },
    { weightLbs: 2.5, label: '2.5', color: '#475569', borderColor: '#64748B', height: 2.2, width: 0.75 },
];

export const BAR_WEIGHT_LBS = 45;

/**
 * Calculate the plates on ONE side of the bar.
 * Returns plates sorted heaviest → lightest (inner → outer from the collar).
 */
export function calculatePlates(totalLbs: number): Plate[] {
    const perSide = (totalLbs - BAR_WEIGHT_LBS) / 2;
    if (perSide <= 0) return [];

    const result: Plate[] = [];
    let remaining = perSide;

    for (const plate of LB_PLATES) {
        while (remaining >= plate.weightLbs - 0.01) {
            result.push(plate);
            remaining -= plate.weightLbs;
        }
    }

    return result;
}

/** Convert lbs → kg, rounded to 1 decimal. */
export function lbsToKgDisplay(lbs: number): string {
    return (lbs * 0.453592).toFixed(1);
}

import { calculateDots } from './dots';

export interface OPLMeet {
    Name: string;
    Date: string;
    BodyweightKg: number;
    WeightClassKg: string;
    Squat1Kg: number | string;
    Squat2Kg: number | string;
    Squat3Kg: number | string;
    Best3SquatKg: number;
    Bench1Kg: number | string;
    Bench2Kg: number | string;
    Bench3Kg: number | string;
    Best3BenchKg: number;
    Deadlift1Kg: number | string;
    Deadlift2Kg: number | string;
    Deadlift3Kg: number | string;
    Best3DeadliftKg: number;
    TotalKg: number;
    Federation: string;
    Sex: string;
}

export interface HitRateStats {
    squat: { made: number; total: number; percent: number };
    bench: { made: number; total: number; percent: number };
    deadlift: { made: number; total: number; percent: number };
    overall: { made: number; total: number; percent: number };
    bombOuts: number;
}

export interface ProgressionStats {
    averageTotalIncreaseKg: number;
    averageTotalIncreasePercent: number;
    averageSquatIncreaseKg: number;
    averageBenchIncreaseKg: number;
    averageDeadliftIncreaseKg: number;
    meetsCount: number;
    history: { date: string; total: number; bodyweight: number; weightClass: string; federation: string; squat: number; bench: number; deadlift: number }[];
}

export interface TacticalStats {
    avgSquatJump1to2: number;
    avgSquatJump2to3: number;
    avgBenchJump1to2: number;
    avgBenchJump2to3: number;
    avgDeadliftJump1to2: number;
    avgDeadliftJump2to3: number;
    opensHeavy: boolean;
}

export interface LiveAttempt {
    kg: number;
    status: 'pending' | 'made' | 'missed';
}

export interface LiveLiftData {
    attempt1?: LiveAttempt;
    attempt2?: LiveAttempt;
    attempt3?: LiveAttempt;
}

export interface CompetitorLiveData {
    squat: LiveLiftData;
    bench: LiveLiftData;
    deadlift: LiveLiftData;
    bodyweight?: number;
}

export interface CompetitorProfile {
    id: string; // usually the slug
    name: string;
    hitRates: HitRateStats;
    progression: ProgressionStats;
    tactics: TacticalStats;
    lastTotal: number;
    projectedTotal: number;
    projectedSquat: number;
    projectedBench: number;
    projectedDeadlift: number;
    heaviestTotal: number;
    heaviestTotalWeightClass: string;
    heaviestTotalBodyweight: number;
    lastBodyweight: number;
    lastMeetDate: string;
    historicalBests: {
        squat: { value: number; date: string };
        bench: { value: number; date: string };
        deadlift: { value: number; date: string };
        total: { value: number; date: string };
        dots: { value: number; date: string };
    };
    liveData?: CompetitorLiveData;
}

/**
 * Calculates the probability of the athlete beating the competitor.
 * Uses a logistic curve where a 10kg lead roughly equals a 75% chance to win.
 */
export function calculateWinProbability(athleteTotal: number, competitorTotal: number): number {
    if (athleteTotal <= 0 || competitorTotal <= 0) return 0;
    // P = 1 / (1 + 10^((Comp - Ath) / 20))
    return 1 / (1 + Math.pow(10, (competitorTotal - athleteTotal) / 20));
}

function parseAttempt(val: any): { attempted: boolean; made: boolean; kg: number } {
    if (val === null || val === undefined || val === '') return { attempted: false, made: false, kg: 0 };
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return { attempted: false, made: false, kg: 0 };
    return {
        attempted: true,
        made: num > 0,
        kg: Math.abs(num)
    };
}

export function analyzeCompetitor(slug: string, meets: OPLMeet[]): CompetitorProfile {
    // Sort meets oldest to newest
    const sortedMeets = [...meets].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
    
    let sqMade = 0, sqTot = 0;
    let bnMade = 0, bnTot = 0;
    let dlMade = 0, dlTot = 0;
    let bombOuts = 0;

    let sqJumps1to2: number[] = [];
    let sqJumps2to3: number[] = [];
    let bnJumps1to2: number[] = [];
    let bnJumps2to3: number[] = [];
    let dlJumps1to2: number[] = [];
    let dlJumps2to3: number[] = [];

    const history = [];

    let name = meets.length > 0 ? meets[0].Name : slug;

    let heaviestTotal = 0;
    let heaviestTotalWeightClass = '';
    let heaviestTotalBodyweight = 0;

    let bestSquat = { value: 0, date: '' };
    let bestBench = { value: 0, date: '' };
    let bestDeadlift = { value: 0, date: '' };
    let bestTotal = { value: 0, date: '' };
    let bestDots = { value: 0, date: '' };

    for (const meet of sortedMeets) {
        if (!meet.TotalKg) continue; // Skip incomplete meets
        
        const s1 = parseAttempt(meet.Squat1Kg);
        const s2 = parseAttempt(meet.Squat2Kg);
        const s3 = parseAttempt(meet.Squat3Kg);
        const sqBest = meet.Best3SquatKg > 0 ? meet.Best3SquatKg : Math.max(s1.made ? s1.kg : 0, s2.made ? s2.kg : 0, s3.made ? s3.kg : 0);
        
        const b1 = parseAttempt(meet.Bench1Kg);
        const b2 = parseAttempt(meet.Bench2Kg);
        const b3 = parseAttempt(meet.Bench3Kg);
        const bnBest = meet.Best3BenchKg > 0 ? meet.Best3BenchKg : Math.max(b1.made ? b1.kg : 0, b2.made ? b2.kg : 0, b3.made ? b3.kg : 0);
        
        const d1 = parseAttempt(meet.Deadlift1Kg);
        const d2 = parseAttempt(meet.Deadlift2Kg);
        const d3 = parseAttempt(meet.Deadlift3Kg);
        const dlBest = meet.Best3DeadliftKg > 0 ? meet.Best3DeadliftKg : Math.max(d1.made ? d1.kg : 0, d2.made ? d2.kg : 0, d3.made ? d3.kg : 0);

        const dots = calculateDots(meet.TotalKg, meet.BodyweightKg, meet.Sex === 'M' ? 'male' : 'female');

        history.push({
            date: meet.Date,
            total: meet.TotalKg,
            bodyweight: meet.BodyweightKg,
            weightClass: meet.WeightClassKg || String(meet.BodyweightKg),
            federation: meet.Federation,
            squat: sqBest,
            bench: bnBest,
            deadlift: dlBest,
            dots: dots
        });

        if (meet.TotalKg > heaviestTotal) {
            heaviestTotal = meet.TotalKg;
            heaviestTotalWeightClass = meet.WeightClassKg || String(meet.BodyweightKg);
            heaviestTotalBodyweight = meet.BodyweightKg;
        }

        // Track Bests
        if (sqBest > bestSquat.value) bestSquat = { value: sqBest, date: meet.Date };
        if (bnBest > bestBench.value) bestBench = { value: bnBest, date: meet.Date };
        if (dlBest > bestDeadlift.value) bestDeadlift = { value: dlBest, date: meet.Date };
        if (meet.TotalKg > bestTotal.value) bestTotal = { value: meet.TotalKg, date: meet.Date };
        if (dots > bestDots.value) bestDots = { value: dots, date: meet.Date };

        // Hit Rates
        if (s1.attempted) { sqTot++; if (s1.made) sqMade++; }
        if (s2.attempted) { sqTot++; if (s2.made) sqMade++; }
        if (s3.attempted) { sqTot++; if (s3.made) sqMade++; }
        if (s1.attempted && !s1.made && !s2.made && !s3.made) bombOuts++;

        if (b1.attempted) { bnTot++; if (b1.made) bnMade++; }
        if (b2.attempted) { bnTot++; if (b2.made) bnMade++; }
        if (b3.attempted) { bnTot++; if (b3.made) bnMade++; }
        if (b1.attempted && !b1.made && !b2.made && !b3.made) bombOuts++;

        if (d1.attempted) { dlTot++; if (d1.made) dlMade++; }
        if (d2.attempted) { dlTot++; if (d2.made) dlMade++; }
        if (d3.attempted) { dlTot++; if (d3.made) dlMade++; }
        if (d1.attempted && !d1.made && !d2.made && !d3.made) bombOuts++;

        // Jumps
        if (s1.made && s2.attempted) sqJumps1to2.push(s2.kg - s1.kg);
        if (s2.made && s3.attempted) sqJumps2to3.push(s3.kg - s2.kg);
        
        if (b1.made && b2.attempted) bnJumps1to2.push(b2.kg - b1.kg);
        if (b2.made && b3.attempted) bnJumps2to3.push(b3.kg - b2.kg);

        if (d1.made && d2.attempted) dlJumps1to2.push(d2.kg - d1.kg);
        if (d2.made && d3.attempted) dlJumps2to3.push(d3.kg - d2.kg);
    }

    const overallMade = sqMade + bnMade + dlMade;
    const overallTot = sqTot + bnTot + dlTot;

    // Progression
    let totalIncreaseKg = 0;
    let totalIncreasePct = 0;
    let sqIncreaseKg = 0;
    let bnIncreaseKg = 0;
    let dlIncreaseKg = 0;
    let progressionMeets = 0;
    let sqProgMeets = 0;
    let bnProgMeets = 0;
    let dlProgMeets = 0;
    
    for (let i = 1; i < history.length; i++) {
        const prev = history[i-1].total;
        const curr = history[i].total;
        if (prev > 0) {
            totalIncreaseKg += (curr - prev);
            totalIncreasePct += ((curr - prev) / prev) * 100;
            progressionMeets++;
        }

        if (history[i-1].squat > 0 && history[i].squat > 0) {
            sqIncreaseKg += (history[i].squat - history[i-1].squat);
            sqProgMeets++;
        }
        if (history[i-1].bench > 0 && history[i].bench > 0) {
            bnIncreaseKg += (history[i].bench - history[i-1].bench);
            bnProgMeets++;
        }
        if (history[i-1].deadlift > 0 && history[i].deadlift > 0) {
            dlIncreaseKg += (history[i].deadlift - history[i-1].deadlift);
            dlProgMeets++;
        }
    }

    const avgIncKg = progressionMeets > 0 ? totalIncreaseKg / progressionMeets : 0;
    const avgIncPct = progressionMeets > 0 ? totalIncreasePct / progressionMeets : 0;
    const avgSqIncKg = sqProgMeets > 0 ? sqIncreaseKg / sqProgMeets : 0;
    const avgBnIncKg = bnProgMeets > 0 ? bnIncreaseKg / bnProgMeets : 0;
    const avgDlIncKg = dlProgMeets > 0 ? dlIncreaseKg / dlProgMeets : 0;

    const lastMeet = history.length > 0 ? history[history.length - 1] : null;
    const lastTotal = lastMeet ? lastMeet.total : 0;
    // Projected = last total + average progression
    const projectedTotal = lastTotal > 0 ? lastTotal + avgIncKg : 0;
    const projectedSquat = lastMeet && lastMeet.squat > 0 ? lastMeet.squat + avgSqIncKg : 0;
    const projectedBench = lastMeet && lastMeet.bench > 0 ? lastMeet.bench + avgBnIncKg : 0;
    const projectedDeadlift = lastMeet && lastMeet.deadlift > 0 ? lastMeet.deadlift + avgDlIncKg : 0;

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

    const tactics: TacticalStats = {
        avgSquatJump1to2: avg(sqJumps1to2),
        avgSquatJump2to3: avg(sqJumps2to3),
        avgBenchJump1to2: avg(bnJumps1to2),
        avgBenchJump2to3: avg(bnJumps2to3),
        avgDeadliftJump1to2: avg(dlJumps1to2),
        avgDeadliftJump2to3: avg(dlJumps2to3),
        opensHeavy: avg(sqJumps1to2) < 7.5 // Arbitrary heuristic
    };

    const round25 = (val: number) => Math.round(val / 2.5) * 2.5;

    return {
        id: slug,
        name,
        hitRates: {
            squat: { made: sqMade, total: sqTot, percent: sqTot > 0 ? Math.round((sqMade/sqTot)*100) : 0 },
            bench: { made: bnMade, total: bnTot, percent: bnTot > 0 ? Math.round((bnMade/bnTot)*100) : 0 },
            deadlift: { made: dlMade, total: dlTot, percent: dlTot > 0 ? Math.round((dlMade/dlTot)*100) : 0 },
            overall: { made: overallMade, total: overallTot, percent: overallTot > 0 ? Math.round((overallMade/overallTot)*100) : 0 },
            bombOuts
        },
        progression: {
            averageTotalIncreaseKg: round25(avgIncKg),
            averageTotalIncreasePercent: Math.round(avgIncPct * 10) / 10,
            averageSquatIncreaseKg: round25(avgSqIncKg),
            averageBenchIncreaseKg: round25(avgBnIncKg),
            averageDeadliftIncreaseKg: round25(avgDlIncKg),
            meetsCount: history.length,
            history
        },
        tactics,
        lastTotal,
        projectedTotal: round25(projectedTotal),
        projectedSquat: round25(projectedSquat),
        projectedBench: round25(projectedBench),
        projectedDeadlift: round25(projectedDeadlift),
        heaviestTotal,
        heaviestTotalWeightClass,
        heaviestTotalBodyweight,
        lastBodyweight: lastMeet ? lastMeet.bodyweight : 0,
        lastMeetDate: lastMeet ? lastMeet.date : '',
        historicalBests: {
            squat: bestSquat,
            bench: bestBench,
            deadlift: bestDeadlift,
            total: bestTotal,
            dots: bestDots
        }
    };
}

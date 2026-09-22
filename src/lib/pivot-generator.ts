import { calculateStress } from './stress-index.js';
import { getExerciseCategory, EXERCISE_CATEGORIES } from './exercise-db.js';

export interface PivotStanceConfig {
    squatStance: 'low_bar' | 'high_bar';
    deadliftStance: 'sumo' | 'conventional';
    keepBenchGroove: boolean;
}

export interface MovementStressBreakdown {
    knee: number;
    hip: number;
    pushH: number;
    total: number;
}

export interface PivotGenerationResult {
    sessions: any[];
    baselineStress: MovementStressBreakdown;
    targetStress: MovementStressBreakdown;
    generatedStress: MovementStressBreakdown;
    detectedStances: PivotStanceConfig;
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}

// Resolve exercise category from custom DB or heuristic
export function resolveCategory(exName: string, exerciseDB?: Record<string, any>): string {
    if (exerciseDB && exerciseDB[exName]?.category) {
        return exerciseDB[exName].category;
    }
    return getExerciseCategory(exName || '');
}

// Calculate Knee, Hip, and Push-H stress for a given set of sessions
export function calculateWeekMovementStress(sessions: any[], exerciseDB?: Record<string, any>): MovementStressBreakdown {
    let knee = 0;
    let hip = 0;
    let pushH = 0;

    (sessions || []).forEach(session => {
        (session.exercises || []).forEach((ex: any) => {
            const cat = resolveCategory(ex.name, exerciseDB);
            const sets = Array.isArray(ex.sets) ? ex.sets : [];

            sets.forEach((s: any) => {
                let reps = 0;
                if (typeof s.reps === 'string' && s.reps.includes('-')) {
                    const [min, max] = s.reps.split('-').map(Number);
                    reps = (min + max) / 2;
                } else {
                    reps = parseFloat(s.reps) || 0;
                }
                const rpe = parseFloat(s.rpe) || 0;

                if (reps > 0 && rpe > 0) {
                    const { total } = calculateStress(reps, rpe);
                    if (cat === EXERCISE_CATEGORIES.KNEE) knee += total;
                    else if (cat === EXERCISE_CATEGORIES.HIP) hip += total;
                    else if (cat === EXERCISE_CATEGORIES.PUSH_HORIZONTAL) pushH += total;
                }
            });
        });
    });

    const round1 = (val: number) => Math.round(val * 10) / 10;
    return {
        knee: round1(knee),
        hip: round1(hip),
        pushH: round1(pushH),
        total: round1(knee + hip + pushH),
    };
}

// Auto-detect competition stances from previous sessions
export function detectCompetitionStances(sessions: any[]): PivotStanceConfig {
    let squatStance: 'low_bar' | 'high_bar' = 'low_bar';
    let deadliftStance: 'sumo' | 'conventional' = 'conventional';

    (sessions || []).forEach(session => {
        (session.exercises || []).forEach((ex: any) => {
            const name = (ex.name || '').toLowerCase();
            if (name.includes('sumo')) {
                deadliftStance = 'sumo';
            } else if (name.includes('conventional') || name.includes('conv')) {
                deadliftStance = 'conventional';
            }

            if (name.includes('high bar')) {
                squatStance = 'high_bar';
            } else if (name.includes('low bar')) {
                squatStance = 'low_bar';
            }
        });
    });

    return {
        squatStance,
        deadliftStance,
        keepBenchGroove: true,
    };
}

// Exercise Pools for Desensitization
const DESENSITIZING_KNEE_POOLS = {
    // If comp is low bar, favor high bar, safety squat bar, front squat, pause, etc.
    from_low_bar: [
        'High Bar Squat',
        'Safety Squat Bar Squat',
        '2-Count Pause Squat',
        'Pin Squat',
        '3-0-3 Tempo Squat',
        'Front Squat',
        'Belt Squat',
        'Leg Press',
        'Bulgarian Split Squat',
        'Hack Squat',
    ],
    // If comp is high bar, favor low bar, SSB, pause, etc.
    from_high_bar: [
        'Low Bar Squat',
        'Safety Squat Bar Squat',
        '2-Count Pause Squat',
        'Pin Squat',
        'Front Squat',
        'Belt Squat',
        'Leg Press',
        'Bulgarian Split Squat',
    ],
};

const DESENSITIZING_HIP_POOLS = {
    // If comp is sumo, desensitize with conventional, RDL, deficit, pause
    from_sumo: [
        'Conventional Deadlift',
        'Romanian Deadlift (RDL)',
        'Deficit Deadlift',
        'Pause Below Knee Deadlift',
        'Stiff Leg Deadlift',
        'Snatch Grip Deadlift',
        'Good Morning',
    ],
    // If comp is conventional, desensitize with sumo, RDL, pause, deficit
    from_conventional: [
        'Sumo Deadlift',
        'Romanian Deadlift (RDL)',
        'Pause Deadlift',
        'Deficit Deadlift',
        'Stiff Leg Deadlift',
        'Good Morning',
    ],
};

// Bench Press variations tailored to preserve technical skill while deloading
const BENCH_GROOVE_VARIATIONS = [
    'Close Grip Bench Press',
    'Larsen Press',
    'Spoto Press',
    '2-Count Pause Bench Press',
    'Touch and Go Bench Press',
    'Comp Bench Press',
    'Incline Bench Press',
    'Floor Press',
    'Dumbbell Bench Press',
];

const BACK_ACCESSORIES_POOL = [
    'Lat Pulldown',
    'Chest Supported Row',
    'Seated Cable Row',
    'Barbell Row',
    'Dumbbell Row',
    'Neutral Grip Lat Pulldown',
    'Face Pull',
    'Seal Row',
];

const ARM_ACCESSORIES_POOL = [
    'Bicep Curl',
    'Hammer Curl',
    'Incline Dumbbell Curl',
    'Cable Tricep Pushdown',
    'Overhead Tricep Extension',
    'Dumbbell Lateral Raise',
    'Cable Lateral Raise',
    'Skull Crusher',
];

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Solver for generating set/rep/RPE schemes that sum to targetStress
export function solveSetsForCategory(
    targetStress: number,
    numExercises: number = 1
): { exerciseSets: { reps: string; rpe: string; weight: string; stress: number }[][]; totalStress: number } {
    if (targetStress <= 0.3) {
        // Fallback minimal deload set
        return {
            exerciseSets: Array(numExercises).fill(null).map(() => [
                { reps: '6', rpe: '6', weight: '', stress: 0.5 },
                { reps: '6', rpe: '6.5', weight: '', stress: 0.6 },
            ]),
            totalStress: numExercises * 1.1,
        };
    }

    const repOptions = [5, 6, 7, 8];
    let bestSets: { reps: string; rpe: string; weight: string; stress: number }[][] = [];
    let minError = Infinity;
    let bestTotalStress = 0;

    // Run randomized search attempts to ensure true procedural generation
    for (let attempt = 0; attempt < 350; attempt++) {
        const currentExerciseSets: { reps: string; rpe: string; weight: string; stress: number }[][] = [];
        let accumulatedStress = 0;

        for (let i = 0; i < numExercises; i++) {
            const exTarget = targetStress / numExercises;
            // 2 to 4 sets per exercise typically
            const targetSetsCount = Math.max(2, Math.min(4, Math.round(exTarget / 0.6)));
            const baseReps = repOptions[Math.floor(Math.random() * repOptions.length)];
            let currentRpe = Math.random() < 0.6 ? 6.0 : 6.5;

            const sets: { reps: string; rpe: string; weight: string; stress: number }[] = [];
            for (let s = 0; s < targetSetsCount; s++) {
                if (s > 0 && Math.random() < 0.5 && currentRpe < 7.5) {
                    currentRpe += 0.5;
                }
                const stress = calculateStress(baseReps, currentRpe).total;
                sets.push({
                    reps: String(baseReps),
                    rpe: String(currentRpe),
                    weight: '',
                    stress,
                });
                accumulatedStress += stress;
            }
            currentExerciseSets.push(sets);
        }

        const error = Math.abs(accumulatedStress - targetStress);
        if (error < minError) {
            minError = error;
            bestSets = currentExerciseSets;
            bestTotalStress = Math.round(accumulatedStress * 10) / 10;
            if (error <= 0.1) break; // Perfect match
        }
    }

    return {
        exerciseSets: bestSets,
        totalStress: bestTotalStress,
    };
}

export interface GeneratePivotOptions {
    referenceWeek: any;
    targetRatio?: number; // default 0.5 (50%)
    stances: PivotStanceConfig;
    exerciseDB?: Record<string, any>;
    customDays?: number[]; // Optional list of days [1, 2, 4, 5]
}

/**
 * Main procedural randomizer for Pivot Week
 */
export function generatePivotWeek({
    referenceWeek,
    targetRatio = 0.5,
    stances,
    exerciseDB,
    customDays,
}: GeneratePivotOptions): PivotGenerationResult {
    const rawSessions = referenceWeek?.sessions || [];
    const baselineStress = calculateWeekMovementStress(rawSessions, exerciseDB);

    // If baseline stress is zero (empty reference week), supply powerlifting sensible defaults
    const baselineKnee = baselineStress.knee > 0 ? baselineStress.knee : 9.0;
    const baselineHip = baselineStress.hip > 0 ? baselineStress.hip : 7.0;
    const baselinePushH = baselineStress.pushH > 0 ? baselineStress.pushH : 11.0;

    const targetKnee = Math.round(baselineKnee * targetRatio * 10) / 10;
    const targetHip = Math.round(baselineHip * targetRatio * 10) / 10;
    const targetPushH = Math.round(baselinePushH * targetRatio * 10) / 10;

    const targetStress: MovementStressBreakdown = {
        knee: targetKnee,
        hip: targetHip,
        pushH: targetPushH,
        total: Math.round((targetKnee + targetHip + targetPushH) * 10) / 10,
    };

    // Determine days to schedule
    let trainingDays: number[] = [];
    if (customDays && customDays.length > 0) {
        trainingDays = [...customDays].sort((a, b) => a - b);
    } else if (rawSessions.length > 0) {
        trainingDays = rawSessions.map((s: any) => Number(s.day || 1)).sort((a, b) => a - b);
    } else {
        trainingDays = [1, 3, 5, 6]; // Default 4-day split (Mon, Wed, Fri, Sat)
    }

    // Inspect which movement patterns were present on each day in reference week
    const dayMovementMap: Record<number, { hasKnee: boolean; hasHip: boolean; hasPushH: boolean }> = {};
    trainingDays.forEach(day => {
        dayMovementMap[day] = { hasKnee: false, hasHip: false, hasPushH: false };
    });

    rawSessions.forEach((s: any) => {
        const day = Number(s.day || 1);
        if (dayMovementMap[day]) {
            (s.exercises || []).forEach((ex: any) => {
                const cat = resolveCategory(ex.name, exerciseDB);
                if (cat === EXERCISE_CATEGORIES.KNEE) dayMovementMap[day].hasKnee = true;
                if (cat === EXERCISE_CATEGORIES.HIP) dayMovementMap[day].hasHip = true;
                if (cat === EXERCISE_CATEGORIES.PUSH_HORIZONTAL) dayMovementMap[day].hasPushH = true;
            });
        }
    });

    // Count how many knee, hip, push slots we need across the week
    let kneeDays = trainingDays.filter(d => dayMovementMap[d].hasKnee);
    let hipDays = trainingDays.filter(d => dayMovementMap[d].hasHip);
    let pushDays = trainingDays.filter(d => dayMovementMap[d].hasPushH);

    // Fallback if no specific patterns found
    if (kneeDays.length === 0) kneeDays = [trainingDays[0] || 1, trainingDays[2] || 5];
    if (hipDays.length === 0) hipDays = [trainingDays[1] || 3];
    if (pushDays.length === 0) pushDays = trainingDays.slice(0, Math.min(3, trainingDays.length));

    // Solve sets, reps, and RPE for each category
    const kneeSolved = solveSetsForCategory(targetKnee, kneeDays.length);
    const hipSolved = solveSetsForCategory(targetHip, hipDays.length);
    const pushSolved = solveSetsForCategory(targetPushH, pushDays.length);

    // Select randomized variations
    const kneePool = shuffleArray(
        stances.squatStance === 'low_bar'
            ? DESENSITIZING_KNEE_POOLS.from_low_bar
            : DESENSITIZING_KNEE_POOLS.from_high_bar
    );
    const hipPool = shuffleArray(
        stances.deadliftStance === 'sumo'
            ? DESENSITIZING_HIP_POOLS.from_sumo
            : DESENSITIZING_HIP_POOLS.from_conventional
    );
    const pushPool = shuffleArray(BENCH_GROOVE_VARIATIONS);
    const backPool = shuffleArray(BACK_ACCESSORIES_POOL);
    const armPool = shuffleArray(ARM_ACCESSORIES_POOL);

    let kneePoolIdx = 0;
    let hipPoolIdx = 0;
    let pushPoolIdx = 0;
    let backPoolIdx = 0;
    let armPoolIdx = 0;

    // Track assigned exercises per day
    const dayExercisesMap: Record<number, any[]> = {};
    trainingDays.forEach(day => {
        dayExercisesMap[day] = [];
    });

    // Assign Knee variations
    kneeDays.forEach((day, idx) => {
        const exName = kneePool[kneePoolIdx % kneePool.length];
        kneePoolIdx++;
        const setsData = kneeSolved.exerciseSets[idx] || [];
        dayExercisesMap[day].push({
            id: generateId(),
            name: exName,
            category: EXERCISE_CATEGORIES.KNEE,
            sets: setsData.map(s => ({
                id: generateId(),
                reps: s.reps,
                rpe: s.rpe,
                weight: '',
            })),
            notes: 'Pivot deload: focus on smooth tempo & posture',
        });
    });

    // Assign Hip variations
    hipDays.forEach((day, idx) => {
        const exName = hipPool[hipPoolIdx % hipPool.length];
        hipPoolIdx++;
        const setsData = hipSolved.exerciseSets[idx] || [];
        dayExercisesMap[day].push({
            id: generateId(),
            name: exName,
            category: EXERCISE_CATEGORIES.HIP,
            sets: setsData.map(s => ({
                id: generateId(),
                reps: s.reps,
                rpe: s.rpe,
                weight: '',
            })),
            notes: 'Pivot deload: controlled eccentric, technical crispness',
        });
    });

    // Assign Bench / Horizontal Push variations
    pushDays.forEach((day, idx) => {
        const exName = pushPool[pushPoolIdx % pushPool.length];
        pushPoolIdx++;
        const setsData = pushSolved.exerciseSets[idx] || [];
        dayExercisesMap[day].push({
            id: generateId(),
            name: exName,
            category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL,
            sets: setsData.map(s => ({
                id: generateId(),
                reps: s.reps,
                rpe: s.rpe,
                weight: '',
            })),
            notes: 'Pivot deload: maintain bar groove & arch tension',
        });
    });

    // Assign Back & Arm Accessories to each day with blank reps & RPE (coach can customize)
    trainingDays.forEach(day => {
        const backEx = backPool[backPoolIdx % backPool.length];
        backPoolIdx++;
        const armEx = armPool[armPoolIdx % armPool.length];
        armPoolIdx++;

        dayExercisesMap[day].push({
            id: generateId(),
            name: backEx,
            category: EXERCISE_CATEGORIES.PULL_HORIZONTAL,
            sets: [
                { id: generateId(), reps: '', rpe: '', weight: '' },
                { id: generateId(), reps: '', rpe: '', weight: '' },
                { id: generateId(), reps: '', rpe: '', weight: '' },
            ],
            notes: 'Accessory: RPE / reps coach choice',
        });

        dayExercisesMap[day].push({
            id: generateId(),
            name: armEx,
            category: EXERCISE_CATEGORIES.ISOLATION_UPPER,
            sets: [
                { id: generateId(), reps: '', rpe: '', weight: '' },
                { id: generateId(), reps: '', rpe: '', weight: '' },
                { id: generateId(), reps: '', rpe: '', weight: '' },
            ],
            notes: 'Accessory: RPE / reps coach choice',
        });
    });

    // Construct the structured sessions
    const generatedSessions = trainingDays.map((dayNum, i) => {
        const exercises = dayExercisesMap[dayNum] || [];
        return {
            id: generateId(),
            name: `Pivot Session ${i + 1}`,
            day: dayNum,
            warmupDrills: 'General dynamic warm-up, hip mobility, rotator cuff prep',
            exercises,
        };
    });

    const generatedStress = calculateWeekMovementStress(generatedSessions, exerciseDB);

    return {
        sessions: generatedSessions,
        baselineStress,
        targetStress,
        generatedStress,
        detectedStances: stances,
    };
}

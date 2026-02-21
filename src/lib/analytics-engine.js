import { calculateSimpleE1RM, calculateStress } from './stress-index';
import { getParentLift, getExerciseCategory, EXERCISE_CATEGORIES } from './exercise-db';

// Feature A: Variation Impact Report
export function generateVariationImpactReport(logs) {
    // 1. Group logs by Date (Session) -> Week -> Block
    // Since we don't have explicit "Block" IDs in logs, we infer blocks by date gaps or assume one big history for now.
    // For simplicity: We look at "Time Windows" where a variation was present.

    // Easier approach:
    // Identify distinct "Parent Lifts" (Squat, Bench, Deadlift).
    // Track their E1RM over time.
    // Identify which variations were performed in the weeks leading up to a PR or E1RM increase.

    // Robust approach matching request:
    // "Analyze every completed training block" -> We need Block definitions.
    // We will assume a "Block" is roughly 4 weeks for this engine if explicit blocks aren't linked.
    // BUT, we have Program ID in logs. If Program = Block, we use that.

    const blocks = {}; // { programId: { logs: [], primaryGains: {}, variations: Set() } }

    logs.forEach(log => {
        if (!blocks[log.programId]) {
            blocks[log.programId] = {
                id: log.programId,
                logs: [],
                variations: new Set(),
                earliestDate: new Date(log.date),
                latestDate: new Date(log.date)
            };
        }
        blocks[log.programId].logs.push(log);

        const date = new Date(log.date);
        if (date < blocks[log.programId].earliestDate) blocks[log.programId].earliestDate = date;
        if (date > blocks[log.programId].latestDate) blocks[log.programId].latestDate = date;

        log.exercises.forEach(ex => {
            const parent = getParentLift(ex.name);
            const isPrimary = ex.name === parent; // e.g. "Squat" === "Squat"
            if (!isPrimary) {
                blocks[log.programId].variations.add(ex.name);
            }
        });
    });

    // Calculate Gains per Block per Parent Lift
    const variationImpact = {}; // { VariationName: { totalGain: 0, count: 0, category: '' } }

    Object.values(blocks).forEach(block => {
        const liftMaxes = {}; // { Squat: { start: 0, end: 0 } }

        // Sort logs by date
        block.logs.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Find start and end E1RMS for primary lifts
        block.logs.forEach(log => {
            log.exercises.forEach(ex => {
                const parent = getParentLift(ex.name);
                if (ex.name === parent) { // Only track primary lift gains
                    const e1rms = ex.sets.map(s => calculateSimpleE1RM(parseFloat(s.weight), parseFloat(s.reps), parseFloat(s.rpe)));
                    const maxE1RM = Math.max(0, ...e1rms);

                    if (!liftMaxes[parent]) liftMaxes[parent] = { first: maxE1RM, last: maxE1RM };
                    liftMaxes[parent].last = maxE1RM; // Update last seen
                    // First seen is kept
                }
            });
        });

        // attribute gains to present variations
        block.variations.forEach(variation => {
            const parent = getParentLift(variation);
            if (liftMaxes[parent]) {
                const start = liftMaxes[parent].first;
                const end = liftMaxes[parent].last;
                if (start > 0) {
                    const pctGain = ((end - start) / start) * 100;

                    if (!variationImpact[variation]) {
                        variationImpact[variation] = {
                            totalGain: 0,
                            count: 0,
                            category: getExerciseCategory(variation),
                            parent: parent
                        };
                    }
                    variationImpact[variation].totalGain += pctGain;
                    variationImpact[variation].count += 1;
                }
            }
        });
    });

    // Format for UI
    return Object.entries(variationImpact).map(([name, data]) => ({
        name,
        avgGain: (data.totalGain / data.count).toFixed(2),
        count: data.count,
        category: data.category,
        parent: data.parent
    })).sort((a, b) => parseFloat(b.avgGain) - parseFloat(a.avgGain));
}


// Feature B: Central Balance Scatterplot
export function generateCentralBalanceData(logs) {
    // X: Central/Total Ratio (Avg for block)
    // Y: % E1RM Gain (Primary Lift)

    // Group by Program (Block)
    const blocks = {};

    logs.forEach(log => {
        if (!blocks[log.programId]) blocks[log.programId] = { logs: [], totalStress: 0, centralStress: 0 };
        blocks[log.programId].logs.push(log);
    });

    const dataPoints = [];

    Object.values(blocks).forEach(block => {
        // Calculate Stress Ratio
        block.logs.forEach(log => {
            log.exercises.forEach(ex => {
                ex.sets.forEach(s => {
                    const stress = calculateStress(parseFloat(s.reps), parseFloat(s.rpe));
                    block.totalStress += stress.total;
                    block.centralStress += stress.central;
                });
            });
        });

        const ratio = block.totalStress > 0 ? (block.centralStress / block.totalStress) : 0;

        // Calculate Gains (Aggregate of Squat/Bench/Deadlift)
        // Sort logs
        block.logs.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalGain = 0;
        let liftCount = 0;
        const liftStarts = {};
        const liftEnds = {};

        block.logs.forEach(log => {
            log.exercises.forEach(ex => {
                const parent = getParentLift(ex.name);
                if (["Squat", "Bench Press", "Deadlift"].includes(parent) && ex.name === parent) {
                    const e1rms = ex.sets.map(s => calculateSimpleE1RM(parseFloat(s.weight), parseFloat(s.reps), parseFloat(s.rpe)));
                    const max = Math.max(0, ...e1rms);
                    if (max > 0) {
                        if (!liftStarts[parent]) liftStarts[parent] = max;
                        liftEnds[parent] = max;
                    }
                }
            });
        });

        Object.keys(liftStarts).forEach(lift => {
            const start = liftStarts[lift];
            const end = liftEnds[lift];
            if (start > 0) {
                totalGain += ((end - start) / start) * 100;
                liftCount++;
            }
        });

        if (liftCount > 0) {
            dataPoints.push({
                x: parseFloat(ratio.toFixed(2)),
                y: parseFloat((totalGain / liftCount).toFixed(2)),
                label: `Block ${dataPoints.length + 1}` // Placeholder
            });
        }
    });

    return dataPoints;
}

// Feature C: Intensity Heatmap
export function generateIntensityHeatmap(logs) {
    // Grid: Reps (1-3, 4-6, 7-10, 10+) vs RPE (6-7, 7-8, 8-9, 9+)
    // Value: Avg E1RM Gain in blocks dominated by this cell?
    // Simplified: Just show Frequency or "Effectiveness" if we can attribute gain to specific sets.
    // Attribution is hard.
    // Let's go with Frequency for now as a base, or "Avg E1RM of sets in this zone" (unlikely useful).
    // Request: "Avg % E1RM Gain achieved in blocks where this Rep/RPE combination was the DOMINANT training stimulus."

    // 1. Identify Dominant Stimulus for each Block
    // 2. Correlate with Block Gain.

    const blocks = {};
    // ... grouping logic similar to above ...
    logs.forEach(log => {
        if (!blocks[log.programId]) blocks[log.programId] = { logs: [], buckets: {} };
        blocks[log.programId].logs.push(log);
    });

    const heatmapData = []; // flattened list for recharts scatter or custom grid

    Object.values(blocks).forEach(block => {
        // Find dominant bucket
        block.logs.forEach(log => {
            log.exercises.forEach(ex => {
                ex.sets.forEach(s => {
                    const reps = parseFloat(s.reps);
                    const rpe = parseFloat(s.rpe);
                    if (reps && rpe) {
                        // Bucket logic
                        let repBucket = "10+";
                        if (reps <= 3) repBucket = "1-3";
                        else if (reps <= 6) repBucket = "4-6";
                        else if (reps <= 10) repBucket = "7-10";

                        let rpeBucket = "9+";
                        if (rpe < 7) rpeBucket = "6-7"; // Assuming > 5
                        else if (rpe < 8) rpeBucket = "7-8";
                        else if (rpe < 9) rpeBucket = "8-9";

                        const key = `${repBucket}|${rpeBucket}`;
                        if (!block.buckets[key]) block.buckets[key] = 0;
                        block.buckets[key]++;
                    }
                });
            });
        });

        // Determine dominant
        let dominantKey = null;
        let maxCount = -1;
        Object.entries(block.buckets).forEach(([key, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantKey = key;
            }
        });

        // Calculate Gain (same logic as above)
        // ... (reuse gain calc) ...
        // Quick copy for prototype
        block.logs.sort((a, b) => new Date(a.date) - new Date(b.date));
        let totalGain = 0;
        let liftCount = 0;
        const liftStarts = {};
        const liftEnds = {};
        block.logs.forEach(log => {
            log.exercises.forEach(ex => {
                const parent = getParentLift(ex.name);
                if (["Squat", "Bench Press", "Deadlift"].includes(parent) && ex.name === parent) {
                    const e1rms = ex.sets.map(s => calculateSimpleE1RM(parseFloat(s.weight), parseFloat(s.reps), parseFloat(s.rpe)));
                    const max = Math.max(0, ...e1rms);
                    if (max > 0) {
                        if (!liftStarts[parent]) liftStarts[parent] = max;
                        liftEnds[parent] = max;
                    }
                }
            });
        });
        Object.keys(liftStarts).forEach(lift => {
            const start = liftStarts[lift];
            const end = liftEnds[lift];
            if (start > 0) {
                totalGain += ((end - start) / start) * 100;
                liftCount++;
            }
        });
        const avgGain = liftCount > 0 ? (totalGain / liftCount) : 0;

        if (dominantKey) {
            heatmapData.push({ key: dominantKey, gain: avgGain });
        }
    });

    // Aggregate Heatmap
    const aggregated = {};
    heatmapData.forEach(d => {
        if (!aggregated[d.key]) aggregated[d.key] = { total: 0, count: 0 };
        aggregated[d.key].total += d.gain;
        aggregated[d.key].count++;
    });

    return Object.entries(aggregated).map(([key, data]) => {
        const [reps, rpe] = key.split('|');
        return {
            reps,
            rpe,
            gain: (data.total / data.count).toFixed(2)
        };
    });
}

// Feature D: Primary Lift Progress
export function generatePrimaryLiftProgress(logs, timeRange) {
    // timeRange: '1m', '3m', '1y', 'all'
    
    // 1. Filter by Date
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === '1m') cutoff.setMonth(now.getMonth() - 1);
    if (timeRange === '3m') cutoff.setMonth(now.getMonth() - 3);
    if (timeRange === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    if (timeRange === 'all') cutoff.setFullYear(1900); // effectively all

    const filteredLogs = logs.filter(l => new Date(l.date) >= cutoff);

    // 2. Group by Parent Lift
    const progressData = {
        Squat: [],
        "Bench Press": [],
        Deadlift: []
    };

    filteredLogs.forEach(log => {
        const date = new Date(log.date).toLocaleDateString(); // Simple date key
        // Check for max E1RM per parent lift in this session
        const sessionMaxes = {};

        log.exercises.forEach(ex => {
            const parent = getParentLift(ex.name);
            if (progressData[parent]) { // Only track main 3
                const e1rms = ex.sets.map(s => calculateSimpleE1RM(parseFloat(s.weight), parseFloat(s.reps), parseFloat(s.rpe)));
                const max = Math.max(0, ...e1rms);
                if (max > 0) {
                     if (!sessionMaxes[parent] || max > sessionMaxes[parent]) {
                        sessionMaxes[parent] = max;
                     }
                }
            }
        });

        // Add to arrays
        Object.entries(sessionMaxes).forEach(([parent, max]) => {
            progressData[parent].push({
                date: log.date, // Keep ISO for sorting
                displayDate: date,
                value: max
            });
        });
    });

    // 3. Sort
    ['Squat', 'Bench Press', 'Deadlift'].forEach(lift => {
        progressData[lift].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return progressData;
}

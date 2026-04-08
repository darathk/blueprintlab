export function calculateE1RM(weight, reps, rpe) {
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    if (!w || !r) return 0;
    
    const rpeValue = parseFloat(rpe) || 10;

    // Adjusted formula: weight * (36 / (37 - (reps + (10 - rpe))))
    const denom = 37 - (r + (10 - rpeValue));

    if (denom <= 0) return w; // Fallback to weight if calc fails (unlikely in normal range)

    return w * (36 / denom);
}

export function processLogsForAnalytics(logs, exerciseName) {
    // Filter logs for specific exercise
    // Flatten to sets

    const relevantSets = [];

    logs.forEach(log => {
        // Check if session contains the exercise
        // Note: log.exercises is an array of composed objects
        const exLog = log.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
        if (exLog) {
            // Find best set (highest E1RM) for the day? Or average? 
            // Usually max effort set is best indicator.
            let maxE1RM = 0;
            let bestSet = null;

            exLog.sets.forEach(set => {
                const e1rm = calculateE1RM(parseFloat(set.weight), parseFloat(set.reps), parseFloat(set.rpe));
                if (e1rm > maxE1RM) {
                    maxE1RM = e1rm;
                    bestSet = set;
                }
            });

            if (bestSet) {
                relevantSets.push({
                    date: log.date,
                    e1rm: maxE1RM,
                    weight: bestSet.weight,
                    reps: bestSet.reps,
                    rpe: bestSet.rpe
                });
            }
        }
    });

    return relevantSets.sort((a, b) => new Date(a.date) - new Date(b.date));
}

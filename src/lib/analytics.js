export function calculateE1RM(weight, reps, rpe) {
    // RTS / Mike Tuchscherer Formula approximation
    // This is generally more accurate for RPE-based training than Epley
    const w = parseFloat(weight);
    const r = parseFloat(reps);

    if (!w || !r || !rpe) return 0;
    const rpeValue = parseFloat(rpe);

    // Prevent division by zero or negative numbers for extreme inputs
    // Formula: 100 * weight / (102.78 - 2.78 * (reps + (10 - rpe)))
    const denom = 102.78 - (2.78 * (r + (10 - rpeValue)));

    if (denom <= 0) return w; // Fallback to weight if calc fails (unlikely in normal range)

    return (100 * w) / denom;
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

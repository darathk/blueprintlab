
const fs = require("fs");
const logs = JSON.parse(fs.readFileSync("data/logs.json", "utf8"));

// Inline Epley Formula
function calculateE1RM(weight, reps, rpe) {
    if (!weight || !reps) return 0;
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    const rp = parseFloat(rpe) || 10;
    return Math.round(w * (1 + (r + (10 - rp)) / 30));
}

const PROGRAM_ID = "ped57ovmk"; // Untitled Program
const PROGRAM_NAME = "Untitled Program";
const START_DATE = new Date("2026-01-26");
const END_DATE = new Date("2026-03-16");

// Relaxed Filtering: ID Match OR (No ID AND Name Match)
const relevantLogs = logs.filter(l => {
    const d = new Date(l.date);
    const inRange = d >= START_DATE && d <= END_DATE;
    const idMatch = l.programId === PROGRAM_ID;
    const nameMatch = !l.programId && l.programName === PROGRAM_NAME;
    return inRange && (idMatch || nameMatch);
});

console.log(`Found ${relevantLogs.length} relevant logs with relaxed filtering.`);

// Calculate Peak and End E1RM for Deadlift
let peakE1RM = 0;
const dailyMaxes = [];

relevantLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

relevantLogs.forEach(l => {
    let dailyMax = 0;
    l.exercises.forEach(e => {
        if (e.name === "Competition Deadlift" || e.name === "Deadlift") {
            e.sets.forEach(s => {
                const e1rm = calculateE1RM(s.weight, s.reps, s.rpe);
                if (e1rm > peakE1RM) peakE1RM = e1rm;
                if (e1rm > dailyMax) dailyMax = e1rm;
            });
        }
    });
    if (dailyMax > 0) dailyMaxes.push({ date: l.date, e1rm: dailyMax });
});

const endE1RM = dailyMaxes.length > 0 ? dailyMaxes[dailyMaxes.length - 1].e1rm : 0;

console.log(`Peak E1RM: ${peakE1RM}`);
console.log(`End E1RM: ${endE1RM}`);
console.log(`Data Points: ${dailyMaxes.length}`);

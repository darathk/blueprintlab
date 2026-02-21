'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import CompetitionLiftHeatMap from './CompetitionLiftHeatMap';
import BlockAnalysisTable from './BlockAnalysisTable';
import AssistCorrelationTable from './AssistCorrelationTable';
import { calculateSimpleE1RM } from '@/lib/stress-index';
import { getExerciseCategory, EXERCISE_CATEGORIES } from '@/lib/exercise-db'; // Import Helper

export default function MetaBlockReview({ programs, logs, reportParams }) {
    const params = useParams();
    const [primaryLift, setPrimaryLift] = useState('Squat'); // Squat, Bench, Deadlift

    // Helper to check if string contains primary lift or exercise is marked primary
    const isPrimary = (exercise, type) => {
        if (!exercise) return false;
        // Check if exercise object has isPrimary flag
        if (exercise.isPrimary) return true;
        // Fallback to name check (Strict Match)
        return exercise.name === `Competition ${type}`;
    };

    // Define relevant categories for each lift
    const RELEVANT_CATEGORIES = useMemo(() => ({
        'Squat': [EXERCISE_CATEGORIES.KNEE, EXERCISE_CATEGORIES.HIP, EXERCISE_CATEGORIES.ISOLATION_LOWER],
        'Bench': [EXERCISE_CATEGORIES.PUSH_HORIZONTAL, EXERCISE_CATEGORIES.PUSH_VERTICAL, EXERCISE_CATEGORIES.ISOLATION_UPPER],
        'Deadlift': [EXERCISE_CATEGORIES.HIP, EXERCISE_CATEGORIES.KNEE, EXERCISE_CATEGORIES.ISOLATION_LOWER]
    }), []); // Dependencies? Empty is fine as constants.

    // 1. Process Data
    const analysisData = useMemo(() => {
        if (!programs || programs.length === 0) return { blocks: [], assistMap: [] };

        const blockStats = [];
        const assistMap = {};

        // Filter programs based on reportParams.programIds
        const selectedPrograms = programs.filter(p =>
            reportParams.programIds.length === 0 || reportParams.programIds.includes(p.id)
        );

        selectedPrograms.forEach(prog => {
            // Filter logs for this specific program (block)
            // Handle legacy logs: Use ID match if available, fallback to Name match if log has no ID
            // ALSO: Include logs that fall strictly within the block's date range, to catch concurrent/overlapping programs
            const startDate = new Date(prog.startDate);
            const endDate = prog.endDate ? new Date(prog.endDate) : new Date();

            const progLogs = logs.filter(l => {
                const logDate = new Date(l.date);
                let isMatch = false;
                if (l.programId) {
                    isMatch = l.programId === prog.id;
                } else if (l.programName) {
                    isMatch = l.programName === prog.name;
                } else {
                    isMatch = (logDate >= startDate && logDate <= endDate);
                }

                return isMatch && l.exercises.some(e =>
                    e.name === `Competition ${primaryLift}` ||
                    isPrimary(e, primaryLift)
                );
            });
            progLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // --- Calculate Primary Lift Stats for this Block ---
            // 1. Filter and Flatten to all relevant sets
            const relevantSets = [];
            progLogs.forEach(s => {
                s.exercises.forEach(e => {
                    // STRICT Filtering: Must match "Competition [Lift]" exactly
                    // User requested specific IDs: 'Competition Squat', 'Competition Bench', 'Competition Deadlift'
                    if (e.name === `Competition ${primaryLift}`) {
                        e.sets.forEach(set => {
                            relevantSets.push({
                                date: s.date,
                                rawDate: new Date(s.date),
                                weight: parseFloat(set.weight || 0),
                                reps: parseFloat(set.reps || 1),
                                rpe: set.rpe ? parseFloat(set.rpe) : null
                            });
                        });
                    }
                });
            });

            console.log(`Program ${prog.id} (${prog.name}): Found ${relevantSets.length} sets for ${primaryLift}`);

            // 2. Aggregate by Date (Max E1RM per day)
            const dailyMaxMap = new Map(); // DateString -> { date, e1rm, ... }

            relevantSets.forEach(set => {
                if (set.weight > 0) {
                    const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe);
                    const dateKey = set.rawDate.toLocaleDateString();

                    const currentMax = dailyMaxMap.get(dateKey);
                    if (!currentMax || e1rm > currentMax.e1rm) {
                        dailyMaxMap.set(dateKey, {
                            date: set.date,
                            e1rm: e1rm,
                            sets: [set] // Keep strict structure for downstream?
                        });
                    }
                }
            });

            // 3. Convert back to array
            const liftLogs = Array.from(dailyMaxMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let startE1RM = 0;
            let endE1RM = 0;
            let peakE1RM = 0;
            let gain = 0;

            if (relevantSets.length > 0) {
                // Calculate Peak E1RM from ALL sets (not just daily maxes)
                const allSetE1RMs = relevantSets
                    .filter(s => s.rpe) // only sets with RPE
                    .map(s => calculateSimpleE1RM(s.weight, s.reps, s.rpe))
                    .filter(v => v > 0);

                if (allSetE1RMs.length > 0) {
                    peakE1RM = Math.max(...allSetE1RMs);
                    peakE1RM = parseFloat(peakE1RM.toFixed(1));

                    // Telemetry Logic: Start = First Set, End = Last Set (to show arc/fatigue)
                    // Ensure sets are strictly sorted by time
                    relevantSets.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

                    const setsWithRPE = relevantSets.filter(s => s.rpe);
                    if (setsWithRPE.length > 0) {
                        const firstSet = setsWithRPE[0];
                        const lastSet = setsWithRPE[setsWithRPE.length - 1];

                        startE1RM = calculateSimpleE1RM(firstSet.weight, firstSet.reps, firstSet.rpe);
                        endE1RM = calculateSimpleE1RM(lastSet.weight, lastSet.reps, lastSet.rpe);

                        startE1RM = parseFloat(startE1RM.toFixed(1));
                        endE1RM = parseFloat(endE1RM.toFixed(1));

                        gain = parseFloat((endE1RM - startE1RM).toFixed(1));
                    }
                }
            }

            const blockStat = {
                id: prog.id,
                startDate: prog.startDate,
                endDate: prog.endDate || 'Ongoing',
                name: prog.name,
                startE1RM,
                endE1RM,
                peakE1RM,
                gain,
                csBalance: '0%'
            };
            blockStats.push(blockStat);

            // --- Correlation Analysis ---
            // Find all OTHER exercises in this program
            const otherExercises = {};
            const allowedCategories = RELEVANT_CATEGORIES[primaryLift] || [];

            progLogs.forEach(s => {
                s.exercises.forEach(e => {
                    if (!isPrimary(e, primaryLift)) {
                        // Check Category
                        const cat = getExerciseCategory(e.name);
                        // If category is allowed, OR fallbacks for simple logic?
                        // Strict filtering based on user request "dont include knee for bench"
                        if (allowedCategories.includes(cat)) {
                            if (!otherExercises[e.name]) otherExercises[e.name] = 0;
                            otherExercises[e.name] += e.sets.length;
                        }
                    }
                });
            });


            // Add to Assist Map
            Object.keys(otherExercises).forEach(exName => {
                if (!assistMap[exName]) {
                    assistMap[exName] = { name: exName, blocks: [], totalGain: 0, count: 0 };
                }
                assistMap[exName].blocks.push({
                    endDate: prog.endDate || 'Ongoing',
                    endE1RM,
                    peakE1RM,
                    gain,
                    sets: otherExercises[exName]
                });
                assistMap[exName].totalGain += gain;
                assistMap[exName].count += 1;
            });
        });

        // Convert Assist Map to Array and Sort by Avg Gain
        const assistArray = Object.values(assistMap).map((item: any) => ({
            ...item,
            avgGain: (item.totalGain / item.count).toFixed(1)
        })).sort((a: any, b: any) => b.avgGain - a.avgGain);

        return { blocks: blockStats, assistData: assistArray };

    }, [programs, logs, reportParams, primaryLift]);

    return (
        <div>
            {/* Header / Config */}
            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                    <span className="neon-text">///</span> METABLOCK ANALYTICS
                </h3>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                    {['Squat', 'Bench', 'Deadlift'].map(lift => {
                        let activeColor = 'var(--primary)';
                        if (lift === 'Bench') activeColor = 'var(--accent)';
                        if (lift === 'Deadlift') activeColor = '#f472b6'; // Pink

                        return (
                            <button
                                key={lift}
                                onClick={() => setPrimaryLift(lift)}
                                style={{
                                    padding: '0.75rem 2.5rem',
                                    background: primaryLift === lift ? activeColor : 'transparent',
                                    color: primaryLift === lift ? 'black' : 'var(--secondary-foreground)',
                                    border: primaryLift === lift ? `1px solid ${activeColor}` : '1px solid var(--card-border)',
                                    borderRadius: '30px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    transition: 'all 0.2s',
                                    boxShadow: primaryLift === lift ? `0 0 20px ${activeColor}66` : 'none'
                                }}
                            >
                                {lift}
                            </button>
                        );
                    })}
                </div>
            </div>

            <CompetitionLiftHeatMap
                blocks={analysisData.blocks}
                logs={logs}
                primaryLift={primaryLift}
            />

            <BlockAnalysisTable blocks={analysisData.blocks} athleteId={params.id} />
            <AssistCorrelationTable assistData={analysisData.assistData} primaryLift={primaryLift} />
        </div>
    );
}

'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import CompetitionLiftHeatMap from './CompetitionLiftHeatMap';
import BlockAnalysisTable from './BlockAnalysisTable';
import AssistCorrelationTable from './AssistCorrelationTable';
import { calculateSimpleE1RM } from '@/lib/stress-index';
import { getExerciseCategory, EXERCISE_CATEGORIES } from '@/lib/exercise-db'; // Import Helper
import BlockImprovements from '@/components/analytics/BlockImprovements';
import CompStats from '@/components/analytics/CompStats';
import LiftDensity from '@/components/analytics/LiftDensity';

export default function MetaBlockReview({ programs, logs, reportParams }) {
    const params = useParams();
    const [primaryLift, setPrimaryLift] = useState('Squat'); // Squat, Bench, Deadlift
    const [viewingBlockId, setViewingBlockId] = useState(null);

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

        const params = reportParams?.parameters || reportParams;

        // Filter programs based on reportParams.programIds
        const selectedPrograms = programs.filter(p =>
            !params?.programIds || params.programIds.length === 0 || params.programIds.includes(p.id)
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

            // 2. Aggregate by Date (Max E1RM per day)
            const dailyMaxMap = new Map(); // DateString -> { date, e1rm, ... }

            relevantSets.forEach(set => {
                if (set.weight > 0) {
                    const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe, set.unit);
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

            if (liftLogs.length > 0) {
                // Calculate Peak E1RM from ALL sets (not just daily maxes)
                const allSetE1RMs = relevantSets
                    .filter(s => s.rpe) // only sets with RPE
                    .map(s => calculateSimpleE1RM(s.weight, s.reps, s.rpe, s.unit))
                    .filter(v => v > 0);

                if (allSetE1RMs.length > 0) {
                    peakE1RM = Math.max(...allSetE1RMs);
                    peakE1RM = parseFloat(peakE1RM.toFixed(1));

                    // Telemetry Logic: Start = First Session Max, End = Last Session Max
                    // This aligns with the Single Block Review (CompStats) which compares the daily top sets
                    const firstDay = liftLogs[0];
                    const lastDay = liftLogs[liftLogs.length - 1];

                    startE1RM = parseFloat(firstDay.e1rm.toFixed(1));
                    endE1RM = parseFloat(lastDay.e1rm.toFixed(1));

                    gain = parseFloat((endE1RM - startE1RM).toFixed(1));
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
                        const cat = e.category || getExerciseCategory(e.name);
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

    if (viewingBlockId) {
        const program = programs.find(p => p.id === viewingBlockId);
        const filteredLogs = logs.filter(l => l.programId === viewingBlockId);

        return (
            <div style={{ padding: '0.5rem', animation: 'fadeIn 0.3s' }}>
                <button
                    onClick={() => setViewingBlockId(null)}
                    className="glass-button chat-press"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '1.5rem',
                        fontSize: '0.85rem',
                        padding: '6px 14px',
                        borderRadius: '16px'
                    }}
                >
                    ← Back to Meta Block Review
                </button>
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--foreground)' }}>
                        Block Review: <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(125, 135, 210, 0.35)' }}>{program?.name}</span>
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginTop: '0.4rem' }}>
                        {program?.startDate && new Date(program.startDate).toLocaleDateString()} - {program?.endDate ? new Date(program.endDate).toLocaleDateString() : 'Ongoing'}
                    </div>
                </div>
                
                <BlockImprovements logs={filteredLogs} dateRange="all" programs={[program]} />
                <CompStats logs={filteredLogs} programs={[program]} />
                <LiftDensity logs={filteredLogs} />
            </div>
        );
    }

    return (
        <div>
            {/* Header / Config */}
            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2rem 1.5rem', textAlign: 'center', borderRadius: 20 }}>
                <h3 style={{ marginBottom: '1.25rem', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
                    METABLOCK <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(125, 135, 210, 0.4)' }}>ANALYTICS</span>
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['Squat', 'Bench', 'Deadlift'].map(lift => {
                        const isSelected = primaryLift === lift;

                        return (
                            <button
                                key={lift}
                                onClick={() => setPrimaryLift(lift)}
                                className="chat-press"
                                style={{
                                    padding: '0.65rem 2.25rem',
                                    background: isSelected ? 'rgba(125, 135, 210, 0.22)' : 'var(--glass-surface-2)',
                                    color: isSelected ? '#ffffff' : 'var(--secondary-foreground)',
                                    border: isSelected ? '1px solid rgba(125, 135, 210, 0.5)' : '1px solid var(--glass-border)',
                                    borderRadius: '24px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    transition: 'all 0.16s var(--ease-out)',
                                    boxShadow: isSelected ? '0 0 16px rgba(125, 135, 210, 0.3)' : 'none'
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

            <BlockAnalysisTable blocks={analysisData.blocks} athleteId={params.id} onSelectBlock={setViewingBlockId} />
            <AssistCorrelationTable assistData={analysisData.assistData} primaryLift={primaryLift} />
        </div>
    );
}

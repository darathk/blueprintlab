'use client';

import { useState, useMemo } from 'react';
import { calculateStress } from '@/lib/stress-index';
import { getExerciseCategory, getParentLift } from '@/lib/exercise-db';

function resolveCategory(ex: any, exerciseDB?: Record<string, any>): string {
    // 1. Check the exercise DB (includes custom exercises with user-chosen categories)
    if (exerciseDB && ex.name && exerciseDB[ex.name]?.category) {
        return exerciseDB[ex.name].category;
    }
    // 2. Fall back to stored category on the exercise object
    if (ex.category) return ex.category;
    // 3. Last resort: heuristic
    return getExerciseCategory(ex.name || '');
}

function computeStress(weeks: any[], exerciseDB?: Record<string, any>) {
    const categories = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];
    const stats: Record<string, { central: number; total: number }> = {};
    categories.forEach(c => stats[c] = { central: 0, total: 0 });

    weeks.forEach(week => {
        week.sessions.forEach(session => {
            session.exercises.forEach(ex => {
                const setsList = Array.isArray(ex.sets) ? ex.sets : [];
                const simpleSets = !Array.isArray(ex.sets) ? (parseFloat(ex.sets) || 0) : 0;

                const category = resolveCategory(ex, exerciseDB);

                const processSet = (repsVal: any, rpeVal: any, multiplier = 1) => {
                    let reps = 0;
                    if (typeof repsVal === 'string' && repsVal.includes('-')) {
                        const [min, max] = repsVal.split('-').map(Number);
                        reps = (min + max) / 2;
                    } else {
                        reps = parseFloat(repsVal) || 0;
                    }
                    const rpe = parseFloat(rpeVal) || 0;

                    if (reps > 0 && rpe > 0) {
                        const { total, central } = calculateStress(reps, rpe);

                        if (stats[category]) {
                            stats[category].total += total * multiplier;
                            stats[category].central += central * multiplier;
                        }
                    }
                };

                if (setsList.length > 0) {
                    setsList.forEach(s => processSet(s.reps, s.rpe));
                } else if (simpleSets > 0) {
                    processSet(ex.reps, ex.rpeTarget, simpleSets);
                }
            });
        });
    });

    const totalStress = Object.values(stats).reduce((sum, v) => sum + v.total, 0);
    const totalCentral = Object.values(stats).reduce((sum, v) => sum + v.central, 0);

    return { stats, totalStress, totalCentral };
}

const CATEGORIES = ['Knee', 'Hip', 'Horizontal Push', 'Vertical Push'];
const CAT_SHORT: Record<string, string> = {
    'Knee': 'Knee',
    'Hip': 'Hip',
    'Horizontal Push': 'Push-H',
    'Vertical Push': 'Push-V',
};

// Map lift target names (e.g. "Squat", "Bench", "Deadlift") to stress categories
function liftTargetsByCategory(liftTargets?: Record<string, { timeToPeak: string; stressTarget: string }>): Record<string, number> {
    if (!liftTargets) return {};
    const result: Record<string, number> = {};
    Object.entries(liftTargets).forEach(([lift, { stressTarget }]) => {
        const target = parseFloat(stressTarget);
        if (!target || isNaN(target)) return;
        const category = getExerciseCategory(lift);
        if (category && CATEGORIES.includes(category)) {
            result[category] = (result[category] || 0) + target;
        }
    });
    return result;
}

function WeekStressTable({ label, stats, totalStress, totalCentral, isCollapsed, onToggle, categoryTargets }: {
    label: string;
    stats: Record<string, { central: number; total: number }>;
    totalStress: number;
    totalCentral: number;
    isCollapsed: boolean;
    onToggle: () => void;
    categoryTargets?: Record<string, number>;
}) {
    const csBalance = totalStress > 0 ? (totalCentral / totalStress) : 0;
    const totalTarget = categoryTargets ? Object.values(categoryTargets).reduce((s, v) => s + v, 0) : 0;

    return (
        <div style={{ marginBottom: '0.25rem' }}>
            {/* Week header — clickable toggle */}
            <div
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background 0.15s',
                    userSelect: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                <span style={{
                    fontSize: '0.55rem',
                    color: 'var(--secondary-foreground)',
                    transition: 'transform 0.2s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    lineHeight: 1,
                }}>
                    ▼
                </span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--primary)',
                }}>
                    {label}
                </span>
                {/* Summary when collapsed */}
                {isCollapsed && totalStress > 0 && (
                    <span style={{
                        fontSize: '0.6rem',
                        color: 'var(--secondary-foreground)',
                        marginLeft: 'auto',
                    }}>
                        {totalStress.toFixed(1)}
                    </span>
                )}
            </div>

            {/* Table content */}
            {!isCollapsed && (
                <div style={{ padding: '0 0.5rem 0.35rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '2px 3px', color: 'var(--secondary-foreground)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.6rem' }}></th>
                                {CATEGORIES.map(c => (
                                    <th key={c} style={{ textAlign: 'center', padding: '2px 1px', color: 'var(--secondary-foreground)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.6rem' }}>
                                        {CAT_SHORT[c]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '3px 3px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                                    Total <span style={{ color: 'var(--secondary-foreground)', fontWeight: 400, fontSize: '0.6rem' }}>{totalStress.toFixed(1)}{totalTarget > 0 && <span style={{ color: 'var(--accent)', opacity: 0.6 }}>/{totalTarget}</span>}</span>
                                </td>
                                {CATEGORIES.map(c => {
                                    const target = categoryTargets?.[c];
                                    const val = stats[c].total;
                                    const overTarget = target && val > target;
                                    const atTarget = target && val >= target * 0.9 && val <= target;
                                    return (
                                        <td key={c} style={{ textAlign: 'center', padding: '3px 1px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 600, color: overTarget ? '#f87171' : atTarget ? '#34d399' : val > 0 ? 'var(--foreground)' : undefined }}>
                                            {val > 0 ? val.toFixed(1) : <span style={{ opacity: 0.2 }}>{target ? '0' : '-'}</span>}
                                            {target ? <span style={{ fontWeight: 400, fontSize: '0.55rem', color: 'var(--secondary-foreground)', opacity: 0.5 }}>/{target}</span> : null}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 3px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                                    Central <span style={{ color: 'var(--secondary-foreground)', fontWeight: 400, fontSize: '0.6rem' }}>{totalCentral.toFixed(1)}</span>
                                </td>
                                {CATEGORIES.map(c => (
                                    <td key={c} style={{ textAlign: 'center', padding: '3px 1px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        {stats[c].central > 0 ? stats[c].central.toFixed(1) : <span style={{ opacity: 0.2 }}>-</span>}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 3px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    CS Bal <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.6rem' }}>{csBalance.toFixed(2)}</span>
                                </td>
                                {CATEGORIES.map(c => {
                                    const val = stats[c].total > 0 ? (stats[c].central / stats[c].total) : 0;
                                    return (
                                        <td key={c} style={{ textAlign: 'center', padding: '3px 1px', opacity: val > 0 ? 1 : 0.2 }}>
                                            {val > 0 ? val.toFixed(2) : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/**
 * Get the Sunday that starts the calendar week containing the given date.
 * The calendar grid uses Sun-Sat rows, so stress buckets must align.
 */
function getSunday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // getDay() 0=Sun, so subtract to reach Sunday
    return d;
}

/**
 * Group sessions by actual calendar week (Sun-Sat) so that sessions
 * appearing in the same visual calendar row share the same stress bucket,
 * even if they belong to different structural program weeks.
 */
function groupByCalendarWeek(weeks: any[], startDate: string) {
    // Parse start date as local time
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    start.setHours(0, 0, 0, 0);

    // Anchor to the Sunday of the week containing startDate
    const anchor = getSunday(start);

    const buckets: Record<number, any[]> = {};

    weeks.forEach(week => {
        week.sessions.forEach((session: any) => {
            // Compute actual date: start + (weekNumber-1)*7 + (day-1) days
            const absDay = (week.weekNumber - 1) * 7 + ((session.day || 1) - 1);
            const sessionDate = new Date(start);
            sessionDate.setDate(sessionDate.getDate() + absDay);

            // Calendar week = how many 7-day intervals from the anchor Sunday
            const diffMs = sessionDate.getTime() - anchor.getTime();
            const calWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

            if (!buckets[calWeek]) buckets[calWeek] = [];
            buckets[calWeek].push(session);
        });
    });

    // Convert buckets into week-like objects
    return Object.entries(buckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([weekNum, sessions]) => ({
            weekNumber: Number(weekNum),
            sessions,
        }));
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekDateRange(weekNumber: number, startDate?: string): string {
    if (!startDate) return `Week ${weekNumber}`;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    start.setHours(0, 0, 0, 0);
    // Anchor to the Sunday of the week containing startDate
    const anchor = getSunday(start);
    const weekStart = new Date(anchor);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const fmt = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

/** Sidebar stress panel — shows stress index for each week */
export default function StressMatrix({ weeks, startDate, liftTargets, exerciseDB }: { weeks: any[]; startDate?: string; liftTargets?: Record<string, { timeToPeak: string; stressTarget: string }>; exerciseDB?: Record<string, any> }) {
    const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>({});

    const categoryTargets = useMemo(() => liftTargetsByCategory(liftTargets), [liftTargets]);

    const weekData = useMemo(() => {
        // If startDate is available, group by actual calendar week
        const effectiveWeeks = startDate ? groupByCalendarWeek(weeks, startDate) : weeks;
        return effectiveWeeks.map(week => {
            const { stats, totalStress, totalCentral } = computeStress([week], exerciseDB);
            return { weekNumber: week.weekNumber, stats, totalStress, totalCentral };
        });
    }, [weeks, startDate, exerciseDB]);

    const toggleWeek = (weekNumber: number) => {
        setCollapsedWeeks(prev => ({ ...prev, [weekNumber]: !prev[weekNumber] }));
    };

    if (weeks.length === 0) {
        return (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.7rem' }}>
                Add exercises to see stress index
            </div>
        );
    }

    return (
        <div style={{ padding: '0.25rem 0' }}>
            {weekData.map(wd => (
                <WeekStressTable
                    key={wd.weekNumber}
                    label={weekDateRange(wd.weekNumber, startDate)}
                    stats={wd.stats}
                    totalStress={wd.totalStress}
                    totalCentral={wd.totalCentral}
                    isCollapsed={!!collapsedWeeks[wd.weekNumber]}
                    onToggle={() => toggleWeek(wd.weekNumber)}
                    categoryTargets={categoryTargets}
                />
            ))}
        </div>
    );
}

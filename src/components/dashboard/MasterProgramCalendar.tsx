'use client';

import { useState, useMemo } from 'react';

// Parse "YYYY-MM-DD" as LOCAL date, not UTC.
// new Date("2026-02-25") is parsed as UTC midnight, which in EST becomes Feb 24 7pm — shifting dates by 1 day.
// This function avoids that trap entirely.
function parseLocalDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    // Fallback: if it's already a full ISO string with time, it's fine
    return new Date(dateStr);
}

export default function MasterProgramCalendar({ programs, athleteId, currentProgramId, onSelectSession, logs = [] }: { programs: any[], athleteId?: string, currentProgramId: string, onSelectSession: any, logs?: any[] }) {
    // Default to current month
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Filter programs for this athlete if athleteId is provided
    const athletePrograms = useMemo(() => {
        if (!athleteId) return programs;
        // Strict filtering: Only show programs assigned effectively to this athlete
        const filtered = programs.filter(p => p.athleteId === athleteId);

        // Prioritize current program
        if (currentProgramId) {
            return filtered.sort((a, b) => {
                if (a.id === currentProgramId) return -1;
                if (b.id === currentProgramId) return 1;
                return 0; // Keep original order for others (or sort by date?)
            });
        }

        // If no current program, maybe sort by start date descending (newest on top)?
        // This helps if there are overlaps, we probably want the newest assignment.
        return filtered.sort((a, b) => parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime());
    }, [programs, athleteId, currentProgramId]);

    const nextMonth = () => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + 1);
        setCurrentMonth(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentMonth);
        prev.setMonth(prev.getMonth() - 1);
        setCurrentMonth(prev);
    };

    // Helper to find program and session for a specific date
    const getProgramDataForDate = (date) => {
        // Iterate through all programs to find one that covers this date
        // Reverse order to prioritize newer programs if overlap? Or just first found.
        for (const prog of athletePrograms) {
            if (!prog.startDate) continue;

            const start = parseLocalDate(prog.startDate);
            // End date might be explicit or calculated
            let end;
            if (prog.endDate) {
                end = parseLocalDate(prog.endDate);
            } else {
                // Calculate from weeks
                const totalWeeks = prog.weeks?.length || 0;
                end = new Date(start);
                end.setDate(end.getDate() + (totalWeeks * 7));
            }

            // Normalize time for comparison
            const d = new Date(date); d.setHours(0, 0, 0, 0);
            const s = new Date(start); s.setHours(0, 0, 0, 0);
            const e = new Date(end); e.setHours(0, 0, 0, 0);

            if (d >= s && d < e) { // End date is usually exclusive or inclusive? Let's say exclusive of the start of next program, but inclusive of training days.
                // Calculate week and day
                const diffTime = d.getTime() - s.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const weekNum = Math.floor(diffDays / 7) + 1;
                const dayNum = (diffDays % 7) + 1;

                const week = prog.weeks.find(w => w.weekNumber === weekNum);
                const session = week?.sessions.find(s => s.day === dayNum);

                return {
                    program: prog,
                    weekNum,
                    dayNum,
                    session
                };
            }
        }
        return null;
    };

    // Generate grid
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0Sun - 6Sat
        const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon start
        const gridStart = new Date(firstDayOfMonth);
        gridStart.setDate(gridStart.getDate() - offset);

        const days = [];
        for (let i = 0; i < 42; i++) {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            const data = getProgramDataForDate(date);

            days.push({
                date,
                dateStr,
                isCurrentMonth: date.getMonth() === month,
                ...data
            });
        }
        return days;
    }, [currentMonth, athletePrograms]);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <button onClick={prevMonth} className="btn-icon">←</button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="btn-icon">→</button>
            </div>

            <div style={{ overflowX: 'hidden' }}>
                <div style={{ minWidth: '100%', width: '100%' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 0', borderBottom: '1px solid var(--card-border)' }}>
                        {weekDays.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase' }}>{d}</div>)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' }}>
                        {calendarDays.map((day, i) => (
                            <div
                                key={day.dateStr}
                                onClick={() => day.program && day.session && day.session.exercises?.length > 0 && onSelectSession && onSelectSession(day.program, day.weekNum, day.dayNum)}
                                style={{
                                    minHeight: '110px',
                                    padding: '0.5rem',
                                    borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--card-border)',
                                    borderBottom: '1px solid var(--card-border)',
                                    background: day.isCurrentMonth ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.3)',
                                    cursor: (day.program && day.session && day.session.exercises?.length > 0) ? 'pointer' : 'default',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                }}
                                className={day.program ? 'calendar-day-active' : ''}
                            >
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: day.isCurrentMonth ? 'var(--foreground)' : 'var(--muted)',
                                    marginBottom: '0.5rem',
                                    fontWeight: day.isCurrentMonth ? 500 : 400
                                }}>
                                    {day.date.getDate()}
                                </div>

                                {day.program && day.session && day.session.exercises && day.session.exercises.length > 0 && (
                                    <div style={{
                                        background: 'var(--secondary)',
                                        borderLeft: '3px solid var(--primary)',
                                        padding: '6px',
                                        borderRadius: '0 6px 6px 0',
                                        fontSize: '0.75rem',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}>
                                        <div style={{ fontWeight: 600, color: 'var(--primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                            {day.program.name}
                                        </div>
                                        <div style={{ marginTop: '2px' }}>
                                            <div style={{ color: 'var(--primary)', fontWeight: 500 }}>{day.session.name}</div>
                                            <div style={{ opacity: 0.7, fontSize: '0.7rem' }}>{day.session.exercises.length} Exercises</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style jsx>{`
                .btn-icon {
                    background: transparent;
                    border: none;
                    color: var(--foreground);
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0.5rem;
                    transition: color 0.2s;
                }
                .btn-icon:hover {
                    color: var(--primary);
                    text-shadow: 0 0 8px var(--primary);
                }
                .calendar-day-active:hover {
                    background: rgba(255,255,255,0.03) !important;
                }
            `}</style>
        </div>
    );
}

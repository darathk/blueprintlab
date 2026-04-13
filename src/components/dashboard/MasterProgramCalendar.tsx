'use client';

import { useState, useMemo } from 'react';

// Parse "YYYY-MM-DD" as LOCAL date, not UTC.
function parseLocalDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
}

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MasterProgramCalendar({ 
    programs, 
    athleteId, 
    currentProgramId, 
    onSelectSession, 
    onToggleTravel,
    logs = [],
    travelDates = [],
    nextMeetDate = null
}: { 
    programs: any[], 
    athleteId?: string | null, 
    currentProgramId?: string | null, 
    onSelectSession: any, 
    onToggleTravel?: (date: string) => void,
    logs?: any[],
    travelDates?: string[],
    nextMeetDate?: string | null
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Filter programs for this athlete if athleteId is provided
    const athletePrograms = useMemo(() => {
        if (!athleteId) return programs;
        const filtered = programs.filter(p => p.athleteId === athleteId);

        // Prioritize current/active program first, then by start date descending
        return filtered.sort((a, b) => {
            if (a.id === currentProgramId) return -1;
            if (b.id === currentProgramId) return 1;
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (b.status === 'active' && a.status !== 'active') return 1;
            return parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime();
        });
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
    // Iterates all programs; only returns a match when the date falls within
    // the program range AND a session with exercises exists on that day.
    // This prevents an overlapping program (with no session on that day)
    // from blocking a newer program that does have a session.
    const getProgramDataForDate = (date: Date) => {
        for (const prog of athletePrograms) {
            if (!prog.startDate) continue;

            const start = parseLocalDate(prog.startDate);
            let end;
            if (prog.endDate) {
                end = parseLocalDate(prog.endDate);
            } else {
                const totalWeeks = prog.weeks?.length || 0;
                end = new Date(start);
                end.setDate(end.getDate() + (totalWeeks * 7));
            }

            const d = new Date(date); d.setHours(0, 0, 0, 0);
            const s = new Date(start); s.setHours(0, 0, 0, 0);
            const e = new Date(end); e.setHours(0, 0, 0, 0);

            if (d >= s && d < e) {
                const diffTime = d.getTime() - s.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const weekNum = Math.floor(diffDays / 7) + 1;
                const dayNum = (diffDays % 7) + 1;

                const week = prog.weeks.find((w: any) => w.weekNumber === weekNum);
                const session = week?.sessions.find((s: any) => s.day === dayNum);

                // Only return if there's an actual session with exercises on this day.
                // Otherwise, continue checking other programs so overlapping ranges
                // don't block sessions from other programs.
                if (session && session.exercises && session.exercises.length > 0) {
                    const isActive = prog.status === 'active' || prog.id === currentProgramId;
                    return {
                        program: prog,
                        weekNum,
                        dayNum,
                        session,
                        isActive
                    };
                }
            }
        }
        return null;
    };

    // Generate grid
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const startDayOfWeek = firstDayOfMonth.getDay();
        const offset = startDayOfWeek;
        const gridStart = new Date(firstDayOfMonth);
        gridStart.setDate(gridStart.getDate() - offset);

        const days: any[] = [];
        for (let i = 0; i < 42; i++) {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + i);
            const dateStr = toDateStr(date);
            const data = getProgramDataForDate(date);
            const isTravel = travelDates.includes(dateStr);
            const isMeet = nextMeetDate === dateStr;

            days.push({
                date,
                dateStr,
                isCurrentMonth: date.getMonth() === month,
                isTravel,
                isMeet,
                ...data
            });
        }
        return days;
    }, [currentMonth, athletePrograms, travelDates, nextMeetDate]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <button onClick={prevMonth} className="btn-icon">←</button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="btn-icon">→</button>
            </div>

            <div style={{ overflowX: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ minWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
                    <div className="calendar-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(18, 18, 18, 0.5)', padding: '0.5rem 0', borderBottom: '1px solid var(--card-border)', boxSizing: 'border-box' }}>
                        {weekDays.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', fontWeight: 600, color: 'var(--secondary-foreground)', textTransform: 'uppercase' }}>{d}</div>)}
                    </div>

                    <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' }}>
                        {calendarDays.map((day, i) => {
                            const hasSession = day.program && day.session && day.session.exercises && day.session.exercises.length > 0;
                            const isActive = day.isActive;

                            return (
                                <div
                                    key={day.dateStr}
                                    onClick={() => {
                                        if (hasSession && onSelectSession) {
                                            onSelectSession(day.program, day.weekNum, day.dayNum);
                                        } else if (onToggleTravel) {
                                            onToggleTravel(day.dateStr);
                                        }
                                    }}
                                    style={{
                                        borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--card-border)',
                                        borderBottom: '1px solid var(--card-border)',
                                        background: day.isTravel 
                                            ? 'rgba(245, 158, 11, 0.15)' 
                                            : (day.isCurrentMonth ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.3)'),
                                        cursor: (hasSession || onToggleTravel) ? 'pointer' : 'default',
                                        position: 'relative',
                                        transition: 'background 0.2s',
                                        borderLeft: day.isTravel ? '2px solid #f59e0b' : 'none',
                                    }}
                                    className={`calendar-cell ${hasSession ? 'calendar-day-active has-session' : ''} ${day.isCurrentMonth ? 'current-month' : 'other-month'} ${day.isTravel ? 'is-travel' : ''}`}
                                >
                                    <div className="date-number">
                                        {day.date.getDate()}
                                    </div>

                                    {hasSession && (
                                        <div className="session-container" style={{
                                            background: isActive ? 'var(--secondary)' : 'rgba(255,255,255,0.015)',
                                            borderLeft: isActive ? '3px solid var(--primary)' : '3px solid rgba(255,255,255,0.1)',
                                            padding: '6px',
                                            borderRadius: '0 6px 6px 0',
                                            boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                                            opacity: isActive ? 1 : 0.45,
                                        }}>
                                            <div className="session-text">
                                                <div style={{ fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--secondary-foreground)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                                    {day.program.name}
                                                </div>
                                                <div style={{ marginTop: '2px' }}>
                                                    <div style={{ color: isActive ? 'var(--primary)' : 'var(--secondary-foreground)', fontWeight: 500 }}>{day.session.name}</div>
                                                    <div style={{ opacity: 0.7, fontSize: '0.7rem' }}>{day.session.exercises.length} Exercises</div>
                                                </div>
                                            </div>
                                            <div className="session-icon">
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: '50%',
                                                    background: isActive ? 'linear-gradient(135deg, #38bdf8, #34d399)' : 'rgba(255,255,255,0.1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: isActive ? '#000' : 'var(--secondary-foreground)', fontSize: 10
                                                }}>
                                                    📋
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {day.isTravel && !hasSession && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '8px',
                                            left: '8px',
                                            right: '8px',
                                            background: 'rgba(245, 158, 11, 0.2)',
                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                            color: '#fbbf24',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            ✈️ Travel
                                        </div>
                                    )}
                                    {day.isMeet && !hasSession && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: day.isTravel ? '36px' : '8px',
                                            left: '8px',
                                            right: '8px',
                                            background: 'rgba(56, 189, 248, 0.2)',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            color: '#38bdf8',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            🏆 Meet
                                        </div>
                                    )}
                                    {day.isTravel && hasSession && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            fontSize: '0.8rem',
                                            zIndex: 2,
                                            background: 'rgba(245, 158, 11, 0.9)',
                                            borderRadius: '100%',
                                            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            ✈️
                                        </div>
                                    )}
                                    {day.isMeet && hasSession && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '4px',
                                            left: '4px',
                                            fontSize: '0.8rem',
                                            zIndex: 2,
                                            background: 'rgba(56, 189, 248, 0.9)',
                                            borderRadius: '100%',
                                            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            🏆
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
                .calendar-cell {
                    min-height: 110px;
                    padding: 0.5rem;
                }
                .calendar-day-active:hover {
                    background: rgba(255,255,255,0.03) !important;
                }
                .calendar-day-active:hover .session-container {
                    opacity: 1 !important;
                }
                .date-number {
                    font-size: 0.85rem;
                    margin-bottom: 0.5rem;
                }
                .calendar-cell.current-month .date-number {
                    color: var(--foreground);
                    font-weight: 500;
                }
                .calendar-cell.other-month .date-number {
                    color: var(--muted);
                    font-weight: 400;
                }
                .session-icon {
                    display: none;
                }

                @media (max-width: 768px) {
                    .calendar-grid-header {
                        padding: 0.25rem 0 !important;
                    }
                    .calendar-cell {
                        min-height: auto;
                        aspect-ratio: 1;
                        padding: 0 !important;
                        border-right: 1px solid var(--card-border) !important;
                        border-bottom: 1px solid var(--card-border) !important;
                        box-sizing: border-box !important;
                    }
                    .date-number {
                        font-size: 0.7rem;
                        font-weight: 500 !important;
                        margin-bottom: 0px;
                        margin-top: 2px;
                        display: block;
                        text-align: center;
                        width: 100%;
                    }
                    .session-container {
                        padding: 2px !important;
                        border-left: none !important;
                        background: transparent !important;
                        box-shadow: none !important;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: calc(100% - 16px);
                    }
                    .session-text {
                        display: none;
                    }
                    .session-icon {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .session-icon > div {
                        width: 18px !important;
                        height: 18px !important;
                        font-size: 9px !important;
                    }
                }
            `}</style>
        </div>
    );
}

'use client';

import { useMemo, useState } from 'react';

export default function ProgramCalendarGrid({ weeks, startDate, onSelectDate, onSessionMove }) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        return startDate ? new Date(startDate) : new Date();
    });

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

    // Generate calendar days for the CURRENT MONTH
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // First day of the month
        const firstDayOfMonth = new Date(year, month, 1);
        // Last day of the month
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Grid start (Monday based)
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0Sun - 6Sat
        // Adjust for Monday start: Mon=1...Sun=0 -> Mon=0...Sun=6
        // If Sun(0), offset is 6. If Mon(1), offset is 0.
        const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

        const gridStart = new Date(firstDayOfMonth);
        gridStart.setDate(gridStart.getDate() - offset);

        const days = [];
        // 6 weeks * 7 days = 42 cells is standard for max month display
        for (let i = 0; i < 42; i++) {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + i);
            // Use local date formatting instead of toISOString() to avoid usage of UTC
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const dStr = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dStr}`;

            // Calculate Program Week/Day relative to Program Start Date
            // Must parse startDate as LOCAL time to match 'date'
            const [startY, startM, startD] = startDate.split('-').map(Number);
            const progStart = new Date(startY, startM - 1, startD);

            // Set both to midnight just in case
            date.setHours(0, 0, 0, 0);
            progStart.setHours(0, 0, 0, 0);

            const diffTime = date.getTime() - progStart.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            let weekNum = Math.floor(diffDays / 7) + 1;
            let dayNum = (diffDays % 7) + 1;

            const isBeforeProgram = diffDays < 0;

            // Find existing session
            const week = weeks.find(w => w.weekNumber === weekNum);
            const session = week?.sessions?.find(s => s.day === dayNum);

            days.push({
                date: date,
                dateStr: dateStr,
                weekNum,
                dayNum,
                session: session,
                isCurrentMonth: date.getMonth() === month,
                isBeforeProgram
            });
        }
        return days;
    }, [weeks, startDate, currentMonth]);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    // DnD State
    const [dragOverDate, setDragOverDate] = useState(null);

    const handleDragStart = (e, weekNum, dayNum) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ weekNum, dayNum }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, dateStr) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        if (dragOverDate !== dateStr) {
            setDragOverDate(dateStr);
        }
    };

    const handleDragLeave = (e) => {
        // e.preventDefault();
        // setDragOverDate(null); // Flickers too much, maybe clear on drop or end
    };

    const handleDrop = (e, targetWeekNum, targetDayNum, targetDateStr) => {
        e.preventDefault();
        setDragOverDate(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.weekNum && data.dayNum) {
                if (onSessionMove) {
                    onSessionMove(data.weekNum, data.dayNum, targetWeekNum, targetDayNum, targetDateStr);
                }
            }
        } catch (err) {
            console.error('Drop error', err);
        }
    };

    return (
        <div>
            {/* Calendar Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
                <div style={{ fontWeight: 700 }}>{monthName}</div>
                <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.2rem' }}>→</button>
            </div>

            {/* Header */}
            <div className="calendar-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {calendarDays.map((day, i) => (
                    <div
                        key={day.dateStr}
                        onClick={() => onSelectDate(day.weekNum, day.dayNum, day.dateStr)}
                        onDragOver={(e) => handleDragOver(e, day.dateStr)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day.weekNum, day.dayNum, day.dateStr)}
                        className={`calendar-cell ${day.session ? 'has-session' : ''} ${day.isCurrentMonth ? 'current-month' : 'other-month'}`}
                        style={{
                            border: dragOverDate === day.dateStr
                                ? '2px dashed var(--primary)'
                                : (day.session ? '1px solid var(--accent)' : '1px solid var(--card-border)'),
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s',
                            transform: dragOverDate === day.dateStr ? 'scale(1.02)' : 'none',
                            minWidth: 0,
                            minHeight: 0
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                            <span className="date-number">
                                {day.date.getDate()}
                            </span>
                        </div>

                        {day.session ? (
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, day.weekNum, day.dayNum)}
                                className="session-container"
                            >
                                <div className="session-text">
                                    <div className="session-name">
                                        {day.session.name}
                                    </div>
                                    <div className="session-details">
                                        {day.session.exercises.length} Exercises
                                    </div>
                                </div>
                                <div className="session-icon">
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 12 }}>
                                        📋
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="add-indicator">
                                <span>+</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <style jsx>{`
                .calendar-grid-header {
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                .calendar-grid {
                    gap: 0.5rem;
                }
                .calendar-cell {
                    aspect-ratio: 1;
                    padding: 0.5rem;
                    border-radius: 8px;
                    background: transparent;
                    opacity: 0.3;
                }
                .calendar-cell.current-month {
                    background: rgba(255,255,255,0.02);
                    opacity: 1;
                }
                .calendar-cell.has-session {
                    background: var(--card-bg);
                }
                .calendar-cell:hover {
                    background: var(--card-bg);
                    border-color: var(--accent);
                }
                .calendar-cell:hover .add-indicator {
                    opacity: 1 !important;
                }
                .session-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                    margin-top: 4px;
                    cursor: grab;
                }
                .session-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .session-icon {
                    display: none;
                }
                .session-name {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--foreground);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .session-details {
                    font-size: 0.7rem;
                    color: var(--accent);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .date-number {
                    font-size: 0.8rem;
                    color: var(--muted);
                }
                .calendar-cell.current-month .date-number {
                    color: var(--secondary-foreground);
                }
                .add-indicator {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                }
                .add-indicator span {
                    font-size: 1.5rem;
                    color: var(--secondary-foreground);
                }

                @media (max-width: 768px) {
                    .calendar-grid, .calendar-grid-header {
                        gap: 0px !important;
                    }
                    .calendar-grid-header {
                        margin-bottom: 0 !important;
                    }
                    .calendar-cell {
                        border-radius: 0 !important;
                        padding: 0.25rem !important;
                        border-right: none !important;
                        border-bottom: none !important;
                    }
                    /* Draw the missing borders for the grid edges */
                    .calendar-grid {
                        border-right: 1px solid var(--card-border);
                        border-bottom: 1px solid var(--card-border);
                    }
                    .calendar-cell.has-session {
                        border: 1px solid var(--card-border) !important;
                        border-right: none !important;
                        border-bottom: none !important;
                    }
                    .date-number {
                        font-size: 0.75rem;
                        font-weight: 500;
                        margin-bottom: 2px;
                        display: block;
                        text-align: center;
                        width: 100%;
                    }
                    .session-text {
                        display: none;
                    }
                    .session-icon {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: auto;
                        padding-bottom: 4px;
                    }
                    .session-icon > div {
                        width: 18px !important;
                        height: 18px !important;
                        font-size: 9px !important;
                    }
                    .add-indicator span {
                        font-size: 1rem;
                    }
                }
            `}</style>
        </div>
    );
}

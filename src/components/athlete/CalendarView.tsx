'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReadinessForm from './ReadinessForm';

export default function CalendarView({ program, athleteId }) {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [readinessLogs, setReadinessLogs] = useState([]);

    // Modal State
    const [selectedSession, setSelectedSession] = useState(null);
    const [showReadinessForm, setShowReadinessForm] = useState(false);

    useEffect(() => {
        // Fetch readiness logs
        fetch(`/api/readiness?athleteId=${athleteId}`)
            .then(res => res.json())
            .then(data => setReadinessLogs(data))
            .catch(err => console.error(err));
    }, [athleteId]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        return { days, firstDay };
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const { days, firstDay } = getDaysInMonth(currentDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const changeMonth = (offset) => {
        const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
        setCurrentDate(new Date(newDate));
    };

    // Helper to get sessions for a specific date
    const getSessionsForDate = (day) => {
        if (!program) return [];
        const targetDateStr = new Date(year, month, day).toISOString().split('T')[0];

        // 1. Check for explicit scheduledDate
        const explicitlyScheduled = [];
        program.weeks.forEach(week => {
            week.sessions.forEach(session => {
                if (session.scheduledDate === targetDateStr) {
                    explicitlyScheduled.push({ ...session, weekNumber: week.weekNumber });
                }
            });
        });

        if (explicitlyScheduled.length > 0) return explicitlyScheduled;

        // 2. Fallback: Computed Date based on Start Date
        // Only if NO sessions have been explicitly scheduled (to avoid mixing logic poorly)
        // OR we can just show them if they match the computed date AND haven't been scheduled elsewhere.
        // For now, let's keep it simple: If valid startDate exists, map Week/Day to calendar.

        if (program.startDate) {
            const start = new Date(program.startDate);
            // Calculate day difference
            const current = new Date(year, month, day);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Logic: Week 1 Day 1 = diffDay 0
            // Week 1 Day 2 = diffDay 1? Or do we assume rest days?
            // "Day 1", "Day 2" usually implies training days sequence, not literal calendar days unless specified.
            // But for a default calendar view, let's try to map:
            // Week 1 -> Days 0-6
            // Week 2 -> Days 7-13
            // Session Day 1 -> Monday (or first day), Session Day 2 -> Wednesday (gap), etc? 
            // Too complex to guess gaps.
            // SIMPLEST DEFAULT: Week X Day Y maps to (Week-1)*7 + (Day-1) days from start.
            // Example: W1D1 = 0 offset. W1D2 = 1 offset.

            if (diffDays >= 0) {
                const weekNum = Math.floor(diffDays / 7) + 1;
                const dayNum = (diffDays % 7) + 1;

                const week = program.weeks.find(w => w.weekNumber === weekNum);
                if (week) {
                    const session = week.sessions.find(s => s.day === dayNum);
                    // Only show if it doesn't have an explicit date set to something else
                    if (session && !session.scheduledDate) {
                        return [{ ...session, weekNumber: weekNum }];
                    }
                }
            }
        }

        return [];
    };

    const handleSessionClick = (session) => {
        // Check if we have readiness for THIS specific session
        const hasReadinessForSession = readinessLogs.some(log =>
            log.programId === program.id &&
            log.weekNumber === session.weekNumber &&
            log.day === session.day
        );

        setSelectedSession(session);
        setShowReadinessForm(!hasReadinessForSession);
    };

    const handleReadinessSubmit = async (scores) => {
        try {
            await fetch('/api/readiness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athleteId,
                    programId: program.id,
                    weekNumber: selectedSession.weekNumber,
                    day: selectedSession.day,
                    date: new Date().toISOString().split('T')[0],
                    scores
                })
            });
            // Update local state
            const todayStr = new Date().toISOString().split('T')[0];
            setReadinessLogs([...readinessLogs, {
                programId: program.id,
                weekNumber: selectedSession.weekNumber,
                day: selectedSession.day,
                date: todayStr,
                scores
            }]);
            setShowReadinessForm(false);
        } catch (e) {
            console.error(e);
            alert('Failed to save readiness');
        }
    };

    const handleDeleteSession = async (session, e) => {
        if (e) e.stopPropagation();
        if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) return;

        try {
            const res = await fetch(`/api/programs?id=${program.id}&week=${session.weekNumber}&day=${session.day}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Refresh logic - ideally router.refresh() or verify parent re-renders. 
                // Since 'program' prop comes from server component, router.refresh() should work.
                setSelectedSession(null);
                router.refresh();
            } else {
                alert('Failed to delete session');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting session');
        }
    };

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            {/* Header */}
            <div style={{
                background: 'var(--primary)', color: 'white', padding: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>
                    ←
                </button>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {monthNames[month]} {year}
                </div>
                <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>
                    →
                </button>
            </div>

            {/* Grid Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', background: 'var(--accent)', color: 'black', fontWeight: 'bold', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            {/* Grid Body */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--card-bg)' }}>
                {/* Empty Cells */}
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ minHeight: '120px', border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)' }}></div>
                ))}

                {/* Days */}
                {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const sessions = getSessionsForDate(day);
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                    return (
                        <div key={day} style={{
                            minHeight: '120px',
                            border: '1px solid var(--card-border)',
                            padding: '0.5rem',
                            position: 'relative',
                            background: isToday ? 'rgba(78, 205, 196, 0.05)' : 'transparent'
                        }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: isToday ? 'bold' : 'normal', color: isToday ? 'var(--accent)' : 'inherit' }}>
                                {day}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {sessions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleSessionClick(s)}
                                        style={{
                                            display: 'block',
                                            background: 'var(--success)',
                                            color: 'black',
                                            padding: '4px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            position: 'relative',
                                            paddingRight: '20px' // Space for X
                                        }}
                                        title={`${s.name}`}
                                    >
                                        {s.name}
                                        <div
                                            onClick={(e) => handleDeleteSession(s, e)}
                                            style={{
                                                position: 'absolute',
                                                top: 0, bottom: 0, right: 0,
                                                width: '18px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'rgba(0,0,0,0.1)',
                                                cursor: 'pointer',
                                                fontSize: '10px',
                                                fontWeight: 'bold'
                                            }}
                                            className="hover-red"
                                        >
                                            ✕
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Overlay */}
            {selectedSession && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem'
                }} onClick={() => setSelectedSession(null)}>
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '12px',
                        width: '100%', maxWidth: '500px',
                        maxHeight: '90vh', overflowY: 'auto',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedSession(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', zIndex: 10 }}
                        >
                            ×
                        </button>

                        {showReadinessForm ? (
                            <ReadinessForm
                                onSubmit={handleReadinessSubmit}
                                onCancel={() => setSelectedSession(null)}
                            />
                        ) : (
                            <div style={{ padding: '2rem' }}>
                                <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>{selectedSession.name}</h1>
                                <p style={{ color: 'var(--secondary-foreground)', marginBottom: '2rem' }}>
                                    {selectedSession.exercises.length} Exercises Scheduled
                                </p>

                                <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedSession.exercises.map((ex, i) => (
                                        <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                            <div style={{ fontWeight: 600 }}>{ex.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>{ex.sets.length} Sets</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={() => router.push(`/athlete/${athleteId}/workout/${program.id}_w${selectedSession.weekNumber}_d${selectedSession.day}`)}
                                        className="btn btn-primary"
                                        style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }}
                                    >
                                        Start Workout
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteSession(selectedSession, null)}
                                        className="btn"
                                        style={{
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0 1.5rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

}

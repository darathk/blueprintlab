'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical } from 'lucide-react';

export default function PeriodizationPlanner({ athlete }) {
    const router = useRouter();
    const [blocks, setBlocks] = useState(athlete?.periodization || []);
    const [isEditing, setIsEditing] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Merged Competition Tracker State
    const [meetName, setMeetName] = useState(athlete.nextMeetName || '');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [meetDate, setMeetDate] = useState(athlete.nextMeetDate || '');

    // Sync if athlete prop updates
    useEffect(() => {
        if (athlete) {
            setMeetName(athlete.nextMeetName || '');
            setMeetDate(athlete.nextMeetDate || '');
            setBlocks(athlete.periodization || []);
        }
    }, [athlete]);

    // Calculate Days Out
    const daysOutData = useMemo(() => {
        if (!meetDate) return null;
        const meet = new Date(meetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = meet.getTime() - today.getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(totalDays / 7);
        const days = totalDays % 7;
        return { totalDays, weeks, days };
    }, [meetDate]);

    // Calculate Schedule (Backwards from Meet)
    const schedule = useMemo(() => {
        if (!meetDate || blocks.length === 0) return [];

        const meet = new Date(meetDate);
        // Find the Sunday of the Meet Week (Start of the "Last Week")
        const meetWeekStart = new Date(meet);
        meetWeekStart.setDate(meet.getDate() - meet.getDay()); // 0 is Sunday

        // We work backwards from this anchor
        let currentAnchor = new Date(meetWeekStart);

        const scheduleItems = [];
        const reversedBlocks = [...blocks].reverse();

        reversedBlocks.forEach(block => {
            const startDate = new Date(currentAnchor);
            startDate.setDate(currentAnchor.getDate() - ((block.weeks - 1) * 7));

            const nextAnchor = new Date(startDate);
            nextAnchor.setDate(startDate.getDate() - 7);

            scheduleItems.unshift({
                ...block,
                startDate: new Date(startDate),
                endDate: new Date(currentAnchor)
            });

            currentAnchor = nextAnchor;
        });
        return scheduleItems;
    }, [meetDate, blocks]);

    // Generate Weekly Table Data
    const weeklyRows = useMemo(() => {
        if (schedule.length === 0) return [];
        const rows = [];

        schedule.forEach(block => {
            // Generate a row for each week in the block
            for (let i = 0; i < block.weeks; i++) {
                const weekStart = new Date(block.startDate);
                weekStart.setDate(weekStart.getDate() + (i * 7));

                rows.push({
                    weekName: i === 0 ? `Week 1` : `Week ${i + 1}`,
                    date: weekStart,
                    blockName: block.name,
                    blockColor: block.color,
                    blockNotes: block.notes, // Pass notes
                    isCheckIn: false,
                    isFirstInBlock: i === 0,
                    blockSpan: block.weeks
                });
            }
        });
        return rows;
    }, [schedule]);

    const [timeToPeak, setTimeToPeak] = useState(4); // Default 4 weeks

    const generatePlan = () => {
        if (!meetDate) {
            alert("Please set a valid Meet Date first.");
            return;
        }

        const meet = new Date(meetDate);
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        meet.setHours(0, 0, 0, 0);
        const diffTime = meet.getTime() - start.getTime();
        const totalDaysAvailable = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Allow negative days (past meets) for retro-planning
        const totalWeeksAvailable = Math.ceil(Math.abs(totalDaysAvailable) / 7);

        // If days are negative (past), we probably want to just generate the structure back from the meet date?
        // Actually, the original logic works by subtracting weeks from meet date.
        // If meet is in past, start dates will be even further in past. This is fine.

        // However, if DaysOut is negative, maybe we don't care about "Time to Peak > Available".
        // Or maybe we treat it as absolute value?
        // Let's assume the user wants to generate a plan LEADING UP TO that past date.

        // We need 'totalWeeksAvailable' to be the duration we are planning for.
        // Usually this is calculated from TODAY to MEET.
        // If MEET is in past, TODAY to MEET is negative.
        // User probably wants to define "How many weeks was the prep?".
        // So we should maybe ask or default to the TimeToPeak if it's in the past?
        // Or just use the TimeToPeak as the total duration if we can't calculate a "current" duration?

        // Let's keep it simple: If in past, just use the Time To Peak as the full duration
        // effectively generating just the peak block + taper ending on that date.
        // Or if they want a longer plan, they can add blocks manually.

        // But let's check the check:
        /*
        const totalWeeksAvailable = Math.ceil(daysOutData.totalDays / 7);
        if (timeToPeak > totalWeeksAvailable) { ... }
        */

        // If totalDays is negative, totalWeeksAvailable is negative. timeToPeak (4) > -10. Truish?
        // Wait, 4 > -10 is true. So it would run?
        // But logic below uses `totalWeeksAvailable - timeToPeak` to calculate "remaining weeks".
        // -10 - 4 = -14 weeks remaining.
        // The while loop `while (remainingWeeks > 0)` would not run.
        // So it would just generate the Peak + Taper blocks.
        // This seems acceptable for a "minimum viable retro plan".

        // Let's just remove the blocker alert.


        // Let's just remove the blocker alert.

        // Fix redeclaration:
        // const totalWeeksAvailable = Math.ceil(daysOutData.totalDays / 7); -> This was the old line, remove it.

        if (timeToPeak > totalWeeksAvailable) {
            // Note: If totalWeeksAvailable is negative, this check passes (positive > negative)
            // But we should probably warn if they try to peak longer than the retro period?
            // Actually, for retro planning, maybe just let them do whatever.
            // alert(\`Time to Peak (\${timeToPeak}w) cannot exceed total time available (\${totalWeeksAvailable}w).\`);
            // return;
        }

        const newBlocks = [];

        // 1. Create the Peak Phase
        const taperWeeks = 1;
        const peakDevWeeks = Math.max(1, timeToPeak - taperWeeks);

        // Push Taper (Last Block)
        newBlocks.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'Taper',
            name: 'Taper Block',
            weeks: taperWeeks,
            color: getTypeColor('Taper'),
            notes: 'Rest and recovery focus before meet.'
        });

        // Push Peak Development (Before Taper)
        newBlocks.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'Development',
            name: 'Development Block (Peak)',
            weeks: peakDevWeeks,
            color: getTypeColor('Development'),
            notes: 'High intensity, low volume.'
        });

        // 2. Fill the remaining time working backwards
        let remainingWeeks = totalWeeksAvailable - timeToPeak;

        // If we have time before the Peak Phase, insert a Pivot (Deload) first
        if (remainingWeeks > 0) {
            newBlocks.unshift({
                id: Math.random().toString(36).substr(2, 9),
                type: 'Pivot/Deload',
                name: 'Pivot Block',
                weeks: 1,
                color: getTypeColor('Pivot/Deload'),
                notes: 'Active recovery.'
            });
            remainingWeeks -= 1;
        }

        while (remainingWeeks > 0) {
            let blockLen = 4;
            if (remainingWeeks < 4) {
                blockLen = remainingWeeks;
            }

            newBlocks.unshift({
                id: Math.random().toString(36).substr(2, 9),
                type: 'Development',
                name: 'Development Block',
                weeks: blockLen,
                color: getTypeColor('Development'),
                notes: 'Volume accumulation.'
            });
            remainingWeeks -= blockLen;

            // If we STILL have time before this block, insert another Pivot
            if (remainingWeeks > 0) {
                newBlocks.unshift({
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'Pivot/Deload',
                    name: 'Pivot Block',
                    weeks: 1,
                    color: getTypeColor('Pivot/Deload'),
                    notes: 'Active recovery.'
                });
                remainingWeeks -= 1;
            }
        }

        setBlocks(newBlocks);
    };

    const addBlock = (type = 'Development') => {
        const newBlock = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: `${type} Block`,
            weeks: 4,
            color: getTypeColor(type),
            notes: ''
        };
        setBlocks([...blocks, newBlock]);
    };

    const updateBlock = (index, field, value) => {
        const newBlocks = [...blocks];
        const oldWeeks = newBlocks[index].weeks;

        // Apply string-to-number conversion for weeks if needed
        if (field === 'weeks' && typeof value === 'string') {
            value = value === '' ? '' : parseInt(value);
        }

        newBlocks[index][field] = value;

        if (field === 'type') {
            newBlocks[index].color = getTypeColor(value);
            newBlocks[index].name = `${value} Block`;
        }

        // Removed smart duration balancing to allow spreadsheet-like tinkering

        setBlocks(newBlocks);
    };

    const updateStartDate = (index, newStartDateStr) => {
        const s = schedule[index];
        if (!s || !newStartDateStr) return;
        
        const newStart = new Date(newStartDateStr);
        // We ensure we calculate using midday to avoid timezone edge cases
        newStart.setHours(12, 0, 0, 0); 
        const end = new Date(s.endDate);
        end.setHours(12, 0, 0, 0);
        
        const diffMs = end.getTime() - newStart.getTime();
        let newWeeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
        if (newWeeks < 1) newWeeks = 1;
        
        const oldWeeks = blocks[index].weeks;
        const delta = newWeeks - oldWeeks;
        
        if (delta === 0) return;
        
        const newBlocks = [...blocks];
        newBlocks[index].weeks = newWeeks;
        
        // We do NOT adjust the preceding block. 
        // This allows the timeline to simply expand/contract backwards from this point,
        // giving the user exact control like a spreadsheet.
        setBlocks(newBlocks);
    };

    const updateEndDate = (index, newEndDateStr) => {
        if (!newEndDateStr) return;
        if (index === blocks.length - 1) {
            setMeetDate(newEndDateStr);
        } else {
            updateStartDate(index + 1, newEndDateStr);
        }
    };

    const formatDateForInput = (date) => {
        const d = new Date(date);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();
        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    };

    const removeBlock = (index) => {
        const newBlocks = blocks.filter((_, i) => i !== index);
        setBlocks(newBlocks);
    };

    const moveBlock = (index, direction) => {
        if (direction === -1 && index === 0) return;
        if (direction === 1 && index === blocks.length - 1) return;
        const newBlocks = [...blocks];
        const temp = newBlocks[index];
        newBlocks[index] = newBlocks[index + direction];
        newBlocks[index + direction] = temp;
        setBlocks(newBlocks);
    };

    const handleDrop = (dropIndex) => {
        if (draggedIndex === null || draggedIndex === dropIndex) return;
        const newBlocks = [...blocks];
        const [draggedItem] = newBlocks.splice(draggedIndex, 1);
        newBlocks.splice(dropIndex, 0, draggedItem);
        setBlocks(newBlocks);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleSave = async () => {
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: athlete.id,
                periodization: blocks,
                nextMeetName: meetName,
                nextMeetDate: meetDate
            })
        });
        setIsEditing(false);
        router.refresh();
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'Development': return '#38bdf8'; // Cyan Neon
            case 'Pivot/Deload': return '#a855f7'; // Purple Neon
            case 'Taper': return '#fb7185'; // Red Neon
            default: return '#94a3b8'; // Slate
        }
    };

    // Helper to convert hex to rgba for table readability
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    if (!athlete) return null;

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>

            {/* Header */}
            <div className="planner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)' }}>Meet Planner</h2>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>Mapping the roadmap to {meetName || 'Victory'}</p>
                </div>

                {/* Days Out Counter */}
                {daysOutData && (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '0.75rem 1.25rem' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
                            {Math.abs(daysOutData.totalDays)}
                        </div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--secondary-foreground)' }}>
                            {daysOutData.totalDays >= 0 ? 'Days Out' : 'Days Since'}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                    {isEditing ? 'Cancel Editing' : 'Edit Plan & Meet'}
                </button>
            </div>

            {/* Editor Mode */}
            {isEditing && (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '2rem', border: '1px solid var(--card-border)' }}>

                    <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--foreground)', fontWeight: 600 }}>Mission Parameters</h3>
                    <div className="flex-mobile-col" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ flex: 1 }}>
                            <label className="label">Target Objective (Meet Name)</label>
                            <input className="input" value={meetName} onChange={e => setMeetName(e.target.value)} placeholder="e.g. Galactic Nationals" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Start Date</label>
                            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Launch Date (Meet Date)</label>
                            <input className="input" type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                        </div>
                    </div>

                    {/* Auto-Generator */}
                    <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>Auto-Sequence Generator</h4>
                        <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                            <div>
                                <label className="label">Peak Duration (Weeks)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={timeToPeak}
                                    onChange={(e) => setTimeToPeak(parseInt(e.target.value))}
                                    style={{ width: '120px', textAlign: 'center', fontWeight: 'bold' }}
                                    min="2"
                                />
                            </div>
                            <button onClick={generatePlan} className="btn btn-primary" style={{ height: '42px' }}>
                                Initialize Sequence
                            </button>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--foreground)', fontWeight: 600 }}>Block Configuration</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {blocks.map((block, index) => (
                            <div
                                key={block.id}
                                draggable
                                onDragStart={(e) => {
                                    setDraggedIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverIndex(index);
                                }}
                                onDragLeave={() => setDragOverIndex(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleDrop(index);
                                }}
                                onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 280px',
                                    gap: '0',
                                    background: 'var(--card-bg)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--card-border)',
                                    borderLeft: `3px solid ${block.color}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    opacity: draggedIndex === index ? 0.4 : 1,
                                    transform: dragOverIndex === index ? 'translateY(4px)' : 'none',
                                    transition: 'transform 0.2s, opacity 0.2s',
                                    boxShadow: dragOverIndex === index ? `0 -4px 0 ${block.color}` : 'none'
                                }}
                            >
                                {/* LEFT COLUMN: Controls + Dates */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 1rem' }}>
                                    {/* Controls Row */}
                                    <div className="block-controls" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'var(--secondary-foreground)', opacity: 0.7, flexShrink: 0 }}>
                                            <GripVertical size={20} />
                                        </div>
                                        <select
                                            value={block.type}
                                            onChange={(e) => updateBlock(index, 'type', e.target.value)}
                                            className="input"
                                            style={{
                                                width: '150px',
                                                flexShrink: 0,
                                                background: 'var(--card-bg)',
                                                border: `1px solid ${hexToRgba(block.color, 0.5)}`,
                                                color: block.color,
                                                fontWeight: 600
                                            }}
                                        >
                                            <option value="Development" style={{ color: '#38bdf8', background: '#141414' }}>Development</option>
                                            <option value="Pivot/Deload" style={{ color: '#a855f7', background: '#141414' }}>Pivot/Deload</option>
                                            <option value="Taper" style={{ color: '#fb7185', background: '#141414' }}>Taper</option>
                                        </select>
                                        <input
                                            value={block.name}
                                            onChange={(e) => updateBlock(index, 'name', e.target.value)}
                                            className="input"
                                            style={{
                                                flex: 1,
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid var(--card-border)',
                                                borderRadius: 0,
                                                padding: '0.4rem 0',
                                                color: 'var(--primary)',
                                                fontSize: '1rem',
                                                fontWeight: 500
                                            }}
                                            placeholder="Block Name"
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.8rem', borderRadius: '1rem', border: `1px solid ${hexToRgba(block.color, 0.2)}`, flexShrink: 0 }}>
                                            <input
                                                type="number"
                                                value={block.weeks || ''}
                                                onChange={(e) => updateBlock(index, 'weeks', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                style={{
                                                    width: '40px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'white',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: '1rem'
                                                }}
                                                min="1"
                                            />
                                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase' }}>WKS</span>
                                        </div>
                                        <button
                                            onClick={() => removeBlock(index)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#fb7185',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '1rem',
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                lineHeight: 1,
                                                flexShrink: 0
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {/* Dates Row */}
                                    {schedule[index] && schedule[index].startDate && (
                                        <div style={{ paddingLeft: '1.75rem', display: 'flex', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 500, background: 'rgba(6, 182, 212, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                <input
                                                    type="date"
                                                    value={formatDateForInput(schedule[index].startDate)}
                                                    onChange={(e) => updateStartDate(index, e.target.value)}
                                                    style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                                                />
                                                <span style={{ opacity: 0.5 }}>-</span>
                                                <input
                                                    type="date"
                                                    value={formatDateForInput(schedule[index].endDate)}
                                                    onChange={(e) => updateEndDate(index, e.target.value)}
                                                    style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN: Notes */}
                                <div style={{
                                    borderLeft: '1px solid var(--card-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '0.6rem 0.85rem',
                                    gap: '0.25rem',
                                    background: 'rgba(255,255,255,0.02)'
                                }}>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-foreground)', opacity: 0.6, fontWeight: 600 }}>Notes</span>
                                    <input
                                        value={block.notes || ''}
                                        onChange={(e) => updateBlock(index, 'notes', e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.75)',
                                            fontSize: '0.85rem',
                                            padding: '0',
                                            fontStyle: 'italic',
                                            outline: 'none',
                                            width: '100%'
                                        }}
                                        placeholder="Add operational notes..."
                                    />
                                </div>
                            </div>

                        ))}
                    </div>
                    <div className="planner-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                        <button onClick={() => addBlock('Development')} className="btn btn-secondary">+ Add Segment</button>
                        <button onClick={handleSave} className="btn btn-primary" style={{ marginLeft: 'auto' }}>Save Configuration</button>
                    </div>
                </div>
            )}

            {/* Weekly Table View */}
            {!meetDate ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)', background: 'var(--secondary)', borderRadius: '2rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>🌌</div>
                    <div>Initialize Meet Date to map the trajectory.</div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: '1rem', border: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Timeline</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Date</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Phase Objective</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weeklyRows.map((row, i) => (
                                <tr
                                    key={i}
                                    style={{
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                    }}
                                >
                                    <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 500 }}>{row.weekName}</td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                                        {row.date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                        <span style={{ opacity: 0.3, marginLeft: '4px' }}>'{row.date.getFullYear().toString().substr(2)}</span>
                                    </td>

                                    {/* Merged Cell Logic for Block Name */}
                                    {row.isFirstInBlock && (
                                        <>
                                            <td
                                                rowSpan={row.blockSpan}
                                                style={{
                                                    padding: '0.25rem', // Slight padding for card separation
                                                    verticalAlign: 'top',
                                                    height: '1px'
                                                }}
                                            >
                                                <div style={{
                                                    background: 'var(--card-bg)',
                                                    border: '1px solid var(--card-border)',
                                                    borderLeft: `3px solid ${row.blockColor}`,
                                                    color: 'var(--foreground)',
                                                    height: '100%',
                                                    minHeight: '60px',
                                                    padding: '0.75rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    alignItems: 'flex-start',
                                                    borderRadius: '8px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{row.blockName}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--secondary-foreground)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{row.blockSpan} WEEKS</span>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Notes Column */}
                                            <td
                                                rowSpan={row.blockSpan}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    verticalAlign: 'top',
                                                    color: 'rgba(255,255,255,0.8)',
                                                    fontSize: '0.85rem',
                                                    lineHeight: 1.4,
                                                    fontStyle: 'italic',
                                                    borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
                                                    whiteSpace: 'pre-wrap'
                                                }}
                                            >
                                                {row.blockNotes || <span style={{ opacity: 0.3 }}>No notes</span>}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {/* Meet Row */}
                            <tr style={{ background: 'var(--card-bg)' }}>
                                <td style={{ padding: '1.25rem 1rem', fontWeight: 600, color: 'var(--foreground)', fontSize: '0.85rem' }}>MEET WEEK</td>
                                <td style={{ padding: '1.25rem 1rem', fontWeight: 500, fontFamily: 'monospace', color: 'var(--secondary-foreground)' }}>
                                    {new Date(meetDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: '2-digit' })}
                                </td>
                                <td colSpan={2} style={{ padding: '1.25rem 1rem', color: 'var(--primary)', fontWeight: 600, textAlign: 'center', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                    COMPETITION DAY
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

}

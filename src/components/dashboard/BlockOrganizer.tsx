'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Calendar, Target, Edit3, Sparkles, Compass, Trophy, CheckCircle2, ChevronDown, ChevronRight, RotateCcw, ArrowRight, Zap } from 'lucide-react';

export default function PeriodizationPlanner({ athlete, onUpdate }: { athlete: any; onUpdate?: (data: any) => void }) {
    const router = useRouter();
    const [blocks, setBlocks] = useState(athlete?.periodization || []);
    const [isEditing, setIsEditing] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Merged Competition Tracker State
    const [meetName, setMeetName] = useState(athlete?.nextMeetName || '');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [meetDate, setMeetDate] = useState(athlete?.nextMeetDate || '');

    // Archived / Completed blocks history
    const [archivedBlocks, setArchivedBlocks] = useState<any[]>([]);
    const [showArchived, setShowArchived] = useState(false);
    const hasAutoPrunedRef = useRef(false);

    // Sync if athlete prop updates
    useEffect(() => {
        if (athlete) {
            setMeetName(athlete.nextMeetName || '');
            setMeetDate(athlete.nextMeetDate || '');
            setBlocks(athlete.periodization || []);
            hasAutoPrunedRef.current = false;
        }
    }, [athlete]);

    // Calculate Days Out
    const daysOutData = useMemo(() => {
        if (!meetDate) return null;
        const meet = new Date(meetDate + (meetDate.includes('T') ? '' : 'T00:00:00'));
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

        const meet = new Date(meetDate + (meetDate.includes('T') ? '' : 'T00:00:00'));
        // Find the Monday of the Meet Week (Start of the "Last Week")
        const meetWeekStart = new Date(meet);
        const offset = (meet.getDay() + 6) % 7;
        meetWeekStart.setDate(meet.getDate() - offset); // Monday is start of week
        meetWeekStart.setHours(0, 0, 0, 0);

        // We work backwards from this anchor
        let currentAnchor = new Date(meetWeekStart);

        const scheduleItems = [];
        const reversedBlocks = [...blocks].reverse();

        reversedBlocks.forEach(block => {
            const numWeeks = typeof block.weeks === 'number' ? block.weeks : parseInt(block.weeks) || 1;
            const startDate = new Date(currentAnchor);
            startDate.setDate(currentAnchor.getDate() - ((numWeeks - 1) * 7));
            startDate.setHours(0, 0, 0, 0);

            // Block finish date: Sunday 23:59:59 of the final week (currentAnchor is Monday of last week)
            const finishDate = new Date(currentAnchor);
            finishDate.setDate(finishDate.getDate() + 6);
            finishDate.setHours(23, 59, 59, 999);

            const nextAnchor = new Date(startDate);
            nextAnchor.setDate(startDate.getDate() - 7);

            scheduleItems.unshift({
                ...block,
                weeks: numWeeks,
                startDate: new Date(startDate),
                endDate: new Date(currentAnchor),
                finishDate,
            });

            currentAnchor = nextAnchor;
        });
        return scheduleItems;
    }, [meetDate, blocks]);

    // Trajectory Status: Where We Are, Current Block, and Next Block Length
    const trajectoryStatus = useMemo(() => {
        if (!meetDate || schedule.length === 0) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start of current week (Monday)
        const currentMonday = new Date(today);
        const dayOffset = (today.getDay() + 6) % 7;
        currentMonday.setDate(today.getDate() - dayOffset);
        currentMonday.setHours(0, 0, 0, 0);

        // End of current week (Sunday)
        const currentSunday = new Date(currentMonday);
        currentSunday.setDate(currentMonday.getDate() + 6);
        currentSunday.setHours(23, 59, 59, 999);

        // Meet date
        const meet = new Date(meetDate + (meetDate.includes('T') ? '' : 'T00:00:00'));
        meet.setHours(0, 0, 0, 0);
        const isMeetPassed = today > meet;

        // Passed blocks: their entire duration ended before current week started
        const passedBlocks = schedule.filter(b => b.finishDate < currentMonday);
        const activeOrFutureBlocks = schedule.filter(b => b.finishDate >= currentMonday);

        // Active block: today falls inside startDate and finishDate
        const currentBlock = schedule.find(b => today >= b.startDate && today <= b.finishDate) || null;

        let currentBlockIndex = -1;
        let currentWeekInBlock = 1;
        let weeksLeftInBlock = 0;
        let progressPercent = 0;

        if (currentBlock) {
            currentBlockIndex = schedule.findIndex(b => b.id === currentBlock.id);
            const daysSinceStart = Math.max(0, Math.floor((today.getTime() - currentBlock.startDate.getTime()) / (1000 * 60 * 60 * 24)));
            currentWeekInBlock = Math.min(currentBlock.weeks, Math.floor(daysSinceStart / 7) + 1);
            weeksLeftInBlock = Math.max(0, currentBlock.weeks - currentWeekInBlock);
            progressPercent = Math.min(100, Math.round((currentWeekInBlock / currentBlock.weeks) * 100));
        }

        // Determine Next Block
        let nextBlock = null;
        if (currentBlock && currentBlockIndex >= 0 && currentBlockIndex < schedule.length - 1) {
            nextBlock = schedule[currentBlockIndex + 1];
        } else if (!currentBlock && activeOrFutureBlocks.length > 0) {
            // If today is before any block starts
            if (today < activeOrFutureBlocks[0].startDate) {
                nextBlock = activeOrFutureBlocks[0];
            }
        }

        return {
            today,
            currentMonday,
            currentSunday,
            passedBlocks,
            activeOrFutureBlocks,
            currentBlock,
            currentBlockIndex,
            currentWeekInBlock,
            weeksLeftInBlock,
            progressPercent,
            nextBlock,
            isMeetPassed,
        };
    }, [meetDate, schedule]);

    // Auto-Prune Effect: automatically removes blocks that already passed as time passes
    useEffect(() => {
        if (isEditing || !athlete?.id || !meetDate || hasAutoPrunedRef.current) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const meet = new Date(meetDate + (meetDate.includes('T') ? '' : 'T00:00:00'));
        meet.setHours(0, 0, 0, 0);

        if (today > meet) return; // Do not auto-prune if the meet itself has already passed

        const currentMonday = new Date(today);
        const dayOffset = (today.getDay() + 6) % 7;
        currentMonday.setDate(today.getDate() - dayOffset);
        currentMonday.setHours(0, 0, 0, 0);

        const passed = schedule.filter(b => b.finishDate < currentMonday);
        if (passed.length > 0) {
            hasAutoPrunedRef.current = true;
            const passedIds = new Set(passed.map(b => b.id));
            const remaining = blocks.filter(b => !passedIds.has(b.id));

            setArchivedBlocks(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newItems = passed.filter(p => !existingIds.has(p.id));
                return [...prev, ...newItems];
            });

            setBlocks(remaining);

            fetch('/api/athletes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: athlete.id,
                    periodization: remaining,
                    nextMeetName: meetName,
                    nextMeetDate: meetDate
                })
            }).catch(err => console.error("Failed to auto-save pruned periodization:", err));

            onUpdate?.({
                periodization: remaining,
                nextMeetName: meetName,
                nextMeetDate: meetDate
            });
        }
    }, [athlete?.id, meetDate, schedule, blocks, isEditing, onUpdate, meetName]);

    const restoreArchivedBlock = (blockToRestore: any) => {
        const updated = [{
            id: blockToRestore.id || Math.random().toString(36).substr(2, 9),
            type: blockToRestore.type,
            name: blockToRestore.name,
            weeks: blockToRestore.weeks,
            color: blockToRestore.color,
            notes: blockToRestore.notes || ''
        }, ...blocks];
        setBlocks(updated);
        setArchivedBlocks(prev => prev.filter(b => b.id !== blockToRestore.id));
    };

    // Generate Weekly Table Data with Current & Completed Week Highlighting
    const weeklyRows = useMemo(() => {
        if (schedule.length === 0) return [];
        const rows = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentMonday = new Date(today);
        const dayOffset = (today.getDay() + 6) % 7;
        currentMonday.setDate(today.getDate() - dayOffset);
        currentMonday.setHours(0, 0, 0, 0);

        schedule.forEach(block => {
            for (let i = 0; i < block.weeks; i++) {
                const weekStart = new Date(block.startDate);
                weekStart.setDate(weekStart.getDate() + (i * 7));
                weekStart.setHours(0, 0, 0, 0);

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                const isCurrentWeek = today >= weekStart && today <= weekEnd;
                const isCompletedWeek = weekEnd < currentMonday;

                rows.push({
                    weekName: i === 0 ? `Week 1` : `Week ${i + 1}`,
                    date: weekStart,
                    endDate: weekEnd,
                    blockName: block.name,
                    blockColor: block.color,
                    blockNotes: block.notes,
                    isCheckIn: false,
                    isFirstInBlock: i === 0,
                    blockSpan: block.weeks,
                    isCurrentWeek,
                    isCompletedWeek,
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
        onUpdate?.({
            periodization: blocks,
            nextMeetName: meetName,
            nextMeetDate: meetDate
        });
        setIsEditing(false);
        router.refresh();
    };

    const handleDeletePlan = async () => {
        if (!confirm('Are you sure you want to delete this meet plan and roadmap? This will remove the meet date, meet name, and planned block segments.')) return;
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: athlete.id,
                periodization: null,
                nextMeetName: null,
                nextMeetDate: null,
                meetAttempts: null
            })
        });
        setMeetName('');
        setMeetDate('');
        setBlocks([]);
        setArchivedBlocks([]);
        onUpdate?.({
            periodization: null,
            nextMeetName: null,
            nextMeetDate: null
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
        <div style={{ width: '100%' }}>

            {/* Context & Actions Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {meetName || 'Target Competition'}
                        </span>
                        {meetDate && (
                            <span className="glass-badge" style={{ fontSize: '0.75rem', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
                                {new Date(meetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        )}
                    </div>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.8rem', margin: '3px 0 0' }}>
                        {meetDate ? 'Lead-up periodization schedule and preparation phases' : 'No competition date configured yet'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {daysOutData && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 14px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(59, 130, 246, 0.1) 100%)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            boxShadow: '0 0 16px rgba(6, 182, 212, 0.15)',
                        }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>
                                {Math.abs(daysOutData.totalDays)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                                    {daysOutData.totalDays >= 0 ? 'Days Out' : 'Days Since'}
                                </span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--secondary-foreground)' }}>
                                    {daysOutData.weeks}w {daysOutData.days}d
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="glass-button chat-press"
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Edit3 size={14} />
                        <span>{isEditing ? 'Cancel Editing' : 'Edit Plan & Meet'}</span>
                    </button>
                </div>
            </div>

            {/* Editor Mode */}
            {isEditing && (
                <div className="glass-panel-elevated" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>

                    <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--foreground)', fontWeight: 600 }}>Mission Parameters</h3>
                    <div className="flex-mobile-col" style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label className="label">Target Objective (Meet Name)</label>
                            <input className="glass-input" value={meetName} onChange={e => setMeetName(e.target.value)} placeholder="e.g. Galactic Nationals" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Start Date</label>
                            <input className="glass-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Launch Date (Meet Date)</label>
                            <input className="glass-input" type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                        </div>
                    </div>

                    {/* Auto-Generator */}
                    <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--foreground)', fontWeight: 600 }}>Auto-Sequence Generator</h4>
                        <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                            <div>
                                <label className="label">Peak Duration (Weeks)</label>
                                <input
                                    type="number"
                                    className="glass-input"
                                    value={timeToPeak}
                                    onChange={(e) => setTimeToPeak(parseInt(e.target.value))}
                                    style={{ width: '120px', textAlign: 'center', fontWeight: 'bold' }}
                                    min="2"
                                />
                            </div>
                            <button onClick={generatePlan} className="glass-button glass-button-primary chat-press" style={{ height: '40px' }}>
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
                    <div className="planner-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', alignItems: 'center' }}>
                        <button onClick={() => addBlock('Development')} className="glass-button chat-press" style={{ padding: '0.6rem 1.25rem', borderRadius: 12 }}>+ Add Segment</button>
                        {(athlete.nextMeetDate || athlete.nextMeetName || (athlete.periodization && athlete.periodization.length > 0)) && (
                            <button
                                type="button"
                                onClick={handleDeletePlan}
                                className="glass-button chat-press"
                                style={{ padding: '0.6rem 1.25rem', borderRadius: 12, fontWeight: 600, color: '#fb7185', borderColor: 'rgba(251, 113, 133, 0.3)' }}
                            >
                                Delete Meet Plan
                            </button>
                        )}
                        <button onClick={handleSave} className="glass-button glass-button-primary chat-press" style={{ marginLeft: 'auto', padding: '0.6rem 1.5rem', borderRadius: 12, fontWeight: 700 }}>Save Configuration</button>
                    </div>
                </div>
            )}

            {/* Dynamic Real-Time Trajectory: Where We Are & Next Block */}
            {trajectoryStatus && !isEditing && (
                <div
                    style={{
                        marginBottom: '1.5rem',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95) 0%, rgba(13, 17, 28, 0.98) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                    }}
                >
                    {/* Top Status Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '26px', height: '26px', borderRadius: '7px',
                                background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.35)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Compass size={15} style={{ color: '#06b6d4' }} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#06b6d4' }}>
                                    Where We Are • Live Trajectory
                                </span>
                            </div>
                        </div>
                        {meetDate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--secondary-foreground)' }}>
                                <Trophy size={14} style={{ color: '#f59e0b' }} />
                                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{meetName || 'Target Competition'}</span>
                                <span>•</span>
                                <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                                    {daysOutData ? (daysOutData.totalDays >= 0 ? `${daysOutData.weeks}w ${daysOutData.days}d out` : `${Math.abs(daysOutData.totalDays)}d ago`) : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 2-Column Grid: Active Block vs Next Block */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        
                        {/* COLUMN 1: Active Block */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.025)',
                            border: trajectoryStatus.currentBlock ? `1px solid ${trajectoryStatus.currentBlock.color}45` : '1px solid rgba(255, 255, 255, 0.08)',
                            borderLeft: trajectoryStatus.currentBlock ? `4px solid ${trajectoryStatus.currentBlock.color}` : '4px solid var(--secondary-foreground)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-foreground)' }}>
                                        Current Position
                                    </span>
                                    {trajectoryStatus.currentBlock && (
                                        <span style={{
                                            background: `${trajectoryStatus.currentBlock.color}25`,
                                            border: `1px solid ${trajectoryStatus.currentBlock.color}60`,
                                            color: trajectoryStatus.currentBlock.color,
                                            fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px',
                                            textTransform: 'uppercase', letterSpacing: '0.04em'
                                        }}>
                                            Active Block
                                        </span>
                                    )}
                                </div>

                                {trajectoryStatus.currentBlock ? (
                                    <>
                                        <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.25 }}>
                                            {trajectoryStatus.currentBlock.name}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--secondary-foreground)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ color: '#06b6d4', fontWeight: 800 }}>
                                                Week {trajectoryStatus.currentWeekInBlock} of {trajectoryStatus.currentBlock.weeks}
                                            </span>
                                            <span>•</span>
                                            <span style={{ fontWeight: 600 }}>
                                                {trajectoryStatus.weeksLeftInBlock > 0
                                                    ? `${trajectoryStatus.weeksLeftInBlock} ${trajectoryStatus.weeksLeftInBlock === 1 ? 'week' : 'weeks'} remaining`
                                                    : 'Final week of this block'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                                            {trajectoryStatus.currentBlock.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {trajectoryStatus.currentBlock.finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                            {trajectoryStatus.isMeetPassed ? 'Meet Concluded' : 'Preparation Trajectory Initialized'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                            {trajectoryStatus.isMeetPassed ? 'Competition day has passed.' : 'Your planned blocks will begin with the upcoming block below.'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Progress Bar for Active Block */}
                            {trajectoryStatus.currentBlock && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--secondary-foreground)', marginBottom: '4px', fontWeight: 700 }}>
                                        <span>Block Completion</span>
                                        <span style={{ color: '#06b6d4' }}>{trajectoryStatus.progressPercent}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${trajectoryStatus.progressPercent}%`,
                                            height: '100%',
                                            background: `linear-gradient(90deg, ${trajectoryStatus.currentBlock.color} 0%, #06b6d4 100%)`,
                                            borderRadius: '3px',
                                            transition: 'width 0.3s ease',
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* COLUMN 2: Next Block (Direct Answer to "what the next block length should be") */}
                        <div style={{
                            background: trajectoryStatus.nextBlock ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)' : 'rgba(255, 255, 255, 0.025)',
                            border: trajectoryStatus.nextBlock ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderLeft: trajectoryStatus.nextBlock ? `4px solid ${trajectoryStatus.nextBlock.color || '#38bdf8'}` : '4px solid rgba(255,255,255,0.2)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: trajectoryStatus.nextBlock ? '#38bdf8' : 'var(--secondary-foreground)' }}>
                                        Next Block Up
                                    </span>
                                    {trajectoryStatus.nextBlock && (
                                        <span style={{
                                            background: 'rgba(6, 182, 212, 0.18)',
                                            border: '1px solid rgba(6, 182, 212, 0.45)',
                                            color: '#06b6d4',
                                            fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px',
                                            textTransform: 'uppercase', letterSpacing: '0.04em'
                                        }}>
                                            Next In Queue
                                        </span>
                                    )}
                                </div>

                                {trajectoryStatus.nextBlock ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.25 }}>
                                                {trajectoryStatus.nextBlock.name}
                                            </div>
                                            {/* Huge, Bold Block Length */}
                                            <div style={{
                                                fontSize: '1.35rem',
                                                fontWeight: 900,
                                                color: trajectoryStatus.nextBlock.color || '#38bdf8',
                                                lineHeight: 1,
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                gap: '4px',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                border: `1px solid ${trajectoryStatus.nextBlock.color}40`,
                                            }}>
                                                <span>{trajectoryStatus.nextBlock.weeks}</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {trajectoryStatus.nextBlock.weeks === 1 ? 'Week' : 'Weeks'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={13} style={{ opacity: 0.7 }} />
                                            <span>Starts: {trajectoryStatus.nextBlock.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            <span>•</span>
                                            <span>Ends: {trajectoryStatus.nextBlock.finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        {trajectoryStatus.nextBlock.notes && (
                                            <div style={{ fontSize: '0.74rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                &ldquo;{trajectoryStatus.nextBlock.notes}&rdquo;
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Trophy size={16} /> Final Block Before Meet
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginTop: '4px' }}>
                                            {trajectoryStatus.currentBlock
                                                ? 'This is the final preparation phase leading directly into Competition Day.'
                                                : 'All scheduled blocks have concluded.'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {trajectoryStatus.nextBlock && (
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--secondary-foreground)' }}>Phase Type:</span>
                                    <span style={{ fontWeight: 700, color: trajectoryStatus.nextBlock.color || '#38bdf8' }}>{trajectoryStatus.nextBlock.type}</span>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Auto-Prune Archive Notification Bar */}
                    {archivedBlocks.length > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.74rem',
                            color: 'var(--secondary-foreground)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                                <span>
                                    <strong style={{ color: 'var(--foreground)' }}>{archivedBlocks.length}</strong> completed past {archivedBlocks.length === 1 ? 'block was' : 'blocks were'} auto-archived based on date.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowArchived(!showArchived)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#06b6d4',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                            >
                                {showArchived ? 'Hide History' : 'Show History'}
                                {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                        </div>
                    )}

                    {/* Expandable Completed Blocks Drawer */}
                    {showArchived && archivedBlocks.length > 0 && (
                        <div style={{
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                        }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Completed Blocks Archive
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {archivedBlocks.map((b, bi) => (
                                    <div key={b.id || bi} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderLeft: `3px solid ${b.color || '#64748b'}`,
                                        fontSize: '0.78rem',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{b.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                                                {b.weeks}w
                                            </span>
                                            {b.notes && (
                                                <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>
                                                    &ldquo;{b.notes}&rdquo;
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => restoreArchivedBlock(b)}
                                            title="Restore to active roadmap"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'var(--foreground)',
                                                cursor: 'pointer',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            <RotateCcw size={11} /> Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Weekly Table View */}
            {!meetDate ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '3.5rem 1.5rem',
                        borderRadius: 16,
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.25) 0%, rgba(15, 23, 42, 0.45) 100%)',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                    }}
                >
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(125, 135, 210, 0.15) 100%)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)',
                        }}
                    >
                        <Target size={26} style={{ color: '#38bdf8' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            No Competition Trajectory Initialized
                        </div>
                        <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.82rem', margin: '4px 0 0', maxWidth: 420 }}>
                            Set your target meet date to automatically map preparation blocks, peak phase duration, and reverse-schedule the cycle.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="glass-button glass-button-primary chat-press"
                        style={{
                            marginTop: 6,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0.55rem 1.25rem',
                        }}
                    >
                        <Calendar size={15} />
                        <span>Initialize Meet Date & Plan</span>
                    </button>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.45)', paddingBottom: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem', fontWeight: 700 }}>Timeline</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem', fontWeight: 700 }}>Date</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem', fontWeight: 700 }}>Phase Objective</th>
                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem', fontWeight: 700 }}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weeklyRows.map((row, i) => (
                                <tr
                                    key={i}
                                    style={{
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                                        background: row.isCurrentWeek ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                        boxShadow: row.isCurrentWeek ? 'inset 3px 0 0 #06b6d4' : 'none',
                                        transition: 'background 0.15s',
                                        opacity: row.isCompletedWeek ? 0.65 : 1,
                                    }}
                                >
                                    <td style={{ padding: '0.85rem 1rem', color: row.isCurrentWeek ? '#06b6d4' : 'var(--primary)', fontWeight: row.isCurrentWeek ? 800 : 600, fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>{row.weekName}</span>
                                            {row.isCurrentWeek && (
                                                <span style={{
                                                    background: '#06b6d4',
                                                    color: '#000000',
                                                    fontSize: '0.62rem',
                                                    fontWeight: 900,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    letterSpacing: '0.04em',
                                                    whiteSpace: 'nowrap',
                                                    boxShadow: '0 0 8px rgba(6, 182, 212, 0.4)',
                                                }}>
                                                    📍 THIS WEEK
                                                </span>
                                            )}
                                            {row.isCompletedWeek && (
                                                <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 700 }}>
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{
                                        padding: '0.85rem 1rem',
                                        fontFamily: 'monospace',
                                        color: row.isCurrentWeek ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                        fontSize: '0.82rem',
                                        fontWeight: row.isCurrentWeek ? 700 : 400
                                    }}>
                                        {row.date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                        <span style={{ opacity: 0.3, marginLeft: '4px' }}>'{row.date.getFullYear().toString().substr(2)}</span>
                                    </td>

                                    {/* Merged Cell Logic for Block Name */}
                                    {row.isFirstInBlock && (
                                        <>
                                            <td
                                                rowSpan={row.blockSpan}
                                                style={{
                                                    padding: '0.35rem 0.5rem',
                                                    verticalAlign: 'top',
                                                    height: '1px'
                                                }}
                                            >
                                                <div style={{
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderLeft: `3px solid ${row.blockColor}`,
                                                    color: 'var(--foreground)',
                                                    height: '100%',
                                                    minHeight: '60px',
                                                    padding: '0.75rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    alignItems: 'flex-start',
                                                    borderRadius: '10px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{row.blockName}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--secondary-foreground)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>{row.blockSpan} WEEKS</span>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Notes Column */}
                                            <td
                                                rowSpan={row.blockSpan}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    verticalAlign: 'top',
                                                    color: 'rgba(255,255,255,0.85)',
                                                    fontSize: '0.85rem',
                                                    lineHeight: 1.45,
                                                    borderLeft: '1px solid rgba(148, 163, 184, 0.08)',
                                                    whiteSpace: 'pre-wrap'
                                                }}
                                            >
                                                {row.blockNotes || <span style={{ opacity: 0.3, fontStyle: 'italic' }}>No notes</span>}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {/* Meet Row */}
                            <tr style={{ background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(125, 135, 210, 0.08) 100%)', borderTop: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                <td style={{ padding: '1rem', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem', letterSpacing: '0.05em' }}>MEET WEEK</td>
                                <td style={{ padding: '1rem', fontWeight: 600, fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
                                    {new Date(meetDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: '2-digit' })}
                                </td>
                                <td colSpan={2} style={{ padding: '1rem', color: '#38bdf8', fontWeight: 700, textAlign: 'center', fontSize: '0.85rem', letterSpacing: '0.08em' }}>
                                    🏆 COMPETITION DAY
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

}

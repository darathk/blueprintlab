'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, Plus, X } from 'lucide-react';
import AthleteStatusCard from '@/app/dashboard/athlete-status-card';

export default function ActivePersonnelList({ athletes, programs, logSummaries, lastLogDates = {}, coachId }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'progress' | 'meet'>('name');
    const [filterMeet, setFilterMeet] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const savedSort = localStorage.getItem('dashboard-sort');
        if (savedSort === 'name' || savedSort === 'progress' || savedSort === 'meet') {
            setSortBy(savedSort as any);
        }
        const savedFilter = localStorage.getItem('dashboard-filter-meet');
        if (savedFilter === 'true') {
            setFilterMeet(true);
        }
    }, []);

    const updateSort = (val: 'name' | 'progress' | 'meet') => {
        setSortBy(val);
        localStorage.setItem('dashboard-sort', val);
    };

    const updateFilterMeet = (val: boolean) => {
        setFilterMeet(val);
        localStorage.setItem('dashboard-filter-meet', String(val));
    };

    const handleAddAthlete = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/athletes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    email: newEmail,
                    coachId: coachId,
                    role: 'athlete'
                })
            });

            if (res.ok) {
                setNewName('');
                setNewEmail('');
                setIsAdding(false);
                router.refresh();
            } else {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.error || res.statusText || 'Unknown error';
                alert(`Failed to add athlete: ${res.status} - ${errorMessage}`);
            }
        } catch (error: any) {
            console.error(error);
            alert(`Network Error: ${error.message || 'An error occurred'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Pre-calculate progress for all athletes to allow sorting
    const enrichedAthletes = (athletes || []).map(athlete => {
        const athletePrograms = programs.filter(p => p.athleteId === athlete.id);
        const athleteLogs = logSummaries.filter(l => l.program?.athleteId === athlete.id);

        let activeProgId = athlete.currentProgramId;

        // Auto-advance logic: ignore old "active" programs that are actually 100% complete
        if (athletePrograms.length > 0) {
            const activeSorted = [...athletePrograms]
                .filter(p => p.status === 'active' || p.id === athlete.currentProgramId)
                .sort((a, b) => new Date(a.createdAt || a.startDate || 0).getTime() - new Date(b.createdAt || b.startDate || 0).getTime());
            
            for (const prog of activeSorted) {
                let totalSessions = 0;
                (prog.weeks || []).forEach((w: any) => totalSessions += (w.sessions?.length || 0));
                
                const progLogs = athleteLogs.filter(l => l.programId === prog.id);
                const uniqueSessions = new Set(progLogs.map(l => l.sessionId));
                
                activeProgId = prog.id; // Assume this one
                
                // If it's incomplete, stop. It's the true active program.
                if (totalSessions === 0 || uniqueSessions.size < totalSessions) {
                    break;
                }
            }
        }

        const currentProgram = programs.find(p => p.id === activeProgId);

        let progress = {
            completedSessions: 0,
            totalSessions: 0,
            currentWeek: 1,
            totalWeeks: 0,
            programName: currentProgram ? currentProgram.name : 'No Program Assigned'
        };

        if (currentProgram) {
            const weeks = currentProgram.weeks;
            let totalSessions = 0;
            let lastActiveWeek = -1;

            (weeks || []).forEach((w: any, index: number) => {
                const sessionCount = w.sessions ? w.sessions.length : 0;
                totalSessions += sessionCount;
                if (sessionCount > 0) {
                    lastActiveWeek = index;
                }
            });

            progress.totalWeeks = lastActiveWeek + 1;
            progress.totalSessions = totalSessions;

            const athleteLogSummaries = logSummaries.filter(l => l.program?.athleteId === athlete.id && l.programId === currentProgram.id);
            const uniqueSessions = new Set(athleteLogSummaries.map(l => l.sessionId));
            progress.completedSessions = uniqueSessions.size;

            if (athleteLogSummaries.length > 0) {
                const weeksFromLogs = athleteLogSummaries.map(l => {
                    const match = l.sessionId.match(/week-(\d+)/i);
                    return match ? parseInt(match[1]) : 1;
                });
                progress.currentWeek = Math.max(...weeksFromLogs);
            }
        }

        const progressPercent = progress.totalSessions > 0 ? (progress.completedSessions / progress.totalSessions) * 100 : 0;

        // Meet countdown
        const meetDate = athlete.nextMeetDate ? new Date(athlete.nextMeetDate) : null;
        let daysOut: number | null = null;
        if (meetDate) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            meetDate.setHours(0, 0, 0, 0);
            daysOut = Math.ceil((meetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Days since last logged session
        let daysSinceLastLog: number | null = null;
        const lastLogDate = lastLogDates[athlete.id];
        if (lastLogDate) {
            const logDate = new Date(lastLogDate);
            logDate.setHours(0, 0, 0, 0);
            const nowDate = new Date();
            nowDate.setHours(0, 0, 0, 0);
            daysSinceLastLog = Math.floor((nowDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (currentProgram) {
            // Has a program but never logged
            daysSinceLastLog = -1; // sentinel for "never logged"
        }

        return {
            ...athlete,
            currentProgramId: activeProgId,
            computedProgress: progress,
            progressPercent,
            daysOut,
            hasMeet: !!athlete.nextMeetDate,
            daysSinceLastLog
        };
    });

    const displayAthletes = enrichedAthletes
        .filter(athlete => {
            const matchesSearch = athlete.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesMeet = !filterMeet || athlete.hasMeet;
            return matchesSearch && matchesMeet;
        })
        .sort((a, b) => {
            if (sortBy === 'progress') {
                return b.progressPercent - a.progressPercent;
            }
            if (sortBy === 'meet') {
                // Athletes with meets first, sorted by soonest (upcoming first, then past)
                if (a.hasMeet && !b.hasMeet) return -1;
                if (!a.hasMeet && b.hasMeet) return 1;
                if (!a.hasMeet && !b.hasMeet) return a.name.localeCompare(b.name);
                // Both have meets: upcoming (positive daysOut) before past (negative)
                const aUpcoming = (a.daysOut ?? 0) >= 0;
                const bUpcoming = (b.daysOut ?? 0) >= 0;
                if (aUpcoming && !bUpcoming) return -1;
                if (!aUpcoming && bUpcoming) return 1;
                // Both upcoming or both past: closest first
                return (a.daysOut ?? 0) - (b.daysOut ?? 0);
            }
            return a.name.localeCompare(b.name);
        });

    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showFilters) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilters]);

    const hasActiveFilters = filterMeet || sortBy !== 'name';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Search Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--card-border)',
                background: 'rgba(255, 255, 255, 0.03)',
                transition: 'border-color 0.2s',
            }}>
                <Search size={18} style={{ color: 'var(--secondary-foreground)', flexShrink: 0 }} />
                <input
                    type="text"
                    placeholder="Filter athletes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--foreground)',
                        fontSize: '0.9rem',
                        outline: 'none',
                    }}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', padding: 2 }}
                    >
                        <X size={16} />
                    </button>
                )}
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: isAdding ? 'var(--primary)' : 'var(--secondary-foreground)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 4,
                        flexShrink: 0,
                        transition: 'color 0.2s',
                    }}
                    title={isAdding ? 'Cancel' : 'Add Athlete'}
                >
                    {isAdding ? <X size={20} /> : <Plus size={20} />}
                </button>
                <div style={{ width: 1, height: 20, background: 'var(--card-border)', flexShrink: 0 }} />
                <div ref={filterRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: hasActiveFilters ? 'var(--primary)' : 'var(--secondary-foreground)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 4,
                            flexShrink: 0,
                            transition: 'color 0.2s',
                        }}
                        title="Sort & Filter"
                    >
                        <SlidersHorizontal size={18} />
                    </button>

                    {/* Filter Dropdown */}
                    {showFilters && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            zIndex: 100,
                            background: '#1a1a24',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '0.75rem',
                            minWidth: '200px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                        }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Sort by</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {[
                                    { value: 'name', label: 'Name' },
                                    { value: 'progress', label: 'Progress' },
                                    { value: 'meet', label: 'Meet' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => updateSort(opt.value as any)}
                                        style={{
                                            flex: 1,
                                            padding: '0.35rem 0.5rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${sortBy === opt.value ? 'var(--primary)' : 'var(--card-border)'}`,
                                            background: sortBy === opt.value ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                                            color: sortBy === opt.value ? 'var(--primary)' : 'var(--foreground)',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ height: 1, background: 'var(--card-border)' }} />
                            <button
                                onClick={() => updateFilterMeet(!filterMeet)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '8px',
                                    border: `1px solid ${filterMeet ? 'var(--primary)' : 'var(--card-border)'}`,
                                    background: filterMeet ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                                    color: filterMeet ? 'var(--primary)' : 'var(--foreground)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    width: '100%',
                                }}
                            >
                                Has Meet
                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{filterMeet ? 'On' : 'Off'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isAdding && (
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem', border: '1px solid var(--primary)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Add New Athlete</h3>
                    <form onSubmit={handleAddAthlete} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Name</label>
                            <input
                                type="text"
                                required
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)', background: 'var(--background)', color: 'white' }}
                                placeholder="E.g. John Doe"
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Email</label>
                            <input
                                type="email"
                                required
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)', background: 'var(--background)', color: 'white' }}
                                placeholder="john@example.com"
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ padding: '0.6rem 1.5rem' }}>
                            {isSubmitting ? 'Adding...' : 'Add Athlete'}
                        </button>
                    </form>
                </div>
            )}

            {displayAthletes.length === 0 ? (
                <p style={{ color: 'var(--secondary-foreground)' }}>
                    {athletes.length === 0 ? "No athletes found." : "No athletes match your search."}
                </p>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {displayAthletes.map(enrichedAthlete => (
                        <AthleteStatusCard
                            key={enrichedAthlete.id}
                            athlete={enrichedAthlete}
                            progress={enrichedAthlete.computedProgress}
                            daysSinceLastLog={enrichedAthlete.daysSinceLastLog}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

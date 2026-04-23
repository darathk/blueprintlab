'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, Plus, X, Megaphone, ChevronDown } from 'lucide-react';
import AthleteStatusCard from '@/app/dashboard/athlete-status-card';

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ActivePersonnelList({ athletes, programs, logSummaries, lastLogDates = {}, coachId }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'progress' | 'meet'>('name');
    const [filterMeet, setFilterMeet] = useState(false);
    const [filterNeedsUpdate, setFilterNeedsUpdate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Broadcast announcement state ──
    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastStart, setBroadcastStart] = useState(todayStr());
    const [broadcastEnd, setBroadcastEnd] = useState('');
    const [broadcastSaving, setBroadcastSaving] = useState(false);
    const [broadcastSaved, setBroadcastSaved] = useState(false);
    const [activeAnnouncement, setActiveAnnouncement] = useState<{ message: string; startDate: string; endDate: string } | null>(null);

    const fetchAnnouncement = useCallback(async () => {
        try {
            const res = await fetch(`/api/announcements?coachId=${coachId}`);
            if (res.ok) {
                const data = await res.json();
                setActiveAnnouncement(data.announcement);
            }
        } catch {}
    }, [coachId]);

    useEffect(() => { fetchAnnouncement(); }, [fetchAnnouncement]);

    const handleSaveBroadcast = async () => {
        if (!broadcastMsg.trim() || !broadcastStart || !broadcastEnd) return;
        setBroadcastSaving(true);
        try {
            const res = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coachId, message: broadcastMsg.trim(), startDate: broadcastStart, endDate: broadcastEnd }),
            });
            if (res.ok) {
                setBroadcastSaved(true);
                setBroadcastMsg('');
                setBroadcastEnd('');
                setBroadcastStart(todayStr());
                setBroadcastOpen(false);
                await fetchAnnouncement();
                setTimeout(() => setBroadcastSaved(false), 3000);
            }
        } finally {
            setBroadcastSaving(false);
        }
    };

    const handleClearBroadcast = async () => {
        await fetch(`/api/announcements?coachId=${coachId}`, { method: 'DELETE' });
        setActiveAnnouncement(null);
    };

    useEffect(() => {
        const savedSort = localStorage.getItem('dashboard-sort');
        if (savedSort === 'name' || savedSort === 'progress' || savedSort === 'meet') {
            setSortBy(savedSort as any);
        }
        if (localStorage.getItem('dashboard-filter-meet') === 'true') setFilterMeet(true);
        if (localStorage.getItem('dashboard-filter-needs-update') === 'true') setFilterNeedsUpdate(true);
    }, []);

    const updateSort = (val: 'name' | 'progress' | 'meet') => {
        setSortBy(val);
        localStorage.setItem('dashboard-sort', val);
    };

    const updateFilterMeet = (val: boolean) => {
        setFilterMeet(val);
        localStorage.setItem('dashboard-filter-meet', String(val));
    };

    const updateFilterNeedsUpdate = (val: boolean) => {
        setFilterNeedsUpdate(val);
        localStorage.setItem('dashboard-filter-needs-update', String(val));
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
        // OR if a newer active program's start date has already arrived.
        let activeSorted: any[] = [];
        // Use rigorous parsing for date comparisons to prevent UTC boundary shifts
        const parseLocalDateStr = (dateStr: any) => {
            if (!dateStr) return new Date(0);
            const s = String(dateStr).split('T')[0];
            const parts = s.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts.map(Number);
                const date = new Date(y, m - 1, d);
                date.setHours(0, 0, 0, 0);
                return date;
            }
            const date = new Date(dateStr);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        if (athletePrograms.length > 0) {            activeSorted = [...athletePrograms]
                .filter(p => p.status !== 'draft')
                .sort((a, b) => {
                    const aStart = parseLocalDateStr(a.startDate || a.createdAt).getTime();
                    const bStart = parseLocalDateStr(b.startDate || b.createdAt).getTime();
                    if (aStart === bStart) {
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    }
                    return aStart - bStart;
                });
            
            for (let i = 0; i < activeSorted.length; i++) {
                const prog = activeSorted[i];
                let totalSessions = 0;
                (prog.weeks || []).forEach((w: any) => totalSessions += (w.sessions?.length || 0));
                
                const progLogs = athleteLogs.filter(l => l.programId === prog.id);
                const uniqueSessions = new Set(progLogs.map(l => l.sessionId));
                
                activeProgId = prog.id;
                
                if (i === activeSorted.length - 1) break;

                const nextProg = activeSorted[i + 1];
                const nextProgLogs = athleteLogs.filter(l => l.programId === nextProg.id);
                const nextHasLogs = nextProgLogs.length > 0;
                
                const isComplete = totalSessions > 0 && uniqueSessions.size >= totalSessions;

                // Check if next program has strictly started by date
                let nextDateStarted = false;
                if (nextProg.startDate) {
                    const nextStart = parseLocalDateStr(nextProg.startDate);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    if (now >= nextStart) nextDateStarted = true;
                }

                // Check if current program is expired by date
                let currentExpired = false;
                const totalWeeks = (prog.weeks?.length || 0);
                if (prog.startDate && totalWeeks > 0) {
                    const expiryDate = parseLocalDateStr(prog.startDate);
                    expiryDate.setDate(expiryDate.getDate() + totalWeeks * 7);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    if (now >= expiryDate) currentExpired = true;
                }

                // Advance if:
                // 1. Current is complete (all sessions logged)
                // 2. OR Current program's status is 'completed' (coach explicitly ended it by assigning a new one)
                // 3. OR Athlete has already started the next one (has logs)
                // 4. OR Current is expired by date (no reason to wait for next program's start date)
                const shouldAdvance = isComplete || prog.status === 'completed' || nextHasLogs || currentExpired;

                if (!shouldAdvance) {
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
                    const match = l.sessionId.match(/_w(\d+)_d/i);
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

        let needsUpdate = false;
        let hasNextBlockReady = false;

        if (currentProgram && progress.totalSessions > 0) {
            const sessionsRemaining = progress.totalSessions - progress.completedSessions;

            // Check if any assigned program hasn't been started yet (queued for the future)
            if (activeProgId) {
                 hasNextBlockReady = activeSorted.some(p => {
                      if (p.id === activeProgId) return false;
                      const pLogs = athleteLogs.filter(l => l.programId === p.id);
                      if (pLogs.length > 0) return false;
                      let pSessions = 0;
                      (p.weeks || []).forEach((w: any) => pSessions += (w.sessions?.length || 0));
                      return pSessions > 0;
                 });
            }

            let isEndingSoonByTime = false;
            let isExpired = false;
            if (activeProgId) {
                const progObj = programs.find((p: any) => p.id === activeProgId);
                if (progObj && progObj.startDate) {
                    const programWeekCount = Array.isArray(progObj.weeks) ? progObj.weeks.length : (progress.totalWeeks || 1);
                    const expiryDate = parseLocalDateStr(progObj.startDate);
                    expiryDate.setDate(expiryDate.getDate() + programWeekCount * 7);

                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    if (now >= expiryDate) isExpired = true;

                    // Use the last 25% of the program's duration (min 3 days) as
                    // the "ending soon" window — a fixed 7-day window covers the
                    // entire duration of 1-week programs, creating false positives.
                    const totalDays = programWeekCount * 7;
                    const warningDays = Math.max(3, Math.floor(totalDays * 0.25));
                    const warningDate = new Date(expiryDate);
                    warningDate.setDate(warningDate.getDate() - warningDays);

                    if (now >= warningDate) isEndingSoonByTime = true;
                }
            }

            // Flag as "needs update" when the athlete has completed >= 80% of
            // sessions OR the program is ending soon by date OR already expired.
            // The old heuristic (sessionsRemaining <= sessionsPerWeek) was always
            // true for 1-week programs, flagging athletes at 50% as "finishing soon."
            const sessionsLow = progress.totalSessions > 0
                && progress.completedSessions >= progress.totalSessions * 0.8;

            needsUpdate = (sessionsLow || isEndingSoonByTime || isExpired) && !hasNextBlockReady;
        }

        return {
            ...athlete,
            currentProgramId: activeProgId,
            computedProgress: progress,
            progressPercent,
            daysOut,
            hasMeet: !!athlete.nextMeetDate,
            daysSinceLastLog,
            needsUpdate,
            hasNextBlockReady,
        };
    });

    const displayAthletes = enrichedAthletes
        .filter(athlete => {
            const matchesSearch = athlete.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesMeet = !filterMeet || athlete.hasMeet;
            const matchesNeedsUpdate = !filterNeedsUpdate || (athlete.needsUpdate && !athlete.hasNextBlockReady);
            return matchesSearch && matchesMeet && matchesNeedsUpdate;
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

    const hasActiveFilters = filterMeet || filterNeedsUpdate || sortBy !== 'name';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── Broadcast Announcement Panel ── */}
            <div style={{
                borderRadius: 14,
                border: broadcastOpen ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(251,191,36,0.2)',
                background: 'rgba(251,191,36,0.05)',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
            }}>
                {/* Panel header — always visible */}
                <button
                    onClick={() => setBroadcastOpen(o => !o)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem 1rem', background: 'transparent', border: 'none',
                        cursor: 'pointer', color: 'var(--foreground)', textAlign: 'left',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Megaphone size={16} color="#fbbf24" />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fbbf24' }}>Broadcast Message</span>
                        {activeAnnouncement && (
                            <span style={{
                                background: 'rgba(251,191,36,0.2)', color: '#fbbf24',
                                borderRadius: 20, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700,
                            }}>LIVE</span>
                        )}
                        {broadcastSaved && (
                            <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>✓ Sent!</span>
                        )}
                    </div>
                    <ChevronDown size={16} color="#fbbf24" style={{ transform: broadcastOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {/* Active announcement preview */}
                {!broadcastOpen && activeAnnouncement && (
                    <div style={{
                        margin: '0 1rem 0.75rem',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 8,
                        background: 'rgba(251,191,36,0.08)',
                        border: '1px solid rgba(251,191,36,0.2)',
                        fontSize: '0.8rem',
                        color: 'var(--secondary-foreground)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                    }}>
                        <div>
                            <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.7rem', display: 'block', marginBottom: 2 }}>
                                Active: {activeAnnouncement.startDate} → {activeAnnouncement.endDate}
                            </span>
                            {activeAnnouncement.message}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClearBroadcast(); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-foreground)', flexShrink: 0, padding: 2 }}
                            title="Clear announcement"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Compose form */}
                {broadcastOpen && (
                    <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <textarea
                            value={broadcastMsg}
                            onChange={e => setBroadcastMsg(e.target.value)}
                            placeholder="Write your message to all athletes... (e.g. 'I'm traveling this week — response times may be delayed')"
                            rows={3}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: 8,
                                border: '1px solid rgba(251,191,36,0.3)',
                                background: 'rgba(0,0,0,0.2)', color: 'var(--foreground)',
                                fontSize: '0.9rem', resize: 'vertical', outline: 'none',
                                fontFamily: 'inherit',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show from</label>
                                <input
                                    type="date"
                                    value={broadcastStart}
                                    onChange={e => setBroadcastStart(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.5rem 0.65rem', borderRadius: 7,
                                        border: '1px solid rgba(251,191,36,0.3)',
                                        background: 'rgba(0,0,0,0.2)', color: 'var(--foreground)',
                                        fontSize: '0.85rem', outline: 'none',
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Until</label>
                                <input
                                    type="date"
                                    value={broadcastEnd}
                                    min={broadcastStart}
                                    onChange={e => setBroadcastEnd(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.5rem 0.65rem', borderRadius: 7,
                                        border: '1px solid rgba(251,191,36,0.3)',
                                        background: 'rgba(0,0,0,0.2)', color: 'var(--foreground)',
                                        fontSize: '0.85rem', outline: 'none',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                {activeAnnouncement && (
                                    <button
                                        onClick={handleClearBroadcast}
                                        style={{
                                            padding: '0.5rem 1rem', borderRadius: 8,
                                            border: '1px solid rgba(148,163,184,0.3)',
                                            background: 'transparent', color: 'var(--secondary-foreground)',
                                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        Clear Live
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveBroadcast}
                                    disabled={broadcastSaving || !broadcastMsg.trim() || !broadcastEnd}
                                    style={{
                                        padding: '0.5rem 1.25rem', borderRadius: 8,
                                        border: 'none',
                                        background: (!broadcastMsg.trim() || !broadcastEnd) ? 'rgba(251,191,36,0.3)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                                        color: '#000',
                                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                        opacity: broadcastSaving ? 0.7 : 1,
                                    }}
                                >
                                    {broadcastSaving ? 'Sending...' : '📣 Deploy'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

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
                            <button
                                onClick={() => updateFilterNeedsUpdate(!filterNeedsUpdate)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '8px',
                                    border: `1px solid ${filterNeedsUpdate ? '#F59E0B' : 'var(--card-border)'}`,
                                    background: filterNeedsUpdate ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                                    color: filterNeedsUpdate ? '#F59E0B' : 'var(--foreground)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    width: '100%',
                                }}
                            >
                                Needs Update
                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{filterNeedsUpdate ? 'On' : 'Off'}</span>
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
                            needsUpdate={enrichedAthlete.needsUpdate}
                            hasNextBlockReady={enrichedAthlete.hasNextBlockReady}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type DropdownMode = 'transfer' | 'copy';

export default function ProgramList({ athleteId, initialPrograms }: { athleteId: string; initialPrograms?: any[] }) {
    const router = useRouter();
    const [programs, setPrograms] = useState(
        initialPrograms ? initialPrograms.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft') : []
    );
    const [loading, setLoading] = useState(!initialPrograms);
    const [dropdownOpen, setDropdownOpen] = useState<{ programId: string; mode: DropdownMode } | null>(null);
    const [athletes, setAthletes] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');
    const [timeline, setTimeline] = useState<string>('ALL');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const TIMELINES: Record<string, number> = {
        '1M': 30,
        '3M': 90,
        '6M': 180,
        '1Y': 365,
        'ALL': Infinity,
    };

    useEffect(() => {
        if (initialPrograms) return; // Skip fetch if data was provided
        const loadPrograms = async () => {
            try {
                const res = await fetch(`/api/programs?athleteId=${athleteId}`);
                const data = await res.json();
                setPrograms(data.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft'));
            } catch (e) {
                console.error('Failed to load programs:', e);
            }
            setLoading(false);
        };
        loadPrograms();
    }, [athleteId, initialPrograms]);

    // Load athletes list when dropdown is opened
    useEffect(() => {
        if (!dropdownOpen) return;
        (async () => {
            try {
                const res = await fetch('/api/athletes');
                if (res.ok) {
                    const data = await res.json();
                    setAthletes(data.filter((a: any) => a.id !== athleteId));
                }
            } catch { /* ignore */ }
        })();
    }, [dropdownOpen, athleteId]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(null);
                setActionError('');
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [dropdownOpen]);

    const handleDelete = async (programId, programName) => {
        if (!confirm(`Are you sure you want to delete "${programName}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/programs?id=${programId}`, { method: 'DELETE' });
            if (res.ok) {
                setPrograms(programs.filter(p => p.id !== programId));
            } else {
                alert('Failed to delete program');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting program');
        }
    };

    const handleTransfer = async (programId: string, targetAthleteId: string, targetName: string) => {
        const program = programs.find((p: any) => p.id === programId);
        const programName = program ? (program as any).name : 'this program';
        if (!confirm(`Transfer "${programName}" to ${targetName}? All workout logs will move with it.`)) return;

        setActionLoading(true);
        setActionError('');
        try {
            const res = await fetch('/api/programs/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId, targetAthleteId }),
            });
            if (!res.ok) {
                const data = await res.json();
                setActionError(data.error || 'Transfer failed');
                setActionLoading(false);
                return;
            }
            setPrograms(programs.filter(p => p.id !== programId));
            setDropdownOpen(null);
            router.refresh();
        } catch {
            setActionError('Network error');
        }
        setActionLoading(false);
    };

    const handleCopy = async (programId: string, targetAthleteId: string, targetName: string) => {
        const program = programs.find((p: any) => p.id === programId);
        const programName = program ? (program as any).name : 'this program';
        if (!confirm(`Copy "${programName}" to ${targetName}?`)) return;

        setActionLoading(true);
        setActionError('');
        try {
            const res = await fetch('/api/programs/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId, targetAthleteId }),
            });
            if (!res.ok) {
                const data = await res.json();
                setActionError(data.error || 'Copy failed');
                setActionLoading(false);
                return;
            }
            setDropdownOpen(null);
        } catch {
            setActionError('Network error');
        }
        setActionLoading(false);
    };

    const handleSaveAsTemplate = async (programId: string, programName: string) => {
        const templateName = prompt('Template name:', programName);
        if (!templateName) return;

        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId, name: templateName }),
            });
            if (res.ok) {
                alert(`"${templateName}" saved as a template! Find it in the Templates Library.`);
            } else {
                let errorMsg = 'Failed to save template';
                try {
                    const data = await res.json();
                    errorMsg = data.error || errorMsg;
                } catch { /* response wasn't JSON */ }
                alert(errorMsg);
            }
        } catch {
            alert('Network error — check your connection and try again');
        }
    };

    const handleDuplicate = async (programId: string) => {
        const program = programs.find((p: any) => p.id === programId);
        const programName = program ? (program as any).name : 'this program';
        if (!confirm(`Duplicate "${programName}"?`)) return;

        setDuplicatingId(programId);
        try {
            const res = await fetch('/api/programs/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId, targetAthleteId: athleteId }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Duplicate failed');
                setDuplicatingId(null);
                return;
            }
            // Reload programs to show the new duplicate
            const listRes = await fetch(`/api/programs?athleteId=${athleteId}`);
            const listData = await listRes.json();
            setPrograms(listData.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft'));
        } catch {
            alert('Network error');
        }
        setDuplicatingId(null);
    };

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
            Loading programs...
        </div>
    );
    if (programs.length === 0) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }}>
            No programs found for this athlete.
        </div>
    );

    // Count only weeks that have at least one session
    const activeWeekCount = (weeks) => {
        if (!Array.isArray(weeks)) return 0;
        return weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0).length;
    };

    // Compute date range from only non-empty weeks, anchored to startDate
    const activeDateRange = (startDate, weeks) => {
        if (!startDate || !Array.isArray(weeks)) return '';
        const nonEmpty = weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0);
        if (nonEmpty.length === 0) return '';
        const [sy, sm, sd] = startDate.split('T')[0].split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const firstWn = Math.min(...nonEmpty.map(w => w.weekNumber || 1));
        const lastWn = Math.max(...nonEmpty.map(w => w.weekNumber || 1));
        const firstDay = new Date(start);
        firstDay.setDate(firstDay.getDate() + (firstWn - 1) * 7);
        const lastDay = new Date(start);
        lastDay.setDate(lastDay.getDate() + (lastWn - 1) * 7 + 6);
        return `${firstDay.toLocaleDateString()} — ${lastDay.toLocaleDateString()}`;
    };

    const openDropdown = (programId: string, mode: DropdownMode) => {
        setAthleteSearch(''); // Reset search when opening/switching
        if (dropdownOpen?.programId === programId && dropdownOpen?.mode === mode) {
            setDropdownOpen(null);
        } else {
            setDropdownOpen({ programId, mode });
        }
        setActionError('');
    };

    const actionBtnStyle = (isActive: boolean) => ({
        flex: 1, textAlign: 'center' as const, fontSize: '0.8rem',
        padding: '0.45rem 0.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
        background: isActive ? 'rgba(125, 135, 210, 0.2)' : 'rgba(255,255,255,0.04)',
        border: isActive ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid var(--glass-border)',
        color: isActive ? '#fff' : 'var(--secondary-foreground)',
        transition: 'all 0.15s var(--ease-out)',
    });

    const [athleteSearch, setAthleteSearch] = useState('');

    const filteredAthletes = athletes.filter(a => 
        a.name.toLowerCase().includes(athleteSearch.toLowerCase()) || 
        a.email.toLowerCase().includes(athleteSearch.toLowerCase())
    );

    const getActualStartDate = (startDate: string, weeks: any[]) => {
        if (!startDate) return 0;
        if (!Array.isArray(weeks)) return new Date(startDate).getTime();
        const nonEmpty = weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0);
        if (nonEmpty.length === 0) return new Date(startDate).getTime();
        const [sy, sm, sd] = startDate.split('T')[0].split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        const firstWn = Math.min(...nonEmpty.map(w => w.weekNumber || 1));
        const firstDay = new Date(start);
        firstDay.setDate(firstDay.getDate() + (firstWn - 1) * 7);
        return firstDay.getTime();
    };

    // Apply timeline filter and sort by active date (newest first)
    const filteredAndSortedPrograms = programs
        .filter((p: any) => {
            const days = TIMELINES[timeline];
            if (days === Infinity) return true;
            if (!p.startDate) return true;
            const actualStart = getActualStartDate(p.startDate, p.weeks);
            if (!actualStart) return true;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            return actualStart >= cutoff.getTime();
        })
        .sort((a: any, b: any) => {
            const dateA = getActualStartDate(a.startDate, a.weeks);
            const dateB = getActualStartDate(b.startDate, b.weeks);
            return dateB - dateA; // descending
        });

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>Assigned Programs</h2>
                {/* Timeline Filter */}
                <div style={{ display: 'flex', background: 'var(--glass-surface-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)' }}>
                    {Object.keys(TIMELINES).map(tl => (
                        <button
                            key={tl}
                            onClick={() => setTimeline(tl)}
                            className="chat-press"
                            style={{
                                padding: '0.35rem 0.85rem',
                                background: timeline === tl ? 'rgba(125, 135, 210, 0.2)' : 'transparent',
                                color: timeline === tl ? '#fff' : 'var(--secondary-foreground)',
                                border: timeline === tl ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '16px',
                                transition: 'all 0.16s var(--ease-out)',
                                boxShadow: timeline === tl ? '0 0 10px rgba(125, 135, 210, 0.25)' : 'none'
                            }}
                        >
                            {tl}
                        </button>
                    ))}
                </div>
            </div>
            
            {filteredAndSortedPrograms.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)', borderRadius: 12, border: '1px dashed var(--glass-border)' }}>
                    No programs found in the selected time range.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {filteredAndSortedPrograms.map((p: any) => {
                    const isTransferOpen = dropdownOpen?.programId === p.id && dropdownOpen?.mode === 'transfer';
                    const isCopyOpen = dropdownOpen?.programId === p.id && dropdownOpen?.mode === 'copy';
                    const isAnyDropdownOpen = isTransferOpen || isCopyOpen;

                    return (
                        <div key={p.id} className="glass-panel" style={{ position: 'relative', padding: '1.25rem' }}>
                            {/* Delete X */}
                            <button
                                onClick={() => handleDelete(p.id, p.name)}
                                className="chat-press"
                                style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    background: 'transparent', border: 'none',
                                    color: 'var(--secondary-foreground)', fontSize: '1.2rem',
                                    cursor: 'pointer', zIndex: 10
                                }}
                                title="Delete Program"
                            >
                                ×
                            </button>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingRight: '1rem' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--foreground)' }}>{p.name}</h3>
                                <span className="glass-badge" style={{ fontSize: '0.75rem', color: 'var(--primary)', borderColor: 'rgba(125, 135, 210, 0.3)' }}>
                                    {activeWeekCount(p.weeks)} Weeks
                                </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                                {activeDateRange(p.startDate, p.weeks)}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                                <Link
                                    href={`/dashboard/athletes/${athleteId}/programs/${p.id}`}
                                    className="glass-button chat-press"
                                    style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', padding: '0.45rem 0.5rem' }}
                                >
                                    Edit
                                </Link>
                                <button disabled={duplicatingId === p.id} onClick={() => handleDuplicate(p.id)} style={{...actionBtnStyle(false), opacity: duplicatingId === p.id ? 0.5 : 1}}>
                                    {duplicatingId === p.id ? 'Duplicating...' : 'Duplicate'}
                                </button>
                                <button onClick={() => openDropdown(p.id, 'copy')} style={actionBtnStyle(isCopyOpen)}>
                                    Copy
                                </button>
                                <button onClick={() => handleSaveAsTemplate(p.id, p.name)} style={actionBtnStyle(false)}>
                                    Template
                                </button>
                                <button onClick={() => openDropdown(p.id, 'transfer')} style={actionBtnStyle(isTransferOpen)}>
                                    Transfer
                                </button>
                            </div>

                            {/* Athlete picker dropdown for Transfer or Copy */}
                            {isAnyDropdownOpen && (
                                <div
                                    ref={dropdownRef}
                                    className="glass-panel-elevated"
                                    style={{
                                        marginTop: '0.65rem', padding: '0.85rem',
                                        borderRadius: 12, animation: 'popoverIn 160ms var(--ease-out)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', fontWeight: 600 }}>
                                            {isTransferOpen ? 'Transfer to:' : 'Copy to:'}
                                        </div>
                                    </div>

                                    {/* Search input field */}
                                    <input
                                        type="text"
                                        placeholder="Search athletes..."
                                        autoFocus
                                        value={athleteSearch}
                                        onChange={(e) => setAthleteSearch(e.target.value)}
                                        className="glass-input"
                                        style={{
                                            width: '100%', marginBottom: '0.75rem', padding: '0.45rem 0.75rem',
                                            fontSize: '0.8rem'
                                        }}
                                    />

                                    {athletes.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', padding: '0.5rem 0' }}>
                                            Loading athletes...
                                        </div>
                                    ) : filteredAthletes.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', padding: '0.5rem 0', textAlign: 'center' }}>
                                            No athletes found
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 200, overflowY: 'auto', paddingRight: '2px' }}>
                                            {filteredAthletes.map((a: any) => (
                                                <button
                                                    key={a.id}
                                                    disabled={actionLoading}
                                                    onClick={() => isTransferOpen
                                                        ? handleTransfer(p.id, a.id, a.name)
                                                        : handleCopy(p.id, a.id, a.name)
                                                    }
                                                    className="chat-press"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '0.5rem 0.75rem', borderRadius: 8,
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid var(--glass-border)',
                                                        color: 'var(--foreground)', cursor: actionLoading ? 'wait' : 'pointer',
                                                        fontSize: '0.85rem', fontWeight: 500,
                                                        transition: 'all 0.15s', textAlign: 'left',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(125, 135, 210, 0.15)';
                                                        e.currentTarget.style.borderColor = 'rgba(125, 135, 210, 0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {actionLoading && <div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
                                                        {a.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                                        {actionLoading ? 'Processing...' : a.email}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {actionError && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.4rem' }}>
                                            {actionError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type DropdownMode = 'transfer' | 'copy';

export default function ProgramList({ athleteId }) {
    const router = useRouter();
    const [programs, setPrograms] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState<{ programId: string; mode: DropdownMode } | null>(null);
    const [athletes, setAthletes] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadPrograms = async () => {
            const res = await fetch(`/api/programs?athleteId=${athleteId}`);
            const data = await res.json();
            setPrograms(data.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft'));
        };
        loadPrograms();
    }, [athleteId]);

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
                const data = await res.json();
                alert(data.error || 'Failed to save template');
            }
        } catch {
            alert('Network error');
        }
    };

    const handleDuplicate = async (programId: string) => {
        const program = programs.find((p: any) => p.id === programId);
        const programName = program ? (program as any).name : 'this program';
        if (!confirm(`Duplicate "${programName}"?`)) return;

        try {
            const res = await fetch('/api/programs/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId, targetAthleteId: athleteId }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Duplicate failed');
                return;
            }
            const result = await res.json();
            // Reload programs to show the new duplicate
            const listRes = await fetch(`/api/programs?athleteId=${athleteId}`);
            const listData = await listRes.json();
            setPrograms(listData.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft'));
        } catch {
            alert('Network error');
        }
    };

    if (programs.length === 0) return null;

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
        background: isActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.05)',
        border: isActive ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.12)',
        color: isActive ? 'var(--primary)' : 'var(--secondary-foreground)',
        transition: 'all 0.2s',
    });

    return (
        <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Assigned Programs</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {programs.map((p: any) => {
                    const isTransferOpen = dropdownOpen?.programId === p.id && dropdownOpen?.mode === 'transfer';
                    const isCopyOpen = dropdownOpen?.programId === p.id && dropdownOpen?.mode === 'copy';
                    const isAnyDropdownOpen = isTransferOpen || isCopyOpen;

                    return (
                        <div key={p.id} className="card" style={{ position: 'relative' }}>
                            {/* Delete X */}
                            <button
                                onClick={() => handleDelete(p.id, p.name)}
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
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{p.name}</h3>
                                <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent)', color: 'black', fontWeight: 'bold' }}>
                                    {activeWeekCount(p.weeks)} Weeks
                                </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                                {activeDateRange(p.startDate, p.weeks)}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                                <Link
                                    href={`/dashboard/athletes/${athleteId}/programs/${p.id}`}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', padding: '0.45rem 0.5rem' }}
                                >
                                    Edit
                                </Link>
                                <button onClick={() => handleDuplicate(p.id)} style={actionBtnStyle(false)}>
                                    Duplicate
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
                                    style={{
                                        marginTop: '0.5rem', padding: '0.75rem',
                                        background: 'rgba(0,0,0,0.6)', border: '1px solid var(--primary)',
                                        borderRadius: 10, backdropFilter: 'blur(12px)',
                                    }}
                                >
                                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        {isTransferOpen ? 'Transfer to:' : 'Copy to:'}
                                    </div>

                                    {athletes.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', padding: '0.5rem 0' }}>
                                            Loading athletes...
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 200, overflowY: 'auto' }}>
                                            {athletes.map((a: any) => (
                                                <button
                                                    key={a.id}
                                                    disabled={actionLoading}
                                                    onClick={() => isTransferOpen
                                                        ? handleTransfer(p.id, a.id, a.name)
                                                        : handleCopy(p.id, a.id, a.name)
                                                    }
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '0.5rem 0.75rem', borderRadius: 8,
                                                        background: 'rgba(255,255,255,0.04)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: 'var(--foreground)', cursor: actionLoading ? 'wait' : 'pointer',
                                                        fontSize: '0.85rem', fontWeight: 500,
                                                        transition: 'all 0.15s', textAlign: 'left',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.12)';
                                                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                                    }}
                                                >
                                                    <span>{a.name}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>{a.email}</span>
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
        </div>
    );
}

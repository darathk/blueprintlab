'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AthleteStatusCard({ athlete, progress, daysSinceLastLog = null, needsUpdate = false, hasNextBlockReady = false }) {
    const router = useRouter();
    const [editingEmail, setEditingEmail] = useState(false);
    const [emailValue, setEmailValue] = useState(athlete.email || '');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailError, setEmailError] = useState('');
    const emailInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingEmail) emailInputRef.current?.focus();
    }, [editingEmail]);

    const handleEmailSave = async () => {
        const trimmed = emailValue.trim();
        if (!trimmed || !trimmed.includes('@')) {
            setEmailError('Enter a valid email');
            return;
        }
        if (trimmed === athlete.email) {
            setEditingEmail(false);
            return;
        }
        setEmailSaving(true);
        setEmailError('');
        try {
            const res = await fetch(`/api/athletes/${athlete.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            if (!res.ok) {
                const data = await res.json();
                setEmailError(data.error || 'Failed to update');
                setEmailSaving(false);
                return;
            }
            athlete.email = trimmed;
            setEditingEmail(false);
            router.refresh();
        } catch {
            setEmailError('Network error');
        }
        setEmailSaving(false);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to the athlete page

        if (!window.confirm(`Are you sure you want to delete ${athlete.name}? This will permanently remove all their programs, logs, and messages.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/athletes/${athlete.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete athlete');
            }

            // Refresh the page to update the list
            router.refresh();
        } catch (error) {
            console.error("Deletion error:", error);
            alert("An error occurred while trying to delete the athlete.");
        }
    };

    const percentage = progress.totalSessions > 0
        ? Math.min(100, Math.round((progress.completedSessions / progress.totalSessions) * 100))
        : 0;

    // Meet countdown — parse YYYY-MM-DD in local time so the day isn't off by one near midnight UTC.
    const parseLocalMeetDate = (dateStr: any): Date | null => {
        if (!dateStr) return null;
        const s = String(dateStr).split('T')[0];
        const parts = s.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts.map(Number);
            const dt = new Date(y, m - 1, d);
            dt.setHours(0, 0, 0, 0);
            return dt;
        }
        const dt = new Date(dateStr);
        dt.setHours(0, 0, 0, 0);
        return dt;
    };
    const meetDate = parseLocalMeetDate(athlete.nextMeetDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let daysOut = 0;
    let weeksOut = 0;
    let meetPassed = false;
    if (meetDate) {
        const diffMs = meetDate.getTime() - now.getTime();
        daysOut = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        weeksOut = Math.floor(daysOut / 7);
        meetPassed = daysOut < 0;
    }

    return (
        <div
            className="glass-panel athlete-card-inner"
            style={{
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid var(--card-border)'
            }}
            onClick={() => router.push(`/dashboard/athletes/${athlete.id}`)}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--card-border)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div className="flex-mobile-col athlete-card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {athlete.name}
                        <button
                            onClick={handleDelete}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--destructive)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                padding: '0.2rem 0.5rem',
                                opacity: 0.6,
                                transition: 'opacity 0.2s',
                                fontWeight: 'normal'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                            title="Delete Athlete"
                        >
                            Delete
                        </button>
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}></span>
                        {progress.programName}
                    </div>

                    {/* Email – inline edit */}
                    {editingEmail ? (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                    ref={emailInputRef}
                                    type="email"
                                    value={emailValue}
                                    onChange={(e) => { setEmailValue(e.target.value); setEmailError(''); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEmailSave();
                                        if (e.key === 'Escape') { setEditingEmail(false); setEmailValue(athlete.email || ''); setEmailError(''); }
                                    }}
                                    style={{
                                        flex: 1, fontSize: '0.8rem', padding: '4px 8px',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid var(--primary)',
                                        borderRadius: 6, color: 'var(--foreground)', outline: 'none',
                                        minWidth: 0,
                                    }}
                                    placeholder="athlete@email.com"
                                />
                                <button
                                    onClick={handleEmailSave}
                                    disabled={emailSaving}
                                    style={{
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
                                        border: 'none', cursor: 'pointer', fontWeight: 600,
                                        background: 'var(--primary)', color: '#000',
                                    }}
                                >
                                    {emailSaving ? '...' : 'Save'}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingEmail(false); setEmailValue(athlete.email || ''); setEmailError(''); }}
                                    style={{
                                        fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6,
                                        border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                                        background: 'transparent', color: 'var(--secondary-foreground)',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                            {emailError && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--destructive)' }}>{emailError}</span>
                            )}
                        </div>
                    ) : (
                        <div
                            onClick={(e) => { e.stopPropagation(); setEditingEmail(true); }}
                            style={{
                                marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--secondary-foreground)'}
                            title="Click to edit email"
                        >
                            <span style={{ fontSize: '0.75rem' }}>✉</span>
                            <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                                {athlete.email || 'Add email'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Meet Info */}
            {athlete.nextMeetDate && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    background: meetPassed
                        ? 'rgba(239, 68, 68, 0.08)'
                        : daysOut <= 14
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(6, 182, 212, 0.08)',
                    border: `1px solid ${meetPassed
                        ? 'rgba(239, 68, 68, 0.2)'
                        : daysOut <= 14
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(6, 182, 212, 0.15)'
                        }`,
                    fontSize: '0.8rem'
                }}>
                    <span style={{ fontSize: '1rem' }}>
                        {meetPassed ? '' : daysOut <= 14 ? '' : ''}
                    </span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                            {athlete.nextMeetName || 'Meet'}
                        </div>
                        <div style={{ color: 'var(--secondary-foreground)', fontSize: '0.75rem', marginTop: '1px' }}>
                            {meetDate ? meetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </div>
                    </div>
                    <div style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: meetPassed
                            ? 'var(--destructive)'
                            : daysOut <= 14
                                ? '#F59E0B'
                                : 'var(--primary)',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap'
                    }}>
                        {meetPassed ? (
                            <span>Completed</span>
                        ) : (
                            <>
                                <div>{weeksOut}w {daysOut % 7}d out</div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.8 }}>{daysOut} days</div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Needs Update alert */}
            {needsUpdate && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.75rem',
                    borderRadius: '8px',
                    background: hasNextBlockReady ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${hasNextBlockReady ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    fontSize: '0.78rem',
                }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: hasNextBlockReady ? '#F59E0B' : '#EF4444',
                        animation: 'pulse 2s infinite',
                    }} />
                    <span style={{ color: hasNextBlockReady ? '#FCD34D' : '#FCA5A5', fontWeight: 600 }}>
                        {hasNextBlockReady ? '⚡ Finishing soon — next block ready' : '⚠️ Finishing soon — needs new program'}
                    </span>
                </div>
            )}

            {/* Missed session alert */}
            {daysSinceLastLog !== null && (daysSinceLastLog === -1 || daysSinceLastLog >= 3) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.75rem',
                    borderRadius: '8px',
                    background: daysSinceLastLog >= 7 || daysSinceLastLog === -1
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${daysSinceLastLog >= 7 || daysSinceLastLog === -1
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(245, 158, 11, 0.25)'}`,
                    fontSize: '0.78rem',
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: daysSinceLastLog >= 7 || daysSinceLastLog === -1 ? '#EF4444' : '#F59E0B',
                        flexShrink: 0,
                        animation: 'pulse 2s infinite',
                    }} />
                    <span style={{
                        color: daysSinceLastLog >= 7 || daysSinceLastLog === -1
                            ? '#FCA5A5'
                            : '#FCD34D',
                        fontWeight: 600,
                    }}>
                        {daysSinceLastLog === -1
                            ? 'No sessions logged yet'
                            : `No log in ${daysSinceLastLog} day${daysSinceLastLog !== 1 ? 's' : ''}`}
                    </span>
                </div>
            )}

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                        Session {progress.completedSessions} <span style={{ color: 'var(--secondary-foreground)' }}>/ {progress.totalSessions}</span>
                    </div>
                </div>

                {/* Progress Bar Track + Percentage */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                            borderRadius: '3px',
                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 0 10px var(--primary)'
                        }}></div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', minWidth: '2.5rem', textAlign: 'right' }}>{percentage}%</span>
                </div>
            </div>
        </div>
    );
}

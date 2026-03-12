'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AthleteStatusCard from '@/app/dashboard/athlete-status-card';

export default function ActivePersonnelList({ athletes, programs, logSummaries, coachId }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'progress'>('name');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        const currentProgram = programs.find(p => p.id === athlete.currentProgramId);

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

        return {
            ...athlete,
            computedProgress: progress,
            progressPercent
        };
    });

    const displayAthletes = enrichedAthletes
        .filter(athlete =>
            athlete.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'progress') {
                return b.progressPercent - a.progressPercent;
            }
            return a.name.localeCompare(b.name);
        });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                borderBottom: '1px solid var(--card-border)',
                paddingBottom: '0.5rem',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', color: 'var(--foreground)', margin: 0 }}>
                        <span className="neon-text">///</span> Active Personnel
                    </h2>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                        {isAdding ? 'Cancel' : '+ Add Athlete'}
                    </button>
                </div>

                {/* Search & Sort UI */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '500px', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '8px',
                                border: '1px solid var(--card-border)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                color: 'var(--foreground)',
                                fontSize: '0.85rem',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="name">Name</option>
                            <option value="progress">Progress (%)</option>
                        </select>
                    </div>

                    <input
                        type="text"
                        placeholder="Search athletes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '9999px',
                            border: '1px solid var(--card-border)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            color: 'var(--foreground)',
                            fontSize: '0.9rem',
                            width: '100%',
                            maxWidth: '220px',
                            outline: 'none',
                            transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = 'var(--primary)';
                            e.target.style.boxShadow = '0 0 10px rgba(6,182,212,0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = 'var(--card-border)';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

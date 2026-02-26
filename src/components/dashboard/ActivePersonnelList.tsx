'use client';

import { useState } from 'react';
import AthleteStatusCard from '@/app/dashboard/athlete-status-card';

export default function ActivePersonnelList({ athletes, programs, logSummaries }) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAthletes = athletes.filter(athlete =>
        athlete.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                <h2 style={{ fontSize: '1.5rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <span className="neon-text">///</span> Active Personnel
                </h2>

                {/* Search Bar */}
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
                        maxWidth: '250px',
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

            {filteredAthletes.length === 0 ? (
                <p style={{ color: 'var(--secondary-foreground)' }}>
                    {athletes.length === 0 ? "No athletes found." : "No athletes match your search."}
                </p>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredAthletes.map(athlete => {
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

                        return (
                            <AthleteStatusCard
                                key={athlete.id}
                                athlete={athlete}
                                progress={progress}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

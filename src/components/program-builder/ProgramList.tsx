'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProgramList({ athleteId }) {
    const [programs, setPrograms] = useState([]);

    useEffect(() => {
        const loadPrograms = async () => {
            const res = await fetch(`/api/programs?athleteId=${athleteId}`);
            const data = await res.json();
            // Fallback filter just in case, and exclude draft programs from display
            setPrograms(data.filter((p: any) => p.athleteId === athleteId && p.status !== 'draft'));
        };
        loadPrograms();
    }, [athleteId]);

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

    if (programs.length === 0) return null;

    // Helper to render date safely across timezones
    const safeDate = (isoString) => {
        if (!isoString) return '';
        const [y, m, d] = isoString.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString();
    };

    // Count only weeks that have at least one session
    const activeWeekCount = (weeks) => {
        if (!Array.isArray(weeks)) return 0;
        return weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0).length;
    };

    // Compute date range from only non-empty weeks
    const activeDateRange = (startDate, weeks) => {
        if (!startDate || !Array.isArray(weeks)) return '';
        const nonEmpty = weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0);
        if (nonEmpty.length === 0) return '';
        const [sy, sm, sd] = startDate.split('T')[0].split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        start.setHours(0, 0, 0, 0);
        // Week 1 Sunday
        const dow = start.getDay();
        const week1Sunday = new Date(start);
        week1Sunday.setDate(week1Sunday.getDate() - dow);
        // First and last non-empty week numbers
        const firstWn = Math.min(...nonEmpty.map(w => w.weekNumber || 1));
        const lastWn = Math.max(...nonEmpty.map(w => w.weekNumber || 1));
        const firstSunday = new Date(week1Sunday);
        firstSunday.setDate(firstSunday.getDate() + (firstWn - 1) * 7);
        const lastSaturday = new Date(week1Sunday);
        lastSaturday.setDate(lastSaturday.getDate() + (lastWn - 1) * 7 + 6);
        return `${firstSunday.toLocaleDateString()} — ${lastSaturday.toLocaleDateString()}`;
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Assigned Programs</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {programs.map((p: any) => (
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

                        <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                            <Link
                                href={`/dashboard/athletes/${athleteId}/programs/${p.id}`}
                                className="btn btn-secondary"
                                style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem' }}
                            >
                                ✏️ Edit
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

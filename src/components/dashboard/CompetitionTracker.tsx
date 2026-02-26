'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompetitionTracker({ athlete }) {
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    // Use optional chaining to prevent crash if athlete is undefined
    const [meetName, setMeetName] = useState(athlete?.nextMeetName || '');
    const [meetDate, setMeetDate] = useState(athlete?.nextMeetDate || '');

    useEffect(() => {
        if (athlete) {
            setMeetName(athlete.nextMeetName || '');
            setMeetDate(athlete.nextMeetDate || '');
        }
    }, [athlete]);

    if (!athlete) return null;

    const handleSave = async () => {
        await fetch('/api/athletes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: athlete.id, nextMeetName: meetName, nextMeetDate: meetDate })
        });
        setIsEditing(false);
        router.refresh();
    };

    const getDaysOut = () => {
        if (!athlete.nextMeetDate) return null;
        const meet = new Date(athlete.nextMeetDate);
        // Calculate days/weeks
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set today to midnight for accurate day difference
        const diffTime = meet.getTime() - today.getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const weeks = Math.floor(totalDays / 7);
        const days = totalDays % 7;

        // Assuming a 16-week (112 days) prep for percentage calculation
        const percentage = Math.max(0, Math.min(100, 100 - ((totalDays / 112) * 100)));

        return { totalDays, weeks, days, percentage, meetDateObj: meet };
    };

    const daysOutData = getDaysOut();
    const { totalDays, weeks, days, percentage, meetDateObj } = daysOutData || {};


    // Visualization Chart
    // Simple bar chart: Start (Date Updated/Created?) -> End (Meet Date)
    // For now, let's just show a nice big countdown number and a visual gauge.

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Background decoration */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="neon-text">
                    <span>🛸</span> Target Coordinates
                </h2>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                >
                    {isEditing ? 'Cancel' : 'Calibrate Target'}
                </button>
            </div>

            {isEditing ? (
                <div className="competition-edit-grid" style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr auto', alignItems: 'end', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <div>
                        <label className="label">Mission Name (Meet)</label>
                        <input
                            className="input"
                            placeholder="e.g. Galactic Championships"
                            value={meetName}
                            onChange={(e) => setMeetName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label">Launch Date</label>
                        <input
                            className="input"
                            type="date"
                            value={meetDate}
                            onChange={(e) => setMeetDate(e.target.value)}
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSave}>Lock Coordinates</button>
                </div>
            ) : (
                <>
                    {!athlete.nextMeetDate ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--secondary-foreground)', border: '1px dashed var(--card-border)', borderRadius: '8px' }}>
                            No mission data found. Calibrate target to begin countdown.
                        </div>
                    ) : (
                        <div className="competition-countdown" style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                            {/* Big Number Section */}
                            <div className="competition-countdown-number" style={{ textAlign: 'center', minWidth: '160px' }}>
                                <div style={{
                                    fontSize: '3.5rem',
                                    fontWeight: 800,
                                    color: totalDays > 0 ? 'var(--primary)' : 'var(--secondary-foreground)',
                                    lineHeight: 1,
                                    textShadow: totalDays > 0 ? '0 0 20px rgba(6, 182, 212, 0.5)' : 'none'
                                }}>
                                    {totalDays > 0 ? (
                                        <span>{totalDays}</span>
                                    ) : 0}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.5rem', fontWeight: 600 }}>
                                    Days Remaining
                                </div>
                            </div>

                            {/* Details & Visual Bar */}
                            <div style={{ flex: 1 }}>
                                <h3 className="competition-meet-name" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{athlete.nextMeetName || 'Unidentified Mission'}</h3>
                                <div style={{ fontSize: '1rem', color: 'var(--secondary-foreground)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📅</span>
                                    Launch: <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{new Date(athlete.nextMeetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>

                                <div style={{ position: 'relative', height: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                                    {/* Grid Lines in Bar */}
                                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, transparent 95%, rgba(255,255,255,0.05) 95%)', backgroundSize: '5% 100%' }}></div>

                                    <div style={{
                                        width: `${percentage}%`,
                                        background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
                                        height: '100%',
                                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)',
                                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}></div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <span>Prep Initiation</span>
                                    <span style={{ color: 'var(--accent)' }}>Mission Day</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

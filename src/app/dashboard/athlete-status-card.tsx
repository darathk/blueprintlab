'use client';

import { useRouter } from 'next/navigation';

export default function AthleteStatusCard({ athlete, progress }) {
    const router = useRouter();

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
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', opacity: 0.8 }}>
                    {percentage}%
                </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                        Session {progress.completedSessions} <span style={{ color: 'var(--secondary-foreground)' }}>/ {progress.totalSessions}</span>
                    </div>
                    <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        Week {progress.currentWeek} <span style={{ color: 'var(--secondary-foreground)', fontWeight: 400 }}>/ {progress.totalWeeks}</span>
                    </div>
                </div>

                {/* Progress Bar Track */}
                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    {/* Progress Bar Fill */}
                    <div style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                        borderRadius: '3px',
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 0 10px var(--primary)'
                    }}></div>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProgramList({ athleteId }) {
    const [programs, setPrograms] = useState([]);

    useEffect(() => {
        const loadPrograms = async () => {
            const res = await fetch('/api/programs');
            const data = await res.json();
            setPrograms(data.filter((p: any) => p.athleteId === athleteId));
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
                                {p.weeks?.length || 0} Weeks
                            </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)', marginBottom: '1rem' }}>
                            {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}
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

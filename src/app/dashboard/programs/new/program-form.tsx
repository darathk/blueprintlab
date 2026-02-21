'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProgramForm() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        weeks: [
            {
                weekNumber: 1,
                sessions: [
                    {
                        day: 1,
                        name: "Session 1",
                        exercises: [] as any[]
                    }
                ]
            }
        ]
    });

    const handleProgramChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const addWeek = () => {
        setFormData({
            ...formData,
            weeks: [
                ...formData.weeks,
                {
                    weekNumber: formData.weeks.length + 1,
                    sessions: [{ day: 1, name: "Session 1", exercises: [] as any[] }]
                }
            ]
        });
    };

    const addSession = (weekIndex) => {
        const updatedWeeks = [...formData.weeks];
        updatedWeeks[weekIndex].sessions.push({
            day: updatedWeeks[weekIndex].sessions.length + 1,
            name: `Session ${updatedWeeks[weekIndex].sessions.length + 1}`,
            exercises: [] as any[]
        });
        setFormData({ ...formData, weeks: updatedWeeks });
    };

    const addExercise = (weekIndex, sessionIndex) => {
        const updatedWeeks = [...formData.weeks];
        updatedWeeks[weekIndex].sessions[sessionIndex].exercises.push({
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            sets: 3,
            reps: '8-12',
            rpeTarget: 8,
            notes: ''
        });
        setFormData({ ...formData, weeks: updatedWeeks });
    };

    const updateExercise = (weekIndex, sessionIndex, exerciseIndex, field, value) => {
        const updatedWeeks = [...formData.weeks];
        updatedWeeks[weekIndex].sessions[sessionIndex].exercises[exerciseIndex][field] = value;
        setFormData({ ...formData, weeks: updatedWeeks });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/programs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    endDate: (() => {
                        if (!formData.startDate) return null;
                        const start = new Date(formData.startDate);
                        const days = formData.weeks.length * 7;
                        start.setDate(start.getDate() + days);
                        return start.toISOString().split('T')[0];
                    })()
                }),
            });

            if (res.ok) {
                router.push('/dashboard');
                router.refresh(); // Refresh server component data
            } else {
                alert('Failed to save program');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving program');
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ maxWidth: '800px' }}>
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Program Details</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                        <label className="label">Program Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleProgramChange}
                            className="input"
                            required
                            placeholder="e.g. Hypertrophy Block 1"
                        />
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label className="label">Start Date</label>
                        <input
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleProgramChange}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">End Date (Auto-Calculated)</label>
                        <input
                            type="date"
                            name="endDate"
                            value={
                                (() => {
                                    if (!formData.startDate) return '';
                                    const start = new Date(formData.startDate);
                                    const days = formData.weeks.length * 7;
                                    start.setDate(start.getDate() + days); // Weeks * 7 days
                                    return start.toISOString().split('T')[0];
                                })()
                            }
                            readOnly
                            className="input"
                            style={{ opacity: 0.7, cursor: 'not-allowed' }}
                        />
                    </div>
                </div>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--secondary-foreground)' }}>
                    Duration: <strong>{formData.weeks.length} Weeks</strong>
                </div>
            </div>

            {formData.weeks.map((week, wIndex) => (
                <div key={wIndex} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Week {week.weekNumber}</h3>

                    {week.sessions.map((session, sIndex) => (
                        <div key={sIndex} className="card" style={{ marginBottom: '1rem', marginLeft: '1rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{session.name}</h4>

                            <div style={{ marginBottom: '1rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>
                                            <th style={{ padding: '0.5rem' }}>Exercise</th>
                                            <th style={{ padding: '0.5rem', width: '80px' }}>Sets</th>
                                            <th style={{ padding: '0.5rem', width: '100px' }}>Reps</th>
                                            <th style={{ padding: '0.5rem', width: '80px' }}>RPE</th>
                                            <th style={{ padding: '0.5rem' }}>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {session.exercises.map((ex, eIndex) => (
                                            <tr key={ex.id}>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        value={ex.name}
                                                        onChange={(e) => updateExercise(wIndex, sIndex, eIndex, 'name', e.target.value)}
                                                        placeholder="Exercise Name"
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        type="number"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        value={ex.sets}
                                                        onChange={(e) => updateExercise(wIndex, sIndex, eIndex, 'sets', parseInt(e.target.value))}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        value={ex.reps}
                                                        onChange={(e) => updateExercise(wIndex, sIndex, eIndex, 'reps', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        type="number"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        value={ex.rpeTarget}
                                                        onChange={(e) => updateExercise(wIndex, sIndex, eIndex, 'rpeTarget', parseFloat(e.target.value))}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        value={ex.notes}
                                                        onChange={(e) => updateExercise(wIndex, sIndex, eIndex, 'notes', e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button type="button" onClick={() => addExercise(wIndex, sIndex)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                                + Add Exercise
                            </button>
                        </div>
                    ))}

                    <button type="button" onClick={() => addSession(wIndex)} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
                        + Add Session to Week {week.weekNumber}
                    </button>
                </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={addWeek} className="btn btn-secondary">
                    + Add Week
                </button>
                <button type="submit" className="btn btn-primary">
                    Save Program
                </button>
            </div>
        </form>
    );
}

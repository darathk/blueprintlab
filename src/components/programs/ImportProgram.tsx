'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportProgram({ onImport }: { onImport?: (data: any) => void }) {
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState('');
    // router not needed anymore if we don't refresh
    // const router = useRouter();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setError('');

        try {
            const text = await file.text();
            const rows = text.split('\n').map(row => row.split(','));

            // Basic Validation
            const header = rows[0].map(h => h.trim().toLowerCase());
            if (!header.includes('week') || !header.includes('day') || !header.includes('exercise')) {
                throw new Error('Invalid CSV format. Please use the template.');
            }

            // Parse CSV to Flat Data
            const flatData = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 3) continue;

                // Simple regex for CSV split handling quotes (same as before or better)
                const cells = row.map(c => c.replace(/^"|"$/g, '').trim());

                flatData.push({
                    week: parseInt(cells[0]) || 1,
                    day: parseInt(cells[1]) || 1,
                    exercise: cells[2],
                    sets: parseInt(cells[3]) || 3,
                    reps: cells[4] || '5',
                    rpe: parseFloat(cells[5]) || 8,
                    notes: cells[6] || ''
                });
            }

            // Structure Data for ProgramForm
            const weeksMap = new Map();

            flatData.forEach((row) => {
                const weekNum = row.week || 1;
                const dayNum = row.day || 1;

                if (!weeksMap.has(weekNum)) {
                    weeksMap.set(weekNum, {
                        weekNumber: weekNum,
                        sessions: new Map()
                    });
                }

                const week = weeksMap.get(weekNum);

                if (!week.sessions.has(dayNum)) {
                    week.sessions.set(dayNum, {
                        day: dayNum,
                        name: `Session ${dayNum}`, // Or Day {dayNum} depending on preference
                        exercises: []
                    });
                }

                const session = week.sessions.get(dayNum);

                if (row.exercise) {
                    session.exercises.push({
                        id: Math.random().toString(36).substr(2, 9), // Client-side ID
                        name: row.exercise,
                        sets: row.sets,
                        reps: row.reps,
                        rpeTarget: row.rpe,
                        notes: row.notes || ''
                    });
                }
            });

            const weeks = Array.from(weeksMap.values()).map((week: any) => ({
                ...week,
                sessions: Array.from(week.sessions.values())
            }));

            const structuredData = {
                name: file.name.replace('.csv', ''),
                weeks: weeks
            };

            // Pass data to parent
            if (onImport) {
                onImport(structuredData);
            } else {
                // Fallback or deprecated behavior if needed, but we are moving it.
                alert('Imported data ready but no handler attached.');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error parsing file');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label className="btn" style={{
                background: 'var(--accent)', color: 'black', padding: '0.5rem 1rem',
                borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
            }}>
                Import Program (CSV)
                <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    disabled={isImporting}
                />
            </label>

            <a href="/program_template.csv" download style={{ fontSize: '0.9rem', color: 'var(--primary)', textDecoration: 'underline' }}>
                Download Template
            </a>

            {isImporting && <span style={{ fontSize: '0.9rem', color: 'var(--secondary-foreground)' }}>Importing...</span>}
            {error && <span style={{ fontSize: '0.9rem', color: 'red' }}>{error}</span>}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, Trash2 } from 'lucide-react';

interface PastMeet {
    id: string;
    date: string;
    meetName: string;
    bodyweight: number;
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
    dots: number;
}

export default function HistoricalPerformance({ athlete }) {
    const router = useRouter();
    const [pastMeets, setPastMeets] = useState<PastMeet[]>(athlete.pastMeets || []);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setError('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const parsedMeets = results.data.map((row: any) => ({
                        id: Math.random().toString(36).substring(7),
                        date: row.Date || '',
                        meetName: row.MeetName || '',
                        bodyweight: parseFloat(row.BodyweightKg) || 0,
                        squat: parseFloat(row.Best3SquatKg) || 0,
                        bench: parseFloat(row.Best3BenchKg) || 0,
                        deadlift: parseFloat(row.Best3DeadliftKg) || 0,
                        total: parseFloat(row.TotalKg) || 0,
                        dots: parseFloat(row.Dots) || parseFloat(row.Goodlift) || 0,
                    }));

                    // Sort by newest date first
                    parsedMeets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    const newPastMeets = [...pastMeets, ...parsedMeets];
                    setPastMeets(newPastMeets);
                    saveToBackend(newPastMeets);

                } catch (err) {
                    setError('Failed to parse OpenPowerlifting CSV format.');
                    console.error(err);
                }
                setIsUploading(false);
                // Clear input
                e.target.value = null;
            },
            error: (err) => {
                setError('CSV parsing error.');
                setIsUploading(false);
            }
        });
    };

    const deleteMeet = (idToRemove) => {
        const confirmDelete = window.confirm("Remove this meet result?");
        if (confirmDelete) {
            const updatedMeets = pastMeets.filter(meet => meet.id !== idToRemove);
            setPastMeets(updatedMeets);
            saveToBackend(updatedMeets);
        }
    };

    const saveToBackend = async (dataToSave) => {
        try {
            await fetch('/api/athletes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: athlete.id,
                    pastMeets: dataToSave
                })
            });
            router.refresh();
        } catch (err) {
            console.error('Failed to save past meets', err);
        }
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                    Track past performance. Upload CSV exports from OpenPowerlifting.
                </p>
                <div>
                    <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <Upload size={16} />
                        {isUploading ? 'Parsing...' : 'Import CSV'}
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploading} />
                    </label>
                </div>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

            {pastMeets.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', border: '1px dashed var(--card-border)', borderRadius: '0.5rem', color: 'var(--secondary-foreground)' }}>
                    No historical meet data imported.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: '0.5rem', background: 'var(--card-bg)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>Date</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>Meet</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>BW (kg)</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>Squat</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>Bench</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>Deadlift</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--primary)', textAlign: 'right', fontWeight: 600 }}>Total</th>
                                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--secondary-foreground)', textAlign: 'right' }}>Dots</th>
                                <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pastMeets.map((meet, index) => (
                                <tr key={meet.id || index} style={{ borderBottom: index < pastMeets.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{meet.date}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={meet.meetName}>{meet.meetName}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'right', color: 'var(--secondary-foreground)' }}>{meet.bodyweight}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'right' }}>{meet.squat}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'right' }}>{meet.bench}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'right' }}>{meet.deadlift}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.95rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{meet.total}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', textAlign: 'right', color: 'var(--secondary-foreground)' }}>{meet.dots.toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <button onClick={() => deleteMeet(meet.id)} style={{ color: '#ef4444', opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none' }} title="Remove Meet">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

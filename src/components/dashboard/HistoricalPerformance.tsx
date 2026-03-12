'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, Trash2, Plus, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateDots } from '@/lib/dots';

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

    const [showAddForm, setShowAddForm] = useState(false);
    const [newMeet, setNewMeet] = useState({
        date: new Date().toISOString().split('T')[0],
        name: '',
        bw: '',
        squat: '',
        bench: '',
        deadlift: ''
    });

    const handleAddMeet = (e) => {
        e.preventDefault();
        setError('');

        if (!newMeet.date || !newMeet.name || !newMeet.bw) {
            setError('Date, meet name, and bodyweight are required.');
            return;
        }

        const bw = parseFloat(newMeet.bw) || 0;
        const squat = parseFloat(newMeet.squat) || 0;
        const bench = parseFloat(newMeet.bench) || 0;
        const deadlift = parseFloat(newMeet.deadlift) || 0;
        const total = squat + bench + deadlift;

        // athlete.gender might be needed for perfect DOTs 
        // default to 'male' if unspecified in athlete object for calculation fallback
        const gender = athlete.gender === 'female' ? 'female' : 'male';
        const dots = total > 0 && bw > 0 ? calculateDots(total, bw, gender) : 0;

        const meetEntry: PastMeet = {
            id: Math.random().toString(36).substring(7),
            date: newMeet.date,
            meetName: newMeet.name,
            bodyweight: bw,
            squat,
            bench,
            deadlift,
            total,
            dots
        };

        const newPastMeets = [...pastMeets, meetEntry];
        newPastMeets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setPastMeets(newPastMeets);
        saveToBackend(newPastMeets);
        setShowAddForm(false);
        setNewMeet({ date: new Date().toISOString().split('T')[0], name: '', bw: '', squat: '', bench: '', deadlift: '' });
    };

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
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {showAddForm ? <X size={16} /> : <Plus size={16} />}
                        {showAddForm ? 'Cancel' : 'Add Manually'}
                    </button>
                    <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <Upload size={16} />
                        {isUploading ? 'Parsing...' : 'Import CSV'}
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploading} />
                    </label>
                </div>
            </div>

            {/* Manual Entry Form */}
            {showAddForm && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--foreground)' }}>Log Past Meet</h3>
                    <form onSubmit={handleAddMeet} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>Date *</label>
                            <input type="date" className="input" value={newMeet.date} onChange={e => setNewMeet({ ...newMeet, date: e.target.value })} required style={{ width: '100%' }} />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>Meet Name *</label>
                            <input type="text" className="input" placeholder="e.g. USAPL Nationals" value={newMeet.name} onChange={e => setNewMeet({ ...newMeet, name: e.target.value })} required style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>BW (kg) *</label>
                            <input type="number" step="0.1" className="input" placeholder="0" value={newMeet.bw} onChange={e => setNewMeet({ ...newMeet, bw: e.target.value })} required style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>Squat (kg)</label>
                            <input type="number" step="0.5" className="input" placeholder="0" value={newMeet.squat} onChange={e => setNewMeet({ ...newMeet, squat: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>Bench (kg)</label>
                            <input type="number" step="0.5" className="input" placeholder="0" value={newMeet.bench} onChange={e => setNewMeet({ ...newMeet, bench: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem' }}>Deadlift (kg)</label>
                            <input type="number" step="0.5" className="input" placeholder="0" value={newMeet.deadlift} onChange={e => setNewMeet({ ...newMeet, deadlift: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary">Save Meet</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Chart */}
            {pastMeets.length > 1 && (
                <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 8px 8px', marginBottom: '2rem' }}>
                    <div style={{ paddingLeft: '1rem', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--primary)' }}>///</span> Meet Progression
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={[...pastMeets].reverse()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                            />
                            <YAxis yAxisId="total" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={62} label={{ value: 'Total (kg)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10 }} />
                            <YAxis yAxisId="dots" orientation="right" tick={{ fill: 'var(--accent)', fontSize: 11 }} axisLine={false} tickLine={false} width={58} label={{ value: 'DOTs', angle: 90, position: 'insideRight', offset: -4, fill: 'var(--accent)', fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'white' }}
                                labelStyle={{ color: 'var(--secondary-foreground)', marginBottom: '4px' }}
                            />
                            <Line yAxisId="total" type="monotone" dataKey="total" name="Total (kg)" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="dots" type="monotone" dataKey="dots" name="DOTs Score" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

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

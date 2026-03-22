'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, Plus, X, Trash2 } from 'lucide-react';
import { calculateGL, calculateDots } from '@/lib/calculators';

interface MeetEntry {
    id: string;
    athleteId: string;
    athleteName: string;
    category: string;
    weightClass: number;
    bodyweight: number;
    meetDate: string;
    meetName: string;
    squat: [number, number, number]; // 3 attempts
    squatResults: [boolean, boolean, boolean]; // true = good, false = miss
    bench: [number, number, number];
    benchResults: [boolean, boolean, boolean];
    deadlift: [number, number, number];
    deadliftResults: [boolean, boolean, boolean];
    gender: string;
}

interface Props {
    athletes: any[];
    coachId: string;
}

export default function MeetDataTable({ athletes, coachId }: Props) {
    const router = useRouter();

    // Build initial meet data from all athletes' pastMeets
    const buildInitialData = (): MeetEntry[] => {
        const entries: MeetEntry[] = [];
        for (const a of athletes) {
            const meets = a.pastMeets || [];
            for (const m of meets) {
                if (m._meetDataEntry) {
                    entries.push({ ...m._meetDataEntry, athleteId: a.id, athleteName: a.name });
                }
            }
        }
        entries.sort((a, b) => (a.meetDate || '').localeCompare(b.meetDate || ''));
        return entries;
    };

    const [entries, setEntries] = useState<MeetEntry[]>(buildInitialData);
    const [showAddForm, setShowAddForm] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState('');

    // New entry form
    const [newEntry, setNewEntry] = useState({
        athleteId: '', category: '', weightClass: '', bodyweight: '', meetDate: '', meetName: '', gender: 'male',
        sq1: '', sq2: '', sq3: '', sq1g: true, sq2g: true, sq3g: true,
        bp1: '', bp2: '', bp3: '', bp1g: true, bp2g: true, bp3g: true,
        dl1: '', dl2: '', dl3: '', dl1g: true, dl2g: true, dl3g: true,
    });

    // Calculations
    const calcSuccessful = (e: MeetEntry) => {
        let good = 0;
        e.squatResults.forEach(r => { if (r) good++; });
        e.benchResults.forEach(r => { if (r) good++; });
        e.deadliftResults.forEach(r => { if (r) good++; });
        return good;
    };

    const calcTotalAttempts = (e: MeetEntry) => {
        let total = 0;
        e.squat.forEach(v => { if (v > 0) total++; });
        e.bench.forEach(v => { if (v > 0) total++; });
        e.deadlift.forEach(v => { if (v > 0) total++; });
        return total || 9;
    };

    const bestLift = (attempts: [number, number, number], results: [boolean, boolean, boolean]) => {
        let best = 0;
        attempts.forEach((v, i) => { if (results[i] && v > best) best = v; });
        return best;
    };

    const calcTotal = (e: MeetEntry) => {
        const sq = bestLift(e.squat, e.squatResults);
        const bp = bestLift(e.bench, e.benchResults);
        const dl = bestLift(e.deadlift, e.deadliftResults);
        if (sq === 0 || bp === 0 || dl === 0) return 0;
        return sq + bp + dl;
    };

    // Track total PRs per athlete
    const totalPRs = useMemo(() => {
        const prs: Record<string, number> = {};
        const sorted = [...entries].sort((a, b) => (a.meetDate || '').localeCompare(b.meetDate || ''));
        for (const e of sorted) {
            const total = calcTotal(e);
            if (total <= 0) continue;
            const prev = prs[e.athleteId] || 0;
            if (total > prev) {
                prs[e.athleteId] = total;
                (e as any)._totalPR = prev > 0 ? total - prev : 0;
                (e as any)._isFirstMeet = prev === 0;
            } else {
                (e as any)._totalPR = 0;
                (e as any)._isFirstMeet = false;
            }
        }
        return prs;
    }, [entries]);

    // Averages
    const averages = useMemo(() => {
        const withTotals = entries.filter(e => calcTotal(e) > 0);
        if (withTotals.length === 0) return null;
        const avgSuccessful = withTotals.reduce((s, e) => s + calcSuccessful(e), 0) / withTotals.length;
        const avgTotal = withTotals.reduce((s, e) => s + calcTotalAttempts(e), 0) / withTotals.length;
        const avgPercent = withTotals.reduce((s, e) => s + (calcSuccessful(e) / calcTotalAttempts(e) * 100), 0) / withTotals.length;
        const avgTotalKg = withTotals.reduce((s, e) => s + calcTotal(e), 0) / withTotals.length;
        const avgDots = withTotals.reduce((s, e) => {
            const total = calcTotal(e);
            const bw = e.bodyweight || e.weightClass;
            const isMale = e.gender !== 'female';
            return s + (total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0);
        }, 0) / withTotals.length;
        return { avgSuccessful: avgSuccessful.toFixed(1), avgTotal: avgTotal.toFixed(0), avgPercent: avgPercent.toFixed(1), avgTotalKg: avgTotalKg.toFixed(1), avgDots: avgDots.toFixed(2) };
    }, [entries]);

    const saveEntriesToBackend = async (updatedEntries: MeetEntry[]) => {
        // Group entries by athlete and save to their pastMeets
        const byAthlete: Record<string, MeetEntry[]> = {};
        for (const e of updatedEntries) {
            if (!byAthlete[e.athleteId]) byAthlete[e.athleteId] = [];
            byAthlete[e.athleteId].push(e);
        }

        for (const athleteId of Object.keys(byAthlete)) {
            const athlete = athletes.find(a => a.id === athleteId);
            if (!athlete) continue;

            // Preserve existing pastMeets that don't have _meetDataEntry
            const existingNonMeetData = (athlete.pastMeets || []).filter((m: any) => !m._meetDataEntry);
            const meetDataEntries = byAthlete[athleteId].map(e => {
                const total = calcTotal(e);
                const bw = e.bodyweight || e.weightClass;
                const isMale = e.gender !== 'female';
                return {
                    id: e.id,
                    date: e.meetDate,
                    meetName: e.meetName,
                    bodyweight: e.bodyweight || e.weightClass,
                    squat: bestLift(e.squat, e.squatResults),
                    bench: bestLift(e.bench, e.benchResults),
                    deadlift: bestLift(e.deadlift, e.deadliftResults),
                    total,
                    dots: total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0,
                    _meetDataEntry: e,
                };
            });

            await fetch('/api/athletes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: athleteId,
                    pastMeets: [...existingNonMeetData, ...meetDataEntries],
                }),
            });
        }
        router.refresh();
    };

    const handleAdd = () => {
        if (!newEntry.athleteId || !newEntry.meetName) return;
        const athlete = athletes.find(a => a.id === newEntry.athleteId);
        if (!athlete) return;

        const entry: MeetEntry = {
            id: Math.random().toString(36).substring(7),
            athleteId: newEntry.athleteId,
            athleteName: athlete.name,
            category: newEntry.category,
            weightClass: parseFloat(newEntry.weightClass) || athlete.weightClass || 0,
            bodyweight: parseFloat(newEntry.bodyweight) || 0,
            meetDate: newEntry.meetDate,
            meetName: newEntry.meetName,
            gender: newEntry.gender || athlete.gender || 'male',
            squat: [parseFloat(newEntry.sq1) || 0, parseFloat(newEntry.sq2) || 0, parseFloat(newEntry.sq3) || 0],
            squatResults: [newEntry.sq1g, newEntry.sq2g, newEntry.sq3g],
            bench: [parseFloat(newEntry.bp1) || 0, parseFloat(newEntry.bp2) || 0, parseFloat(newEntry.bp3) || 0],
            benchResults: [newEntry.bp1g, newEntry.bp2g, newEntry.bp3g],
            deadlift: [parseFloat(newEntry.dl1) || 0, parseFloat(newEntry.dl2) || 0, parseFloat(newEntry.dl3) || 0],
            deadliftResults: [newEntry.dl1g, newEntry.dl2g, newEntry.dl3g],
        };

        const updated = [...entries, entry].sort((a, b) => (a.meetDate || '').localeCompare(b.meetDate || ''));
        setEntries(updated);
        saveEntriesToBackend(updated);
        setShowAddForm(false);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this meet entry?')) return;
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        saveEntriesToBackend(updated);
    };

    // LiftingCast CSV Import
    const handleLiftingCastImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportError('');
        setImportResult('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const athleteNames = athletes.map(a => a.name.toLowerCase().trim());
                    const newEntries: MeetEntry[] = [];
                    let matchedCount = 0;

                    for (const row of results.data as any[]) {
                        // LiftingCast column names - try common variants
                        const name = (row['Name'] || row['name'] || row['Lifter'] || row['lifter'] || '').trim();
                        if (!name) continue;

                        // Match against athlete names (fuzzy: check if CSV name contains athlete name or vice versa)
                        const nameLower = name.toLowerCase();
                        const matchedAthlete = athletes.find(a => {
                            const aName = a.name.toLowerCase().trim();
                            // Check both directions for partial matching
                            const aParts = aName.split(/\s+/);
                            const nParts = nameLower.split(/\s+/);
                            // Exact match
                            if (aName === nameLower) return true;
                            // Last name + first name match (LiftingCast often uses "Last, First")
                            const commaName = nameLower.replace(/,\s*/, ' ').trim();
                            if (aName === commaName) return true;
                            // If all parts of the athlete name appear in the CSV name
                            if (aParts.length >= 2 && aParts.every(p => nameLower.includes(p))) return true;
                            if (nParts.length >= 2 && nParts.every(p => aName.includes(p))) return true;
                            return false;
                        });

                        if (!matchedAthlete) continue;
                        matchedCount++;

                        // Parse attempts - LiftingCast uses various column naming
                        const parseAttempt = (keys: string[]): number => {
                            for (const k of keys) {
                                const val = parseFloat(row[k]);
                                if (!isNaN(val)) return val;
                            }
                            return 0;
                        };

                        const sq1 = parseAttempt(['Squat 1', 'Squat1', 'squat1', 'Squat1Kg', 'Best Squat 1']);
                        const sq2 = parseAttempt(['Squat 2', 'Squat2', 'squat2', 'Squat2Kg', 'Best Squat 2']);
                        const sq3 = parseAttempt(['Squat 3', 'Squat3', 'squat3', 'Squat3Kg', 'Best Squat 3']);
                        const bp1 = parseAttempt(['Bench 1', 'Bench1', 'bench1', 'Bench1Kg', 'Best Bench 1']);
                        const bp2 = parseAttempt(['Bench 2', 'Bench2', 'bench2', 'Bench2Kg', 'Best Bench 2']);
                        const bp3 = parseAttempt(['Bench 3', 'Bench3', 'bench3', 'Bench3Kg', 'Best Bench 3']);
                        const dl1 = parseAttempt(['Deadlift 1', 'Deadlift1', 'deadlift1', 'Deadlift1Kg', 'Best Deadlift 1']);
                        const dl2 = parseAttempt(['Deadlift 2', 'Deadlift2', 'deadlift2', 'Deadlift2Kg', 'Best Deadlift 2']);
                        const dl3 = parseAttempt(['Deadlift 3', 'Deadlift3', 'deadlift3', 'Deadlift3Kg', 'Best Deadlift 3']);

                        // Negative values mean missed lifts in LiftingCast
                        const isGood = (v: number) => v > 0;

                        const sex = (row['Sex'] || row['sex'] || row['Gender'] || row['gender'] || '').toLowerCase();
                        const division = row['Division'] || row['Div'] || row['division'] || row['Category'] || row['category'] || '';
                        const bw = parseFloat(row['Bodyweight'] || row['BodyweightKg'] || row['Body Weight'] || row['BW'] || row['bw'] || 0);
                        const wc = parseFloat(row['WeightClass'] || row['Weight Class'] || row['WeightClassKg'] || row['Class'] || 0);
                        const meetName = row['Competition'] || row['Meet'] || row['MeetName'] || row['Meet Name'] || file.name.replace('.csv', '') || '';
                        const meetDate = row['Date'] || row['date'] || row['Meet Date'] || '';

                        newEntries.push({
                            id: Math.random().toString(36).substring(7),
                            athleteId: matchedAthlete.id,
                            athleteName: matchedAthlete.name,
                            category: division,
                            weightClass: wc || matchedAthlete.weightClass || 0,
                            bodyweight: bw || 0,
                            meetDate,
                            meetName,
                            gender: sex.startsWith('f') ? 'female' : 'male',
                            squat: [Math.abs(sq1), Math.abs(sq2), Math.abs(sq3)],
                            squatResults: [isGood(sq1), isGood(sq2), isGood(sq3)],
                            bench: [Math.abs(bp1), Math.abs(bp2), Math.abs(bp3)],
                            benchResults: [isGood(bp1), isGood(bp2), isGood(bp3)],
                            deadlift: [Math.abs(dl1), Math.abs(dl2), Math.abs(dl3)],
                            deadliftResults: [isGood(dl1), isGood(dl2), isGood(dl3)],
                        });
                    }

                    if (newEntries.length === 0) {
                        setImportError(`No matching athletes found in the CSV. Make sure athlete names in BlueprintLab match the names in the LiftingCast export.`);
                    } else {
                        const updated = [...entries, ...newEntries].sort((a, b) => (a.meetDate || '').localeCompare(b.meetDate || ''));
                        setEntries(updated);
                        saveEntriesToBackend(updated);
                        setImportResult(`Imported ${newEntries.length} result(s) for ${matchedCount} athlete(s).`);
                    }
                } catch (err) {
                    console.error(err);
                    setImportError('Failed to parse LiftingCast CSV.');
                }
                setImporting(false);
                e.target.value = '';
            },
            error: () => {
                setImportError('CSV parsing error.');
                setImporting(false);
            },
        });
    };

    // Attempt cell renderer
    const AttemptCell = ({ value, good, compact }: { value: number; good: boolean; compact?: boolean }) => {
        if (!value) return <td style={{ ...cellStyle, padding: compact ? '0.3rem' : cellStyle.padding }}></td>;
        return (
            <td style={{
                ...cellStyle,
                padding: compact ? '0.3rem' : cellStyle.padding,
                background: good ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: good ? '#4ade80' : '#f87171',
                fontWeight: 600,
                fontSize: '0.85rem',
            }}>
                {value}
            </td>
        );
    };

    const cellStyle: React.CSSProperties = {
        padding: '0.5rem 0.6rem',
        fontSize: '0.85rem',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        whiteSpace: 'nowrap',
    };

    const headerStyle: React.CSSProperties = {
        ...cellStyle,
        fontSize: '0.7rem',
        fontWeight: 700,
        color: 'var(--secondary-foreground)',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: 'rgba(255,255,255,0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
    };

    return (
        <div>
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                        Meet <span style={{ color: 'var(--primary)' }}>Data</span>
                    </h1>
                    <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                        Track athlete meet performances across competitions
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                        {showAddForm ? <X size={16} /> : <Plus size={16} />}
                        {showAddForm ? 'Cancel' : 'Add Entry'}
                    </button>
                    <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <Upload size={16} />
                        {importing ? 'Importing...' : 'Import LiftingCast CSV'}
                        <input type="file" accept=".csv" onChange={handleLiftingCastImport} style={{ display: 'none' }} disabled={importing} />
                    </label>
                </div>
            </div>

            {importError && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>{importError}</div>}
            {importResult && <div style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(6,182,212,0.1)', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)' }}>{importResult}</div>}

            {/* Add Entry Form */}
            {showAddForm && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div>
                            <label style={labelStyle}>Athlete *</label>
                            <select className="input" value={newEntry.athleteId} onChange={e => setNewEntry({ ...newEntry, athleteId: e.target.value })} style={{ width: '100%' }}>
                                <option value="">Select...</option>
                                {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Category</label>
                            <input className="input" placeholder="e.g. Junior" value={newEntry.category} onChange={e => setNewEntry({ ...newEntry, category: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Weight Class (kg)</label>
                            <input type="number" className="input" value={newEntry.weightClass} onChange={e => setNewEntry({ ...newEntry, weightClass: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Bodyweight (kg)</label>
                            <input type="number" step="0.1" className="input" value={newEntry.bodyweight} onChange={e => setNewEntry({ ...newEntry, bodyweight: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Meet Date</label>
                            <input type="date" className="input" value={newEntry.meetDate} onChange={e => setNewEntry({ ...newEntry, meetDate: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Meet Name *</label>
                            <input className="input" placeholder="e.g. USAPL Nationals" value={newEntry.meetName} onChange={e => setNewEntry({ ...newEntry, meetName: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={labelStyle}>Gender</label>
                            <select className="input" value={newEntry.gender} onChange={e => setNewEntry({ ...newEntry, gender: e.target.value })} style={{ width: '100%' }}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                    </div>

                    {/* Attempts Grid */}
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                        <div></div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>1st</div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>2nd</div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>3rd</div>

                        <div style={labelStyle}>Squat</div>
                        <input type="number" step="0.5" className="input" value={newEntry.sq1} onChange={e => setNewEntry({ ...newEntry, sq1: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.sq2} onChange={e => setNewEntry({ ...newEntry, sq2: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.sq3} onChange={e => setNewEntry({ ...newEntry, sq3: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />

                        <div style={labelStyle}>Bench</div>
                        <input type="number" step="0.5" className="input" value={newEntry.bp1} onChange={e => setNewEntry({ ...newEntry, bp1: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.bp2} onChange={e => setNewEntry({ ...newEntry, bp2: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.bp3} onChange={e => setNewEntry({ ...newEntry, bp3: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />

                        <div style={labelStyle}>Deadlift</div>
                        <input type="number" step="0.5" className="input" value={newEntry.dl1} onChange={e => setNewEntry({ ...newEntry, dl1: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.dl2} onChange={e => setNewEntry({ ...newEntry, dl2: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                        <input type="number" step="0.5" className="input" value={newEntry.dl3} onChange={e => setNewEntry({ ...newEntry, dl3: e.target.value })} style={{ width: '100%', textAlign: 'center' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button onClick={handleAdd} className="btn btn-primary">Add Meet Entry</button>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: 1400 }}>
                    <thead>
                        <tr>
                            <th style={{ ...headerStyle, textAlign: 'left', minWidth: 130 }}>Athlete</th>
                            <th style={{ ...headerStyle, minWidth: 70 }}>Category</th>
                            <th style={{ ...headerStyle, minWidth: 60 }}>Wt Class</th>
                            <th style={{ ...headerStyle, minWidth: 80 }}>Meet Date</th>
                            <th style={{ ...headerStyle, textAlign: 'left', minWidth: 150 }}>Meet Name</th>
                            <th colSpan={3} style={{ ...headerStyle, borderBottom: '2px solid rgba(125,135,210,0.3)', color: '#7d87d2' }}>Squat (kgs)</th>
                            <th colSpan={3} style={{ ...headerStyle, borderBottom: '2px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>Bench (kgs)</th>
                            <th colSpan={3} style={{ ...headerStyle, borderBottom: '2px solid rgba(16,185,129,0.3)', color: '#10b981' }}>Deadlift (kgs)</th>
                            <th style={headerStyle}>Good</th>
                            <th style={headerStyle}>Total Att</th>
                            <th style={headerStyle}>% Success</th>
                            <th style={{ ...headerStyle, color: 'var(--primary)' }}>Total (kgs)</th>
                            <th style={headerStyle}>Total PR</th>
                            <th style={{ ...headerStyle, color: '#f59e0b' }}>DOTS</th>
                            <th style={{ ...headerStyle, color: '#38bdf8' }}>IPF Pts</th>
                            <th style={{ ...headerStyle, width: 40 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={22} style={{ padding: '3rem', color: 'var(--secondary-foreground)', textAlign: 'center' }}>
                                    No meet data yet. Add entries manually or import from LiftingCast CSV.
                                </td>
                            </tr>
                        ) : entries.map((e, idx) => {
                            const total = calcTotal(e);
                            const successful = calcSuccessful(e);
                            const totalAttempts = calcTotalAttempts(e);
                            const pct = totalAttempts > 0 ? (successful / totalAttempts * 100) : 0;
                            const bw = e.bodyweight || e.weightClass;
                            const isMale = e.gender !== 'female';
                            const dots = total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0;
                            const ipf = total > 0 && bw > 0 ? calculateGL(total, bw, isMale, false, false) : 0;
                            const pr = (e as any)._totalPR;
                            const isFirst = (e as any)._isFirstMeet;

                            return (
                                <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>{e.athleteName}</td>
                                    <td style={cellStyle}>{e.category}</td>
                                    <td style={cellStyle}>{e.weightClass || '-'}</td>
                                    <td style={cellStyle}>{e.meetDate || '-'}</td>
                                    <td style={{ ...cellStyle, textAlign: 'left', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.meetName}>{e.meetName}</td>

                                    <AttemptCell value={e.squat[0]} good={e.squatResults[0]} />
                                    <AttemptCell value={e.squat[1]} good={e.squatResults[1]} />
                                    <AttemptCell value={e.squat[2]} good={e.squatResults[2]} />

                                    <AttemptCell value={e.bench[0]} good={e.benchResults[0]} />
                                    <AttemptCell value={e.bench[1]} good={e.benchResults[1]} />
                                    <AttemptCell value={e.bench[2]} good={e.benchResults[2]} />

                                    <AttemptCell value={e.deadlift[0]} good={e.deadliftResults[0]} />
                                    <AttemptCell value={e.deadlift[1]} good={e.deadliftResults[1]} />
                                    <AttemptCell value={e.deadlift[2]} good={e.deadliftResults[2]} />

                                    <td style={cellStyle}>{successful}</td>
                                    <td style={cellStyle}>{totalAttempts}</td>
                                    <td style={{ ...cellStyle, color: pct >= 88 ? '#4ade80' : pct >= 66 ? '#fbbf24' : '#f87171' }}>
                                        {pct.toFixed(1)}%
                                    </td>
                                    <td style={{ ...cellStyle, fontWeight: 700, color: total > 0 ? 'var(--primary)' : 'var(--secondary-foreground)' }}>
                                        {total > 0 ? total : '-'}
                                    </td>
                                    <td style={{ ...cellStyle, color: pr > 0 ? '#4ade80' : 'var(--secondary-foreground)' }}>
                                        {isFirst ? 'First Meet' : pr > 0 ? `+${pr}` : '-'}
                                    </td>
                                    <td style={{ ...cellStyle, color: '#f59e0b' }}>{dots > 0 ? dots.toFixed(2) : '-'}</td>
                                    <td style={{ ...cellStyle, color: '#38bdf8' }}>{ipf > 0 ? ipf.toFixed(2) : '-'}</td>
                                    <td style={cellStyle}>
                                        <button onClick={() => handleDelete(e.id)} style={{ color: '#ef4444', opacity: 0.5, cursor: 'pointer', background: 'none', border: 'none' }} title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Average Row */}
                        {averages && (
                            <tr style={{ borderTop: '2px solid var(--card-border)', background: 'rgba(255,255,255,0.03)' }}>
                                <td style={{ ...cellStyle, fontWeight: 700, textAlign: 'left' }}>Average</td>
                                <td colSpan={4} style={cellStyle}></td>
                                <td colSpan={9} style={cellStyle}></td>
                                <td style={{ ...cellStyle, fontWeight: 600 }}>{averages.avgSuccessful}</td>
                                <td style={{ ...cellStyle, fontWeight: 600 }}>{averages.avgTotal}</td>
                                <td style={{ ...cellStyle, fontWeight: 600 }}>{averages.avgPercent}%</td>
                                <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--primary)' }}>{averages.avgTotalKg}</td>
                                <td style={cellStyle}>N/A</td>
                                <td style={{ ...cellStyle, color: '#f59e0b', fontWeight: 600 }}>{averages.avgDots}</td>
                                <td style={{ ...cellStyle, color: '#38bdf8' }}></td>
                                <td style={cellStyle}></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--secondary-foreground)',
    marginBottom: '0.3rem',
    fontWeight: 600,
};

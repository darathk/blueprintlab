'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, Plus, X, Trash2, Pencil, Check } from 'lucide-react';
import { calculateGL, calculateDots } from '@/lib/calculators';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
    csvDotsPoints?: number;
    csvIpfPoints?: number;
    referencePreviousTotal?: number;
    isFirstMeetExplicit?: boolean;
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<MeetEntry | null>(null);
    const [chartAthleteId, setChartAthleteId] = useState<string>('');
    const [chartMetric, setChartMetric] = useState<'total' | 'dots' | 'ipf'>('total');

    // New entry form
    const [newEntry, setNewEntry] = useState({
        athleteId: '', category: '', weightClass: '', bodyweight: '', meetDate: '', meetName: '', gender: 'male',
        sq1: '', sq2: '', sq3: '', sq1g: true, sq2g: true, sq3g: true,
        bp1: '', bp2: '', bp3: '', bp1g: true, bp2g: true, bp3g: true,
        dl1: '', dl2: '', dl3: '', dl1g: true, dl2g: true, dl3g: true,
        referencePreviousTotal: '', isFirstMeetExplicit: false,
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
            if (total <= 0) {
                (e as any)._totalPR = 0;
                (e as any)._isFirstMeet = false;
                continue;
            }

            let prev = prs[e.athleteId] || 0;
            if (e.isFirstMeetExplicit) {
                prev = 0;
            } else if (e.referencePreviousTotal && e.referencePreviousTotal > prev) {
                prev = e.referencePreviousTotal;
            }

            if (total > prev) {
                prs[e.athleteId] = total; 
                (e as any)._totalPR = prev > 0 ? total - prev : 0;
                (e as any)._isFirstMeet = prev === 0 || e.isFirstMeetExplicit;
            } else {
                (e as any)._totalPR = 0;
                (e as any)._isFirstMeet = e.isFirstMeetExplicit; 
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
        
        const prMeets = withTotals.filter(e => (e as any)._totalPR > 0);
        const avgPR = prMeets.length > 0 ? prMeets.reduce((s, e) => s + (e as any)._totalPR, 0) / prMeets.length : 0;
        
        const avgDots = withTotals.reduce((s, e) => {
            const total = calcTotal(e);
            const bw = e.bodyweight || e.weightClass;
            const isMale = e.gender !== 'female';
            return s + (e.csvDotsPoints || (total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0));
        }, 0) / withTotals.length;

        const avgIpf = withTotals.reduce((s, e) => {
            const total = calcTotal(e);
            const bw = e.bodyweight || e.weightClass;
            const isMale = e.gender !== 'female';
            return s + (e.csvIpfPoints || (total > 0 && bw > 0 ? calculateGL(total, bw, isMale, false, false) : 0));
        }, 0) / withTotals.length;

        return { 
            avgSuccessful: avgSuccessful.toFixed(1), 
            avgTotal: avgTotal.toFixed(0), 
            avgPercent: avgPercent.toFixed(1), 
            avgPR: avgPR.toFixed(1), 
            avgDots: avgDots.toFixed(2),
            avgIpf: avgIpf.toFixed(2)
        };
    }, [entries, totalPRs]);

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
            referencePreviousTotal: parseFloat(newEntry.referencePreviousTotal) || undefined,
            isFirstMeetExplicit: newEntry.isFirstMeetExplicit,
            squat: [Math.abs(parseFloat(newEntry.sq1) || 0), Math.abs(parseFloat(newEntry.sq2) || 0), Math.abs(parseFloat(newEntry.sq3) || 0)],
            squatResults: [newEntry.sq1g, newEntry.sq2g, newEntry.sq3g],
            bench: [Math.abs(parseFloat(newEntry.bp1) || 0), Math.abs(parseFloat(newEntry.bp2) || 0), Math.abs(parseFloat(newEntry.bp3) || 0)],
            benchResults: [newEntry.bp1g, newEntry.bp2g, newEntry.bp3g],
            deadlift: [Math.abs(parseFloat(newEntry.dl1) || 0), Math.abs(parseFloat(newEntry.dl2) || 0), Math.abs(parseFloat(newEntry.dl3) || 0)],
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

    const startEdit = (entry: MeetEntry) => {
        setEditingId(entry.id);
        setEditDraft({ ...entry, squat: [...entry.squat] as [number, number, number], squatResults: [...entry.squatResults] as [boolean, boolean, boolean], bench: [...entry.bench] as [number, number, number], benchResults: [...entry.benchResults] as [boolean, boolean, boolean], deadlift: [...entry.deadlift] as [number, number, number], deadliftResults: [...entry.deadliftResults] as [boolean, boolean, boolean] });
    };

    const saveEdit = () => {
        if (!editDraft || !editingId) return;
        const updated = entries.map(e => e.id === editingId ? editDraft : e).sort((a, b) => (a.meetDate || '').localeCompare(b.meetDate || ''));
        setEntries(updated);
        saveEntriesToBackend(updated);
        setEditingId(null);
        setEditDraft(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditDraft(null);
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

                        const sex = (row['Gender'] || row['gender'] || row['Sex'] || row['sex'] || '').toLowerCase();
                        const division = row['Awards Division'] || row['Division'] || row['Div'] || row['division'] || row['Category'] || row['category'] || '';
                        const bw = parseFloat(row['Body Weight (kg)'] || row['Body Weight'] || row['Bodyweight'] || row['BodyweightKg'] || row['BW'] || row['bw'] || 0);
                        const wc = row['Weight Class'] || row['WeightClass'] || row['WeightClassKg'] || row['Class'] || '';
                        const wcNum = parseFloat(wc) || 0;
                        const meetName = row['Competition'] || row['Meet'] || row['MeetName'] || row['Meet Name'] || file.name.replace('.csv', '') || '';
                        const meetDate = row['Date'] || row['date'] || row['Meet Date'] || '';

                        // Pick up scoring directly from CSV
                        const csvDots = parseFloat(row['Dots Points'] || row['DOTS'] || row['Dots'] || 0);
                        const csvIpf = parseFloat(row['IPF Points'] || row['IPF Pts'] || row['IPF GL Points'] || 0);

                        newEntries.push({
                            id: Math.random().toString(36).substring(7),
                            athleteId: matchedAthlete.id,
                            athleteName: matchedAthlete.name,
                            category: division,
                            weightClass: wcNum || matchedAthlete.weightClass || 0,
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
                            csvDotsPoints: csvDots > 0 ? csvDots : undefined,
                            csvIpfPoints: csvIpf > 0 ? csvIpf : undefined,
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

    const chartData = useMemo(() => {
        if (!chartAthleteId) return [];
        return entries
            .filter(e => e.athleteId === chartAthleteId)
            .map(e => {
                const total = calcTotal(e);
                const bw = e.bodyweight || e.weightClass;
                const isMale = e.gender !== 'female';
                return {
                    meetDate: e.meetDate,
                    total,
                    dots: Number((e.csvDotsPoints || (total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0)).toFixed(2)),
                    ipf: Number((e.csvIpfPoints || (total > 0 && bw > 0 ? calculateGL(total, bw, isMale, false, false) : 0)).toFixed(2)),
                };
            })
            .filter(d => d.total > 0);
    }, [entries, chartAthleteId]);

    const chartColor = chartMetric === 'total' ? 'var(--primary)' : chartMetric === 'dots' ? '#f59e0b' : '#38bdf8';

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
                        <div style={{ gridColumn: '1 / -1', marginTop: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={newEntry.isFirstMeetExplicit} onChange={e => setNewEntry({ ...newEntry, isFirstMeetExplicit: e.target.checked, referencePreviousTotal: '' })} />
                                    This is their first meet
                                </label>
                                {!newEntry.isFirstMeetExplicit && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>OR Previous Total PR (kg):</span>
                                        <input type="number" step="0.5" className="input" placeholder="e.g. 450" value={newEntry.referencePreviousTotal} onChange={e => setNewEntry({ ...newEntry, referencePreviousTotal: e.target.value })} style={{ width: 100 }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Attempts Grid */}
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                        <div></div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>1st</div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>2nd</div>
                        <div style={{ ...labelStyle, textAlign: 'center', margin: 0 }}>3rd</div>

                        {/* Squat */}
                        <div style={labelStyle}>Squat</div>
                        {[1, 2, 3].map(i => {
                            const valKey = `sq${i}` as keyof typeof newEntry;
                            const goodKey = `sq${i}g` as keyof typeof newEntry;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <input type="number" step="0.5" className="input" value={newEntry[valKey] as string} onChange={e => setNewEntry({ ...newEntry, [valKey]: e.target.value })} style={{ width: '100%', textAlign: 'center', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }} />
                                    <button type="button" onClick={() => setNewEntry({ ...newEntry, [goodKey]: !newEntry[goodKey] })} style={{ fontSize: '0.65rem', cursor: 'pointer', background: 'none', border: 'none', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }}>{newEntry[goodKey] ? 'good' : 'miss'}</button>
                                </div>
                            );
                        })}

                        {/* Bench */}
                        <div style={labelStyle}>Bench</div>
                        {[1, 2, 3].map(i => {
                            const valKey = `bp${i}` as keyof typeof newEntry;
                            const goodKey = `bp${i}g` as keyof typeof newEntry;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <input type="number" step="0.5" className="input" value={newEntry[valKey] as string} onChange={e => setNewEntry({ ...newEntry, [valKey]: e.target.value })} style={{ width: '100%', textAlign: 'center', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }} />
                                    <button type="button" onClick={() => setNewEntry({ ...newEntry, [goodKey]: !newEntry[goodKey] })} style={{ fontSize: '0.65rem', cursor: 'pointer', background: 'none', border: 'none', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }}>{newEntry[goodKey] ? 'good' : 'miss'}</button>
                                </div>
                            );
                        })}

                        {/* Deadlift */}
                        <div style={labelStyle}>Deadlift</div>
                        {[1, 2, 3].map(i => {
                            const valKey = `dl${i}` as keyof typeof newEntry;
                            const goodKey = `dl${i}g` as keyof typeof newEntry;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <input type="number" step="0.5" className="input" value={newEntry[valKey] as string} onChange={e => setNewEntry({ ...newEntry, [valKey]: e.target.value })} style={{ width: '100%', textAlign: 'center', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }} />
                                    <button type="button" onClick={() => setNewEntry({ ...newEntry, [goodKey]: !newEntry[goodKey] })} style={{ fontSize: '0.65rem', cursor: 'pointer', background: 'none', border: 'none', color: newEntry[goodKey] ? '#4ade80' : '#f87171' }}>{newEntry[goodKey] ? 'good' : 'miss'}</button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button onClick={handleAdd} className="btn btn-primary">Add Meet Entry</button>
                    </div>
                </div>
            )}

            {/* Chart Section */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Athlete Chart</label>
                        <select className="input" value={chartAthleteId} onChange={e => setChartAthleteId(e.target.value)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                            <option value="">Select Athlete...</option>
                            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    {chartAthleteId && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['total', 'dots', 'ipf'].map(m => (
                                <button key={m} onClick={() => setChartMetric(m as any)} style={{
                                    padding: '4px 10px', borderRadius: 6, border: `1px solid ${m === 'total' ? 'var(--primary)' : m === 'dots' ? '#f59e0b' : '#38bdf8'}`,
                                    background: chartMetric === m ? `${m === 'total' ? 'rgba(6,182,212,0.1)' : m === 'dots' ? 'rgba(245,158,11,0.1)' : 'rgba(56,189,248,0.1)'}` : 'transparent',
                                    color: chartMetric === m ? (m === 'total' ? 'var(--primary)' : m === 'dots' ? '#f59e0b' : '#38bdf8') : 'rgba(255,255,255,0.4)',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase'
                                }}>
                                    {m === 'total' ? 'Total (kg)' : m === 'dots' ? 'DOTS' : 'IPF GL'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {chartAthleteId ? (
                    chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="meetDate" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                                <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                                <Area type="monotone" dataKey={chartMetric} stroke={chartColor} strokeWidth={2.5} fill="url(#colorMetric)" dot={{ r: 4, fill: chartColor, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>No meet data found for this athlete.</div>
                    )
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}>Select an athlete to view their meet history chart.</div>
                )}
            </div>

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
                            const isEditing = editingId === e.id;
                            const d = isEditing && editDraft ? editDraft : e;
                            const total = calcTotal(d);
                            const successful = calcSuccessful(d);
                            const totalAttempts = calcTotalAttempts(d);
                            const pct = totalAttempts > 0 ? (successful / totalAttempts * 100) : 0;
                            const bw = d.bodyweight || d.weightClass;
                            const isMale = d.gender !== 'female';
                            const dots = d.csvDotsPoints || (total > 0 && bw > 0 ? calculateDots(total, bw, isMale) : 0);
                            const ipf = d.csvIpfPoints || (total > 0 && bw > 0 ? calculateGL(total, bw, isMale, false, false) : 0);
                            const pr = (e as any)._totalPR;
                            const isFirst = (e as any)._isFirstMeet;

                            if (isEditing && editDraft) {
                                const inputStyle: React.CSSProperties = { width: '100%', textAlign: 'center', padding: '0.2rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'inherit' };
                                const updateDraft = (patch: Partial<MeetEntry>) => setEditDraft({ ...editDraft, ...patch } as MeetEntry);
                                const updateAttempt = (lift: 'squat' | 'bench' | 'deadlift', idx: number, val: string) => {
                                    const arr = [...editDraft[lift]] as [number, number, number];
                                    arr[idx] = parseFloat(val) || 0;
                                    updateDraft({ [lift]: arr });
                                };
                                const toggleResult = (lift: 'squatResults' | 'benchResults' | 'deadliftResults', idx: number) => {
                                    const arr = [...editDraft[lift]] as [boolean, boolean, boolean];
                                    arr[idx] = !arr[idx];
                                    updateDraft({ [lift]: arr });
                                };
                                return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(6,182,212,0.05)' }}>
                                        <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>
                                            {editDraft.athleteName}
                                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                                                <select style={{ ...inputStyle, width: 55, fontSize: '0.65rem' }} value={editDraft.gender} onChange={ev => updateDraft({ gender: ev.target.value })}>
                                                    <option value="male">M</option>
                                                    <option value="female">F</option>
                                                </select>
                                                <input type="number" step="0.1" placeholder="BW" title="Bodyweight (kg)" style={{ ...inputStyle, width: 55, fontSize: '0.65rem' }} value={editDraft.bodyweight || ''} onChange={ev => updateDraft({ bodyweight: parseFloat(ev.target.value) || 0 })} />
                                            </div>
                                        </td>
                                        <td style={cellStyle}><input style={inputStyle} value={editDraft.category} onChange={ev => updateDraft({ category: ev.target.value })} /></td>
                                        <td style={cellStyle}><input type="number" style={inputStyle} value={editDraft.weightClass || ''} onChange={ev => updateDraft({ weightClass: parseFloat(ev.target.value) || 0 })} /></td>
                                        <td style={cellStyle}><input type="date" style={{ ...inputStyle, width: 120 }} value={editDraft.meetDate} onChange={ev => updateDraft({ meetDate: ev.target.value })} /></td>
                                        <td style={{ ...cellStyle, textAlign: 'left' }}><input style={{ ...inputStyle, textAlign: 'left' }} value={editDraft.meetName} onChange={ev => updateDraft({ meetName: ev.target.value })} /></td>
                                        {(['squat', 'bench', 'deadlift'] as const).map(lift => {
                                            const resKey = `${lift}Results` as 'squatResults' | 'benchResults' | 'deadliftResults';
                                            return [0, 1, 2].map(i => (
                                                <td key={`${lift}${i}`} style={{ ...cellStyle, padding: '0.2rem', background: editDraft[resKey][i] ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
                                                    <input type="number" step="0.5" style={{ ...inputStyle, width: 55, color: editDraft[resKey][i] ? '#4ade80' : '#f87171' }} value={editDraft[lift][i] || ''} onChange={ev => updateAttempt(lift, i, ev.target.value)} />
                                                    <button onClick={() => toggleResult(resKey, i)} style={{ fontSize: '0.6rem', cursor: 'pointer', background: 'none', border: 'none', color: editDraft[resKey][i] ? '#4ade80' : '#f87171', display: 'block', margin: '0 auto' }}>
                                                        {editDraft[resKey][i] ? 'good' : 'miss'}
                                                    </button>
                                                </td>
                                            ));
                                        })}
                                        <td style={cellStyle}>{successful}</td>
                                        <td style={cellStyle}>{totalAttempts}</td>
                                        <td style={{ ...cellStyle, color: pct >= 88 ? '#4ade80' : pct >= 66 ? '#fbbf24' : '#f87171' }}>{pct.toFixed(1)}%</td>
                                        <td style={{ ...cellStyle, fontWeight: 700, color: total > 0 ? 'var(--primary)' : 'var(--secondary-foreground)' }}>{total > 0 ? total : '-'}</td>
                                        <td style={cellStyle}>-</td>
                                        <td style={{ ...cellStyle, color: '#f59e0b' }}>{dots > 0 ? dots.toFixed(2) : '-'}</td>
                                        <td style={{ ...cellStyle, color: '#38bdf8' }}>{ipf > 0 ? ipf.toFixed(2) : '-'}</td>
                                        <td style={{ ...cellStyle, display: 'flex', gap: '0.3rem' }}>
                                            <button onClick={saveEdit} style={{ color: '#4ade80', cursor: 'pointer', background: 'none', border: 'none' }} title="Save"><Check size={14} /></button>
                                            <button onClick={cancelEdit} style={{ color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }} title="Cancel"><X size={14} /></button>
                                        </td>
                                    </tr>
                                );
                            }

                            return (
                                <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>{e.athleteName}</td>
                                    <td style={cellStyle}>{e.category}</td>
                                    <td style={cellStyle}>{e.weightClass || '-'}</td>
                                    <td style={cellStyle}>{e.meetDate || '-'}</td>
                                    <td style={{ ...cellStyle, textAlign: 'left', minWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word' }}>{e.meetName}</td>

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
                                    <td style={{ ...cellStyle, display: 'flex', gap: '0.3rem' }}>
                                        <button onClick={() => startEdit(e)} style={{ color: 'var(--primary)', opacity: 0.5, cursor: 'pointer', background: 'none', border: 'none' }} title="Edit">
                                            <Pencil size={14} />
                                        </button>
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
                                <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--secondary-foreground)' }}>-</td>
                                <td style={{ ...cellStyle, color: parseFloat(averages.avgPR) > 0 ? '#4ade80' : 'var(--secondary-foreground)', fontWeight: 600 }}>
                                    {parseFloat(averages.avgPR) > 0 ? `+${averages.avgPR}` : '-'}
                                </td>
                                <td style={{ ...cellStyle, color: '#f59e0b', fontWeight: 600 }}>{averages.avgDots}</td>
                                <td style={{ ...cellStyle, color: '#38bdf8', fontWeight: 600 }}>{averages.avgIpf}</td>
                                <td style={{ ...cellStyle, borderRight: 'none' }}></td>
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

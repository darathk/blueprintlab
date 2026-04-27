'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { calculateSimpleE1RM, calculateStress } from '@/lib/stress-index';

export default function SessionDetailsModal({ session, programName, programId, sessionKey, onClose, athleteId, onSaveLog, existingLog }) {
    const [logData, setLogData] = useState({});
    const [videoTab, setVideoTab] = useState(false);
    const [sessionMessages, setSessionMessages] = useState<any[]>([]);
    const [loadingVideos, setLoadingVideos] = useState(false);

    const fetchSessionMedia = useCallback(async () => {
        if (!athleteId || !sessionKey) return;
        setLoadingVideos(true);
        try {
            const res = await fetch(`/api/messages?athleteId=${athleteId}&sessionId=${encodeURIComponent(sessionKey)}`);
            if (res.ok) {
                const data = await res.json();
                setSessionMessages(data.filter((m: any) => m.mediaUrl || m.content));
            }
        } catch {
            // silently fail — review panel is non-critical
        } finally {
            setLoadingVideos(false);
        }
    }, [athleteId, sessionKey]);

    // Initialize log data
    useEffect(() => {
        if (session) {
            const initialLog = {};

            session.exercises.forEach((ex, exIndex) => {
                const savedEx = existingLog?.exercises?.find(e => e.name === ex.name);
                const savedSets = savedEx?.sets || [];

                initialLog[ex.id || exIndex] = (ex.sets || []).map((s, setIndex) => {
                    const savedSet = savedSets[setIndex] || {};
                    return {
                        weight: savedSet.weight || '',
                        reps: savedSet.reps || '', // User entered Actual
                        rpe: savedSet.rpe || '',
                        notes: savedSet.notes || ''
                    };
                });
            });
            setLogData(initialLog);
        }
    }, [session, existingLog]);

    const updateLog = (exId, setIndex, field, value) => {
        setLogData(prev => {
            const exerciseLog = [...(prev[exId] || [])];
            if (!exerciseLog[setIndex]) exerciseLog[setIndex] = {};
            exerciseLog[setIndex] = { ...exerciseLog[setIndex], [field]: value };
            return { ...prev, [exId]: exerciseLog };
        });
    };

    // Calculate real-time stats
    const stats = useMemo(() => {
        if (!session || !logData) return { sessionTotal: 0, sessionCentral: 0, sessionPeripheral: 0 };

        let sessionTotal = 0;
        let sessionCentral = 0;
        let sessionPeripheral = 0;

        session.exercises.forEach((ex, exIndex) => {
            const exSets = logData[ex.id || exIndex] || [];
            exSets.forEach(set => {
                const r = parseFloat(set.reps) || 0;
                const rpe = parseFloat(set.rpe) || 0;
                if (r > 0 && rpe > 0) {
                    const s = calculateStress(r, rpe);
                    sessionTotal += s.total;
                    sessionCentral += s.central;
                    sessionPeripheral += s.peripheral;
                }
            });
        });

        return {
            sessionTotal: sessionTotal.toFixed(1),
            sessionCentral: sessionCentral.toFixed(1),
            sessionPeripheral: sessionPeripheral.toFixed(1)
        };
    }, [session, logData]);

    const handleSave = async () => {
        if (!onSaveLog) return;

        // Format log for API — use sessionKey (programId_wX_dY) to match athlete-side format
        const formattedLog = {
            sessionId: sessionKey || session.id,
            programName: programName,
            programId: programId,
            date: new Date().toISOString(),
            exercises: session.exercises.map((ex, exIndex) => ({
                name: ex.name,
                sets: logData[ex.id || exIndex] || []
            }))
        };

        await onSaveLog(formattedLog);
        onClose();
    };

    if (!session) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 10, 20, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(8px)'
        }} onClick={onClose}>
            <div className="glass-panel" style={{
                width: '95%',
                maxWidth: '800px', // Wider for Target/Actual columns
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '0',
                position: 'relative',
                boxShadow: '0 0 40px rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                background: 'var(--card-bg)',
                borderRadius: '8px'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(to right, var(--primary-dark), var(--card-bg))',
                    borderBottom: '1px solid var(--primary)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{session.name}</h2>
                            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.25rem' }}>{programName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Session Stress</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.sessionTotal}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>C: {stats.sessionCentral} | P: {stats.sessionPeripheral}</div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {session.exercises.map((ex, exIndex) => {
                        // Exercise-level Stats
                        const exSets = logData[ex.id || exIndex] || [];
                        const validSets = exSets.filter(s => s.weight && s.reps && s.rpe);
                        const e1rms = validSets.map(s => calculateSimpleE1RM(s.weight, s.reps, s.rpe));
                        const maxE1RM = e1rms.length > 0 ? Math.max(...e1rms) : 0;

                        let exTotalStress = 0;
                        let exCentralStress = 0;
                        let exPeripheralStress = 0;
                        let tonnage = 0;
                        let nl = 0;

                        exSets.forEach(s => {
                            const r = parseFloat(s.reps) || 0;
                            const w = parseFloat(s.weight) || 0;
                            const rpe = parseFloat(s.rpe) || 0;

                            if (r > 0) {
                                tonnage += r * w;
                                nl += r;
                            }

                            if (r > 0 && rpe > 0) {
                                const stress = calculateStress(r, rpe);
                                exTotalStress += stress.total;
                                exCentralStress += stress.central;
                                exPeripheralStress += stress.peripheral;
                            }
                        });


                        return (
                            <div key={ex.id || exIndex} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', overflow: 'hidden' }}>
                                {/* Ex Header */}
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ background: 'var(--primary)', color: 'black', width: '20px', height: '20px', borderRadius: '50%', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', lineHeight: '20px' }}>{exIndex + 1}</span>
                                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent)' }}>{ex.name}</h3>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>Sets: <strong>{ex.sets?.length || 0}</strong></div>
                                </div>

                                <div style={{ padding: '0.5rem' }}>
                                    {/* Table Header */}
                                    <div className="session-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
                                        <div style={{ textAlign: 'center', color: 'var(--secondary-foreground)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Target</div>
                                        <div style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Actual</div>
                                    </div>
                                    <div className="session-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.7rem', color: 'var(--secondary-foreground)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
                                            <span>Weight</span><span>Reps</span><span>RPE</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
                                            <span>Weight</span><span>Reps</span><span>RPE</span>
                                        </div>
                                    </div>

                                    {/* Rows */}
                                    {ex.sets.map((set, setIndex) => {
                                        const currentLog = logData[ex.id || exIndex]?.[setIndex] || {};
                                        return (
                                            <div key={setIndex} className="session-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: '4px' }}>
                                                {/* Target */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: '0.25rem' }}>
                                                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>{set.weight || '-'}</div>
                                                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>{set.reps || '-'}</div>
                                                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>{set.rpe || '-'}</div>
                                                </div>

                                                {/* Actual */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: '0.25rem' }}>
                                                    <input
                                                        className="input"
                                                        placeholder="lbs"
                                                        value={currentLog.weight || ''}
                                                        onChange={(e) => updateLog(ex.id || exIndex, setIndex, 'weight', e.target.value)}
                                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                                    />
                                                    <input
                                                        className="input"
                                                        placeholder="Reps"
                                                        value={currentLog.reps || ''}
                                                        onChange={(e) => updateLog(ex.id || exIndex, setIndex, 'reps', e.target.value)}
                                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                                    />
                                                    <input
                                                        className="input"
                                                        placeholder="RPE"
                                                        value={currentLog.rpe || ''}
                                                        onChange={(e) => updateLog(ex.id || exIndex, setIndex, 'rpe', e.target.value)}
                                                        style={{ padding: '4px', textAlign: 'center', fontSize: '0.85rem' }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Footer Stats */}
                                    <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--foreground)' }}>
                                        <div><strong>E1RM:</strong> {Math.round(maxE1RM)}</div>
                                        <div><strong>NL:</strong> {nl}</div>
                                        <div><strong>Tonnage:</strong> {Math.round(tonnage)}</div>
                                        <div style={{ height: '1.2em', width: '1px', background: 'var(--card-border)' }}></div>
                                        <div><strong>Total Stress:</strong> {exTotalStress.toFixed(2)}</div>
                                        <div style={{ color: 'var(--secondary-foreground)' }}>P: {exPeripheralStress.toFixed(2)}, C: {exCentralStress.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Session Feedback & Videos */}
                <div style={{ borderTop: '1px solid var(--card-border)', margin: '0 1.5rem' }}>
                    <button
                        onClick={() => { setVideoTab(v => !v); if (!videoTab) fetchSessionMedia(); }}
                        style={{
                            width: '100%', padding: '0.75rem 0', background: 'none', border: 'none',
                            color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left'
                        }}
                    >
                        <span style={{ fontSize: 14 }}>{videoTab ? '▲' : '▼'}</span>
                        Session Feedback &amp; Videos
                    </button>

                    {videoTab && (
                        <div style={{ paddingBottom: '1rem' }}>
                            {loadingVideos ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', textAlign: 'center', padding: '1rem 0' }}>Loading…</p>
                            ) : sessionMessages.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', textAlign: 'center', padding: '1rem 0' }}>
                                    No feedback sent for this session yet.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {sessionMessages.map((msg: any) => (
                                        <div key={msg.id} style={{
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                            borderRadius: 8, padding: '10px 12px'
                                        }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginBottom: 6 }}>
                                                {msg.sender?.name} · {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {msg.mediaUrl && msg.mediaType?.startsWith('video/') && (
                                                <video
                                                    src={msg.mediaUrl}
                                                    controls
                                                    playsInline
                                                    style={{ width: '100%', maxHeight: 320, borderRadius: 6, background: '#000', display: 'block', marginBottom: msg.content ? 8 : 0 }}
                                                />
                                            )}
                                            {msg.mediaUrl && msg.mediaType?.startsWith('image/') && (
                                                <img
                                                    src={msg.mediaUrl}
                                                    alt=""
                                                    style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 6, display: 'block', marginBottom: msg.content ? 8 : 0 }}
                                                />
                                            )}
                                            {msg.content && msg.content !== 'Video' && msg.content !== 'Photo' && (
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{ borderTop: '1px solid var(--card-border)', padding: '1rem', textAlign: 'right', background: 'var(--card-bg)', position: 'sticky', bottom: 0 }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ marginRight: '1rem' }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Complete Workout</button>
                </div>

            </div>
        </div>
    );
}

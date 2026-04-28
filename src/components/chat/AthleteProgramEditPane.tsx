'use client';

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Pencil, Plus, History } from 'lucide-react';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

interface Props {
    athleteId: string;
    coachId: string;
    onClose: () => void;
    onBuilderActive: (active: boolean) => void;
}

export default function AthleteProgramEditPane({ athleteId, coachId, onClose, onBuilderActive }: Props) {
    const [view, setView] = useState<'history' | 'builder'>('history');
    const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    
    // Editor Data
    const [editorData, setEditorData] = useState<any>(null);
    const [loadingEditor, setLoadingEditor] = useState(false);

    // Fetch history
    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const res = await fetch(`/api/programs?athleteId=${athleteId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setHistory(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                }
            } catch (err) {
                console.error('Failed to load program history:', err);
            } finally {
                if (isMounted) setLoadingHistory(false);
            }
        };
        fetchHistory();
        return () => { isMounted = false; };
    }, [athleteId, view]); // refetch when returning to history view

    // Load editor data when a program is selected
    useEffect(() => {
        if (!selectedProgramId) return;
        
        let isMounted = true;
        const fetchEditorData = async () => {
            setLoadingEditor(true);
            onBuilderActive(true);
            try {
                const res = await fetch(`/api/programs/${selectedProgramId}/editor-data`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setEditorData(data);
                        setView('builder');
                    }
                }
            } catch (err) {
                console.error('Failed to load editor data:', err);
                if (isMounted) {
                    setSelectedProgramId(null);
                    onBuilderActive(false);
                }
            } finally {
                if (isMounted) setLoadingEditor(false);
            }
        };
        fetchEditorData();
        return () => { isMounted = false; };
    }, [selectedProgramId, onBuilderActive]);

    const handleBackToHistory = () => {
        setSelectedProgramId(null);
        setEditorData(null);
        setView('history');
        onBuilderActive(false);
    };

    if (view === 'builder' && editorData) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)' }}>
                <div style={{
                    padding: '12px 16px',
                    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: 'calc(var(--header-height) + env(safe-area-inset-top, 0px))',
                    flexShrink: 0,
                    background: 'rgba(18, 18, 18, 0.97)',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            onClick={handleBackToHistory}
                            style={{ 
                                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', 
                                padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600
                            }}
                        >
                            ← Back to History
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--foreground)' }}>
                            <Pencil size={16} color="var(--primary)" />
                            Editing: {editorData.program.name}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <ProgramBuilder 
                        athleteId={athleteId}
                        initialData={editorData.program}
                        initialExercises={editorData.initialExercises}
                        athleteLiftTargets={editorData.athlete?.liftTargets}
                        athleteTrainingSchedule={editorData.athlete?.trainingSchedule}
                        athleteName={editorData.athlete?.name}
                        existingPrograms={editorData.existingPrograms}
                        initialCoachNotes={editorData.initialCoachNotes}
                        isEmbedded={true}
                    />
                </div>
            </div>
        );
    }

    // History View
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(18, 18, 18, 0.97)' }}>
            <div style={{
                padding: '12px 16px',
                paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: 'calc(var(--header-height) + env(safe-area-inset-top, 0px))',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    <History size={16} color="var(--primary)" />
                    Program History
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    <X size={18} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <a 
                    href={`/dashboard/programs/new?athleteId=${athleteId}`}
                    target="_blank"
                    style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: 'linear-gradient(135deg, rgba(125,135,210,0.2), rgba(168,85,247,0.2))',
                        border: '1px solid rgba(125,135,210,0.4)',
                        color: 'var(--primary)', padding: '12px', borderRadius: 8,
                        textDecoration: 'none', fontWeight: 600, marginBottom: 20,
                        transition: 'all 0.2s',
                    }}
                >
                    <Plus size={18} /> Create New Program
                </a>

                {loadingHistory || loadingEditor ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)' }} className="pulse">
                        {loadingEditor ? 'Loading builder...' : 'Loading history...'}
                    </div>
                ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-foreground)', border: '1px dashed var(--card-border)', borderRadius: '0.5rem' }}>
                        No programs found for this athlete.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {history.map((prog) => (
                            <div 
                                key={prog.id}
                                onClick={() => setSelectedProgramId(prog.id)}
                                style={{
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--card-border)',
                                    borderRadius: 10,
                                    padding: '14px',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s, transform 0.2s',
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--card-border)'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)' }}>
                                        {prog.name}
                                    </div>
                                    <div style={{
                                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                        background: prog.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.1)',
                                        color: prog.status === 'active' ? '#22c55e' : 'var(--secondary-foreground)'
                                    }}>
                                        {prog.status.toUpperCase()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--secondary-foreground)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <CalendarIcon size={12} />
                                        {prog.startDate ? new Date(prog.startDate + 'T12:00:00').toLocaleDateString() : 'No date'}
                                    </span>
                                    <span>{Array.isArray(prog.weeks) ? prog.weeks.length : 0} Weeks</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

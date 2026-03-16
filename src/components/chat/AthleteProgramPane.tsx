'use client';

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import ScheduleView from '@/components/athlete/ScheduleView';

interface Props {
    athleteId: string;
    coachId: string;
    onClose: () => void;
}

export default function AthleteProgramPane({ athleteId, coachId, onClose }: Props) {
    const [data, setData] = useState<{ programs: any[], logs: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                const [progRes, logRes] = await Promise.all([
                    fetch(`/api/programs?athleteId=${athleteId}`),
                    fetch(`/api/logs?athleteId=${athleteId}`)
                ]);

                if (!progRes.ok || !logRes.ok) throw new Error('Failed to load athlete data');

                const programs = await progRes.json();
                const logs = await logRes.json();

                if (isMounted) {
                    setData({ programs, logs });
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('ProgramPane Error:', err);
                    setError('Could not load program data.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [athleteId]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(15, 23, 42, 0.97)' }}>
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
                    <CalendarIcon size={16} color="var(--primary)" />
                    Training Program
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    <X size={18} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {loading && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)' }} className="pulse">
                        Loading program...
                    </div>
                )}

                {error && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
                        {error}
                    </div>
                )}

                {!loading && data && data.programs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-foreground)', border: '1px dashed var(--card-border)', borderRadius: '0.5rem' }}>
                        No active programs assigned to this athlete.
                    </div>
                )}

                {!loading && data && data.programs.length > 0 && (
                    <div style={{ margin: '-1rem' }}>
                        <ScheduleView programs={data.programs} athleteId={athleteId} coachId={coachId} logs={data.logs} />
                    </div>
                )}
            </div>
        </div>
    );
}

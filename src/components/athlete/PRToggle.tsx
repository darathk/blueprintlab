'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Video, X, Check, Upload, Camera } from 'lucide-react';

interface Props {
    athleteId: string;
    exerciseName: string;
    sets: Array<{ weight: string; reps: string; rpe: string }>;
    unit: string;
    sessionId: string;
    programName: string;
    weekNum: number;
    dayNum: number;
    date: string;
}

export default function PRToggle({
    athleteId, exerciseName, sets, unit, sessionId, programName, weekNum, dayNum, date
}: Props) {
    const [open, setOpen] = useState(false);
    const [selectedSet, setSelectedSet] = useState(0);
    const [note, setNote] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputId = `pr-video-${useId()}`;

    // Auto-select the heaviest set that actually has data
    const getBestSetIndex = () => {
        let best = -1, bestWeight = -1;
        sets.forEach((s, i) => {
            if (!s.weight && !s.reps) return; // Skip empty sets
            const w = parseFloat(s.weight) || 0;
            if (w >= bestWeight) { bestWeight = w; best = i; }
        });
        return best >= 0 ? best : 0;
    };

    const handleOpen = () => {
        if (!open) setSelectedSet(getBestSetIndex());
        setOpen(!open);
        setSaved(false);
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 200 * 1024 * 1024) { alert('Max 200MB'); return; }
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
        if (fileRef.current) fileRef.current.value = '';
    };

    const clearVideo = () => {
        if (videoPreview) URL.revokeObjectURL(videoPreview);
        setVideoFile(null);
        setVideoPreview(null);
    };

    const uploadVideo = async (file: File): Promise<{ url: string; type: string }> => {
        const mime = file.type || 'video/mp4';
        let ext = '.mp4';
        if (mime.includes('quicktime') || file.name?.toLowerCase().endsWith('.mov')) ext = '.mov';
        else if (mime.includes('webm')) ext = '.webm';

        const path = `${athleteId}/pr-${Date.now()}${ext}`;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/lift-videos/${path}`;

            xhr.open('POST', url);
            xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
            xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
            xhr.setRequestHeader('Content-Type', mime);
            xhr.setRequestHeader('Cache-Control', '604800');
            xhr.setRequestHeader('x-upsert', 'true');

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const { data } = supabase.storage.from('lift-videos').getPublicUrl(path);
                    resolve({ url: data.publicUrl, type: mime });
                } else reject(new Error(`Upload failed: ${xhr.status}`));
            };

            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.timeout = 300000;
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            xhr.send(file);
        });
    };

    const handleSubmit = async () => {
        const set = sets[selectedSet];
        if (!set || (!set.weight && !set.reps)) {
            alert('Please select a set that has data.');
            return;
        }
        if (!set.weight || !set.reps) {
            alert('Please make sure both weight and reps are filled out for the selected set. Use 0 for bodyweight exercises.');
            return;
        }
        
        if (!videoFile) {
            alert('Please attach a video of your lift to submit a PR.');
            return;
        }

        setSaving(true);
        setUploadProgress(0);

        try {
            let videoUrl: string | null = null;
            let videoType: string | null = null;

            if (videoFile) {
                const result = await uploadVideo(videoFile);
                videoUrl = result.url;
                videoType = result.type;
            }

            const res = await fetch('/api/prs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athleteId,
                    exerciseName,
                    weight: set.weight,
                    reps: set.reps,
                    rpe: set.rpe || null,
                    unit: unit || (typeof window !== 'undefined' ? localStorage.getItem('athlete-unit-pref') : null) || 'lbs',
                    videoUrl,
                    videoType,
                    sessionId,
                    programName,
                    weekNum,
                    dayNum,
                    note: note || null,
                    date,
                }),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => { setOpen(false); }, 2000);
            } else {
                alert('Failed to save PR');
            }
        } catch (e) {
            console.error('PR submit error:', e);
            alert('Failed to save PR');
        } finally {
            setSaving(false);
        }
    };

    const hasData = sets.some(s => s.weight && s.reps);

    if (saved && !open) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', margin: '8px 16px 4px',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fbbf24',
            }}>
                <Trophy size={13} /> PR Logged
            </div>
        );
    }

    return (
        <div style={{ display: 'contents' }}>
            {/* Toggle button */}
            <button
                onClick={handleOpen}
                className="chat-press"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open
                        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.12) 100%)'
                        : 'rgba(251, 191, 36, 0.08)',
                    border: `1px solid rgba(251, 191, 36, ${open ? '0.45' : '0.22'})`,
                    borderRadius: 12, padding: '9px 14px', cursor: 'pointer',
                    color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700,
                    boxShadow: open ? '0 0 14px rgba(251, 191, 36, 0.2)' : 'none',
                    transition: 'all 0.16s var(--ease-out)', flex: 1, justifyContent: 'center',
                }}
            >
                <Trophy size={14} />
                {open ? 'Cancel PR' : 'Mark as PR'}
            </button>

            {/* Expanded PR form */}
            {open && !saved && (
                <div style={{
                    flexBasis: '100%', order: 10, padding: 14,
                    background: 'linear-gradient(180deg, rgba(28, 24, 18, 0.88) 0%, rgba(16, 14, 12, 0.96) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    borderRadius: 16,
                }}>
                    {/* Set selector */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--secondary-foreground)', marginBottom: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Which set was the PR?</div>
                        {!hasData ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--secondary-foreground)', fontStyle: 'italic', padding: '4px 0' }}>
                                Please log your weight and reps in the workout first.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {sets.map((s, i) => {
                                    if (!s.weight && !s.reps) return null;
                                    const sel = selectedSet === i;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedSet(i)}
                                            className="chat-press"
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700,
                                                background: sel ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.04)',
                                                border: sel ? '1px solid rgba(251,191,36,0.55)' : '1px solid rgba(255,255,255,0.08)',
                                                color: sel ? '#fbbf24' : 'var(--secondary-foreground)',
                                                boxShadow: sel ? '0 0 10px rgba(251,191,36,0.2)' : 'none',
                                                cursor: 'pointer', transition: 'all 0.16s var(--ease-out)',
                                            }}
                                        >
                                            S{i + 1}: {s.weight}×{s.reps}{s.rpe ? ` @${s.rpe}` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Note input */}
                    <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        style={{
                            width: '100%', background: 'rgba(0,0,0,0.35)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                            padding: '9px 12px', fontSize: '0.82rem', color: 'var(--foreground)',
                            outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                        }}
                    />

                    {/* Video upload */}
                    <div style={{ marginBottom: 12 }}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/*"
                            onChange={handleVideoSelect}
                            style={{ display: 'none' }}
                            id={inputId}
                        />
                        {videoPreview ? (
                            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(251,191,36,0.25)' }}>
                                <video
                                    src={videoPreview}
                                    controls playsInline muted preload="metadata"
                                    style={{ width: '100%', maxHeight: 180, borderRadius: 10, background: '#000' }}
                                />
                                <button
                                    onClick={clearVideo}
                                    style={{
                                        position: 'absolute', top: 6, right: 6,
                                        background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%',
                                        color: '#fff', width: 26, height: 26, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor={inputId}
                                className="chat-press"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    padding: '12px', borderRadius: 10, cursor: 'pointer',
                                    border: '1px dashed rgba(251,191,36,0.35)',
                                    background: 'rgba(251,191,36,0.05)',
                                    color: 'rgba(251,191,36,0.8)', fontSize: '0.82rem', fontWeight: 600,
                                    transition: 'all 0.16s ease',
                                }}
                            >
                                <Camera size={15} /> Attach PR Video
                            </label>
                        )}
                    </div>

                    {/* Upload progress */}
                    {saving && uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 9999, height: 5, overflow: 'hidden', marginBottom: 10 }}>
                            <div style={{ height: '100%', borderRadius: 9999, background: '#fbbf24', transition: 'width 200ms', width: `${uploadProgress}%` }} />
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !hasData}
                        className="chat-press"
                        style={{
                            width: '100%', padding: '11px', borderRadius: 12, border: 'none',
                            cursor: saving || !hasData ? 'default' : 'pointer',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                            color: '#000', fontSize: '0.88rem', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            opacity: saving || !hasData ? 0.7 : 1,
                        }}
                    >
                        {saving ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Saving...') : <><Trophy size={15} /> Submit PR</>}
                    </button>
                </div>
            )}

            {/* Saved confirmation */}
            {saved && (
                <div style={{
                    marginTop: 8, padding: '10px 14px',
                    background: 'rgba(251, 191, 36, 0.12)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    borderRadius: 12, textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700,
                }}>
                    <Check size={16} /> PR Saved!
                </div>
            )}
        </div>
    );
}

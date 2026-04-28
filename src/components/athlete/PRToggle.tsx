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

    // Auto-select the heaviest set
    const getBestSetIndex = () => {
        let best = 0, bestWeight = 0;
        sets.forEach((s, i) => {
            const w = parseFloat(s.weight) || 0;
            if (w > bestWeight) { bestWeight = w; best = i; }
        });
        return best;
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
        if (!set?.weight || !set?.reps) return;

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
                    unit,
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

    // Don't show if no actual sets have data
    const hasData = sets.some(s => s.weight && s.reps);
    if (!hasData) return null;

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
        <div style={{ padding: '4px 16px 8px' }}>
            {/* Toggle button */}
            <button
                onClick={handleOpen}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.06)',
                    border: `1px solid rgba(251, 191, 36, ${open ? '0.35' : '0.15'})`,
                    borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                    color: '#fbbf24', fontSize: 12, fontWeight: 600,
                    transition: 'all 0.15s', width: '100%', justifyContent: 'center',
                }}
            >
                <Trophy size={13} />
                {open ? 'Cancel PR' : 'Mark as PR'}
            </button>

            {/* Expanded PR form */}
            {open && !saved && (
                <div style={{
                    marginTop: 8, padding: 12,
                    background: 'rgba(251, 191, 36, 0.04)',
                    border: '1px solid rgba(251, 191, 36, 0.15)',
                    borderRadius: 10,
                }}>
                    {/* Set selector */}
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', marginBottom: 6, fontWeight: 600 }}>Which set was the PR?</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {sets.map((s, i) => {
                                if (!s.weight && !s.reps) return null;
                                const sel = selectedSet === i;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedSet(i)}
                                        style={{
                                            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                            background: sel ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                                            border: sel ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                            color: sel ? '#fbbf24' : 'var(--secondary-foreground)',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                    >
                                        S{i + 1}: {s.weight}×{s.reps}{s.rpe ? ` @${s.rpe}` : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Note input */}
                    <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                            padding: '7px 10px', fontSize: 12, color: 'var(--foreground)',
                            outline: 'none', marginBottom: 10, boxSizing: 'border-box',
                        }}
                    />

                    {/* Video upload */}
                    <div style={{ marginBottom: 10 }}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/*"
                            capture="environment"
                            onChange={handleVideoSelect}
                            style={{ display: 'none' }}
                            id={inputId}
                        />
                        {videoPreview ? (
                            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                                <video
                                    src={videoPreview}
                                    controls playsInline muted preload="metadata"
                                    style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }}
                                />
                                <button
                                    onClick={clearVideo}
                                    style={{
                                        position: 'absolute', top: 4, right: 4,
                                        background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                                        color: '#fff', width: 24, height: 24, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor={inputId}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    padding: '10px', borderRadius: 8, cursor: 'pointer',
                                    border: '1px dashed rgba(251,191,36,0.25)',
                                    background: 'rgba(251,191,36,0.03)',
                                    color: 'rgba(251,191,36,0.6)', fontSize: 12, fontWeight: 600,
                                }}
                            >
                                <Camera size={14} /> Attach PR Video
                            </label>
                        )}
                    </div>

                    {/* Upload progress */}
                    {saving && uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ height: '100%', borderRadius: 4, background: '#fbbf24', transition: 'width 200ms', width: `${uploadProgress}%` }} />
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{
                            width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                            cursor: saving ? 'default' : 'pointer',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            color: '#000', fontSize: 13, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            opacity: saving ? 0.7 : 1,
                        }}
                    >
                        {saving ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Saving...') : <><Trophy size={14} /> Submit PR</>}
                    </button>
                </div>
            )}

            {/* Saved confirmation */}
            {saved && (
                <div style={{
                    marginTop: 8, padding: '10px 12px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: 8, textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    color: '#fbbf24', fontSize: 13, fontWeight: 600,
                }}>
                    <Check size={15} /> PR Saved!
                </div>
            )}
        </div>
    );
}

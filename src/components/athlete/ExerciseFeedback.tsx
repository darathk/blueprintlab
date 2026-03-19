'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Video, X, Send, CheckCircle, Scissors, Paperclip, Image } from 'lucide-react';
import VideoCropper from '@/components/chat/VideoCropper';

interface Props {
    athleteId: string;
    coachId: string;
    exerciseName: string;
    weekNum: number;
    dayNum: number;
    blockName: string;
    unit?: 'kg' | 'lbs';
    sets: Array<{
        setNumber: number;
        actual: { weight: string; reps: string; rpe: string };
    }>;
}

export default function ExerciseFeedback({
    athleteId, coachId: coachIdProp, exerciseName, weekNum, dayNum, blockName, unit = 'lbs', sets
}: Props) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [resolvedCoachId, setResolvedCoachId] = useState(coachIdProp || '');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Media staging (same as chat)
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [stagedFileUrls, setStagedFileUrls] = useState<string[]>([]);
    const [stagedPosters, setStagedPosters] = useState<Record<number, string>>({});
    const [stagedPreviewIndex, setStagedPreviewIndex] = useState(0);
    const [showStaging, setShowStaging] = useState(false);

    // Video cropper
    const [cropFile, setCropFile] = useState<File | null>(null);
    const [stagedTrimData, setStagedTrimData] = useState<Record<number, { start: number; end: number }>>({});

    const fileRef = useRef<HTMLInputElement>(null);

    // Resolve coach ID
    useEffect(() => {
        if (resolvedCoachId) return;
        fetch(`/api/athletes/${athleteId}`)
            .then(r => r.json())
            .then(data => {
                const cid = data?.coachId || data?.athlete?.coachId || '';
                if (cid) setResolvedCoachId(cid);
            })
            .catch(() => { });
    }, [athleteId, resolvedCoachId]);

    const buildAutoMessage = () => {
        const setLines = sets
            .filter(s => s.actual.weight || s.actual.reps || s.actual.rpe)
            .map(s => {
                const displayWeight = unit === 'lbs' ? s.actual.weight : (parseFloat(s.actual.weight) * 0.45359237).toFixed(1).replace(/\.0$/, '');
                return `  Set ${s.setNumber}: ${displayWeight || '—'} ${unit} × ${s.actual.reps || '—'} reps @ RPE ${s.actual.rpe || '—'}`;
            })
            .join('\n');

        return [
            `Feedback`,
            `Block: ${blockName}`,
            `Week: ${weekNum} | Session: ${dayNum}`,
            `Exercise: ${exerciseName}`,
            setLines ? `\nSets Logged:\n${setLines}` : '',
            `\nFeedback: `,
        ].filter(Boolean).join('\n');
    };

    const handleOpen = () => {
        if (!open) setMessage(buildAutoMessage());
        setOpen(o => !o);
        setSent(false);
        setError('');
    };

    // --- Media handling (mirrors ChatInterface) ---

    const generateVideoPoster = useCallback((file: File, index: number) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        const objUrl = URL.createObjectURL(file);
        video.src = objUrl;

        let captured = false;
        const capturePoster = () => {
            if (captured) return;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 160;
                canvas.height = video.videoHeight || 90;
                const ctx = canvas.getContext('2d');
                if (ctx && video.videoWidth > 0) {
                    ctx.drawImage(video, 0, 0);
                    const poster = canvas.toDataURL('image/jpeg', 0.7);
                    setStagedPosters(prev => ({ ...prev, [index]: poster }));
                    captured = true;
                }
            } catch (e) {
                console.error('Poster generation failed:', e);
            }
            URL.revokeObjectURL(objUrl);
            video.remove();
        };

        video.onloadeddata = () => {
            // Try to seek to 0.5s for a better frame
            video.currentTime = Math.min(0.5, video.duration || 0.5);
        };
        video.onseeked = capturePoster;
        // Fallback: if seek never fires, capture on loadeddata after a short delay
        video.onloadedmetadata = () => {
            setTimeout(() => { if (!captured) capturePoster(); }, 1000);
        };
    }, []);

    const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const validFiles = files.filter(f => {
            const isVid = f.type.startsWith('video/');
            const isImg = f.type.startsWith('image/');
            return (isVid || isImg) && f.size <= 200 * 1024 * 1024;
        });

        if (validFiles.length < files.length) {
            alert('Some files were ignored (must be image/video under 200MB)');
        }
        if (validFiles.length === 0) return;

        const startIndex = stagedFiles.length;
        setStagedFiles(prev => [...prev, ...validFiles]);
        setStagedFileUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

        validFiles.forEach((f, i) => {
            if (f.type.startsWith('video/')) {
                generateVideoPoster(f, startIndex + i);
            }
        });

        setShowStaging(true);
        if (fileRef.current) fileRef.current.value = '';
    };

    const clearStagedMedia = (index?: number) => {
        if (index !== undefined) {
            URL.revokeObjectURL(stagedFileUrls[index]);
            setStagedFiles(prev => prev.filter((_, i) => i !== index));
            setStagedFileUrls(prev => prev.filter((_, i) => i !== index));
            setStagedPosters(prev => { const n = { ...prev }; delete n[index]; return n; });
            setStagedTrimData(prev => { const n = { ...prev }; delete n[index]; return n; });
            if (stagedPreviewIndex >= stagedFiles.length - 1) {
                setStagedPreviewIndex(Math.max(0, stagedFiles.length - 2));
            }
        } else {
            stagedFileUrls.forEach(url => URL.revokeObjectURL(url));
            setStagedFiles([]);
            setStagedFileUrls([]);
            setStagedPosters({});
            setStagedTrimData({});
        }
    };

    const closeStagingOverlay = () => {
        setShowStaging(false);
    };

    const confirmStaging = () => {
        setShowStaging(false);
    };

    const handleCropComplete = (file: File, trimStart?: number, trimEnd?: number) => {
        const existingIndex = stagedFiles.findIndex(f => f === cropFile);
        if (existingIndex >= 0) {
            URL.revokeObjectURL(stagedFileUrls[existingIndex]);
            setStagedFiles(prev => prev.map((f, i) => i === existingIndex ? file : f));
            setStagedFileUrls(prev => prev.map((url, i) => i === existingIndex ? URL.createObjectURL(file) : url));
            generateVideoPoster(file, existingIndex);
            if (trimStart !== undefined && trimEnd !== undefined) {
                setStagedTrimData(prev => ({ ...prev, [existingIndex]: { start: trimStart, end: trimEnd } }));
            } else {
                setStagedTrimData(prev => { const n = { ...prev }; delete n[existingIndex]; return n; });
            }
        } else {
            const newIndex = stagedFiles.length;
            setStagedFiles(prev => [...prev, file]);
            setStagedFileUrls(prev => [...prev, URL.createObjectURL(file)]);
            generateVideoPoster(file, newIndex);
            if (trimStart !== undefined && trimEnd !== undefined) {
                setStagedTrimData(prev => ({ ...prev, [newIndex]: { start: trimStart, end: trimEnd } }));
            }
        }
        setCropFile(null);
    };

    // --- Upload & Send ---

    const uploadFile = async (file: File, index: number): Promise<{ url: string; type: string }> => {
        const mime = file.type || 'video/mp4';
        let ext = '.mp4';
        if (mime.includes('quicktime')) ext = '.mov';
        else if (mime.includes('webm')) ext = '.webm';
        else if (mime.includes('png')) ext = '.png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';

        const path = `${athleteId}/${Date.now()}-feedback-${index}${ext}`;

        // Use XHR for progress tracking (same as chat)
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
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const { data } = supabase.storage.from('lift-videos').getPublicUrl(path);
                    resolve({ url: data.publicUrl, type: mime });
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.timeout = 300000;
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            xhr.send(file);
        });
    };

    const handleSend = async () => {
        if (!message.trim() && stagedFiles.length === 0) return;
        if (!resolvedCoachId) {
            setError('Could not find coach — please contact support.');
            return;
        }

        setSending(true);
        setError('');
        setUploadProgress(0);

        try {
            let mediaUrl: string | null = null;
            let mediaType: string | null = null;

            // Upload first file (messages support single media)
            // Videos upload at original quality — no re-encoding preserves
            // full quality, audio, and eliminates processing delay
            if (stagedFiles.length > 0) {
                const result = await uploadFile(stagedFiles[0], 0);
                // Append media fragment URI for trimmed videos
                const trim = stagedTrimData[0];
                mediaUrl = trim ? `${result.url}#t=${trim.start},${trim.end}` : result.url;
                mediaType = result.type;
            }

            const content = message.trim() || (stagedFiles.length > 0 ? 'Video feedback' : '');

            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: athleteId,
                    receiverId: resolvedCoachId,
                    content,
                    mediaUrl,
                    mediaType,
                }),
            });

            if (!res.ok) throw new Error('Failed to send');

            setSent(true);
            setTimeout(() => {
                setOpen(false);
                setSent(false);
                setMessage('');
                clearStagedMedia();
                setUploadProgress(0);
            }, 1800);
        } catch (e: any) {
            setError('Send failed — please try again.');
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ marginTop: 10 }}>
            {/* Trigger button */}
            <button
                onClick={handleOpen}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    color: '#818cf8', fontSize: 13, fontWeight: 600,
                    transition: 'all 0.15s', width: '100%', justifyContent: 'center',
                }}
            >
                <MessageCircle size={15} />
                {open ? 'Hide Feedback' : 'Send Feedback'}
            </button>

            {/* Expandable panel */}
            {open && (
                <div style={{
                    marginTop: 8, background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
                    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {/* Auto-filled message textarea */}
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={9}
                        style={{
                            width: '100%', background: 'rgba(15,23,42,0.8)',
                            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                            padding: '10px 12px', fontSize: 13, color: '#f1f5f9',
                            resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit',
                            outlineColor: '#6366f1',
                        }}
                    />

                    {/* Inline media previews (thumbnails) */}
                    {stagedFiles.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {stagedFiles.map((file, i) => (
                                <div
                                    key={i}
                                    onClick={() => { setStagedPreviewIndex(i); setShowStaging(true); }}
                                    style={{
                                        width: 64, height: 64, borderRadius: 8, overflow: 'hidden',
                                        border: '1px solid rgba(99,102,241,0.3)',
                                        cursor: 'pointer', position: 'relative', flexShrink: 0,
                                    }}
                                >
                                    {file.type.startsWith('video/') ? (
                                        stagedPosters[i] ? (
                                            <img src={stagedPosters[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Video size={20} color="#818cf8" />
                                            </div>
                                        )
                                    ) : (
                                        <img src={stagedFileUrls[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                    {/* Remove button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); clearStagedMedia(i); }}
                                        style={{
                                            position: 'absolute', top: 2, right: 2,
                                            background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                                            color: '#fff', width: 18, height: 18,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', padding: 0,
                                        }}
                                    >
                                        <X size={10} />
                                    </button>
                                    {/* Video badge */}
                                    {file.type.startsWith('video/') && (
                                        <div style={{
                                            position: 'absolute', bottom: 2, left: 2,
                                            background: 'rgba(0,0,0,0.6)', borderRadius: 3,
                                            padding: '1px 4px', fontSize: 9, color: '#fff',
                                        }}>
                                            {(file.size / (1024 * 1024)).toFixed(1)}MB
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload progress */}
                    {sending && uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 4,
                                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                transition: 'width 200ms',
                                width: `${uploadProgress}%`,
                            }} />
                        </div>
                    )}

                    {/* Actions row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* File picker */}
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept="video/*,image/*"
                            onChange={handleMedia}
                            style={{ display: 'none' }}
                            id={`feedback-media-${athleteId}-${exerciseName.replace(/\s/g, '-')}`}
                        />
                        <label
                            htmlFor={`feedback-media-${athleteId}-${exerciseName.replace(/\s/g, '-')}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: stagedFiles.length > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${stagedFiles.length > 0 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                                color: stagedFiles.length > 0 ? '#818cf8' : '#94a3b8', fontSize: 13, fontWeight: 600,
                                transition: 'all 0.15s', flexShrink: 0,
                            }}
                        >
                            <Paperclip size={14} />
                            {stagedFiles.length > 0 ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}` : 'Attach'}
                        </label>

                        {/* Send */}
                        <button
                            onClick={handleSend}
                            disabled={sending || sent || (!message.trim() && stagedFiles.length === 0)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: sent ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: sent ? '1px solid rgba(16,185,129,0.4)' : 'none',
                                borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
                                color: sent ? '#34d399' : '#fff', fontSize: 13, fontWeight: 700,
                                opacity: (!message.trim() && stagedFiles.length === 0) ? 0.4 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {sent
                                ? <><CheckCircle size={14} /> Sent!</>
                                : sending
                                    ? uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Sending…'
                                    : <><Send size={13} /> Send to Coach</>
                            }
                        </button>
                    </div>

                    {error && (
                        <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</div>
                    )}
                </div>
            )}

            {/* Full-screen media staging overlay (same as chat) */}
            {showStaging && stagedFiles.length > 0 && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: '#0b141a',
                    display: 'flex', flexDirection: 'column',
                    animation: 'fadeIn 0.2s ease',
                }}>
                    {/* Top Bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                        color: '#fff', background: '#1f2c34',
                    }}>
                        <button
                            onClick={closeStagingOverlay}
                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                        >
                            <X size={26} />
                        </button>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') && (
                                <button
                                    onClick={() => setCropFile(stagedFiles[stagedPreviewIndex])}
                                    style={{
                                        background: 'rgba(0,168,132,0.2)', border: 'none', color: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                        borderRadius: 20,
                                    }}
                                >
                                    <Scissors size={18} color="#00a884" />
                                    <span style={{ fontSize: 13, color: '#00a884', fontWeight: 600 }}>Trim</span>
                                </button>
                            )}
                            <div style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>HD</div>
                            <button
                                onClick={() => fileRef.current?.click()}
                                style={{ background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', padding: 4 }}
                            >
                                <Paperclip size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Main Preview */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 16 }}>
                        {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') ? (
                            <video
                                key={stagedFileUrls[stagedPreviewIndex]}
                                src={stagedFileUrls[stagedPreviewIndex]}
                                poster={stagedPosters[stagedPreviewIndex] || undefined}
                                controls
                                playsInline
                                preload="auto"
                                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                            />
                        ) : (
                            <img
                                src={stagedFileUrls[stagedPreviewIndex]}
                                alt=""
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                            />
                        )}

                        {/* File size overlay for videos */}
                        {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') && (
                            <div style={{
                                position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                                borderRadius: 16, padding: '6px 14px',
                                fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
                            }}>
                                {(stagedFiles[stagedPreviewIndex].size / (1024 * 1024)).toFixed(1)} MB
                            </div>
                        )}
                    </div>

                    {/* Bottom area */}
                    <div style={{ background: '#111b21', padding: '12px 12px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
                        {/* File thumbnails */}
                        {stagedFiles.length >= 1 && (
                            <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto', paddingLeft: 4 }}>
                                {stagedFileUrls.map((url, i) => (
                                    <div key={i} onClick={() => setStagedPreviewIndex(i)} style={{
                                        width: 54, height: 54, borderRadius: 8, overflow: 'hidden',
                                        border: i === stagedPreviewIndex ? '2px solid #00a884' : '2px solid transparent',
                                        cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'all 0.15s ease',
                                    }}>
                                        {stagedFiles[i]?.type.startsWith('video/') ? (
                                            stagedPosters[i] ? (
                                                <img src={stagedPosters[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                            ) : (
                                                <video
                                                    src={url}
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    onLoadedData={e => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }}
                                                />
                                            )
                                        ) : (
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearStagedMedia(i); }}
                                            style={{
                                                position: 'absolute', top: 2, right: 2,
                                                background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                                                color: '#fff', width: 18, height: 18,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    style={{
                                        width: 54, height: 54, borderRadius: 8,
                                        border: '2px dashed rgba(134,150,160,0.4)',
                                        background: 'none', color: '#8696a0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    <div style={{ fontSize: 26, fontWeight: 300 }}>+</div>
                                </button>
                            </div>
                        )}

                        {/* Done / confirm button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                flex: 1, background: '#2a3942', borderRadius: 24, padding: '4px 16px',
                                display: 'flex', alignItems: 'center', minHeight: 48,
                                boxShadow: '0 1px 1px rgba(0,0,0,0.2)',
                            }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                                    {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                            <button
                                onClick={confirmStaging}
                                style={{
                                    width: 52, height: 52, borderRadius: '50%', background: '#00a884',
                                    border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', flexShrink: 0,
                                }}
                            >
                                <CheckCircle size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Cropper modal */}
            {cropFile && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: '#000' }}>
                    <VideoCropper
                        file={cropFile}
                        onCancel={() => setCropFile(null)}
                        onComplete={handleCropComplete}
                    />
                </div>
            )}
        </div>
    );
}

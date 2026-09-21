'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Video, X, Send, CheckCircle, Scissors, Paperclip, Image, Upload, Film } from 'lucide-react';
import VideoCropper from '@/components/chat/VideoCropper';
import { chatUploadManager } from '@/lib/chat-upload-manager';

const getSafeMimeType = (f: File) => {
    let mime = f?.type || '';
    const isGeneric = !mime || mime === 'application/octet-stream' || mime === 'application/x-www-form-urlencoded';
    if (isGeneric && f?.name) {
        const name = f.name.toLowerCase();
        if (/\.(mp4|mov|webm|3gp|m4v|mkv)$/i.test(name)) mime = 'video/mp4';
        else if (/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(name)) mime = 'image/jpeg';
        else if (/\.(m4a|ogg|mp3|wav)$/i.test(name)) mime = 'audio/mp4';
    }
    return mime;
};

const isVideoFile = (f?: File | null) => {
    if (!f) return false;
    const mime = getSafeMimeType(f);
    return mime.startsWith('video/') || /\.(mp4|mov|webm|3gp|m4v|mkv)$/i.test(f.name || '');
};

interface Props {
    athleteId: string;
    coachId: string;
    exerciseName: string;
    weekNum: number;
    dayNum: number;
    blockName: string;
    sessionId?: string;
    unit?: 'kg' | 'lbs';
    sets: Array<{
        setNumber: number;
        actual: { weight: string; reps: string; rpe: string };
    }>;
}

export default function ExerciseFeedback({
    athleteId, coachId: coachIdProp, exerciseName, weekNum, dayNum, blockName, sessionId, unit = 'lbs', sets
}: Props) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState<false | 'done' | 'uploading'>(false);
    const [error, setError] = useState('');
    const [resolvedCoachId, setResolvedCoachId] = useState(coachIdProp || '');
    const [attachWarning, setAttachWarning] = useState(false);

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

    // React-guaranteed unique id. Without this, the old
    // `feedback-media-${athleteId}-${exerciseName}` id collided whenever the
    // same exercise appeared more than once in a session (supersets, back-off
    // sets, warmup + main block). Multiple <label htmlFor> pointing at the
    // same id means the browser fires the click on the first matching input —
    // so the file ended up staged on the WRONG ExerciseFeedback instance and
    // the athlete thought their attach silently did nothing.
    const inputId = `feedback-media-${useId()}`;

    // Resolve coach ID if not provided via prop
    useEffect(() => {
        if (resolvedCoachId) return;
        fetch(`/api/athletes/${athleteId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const cid = data?.coachId || '';
                if (cid) setResolvedCoachId(cid);
            })
            .catch(() => { });
    }, [athleteId, resolvedCoachId]);

    const buildAutoMessage = () => {
        const savedPref = (typeof window !== 'undefined' ? localStorage.getItem('athlete-unit-pref') : null) as string | null;
        const effectiveUnit = unit || savedPref || 'lbs';
        const setLines = (sets || [])
            .filter(s => s && s.actual && (s.actual.weight || s.actual.reps || s.actual.rpe))
            .map((s, idx) => {
                const displayWeight = s.actual.weight;
                const setNum = s.setNumber !== undefined ? s.setNumber : (idx + 1);
                return `Set ${setNum}: ${displayWeight || '—'} ${effectiveUnit} × ${s.actual.reps || '—'} reps @ RPE ${s.actual.rpe || '—'}`;
            })
            .join('\n');

        return [
            `Exercise: ${exerciseName} (${blockName || 'Current Block'} • W${weekNum}:S${dayNum})`,
            setLines ? `Sets Logged:\n${setLines}` : '',
            `Feedback:\n`,
        ].filter(Boolean).join('\n\n');
    };

    const handleOpen = () => {
        if (!open) setMessage(buildAutoMessage());
        setOpen(o => !o);
        setSent(false);
        setError('');
        setAttachWarning(false);
    };

    // Returns true if all sets that have any data filled in also have both reps AND rpe
    const setsHaveRepsAndRpe = () => {
        const filledSets = sets.filter(s => s.actual.weight || s.actual.reps || s.actual.rpe);
        if (filledSets.length === 0) return false; // no data at all
        return filledSets.every(s => s.actual.reps && s.actual.rpe);
    };

    const handleAttachClick = (e: React.MouseEvent) => {
        if (!setsHaveRepsAndRpe()) {
            e.preventDefault();
            setAttachWarning(true);
            return;
        }
        setAttachWarning(false);
        fileRef.current?.click();
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
            const mime = getSafeMimeType(f);
            const isVid = mime.startsWith('video/');
            const isImg = mime.startsWith('image/');
            return (isVid || isImg) && f.size <= 500 * 1024 * 1024;
        });

        if (validFiles.length < files.length) {
            alert('Some files were ignored (must be image/video under 500MB)');
        }
        if (validFiles.length === 0) return;

        const startIndex = stagedFiles.length;
        setStagedFiles(prev => [...prev, ...validFiles]);
        setStagedFileUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

        validFiles.forEach((f, i) => {
            const mime = getSafeMimeType(f);
            if (mime.startsWith('video/')) {
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

    const handleSend = async () => {
        const textContent = message.trim();
        const filesToSend = stagedFiles.length > 0 ? [...stagedFiles] : [];

        if (!textContent && filesToSend.length === 0) return;
        if (!resolvedCoachId) {
            setError('Could not find coach — please contact support.');
            return;
        }

        setSending(true);
        setError('');
        const hadFiles = filesToSend.length > 0;

        try {
            if (filesToSend.length === 0) {
                // 1. Text-only feedback message
                const res = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        senderId: athleteId,
                        receiverId: resolvedCoachId,
                        content: textContent,
                        mediaUrl: null,
                        mediaType: null,
                        sessionId: sessionId || null,
                    }),
                });
                if (!res.ok) throw new Error('Failed to send text');
            } else {
                // 2. Upload files in background — the first file carries the entire feedback block!
                // This guarantees the video and the feedback text arrive together as one unified message bubble.
                for (let i = 0; i < filesToSend.length; i++) {
                    const safeMime = getSafeMimeType(filesToSend[i]);
                    const isVid = safeMime.startsWith('video/');
                    const isAudio = safeMime.startsWith('audio/');
                    
                    const msgContent = i === 0 && textContent
                        ? textContent
                        : isAudio ? 'Voice Message' : isVid ? 'Video' : 'Photo';
                    const tempId = `temp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
                    
                    chatUploadManager.startUpload({
                        file: filesToSend[i],
                        tempMessageId: tempId,
                        athleteId: athleteId,
                        currentUserId: athleteId,
                        otherUserId: resolvedCoachId,
                        content: msgContent,
                        replyToId: null,
                        trim: stagedTrimData[i],
                        sessionId: sessionId || null,
                    });
                }
            }

            setSent(hadFiles ? 'uploading' : 'done');
            clearStagedMedia();
            setShowStaging(false);
            setMessage('');
            setTimeout(() => {
                setOpen(false);
                setSent(false);
            }, hadFiles ? 2500 : 1200);
        } catch (e: any) {
            setError('Send failed — please try again.');
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {/* Trigger button */}
            <button
                onClick={handleOpen}
                className="chat-press"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)'
                        : 'rgba(99, 102, 241, 0.1)',
                    border: `1px solid rgba(99, 102, 241, ${open ? '0.45' : '0.25'})`,
                    borderRadius: 12, padding: '9px 14px', cursor: 'pointer',
                    color: '#a5b4fc', fontSize: '0.82rem', fontWeight: 700,
                    boxShadow: open ? '0 0 14px rgba(99, 102, 241, 0.25)' : 'none',
                    transition: 'all 0.16s var(--ease-out)', width: '100%', justifyContent: 'center',
                }}
            >
                <MessageCircle size={15} />
                {open ? 'Hide Feedback' : 'Send Feedback'}
            </button>

            {/* Expandable panel */}
            {open && (
                <div style={{
                    background: 'linear-gradient(180deg, rgba(18, 22, 36, 0.9) 0%, rgba(12, 14, 24, 0.96) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    borderRadius: 16,
                    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {/* Exercise Context Badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        fontSize: '0.74rem', color: '#c7d2fe',
                        flexWrap: 'wrap', gap: 4
                    }}>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{exerciseName}</span>
                        <span style={{ color: 'rgba(199, 210, 254, 0.75)', fontSize: '0.7rem' }}>
                            {blockName ? `${blockName} • ` : ''}W{weekNum}:S{dayNum}
                        </span>
                    </div>

                    {/* Auto-filled message textarea */}
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={6}
                        style={{
                            width: '100%', background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 10,
                            padding: '10px 12px', fontSize: '0.82rem', color: '#f8fafc',
                            resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit',
                            outlineColor: '#6366f1', boxSizing: 'border-box',
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
                                    {getSafeMimeType(file).startsWith('video/') ? (
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
                                    {getSafeMimeType(file).startsWith('video/') && (
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



                    {/* Reps/RPE warning card */}
                    {attachWarning && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.4)',
                            borderRadius: 10, padding: '12px 14px',
                            animation: 'fadeIn 0.2s ease',
                        }}>
                            <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>⚠️</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>
                                    Log your sets before attaching media
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', lineHeight: 1.5 }}>
                                    Please fill in both <strong>Reps</strong> and <strong>RPE</strong> for each set before you can attach a video or photo.
                                </div>
                            </div>
                            <button
                                onClick={() => setAttachWarning(false)}
                                style={{ background: 'none', border: 'none', color: 'rgba(251,191,36,0.6)', cursor: 'pointer', padding: 0, marginLeft: 'auto', flexShrink: 0 }}
                            >
                                <X size={14} />
                            </button>
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
                            id={inputId}
                        />
                        <button
                            onClick={handleAttachClick}
                            className="chat-press"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: stagedFiles.length > 0 ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${stagedFiles.length > 0 ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
                                color: stagedFiles.length > 0 ? '#a5b4fc' : '#94a3b8', fontSize: '0.82rem', fontWeight: 700,
                                transition: 'all 0.16s var(--ease-out)', flexShrink: 0,
                            }}
                        >
                            <Paperclip size={14} />
                            {stagedFiles.length > 0 ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}` : 'Attach'}
                        </button>

                        {/* Send */}
                        <button
                            onClick={handleSend}
                            disabled={!!sending || !!sent || (!message.trim() && stagedFiles.length === 0)}
                            className="chat-press"
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: sent === 'uploading'
                                    ? 'rgba(99,102,241,0.25)'
                                    : sent === 'done'
                                        ? 'rgba(16,185,129,0.25)'
                                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                border: sent === 'uploading'
                                    ? '1px solid rgba(99,102,241,0.45)'
                                    : sent === 'done'
                                        ? '1px solid rgba(16,185,129,0.45)'
                                        : 'none',
                                borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
                                color: sent === 'uploading' ? '#a5b4fc' : sent === 'done' ? '#34d399' : '#fff',
                                fontSize: '0.86rem', fontWeight: 800,
                                opacity: (!message.trim() && stagedFiles.length === 0) ? 0.4 : 1,
                                boxShadow: (!message.trim() && stagedFiles.length === 0) || sent ? 'none' : '0 4px 16px rgba(99, 102, 241, 0.35)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {sent === 'uploading'
                                ? <><Upload size={14} /> Video uploading ↑</>
                                : sent === 'done'
                                    ? <><CheckCircle size={14} /> Sent!</>
                                    : sending
                                        ? 'Sending…'
                                        : <><Send size={13} /> Send to Coach</>
                            }
                        </button>
                    </div>

                    {error && (
                        <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</div>
                    )}
                </div>
            )}

            {/* Media staging dialog (Full-Screen Glass Modal portaled to document.body) */}
            {mounted && showStaging && stagedFiles.length > 0 && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        background: 'rgba(8, 10, 16, 0.96)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        height: '100dvh',
                        maxHeight: '100dvh',
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'fadeIn 0.2s ease',
                    }}
                >
                    {/* Top Bar with Glass Design */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 18px',
                        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#fff',
                        background: 'rgba(12, 15, 24, 0.85)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={closeStagingOverlay}
                                className="chat-press"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '50%',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                                Attach Workout Media
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {isVideoFile(stagedFiles[stagedPreviewIndex]) && (
                                <button
                                    onClick={() => setCropFile(stagedFiles[stagedPreviewIndex])}
                                    className="chat-press"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%)',
                                        border: '1px solid rgba(129, 140, 248, 0.4)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 16px',
                                        borderRadius: 20,
                                        boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)',
                                        transition: 'all 0.16s ease',
                                    }}
                                >
                                    <Scissors size={16} color="var(--primary, #818cf8)" />
                                    <span style={{ fontSize: 13, color: '#e0e7ff', fontWeight: 700 }}>Trim</span>
                                </button>
                            )}
                            <div style={{ border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: 'rgba(255, 255, 255, 0.85)', background: 'rgba(255, 255, 255, 0.04)' }}>
                                HD
                            </div>
                            <button
                                onClick={() => fileRef.current?.click()}
                                className="chat-press"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '50%',
                                    color: 'var(--secondary-foreground, #8696a0)',
                                    cursor: 'pointer',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                title="Add file"
                            >
                                <Paperclip size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Main Preview Container */}
                    <div style={{
                        flex: 1,
                        maxHeight: 'min(55vh, 420px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        padding: 16,
                    }}>
                        {isVideoFile(stagedFiles[stagedPreviewIndex]) ? (
                            <video
                                key={stagedFileUrls[stagedPreviewIndex]}
                                src={stagedFileUrls[stagedPreviewIndex]}
                                poster={stagedPosters[stagedPreviewIndex] || undefined}
                                controls
                                playsInline
                                webkit-playsinline="true"
                                preload="metadata"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: 'min(50vh, 380px)',
                                    borderRadius: 14,
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                            />
                        ) : (
                            <img
                                src={stagedFileUrls[stagedPreviewIndex]}
                                alt=""
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: 'min(50vh, 380px)',
                                    objectFit: 'contain',
                                    borderRadius: 14,
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                            />
                        )}

                        {/* File size overlay */}
                        {isVideoFile(stagedFiles[stagedPreviewIndex]) && (
                            <div style={{
                                position: 'absolute',
                                bottom: 12,
                                right: 16,
                                background: 'rgba(10, 12, 20, 0.85)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 10,
                                padding: '4px 10px',
                                fontSize: 11,
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontWeight: 600,
                            }}>
                                {(stagedFiles[stagedPreviewIndex].size / (1024 * 1024)).toFixed(1)} MB
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Area with Glass Styling */}
                    <div style={{
                        background: 'rgba(12, 15, 24, 0.92)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '14px 16px',
                        paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
                        marginTop: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}>
                        {/* File thumbnails strip — Fast, zero <video> tags, 0ms latency */}
                        {stagedFiles.length > 1 && (
                            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                                {stagedFileUrls.map((url, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setStagedPreviewIndex(i)}
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 10,
                                            overflow: 'hidden',
                                            border: i === stagedPreviewIndex ? '2px solid var(--primary, #818cf8)' : '1px solid rgba(255, 255, 255, 0.12)',
                                            boxShadow: i === stagedPreviewIndex ? '0 0 14px rgba(129, 140, 248, 0.4)' : 'none',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            position: 'relative',
                                            transition: 'all 0.15s ease',
                                            transform: i === stagedPreviewIndex ? 'scale(1.05)' : 'scale(1)',
                                        }}
                                    >
                                        {isVideoFile(stagedFiles[i]) ? (
                                            stagedPosters[i] ? (
                                                <img src={stagedPosters[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.6 }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.06)', opacity: i === stagedPreviewIndex ? 1 : 0.6 }}>
                                                    <Film size={18} color="var(--primary, #818cf8)" />
                                                </div>
                                            )
                                        ) : (
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.6 }} />
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearStagedMedia(i); }}
                                            className="chat-press"
                                            style={{
                                                position: 'absolute',
                                                top: 2,
                                                right: 2,
                                                background: 'rgba(0, 0, 0, 0.75)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                color: '#fff',
                                                width: 18,
                                                height: 18,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0,
                                            }}
                                            title="Remove"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="chat-press"
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 10,
                                        border: '1.5px dashed rgba(255, 255, 255, 0.25)',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        color: 'var(--secondary-foreground, #8696a0)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                    }}
                                    title="Add file"
                                >
                                    <div style={{ fontSize: 24, fontWeight: 300, lineHeight: 1 }}>+</div>
                                </button>
                            </div>
                        )}

                        {/* Caption / Feedback notes input and Send button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                onClick={(e) => {
                                    const ta = e.currentTarget.querySelector('textarea');
                                    if (ta) ta.focus();
                                }}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    borderRadius: 16,
                                    padding: '8px 14px',
                                    border: '1px solid rgba(255, 255, 255, 0.14)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 48,
                                    cursor: 'text',
                                }}
                            >
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Add feedback or notes for coach..."
                                    rows={1}
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontSize: 16,
                                        resize: 'none',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        lineHeight: 1.4,
                                        maxHeight: '80px',
                                        WebkitUserSelect: 'text',
                                        userSelect: 'text',
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                title="Send feedback and media to coach"
                                className="chat-press"
                                style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--primary, #6366f1), #8b5cf6)',
                                    border: 'none',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: sending ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 0 16px rgba(99, 102, 241, 0.45)',
                                    flexShrink: 0,
                                    opacity: sending ? 0.6 : 1,
                                    transition: 'transform 0.15s ease',
                                }}
                            >
                                {sending ? (
                                    <div style={{ width: 18, height: 18, border: '2px solid rgba(255, 255, 255, 0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                ) : (
                                    <Send size={22} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Video Cropper modal (portal to body) */}
            {mounted && cropFile && (
                <VideoCropper
                    file={cropFile}
                    onCancel={() => setCropFile(null)}
                    onComplete={handleCropComplete}
                />
            )}
        </div>
    );
}

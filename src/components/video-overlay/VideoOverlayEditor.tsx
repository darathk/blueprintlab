'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Download, ImageIcon, Video, Loader2, CheckCircle2 } from 'lucide-react';
import OverlayCard, { drawCardToCanvas, type ClipSetData } from './OverlayCard';
import { useDragResize } from './useDragResize';

interface VideoOverlayEditorProps {
    isOpen: boolean;
    onClose: () => void;
    exerciseName: string;
    sessionLabel: string;
    sets: ClipSetData[];
}

type ExportState = 'idle' | 'recording' | 'done' | 'error';

// Pick the best mimeType this browser supports
function getSupportedMimeType(): string | null {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

function fileExtFromMime(mime: string): string {
    if (mime.startsWith('video/mp4')) return '.mp4';
    if (mime.startsWith('video/webm')) return '.webm';
    return '.mp4';
}

async function shareOrDownload(blob: Blob, filename: string) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
        const file = new File([blob], filename, { type: blob.type });
        try {
            await navigator.share({ files: [file] });
            return;
        } catch {
            // fall through to download
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function VideoOverlayEditor({
    isOpen, onClose, exerciseName, sessionLabel, sets,
}: VideoOverlayEditorProps) {
    const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [selectedSetIdx, setSelectedSetIdx] = useState(0);
    const [exportState, setExportState] = useState<ExportState>('idle');
    const [exportProgress, setExportProgress] = useState(0);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const {
        pos, size, setPos, setSize,
        containerRef, cardRef,
        onCardPointerDown, onResizePointerDown,
    } = useDragResize({ initialPos: { x: 16, y: 16 }, initialWidth: 260 });

    // Auto-select heaviest set
    useEffect(() => {
        if (!isOpen) return;
        let best = 0, bestIdx = 0;
        sets.forEach((s, i) => {
            const w = parseFloat(s.weight) || 0;
            if (w > best) { best = w; bestIdx = i; }
        });
        setSelectedSetIdx(bestIdx);
    }, [isOpen, sets]);

    // Pre-load logo for canvas drawing
    useEffect(() => {
        const img = new Image();
        img.src = '/logo.png';
        img.onload = () => setLogoImg(img);
    }, []);

    // Clean up blob URL on unmount / video change
    useEffect(() => {
        return () => {
            if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
        };
    }, [videoObjectUrl]);

    // Stop export RAF on unmount
    useEffect(() => {
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, []);

    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('video/') && !file.name.toLowerCase().match(/\.(mov|mp4|webm|avi|mkv)$/)) {
            alert('Please select a video file.');
            return;
        }
        if (file.size > 500 * 1024 * 1024) {
            alert('File must be under 500 MB.');
            return;
        }
        if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
        setVideoFile(file);
        setVideoObjectUrl(URL.createObjectURL(file));
        setExportState('idle');
        // Reset card to top-left after new video
        setPos({ x: 16, y: 16 });
        setSize({ width: 260 });
    }, [videoObjectUrl, setPos, setSize]);

    // ── File drag-drop on the video area ──────────────────────────────────
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
    const onDragLeave = () => setIsDraggingFile(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    // ── Image export ──────────────────────────────────────────────────────
    const exportImage = useCallback(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return;

        const vw = video.videoWidth || container.offsetWidth;
        const vh = video.videoHeight || container.offsetHeight;
        const previewW = container.offsetWidth;
        const previewH = container.offsetHeight;
        const scaleX = vw / previewW;
        const scaleY = vh / previewH;

        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, vw, vh);

        drawCardToCanvas({
            ctx,
            x: pos.x * scaleX,
            y: pos.y * scaleY,
            width: size.width * scaleX,
            exerciseName,
            sessionLabel,
            set: sets[selectedSetIdx] ?? sets[0],
            logoImage: logoImg,
        });

        canvas.toBlob(blob => {
            if (!blob) return;
            const name = `${exerciseName.replace(/\s+/g, '_')}_clip.png`;
            shareOrDownload(blob, name);
        }, 'image/png');
    }, [pos, size, exerciseName, sessionLabel, sets, selectedSetIdx, logoImg, containerRef]);

    // ── Video export ──────────────────────────────────────────────────────
    const exportVideo = useCallback(async () => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container || !videoObjectUrl) return;

        const mimeType = getSupportedMimeType();
        if (!mimeType) {
            alert('Your browser doesn\'t support video recording. Please use "Export Image" instead.');
            return;
        }

        const vw = video.videoWidth || container.offsetWidth;
        const vh = video.videoHeight || container.offsetHeight;
        const previewW = container.offsetWidth;
        const previewH = container.offsetHeight;
        const scaleX = vw / previewW;
        const scaleY = vh / previewH;

        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setExportState('recording');
        setExportProgress(0);

        const stream = canvas.captureStream(30);
        const chunks: Blob[] = [];
        let recorder: MediaRecorder;

        try {
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
        } catch {
            // Fallback: try without bitrate
            recorder = new MediaRecorder(stream, { mimeType });
        }

        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = async () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            const blob = new Blob(chunks, { type: mimeType });
            const ext = fileExtFromMime(mimeType);
            const name = `${exerciseName.replace(/\s+/g, '_')}_clip${ext}`;
            await shareOrDownload(blob, name);
            setExportState('done');
            setTimeout(() => setExportState('idle'), 3000);
        };

        const drawFrame = () => {
            if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, vw, vh);
                drawCardToCanvas({
                    ctx,
                    x: pos.x * scaleX,
                    y: pos.y * scaleY,
                    width: size.width * scaleX,
                    exerciseName,
                    sessionLabel,
                    set: sets[selectedSetIdx] ?? sets[0],
                    logoImage: logoImg,
                });
                const progress = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
                setExportProgress(Math.round(progress));
                rafRef.current = requestAnimationFrame(drawFrame);
            } else {
                setExportProgress(100);
                recorder.stop();
                video.pause();
            }
        };

        recorder.start(100); // collect data every 100ms
        video.currentTime = 0;
        video.muted = true;

        // Wait for seek before playing
        const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            video.play().then(() => {
                rafRef.current = requestAnimationFrame(drawFrame);
            }).catch(() => {
                recorder.stop();
                setExportState('error');
            });
        };
        video.addEventListener('seeked', onSeeked);

    }, [videoObjectUrl, pos, size, exerciseName, sessionLabel, sets, selectedSetIdx, logoImg, containerRef]);

    if (!isOpen) return null;

    const currentSet = sets[selectedSetIdx] ?? sets[0];
    const activeSets = sets.filter(s => s.weight && s.reps);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.97)',
            backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
            overflowY: 'auto',
        }}>
            {/* ── Header ───────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(99,102,241,0.2))',
                        border: '1px solid rgba(6,182,212,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                    }}>🎬</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Create Clip</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{exerciseName}</div>
                    </div>
                </div>
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                    <X size={18} />
                </button>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', flex: 1, gap: 0,
                flexDirection: 'row',
                minHeight: 0,
            }}>
                {/* ── Video / canvas area ───────────────────────────── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div
                        ref={containerRef}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        style={{
                            position: 'relative',
                            flex: 1,
                            background: '#000',
                            overflow: 'hidden',
                            minHeight: 200,
                            maxHeight: 'calc(100vh - 130px)',
                        }}
                    >
                        {videoObjectUrl ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={videoObjectUrl}
                                    controls
                                    playsInline
                                    loop
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                />

                                {/* Overlay card */}
                                <OverlayCard
                                    exerciseName={exerciseName}
                                    sessionLabel={sessionLabel}
                                    set={currentSet}
                                    width={size.width}
                                    cardRef={cardRef}
                                    onPointerDown={onCardPointerDown}
                                    style={{ left: pos.x, top: pos.y }}
                                    resizeHandle={
                                        <div
                                            data-resize="true"
                                            onPointerDown={onResizePointerDown}
                                            style={{
                                                position: 'absolute',
                                                bottom: 6, right: 6,
                                                width: 18, height: 18,
                                                cursor: 'nwse-resize',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 10L10 10L10 2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                                                <path d="M5 10L10 10L10 5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                                                <path d="M8 10L10 10L10 8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                    }
                                />

                                {/* File drag overlay hint */}
                                {isDraggingFile && (
                                    <div style={{
                                        position: 'absolute', inset: 0, background: 'rgba(6,182,212,0.15)',
                                        border: '2px dashed rgba(6,182,212,0.6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 16, color: 'rgba(6,182,212,0.9)', fontWeight: 600,
                                        pointerEvents: 'none',
                                    }}>
                                        Drop to replace video
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Drop zone */
                            <label
                                htmlFor="clip-video-input"
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: 12, cursor: 'pointer',
                                    border: isDraggingFile ? '2px dashed rgba(6,182,212,0.7)' : '2px dashed rgba(255,255,255,0.12)',
                                    borderRadius: 4,
                                    transition: 'border-color 0.2s',
                                    background: isDraggingFile ? 'rgba(6,182,212,0.06)' : 'transparent',
                                }}
                            >
                                <div style={{
                                    width: 64, height: 64, borderRadius: 16,
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Video size={28} color="rgba(255,255,255,0.3)" />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                                        Tap to select your lift video
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                                        MOV, MP4, WebM · up to 500 MB
                                    </div>
                                </div>
                            </label>
                        )}
                    </div>

                    <input
                        id="clip-video-input"
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,.mov"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                        style={{ display: 'none' }}
                    />
                </div>

                {/* ── Controls sidebar ─────────────────────────────── */}
                <div style={{
                    width: 220,
                    flexShrink: 0,
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', flexDirection: 'column',
                    overflowY: 'auto',
                }}>
                    {/* Set picker */}
                    <div style={{ padding: '16px 16px 0' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Select Set
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {sets.map((s, i) => {
                                if (!s.weight && !s.reps) return null;
                                const sel = selectedSetIdx === i;
                                return (
                                    <button key={i} onClick={() => setSelectedSetIdx(i)} style={{
                                        padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                                        background: sel ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)',
                                        border: sel ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.07)',
                                        color: sel ? 'rgba(6,182,212,0.95)' : 'rgba(255,255,255,0.6)',
                                        fontSize: 12, fontWeight: sel ? 700 : 500,
                                        transition: 'all 0.15s',
                                    }}>
                                        S{i + 1}: {s.weight}{s.weight ? 'lbs' : ''} × {s.reps}{s.rpe ? ` @${s.rpe}` : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card size slider */}
                    <div style={{ padding: '16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Card Size
                        </div>
                        <input
                            type="range" min={160} max={440} value={size.width}
                            onChange={e => setSize({ width: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: 'rgb(6,182,212)' }}
                        />
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 2 }}>
                            {size.width}px
                        </div>
                    </div>

                    {/* Replace video */}
                    <div style={{ padding: '0 16px 16px' }}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                        >
                            <Video size={13} /> {videoObjectUrl ? 'Replace Video' : 'Select Video'}
                        </button>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 16px' }} />

                    {/* Export buttons */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>

                        {/* Export progress bar */}
                        {exportState === 'recording' && (
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Recording…</span>
                                    <span style={{ fontSize: 11, color: 'rgba(6,182,212,0.8)', fontWeight: 700 }}>{exportProgress}%</span>
                                </div>
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 2,
                                        background: 'linear-gradient(90deg, #06B6D4, #6366F1)',
                                        width: `${exportProgress}%`, transition: 'width 300ms',
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* Image export */}
                        <button
                            onClick={exportImage}
                            disabled={!videoObjectUrl || exportState === 'recording'}
                            style={{
                                width: '100%', padding: '11px 12px', borderRadius: 10, cursor: videoObjectUrl ? 'pointer' : 'not-allowed',
                                background: videoObjectUrl ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: videoObjectUrl ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                                fontSize: 13, fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                transition: 'all 0.15s',
                            }}
                        >
                            <ImageIcon size={15} /> Export Frame
                        </button>

                        {/* Video export */}
                        <button
                            onClick={exportVideo}
                            disabled={!videoObjectUrl || exportState === 'recording'}
                            style={{
                                width: '100%', padding: '11px 12px', borderRadius: 10,
                                cursor: videoObjectUrl && exportState !== 'recording' ? 'pointer' : 'not-allowed',
                                background: exportState === 'done'
                                    ? 'rgba(34,197,94,0.12)'
                                    : videoObjectUrl
                                        ? 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(99,102,241,0.18))'
                                        : 'rgba(255,255,255,0.03)',
                                border: exportState === 'done'
                                    ? '1px solid rgba(34,197,94,0.4)'
                                    : videoObjectUrl
                                        ? '1px solid rgba(6,182,212,0.35)'
                                        : '1px solid rgba(255,255,255,0.07)',
                                color: exportState === 'done'
                                    ? 'rgba(34,197,94,0.9)'
                                    : videoObjectUrl
                                        ? 'rgba(6,182,212,0.95)'
                                        : 'rgba(255,255,255,0.25)',
                                fontSize: 13, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                transition: 'all 0.2s',
                            }}
                        >
                            {exportState === 'recording' && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                            {exportState === 'done' && <CheckCircle2 size={15} />}
                            {exportState === 'idle' || exportState === 'error' ? <Download size={15} /> : null}
                            {exportState === 'recording' ? `Recording ${exportProgress}%` : exportState === 'done' ? 'Saved!' : 'Save Clip'}
                        </button>

                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
                            Video plays through once while recording. Keep this screen open.
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

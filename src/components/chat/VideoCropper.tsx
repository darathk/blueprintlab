import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Play, Pause, Scissors } from 'lucide-react';

interface Props {
    file: File;
    onCancel: () => void;
    onComplete: (croppedFile: File) => void;
}

export default function VideoCropper({ file, onCancel, onComplete }: Props) {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
    const [fileSize, setFileSize] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const filmstripRef = useRef<HTMLDivElement>(null);
    const thumbVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setFileSize(`${sizeMB} MB`);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Generate filmstrip thumbnails
    const generateThumbnails = useCallback(async () => {
        if (!videoUrl || duration <= 0) return;

        const thumbCount = 15;
        const thumbVideo = document.createElement('video');
        thumbVideo.src = videoUrl;
        thumbVideo.muted = true;
        thumbVideo.playsInline = true;
        thumbVideoRef.current = thumbVideo;

        await new Promise<void>((resolve) => {
            thumbVideo.onloadeddata = () => resolve();
            thumbVideo.load();
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 60;
        canvas.height = 80;

        const thumbs: string[] = [];

        for (let i = 0; i < thumbCount; i++) {
            const time = (i / thumbCount) * duration;
            thumbVideo.currentTime = time;
            await new Promise<void>((resolve) => {
                thumbVideo.onseeked = () => {
                    ctx.drawImage(thumbVideo, 0, 0, canvas.width, canvas.height);
                    thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
                    resolve();
                };
            });
        }

        setThumbnails(thumbs);
        thumbVideo.remove();
    }, [videoUrl, duration]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const d = videoRef.current.duration;
            setDuration(d);
            setEndTime(d);
        }
    };

    useEffect(() => {
        if (duration > 0) generateThumbnails();
    }, [duration, generateThumbnails]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const ct = videoRef.current.currentTime;
            setCurrentTime(ct);
            if (ct >= endTime) {
                videoRef.current.currentTime = startTime;
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            if (videoRef.current.currentTime < startTime || videoRef.current.currentTime >= endTime) {
                videoRef.current.currentTime = startTime;
            }
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    const formatTime = (t: number) => {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const trimDuration = endTime - startTime;

    // Drag handling for trim handles
    const getTimeFromX = useCallback((clientX: number) => {
        if (!filmstripRef.current) return 0;
        const rect = filmstripRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * duration;
    }, [duration]);

    const handlePointerDown = (type: 'start' | 'end') => (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(type);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging) return;
        const time = getTimeFromX(e.clientX);
        if (dragging === 'start') {
            setStartTime(Math.max(0, Math.min(time, endTime - 0.5)));
        } else if (dragging === 'end') {
            setEndTime(Math.max(startTime + 0.5, Math.min(time, duration)));
        }
    }, [dragging, startTime, endTime, duration, getTimeFromX]);

    const handlePointerUp = useCallback(() => {
        setDragging(null);
    }, []);

    // Tap on filmstrip to seek
    const handleFilmstripTap = (e: React.MouseEvent) => {
        if (dragging) return;
        const time = getTimeFromX(e.clientX);
        if (time >= startTime && time <= endTime && videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const processVideo = async () => {
        if (!videoRef.current) return;
        setProcessing(true);
        setProgress(0);

        const noTrimmingApplied = Math.abs(startTime) < 0.1 && Math.abs(endTime - duration) < 0.1;

        if (noTrimmingApplied) {
            onComplete(file);
            setProcessing(false);
            return;
        }

        try {
            const video = videoRef.current;
            const originalWidth = video.videoWidth;
            const originalHeight = video.videoHeight;

            const canvas = document.createElement('canvas');
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2d context unavailable');

            if (typeof (canvas as any).captureStream !== 'function') {
                throw new Error('captureStream not supported');
            }

            const stream = (canvas as any).captureStream(30) as MediaStream;

            // Try to add audio track
            try {
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                source.connect(audioCtx.destination);
                dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
            } catch {
                // No audio - that's fine
            }

            const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
                ? 'video/mp4;codecs=avc1'
                : MediaRecorder.isTypeSupported('video/mp4')
                    ? 'video/mp4'
                    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                        ? 'video/webm;codecs=vp9'
                        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                            ? 'video/webm;codecs=vp8'
                            : MediaRecorder.isTypeSupported('video/webm')
                                ? 'video/webm'
                                : '';

            if (!mimeType) throw new Error('No supported recording format');

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

            const finished = new Promise<File>((resolve, reject) => {
                recorder.onstop = () => {
                    try {
                        const finalMime = mimeType.split(';')[0];
                        const blob = new Blob(chunks, { type: finalMime });
                        if (blob.size < 1000) {
                            reject(new Error('Empty recording'));
                            return;
                        }
                        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                        const outFile = new File([blob], `trimmed_${file.name.split('.')[0]}.${ext}`, { type: finalMime });
                        resolve(outFile);
                    } catch (e) {
                        reject(e);
                    }
                };
                recorder.onerror = reject;
            });

            video.pause();
            video.muted = true;
            video.currentTime = startTime;
            await new Promise<void>((r) => { video.onseeked = () => r(); });

            recorder.start(100);
            await video.play();

            const totalTime = endTime - startTime;
            await new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    const elapsed = video.currentTime - startTime;
                    setProgress(Math.min((elapsed / totalTime) * 100, 99));

                    ctx.drawImage(video, 0, 0, originalWidth, originalHeight);

                    if (video.currentTime >= endTime || video.ended || video.paused) {
                        clearInterval(interval);
                        video.pause();
                        recorder.stop();
                        resolve();
                    }
                }, 1000 / 30);

                setTimeout(() => {
                    clearInterval(interval);
                    if (video) video.pause();
                    if (recorder.state !== 'inactive') recorder.stop();
                    resolve();
                }, (totalTime + 5) * 1000);
            });

            const outFile = await finished;
            setProgress(100);
            onComplete(outFile);
        } catch (err) {
            console.warn('Video processing failed, using original file:', err);
            onComplete(file);
        } finally {
            setProcessing(false);
        }
    };

    if (!videoUrl) return null;

    const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPct = duration > 0 ? (endTime / duration) * 100 : 100;
    const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const noTrimApplied = Math.abs(startTime) < 0.1 && Math.abs(endTime - duration) < 0.1;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#0b141a',
            display: 'flex', flexDirection: 'column',
            color: '#fff', touchAction: 'none'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#1f2c34'
            }}>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 8 }}>
                    <X size={24} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scissors size={18} color="#00a884" />
                    <span style={{ fontWeight: 600, fontSize: 16 }}>Trim Video</span>
                </div>
                <button
                    onClick={processVideo}
                    disabled={processing}
                    style={{
                        background: '#00a884',
                        border: 'none',
                        borderRadius: 20,
                        color: '#fff',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: processing ? 0.6 : 1
                    }}
                >
                    {processing ? `${progress.toFixed(0)}%` : <><Check size={18} /> Done</>}
                </button>
            </div>

            {/* Filmstrip Timeline */}
            <div style={{ padding: '12px 16px 8px', background: '#1f2c34' }}>
                <div
                    ref={filmstripRef}
                    onClick={handleFilmstripTap}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                        position: 'relative',
                        height: 56,
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        touchAction: 'none'
                    }}
                >
                    {/* Thumbnail images */}
                    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                        {thumbnails.length > 0 ? thumbnails.map((thumb, i) => (
                            <img
                                key={i}
                                src={thumb}
                                alt=""
                                draggable={false}
                                style={{
                                    flex: 1,
                                    height: '100%',
                                    objectFit: 'cover',
                                    pointerEvents: 'none',
                                    userSelect: 'none'
                                }}
                            />
                        )) : (
                            <div style={{
                                width: '100%', height: '100%',
                                background: 'linear-gradient(90deg, #2a3942 0%, #1f2c34 50%, #2a3942 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, color: 'rgba(255,255,255,0.3)'
                            }}>
                                Loading thumbnails...
                            </div>
                        )}
                    </div>

                    {/* Dimmed areas outside trim range */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0,
                        width: `${startPct}%`, height: '100%',
                        background: 'rgba(0,0,0,0.7)',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: `${100 - endPct}%`, height: '100%',
                        background: 'rgba(0,0,0,0.7)',
                        pointerEvents: 'none'
                    }} />

                    {/* Selected range border */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: `${startPct}%`,
                        width: `${endPct - startPct}%`,
                        height: '100%',
                        borderTop: '3px solid #00a884',
                        borderBottom: '3px solid #00a884',
                        boxSizing: 'border-box',
                        pointerEvents: 'none'
                    }} />

                    {/* Left handle */}
                    <div
                        onPointerDown={handlePointerDown('start')}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${startPct}%`,
                            transform: 'translateX(-100%)',
                            width: 20,
                            height: '100%',
                            background: '#00a884',
                            borderRadius: '6px 0 0 6px',
                            cursor: 'ew-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'none',
                            zIndex: 10
                        }}
                    >
                        <div style={{ width: 3, height: 20, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
                    </div>

                    {/* Right handle */}
                    <div
                        onPointerDown={handlePointerDown('end')}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${endPct}%`,
                            width: 20,
                            height: '100%',
                            background: '#00a884',
                            borderRadius: '0 6px 6px 0',
                            cursor: 'ew-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'none',
                            zIndex: 10
                        }}
                    >
                        <div style={{ width: 3, height: 20, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
                    </div>

                    {/* Playhead indicator */}
                    {currentPct >= startPct && currentPct <= endPct && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: `${currentPct}%`,
                            width: 2,
                            height: '100%',
                            background: '#fff',
                            pointerEvents: 'none',
                            zIndex: 5,
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                        }} />
                    )}
                </div>

                {/* Time labels */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, padding: '0 4px'
                }}>
                    <span style={{ fontSize: 12, color: '#00a884', fontWeight: 600 }}>
                        {formatTime(startTime)}
                    </span>
                    <span style={{
                        fontSize: 12,
                        color: noTrimApplied ? 'rgba(255,255,255,0.5)' : '#00a884',
                        fontWeight: 600,
                        background: noTrimApplied ? 'transparent' : 'rgba(0,168,132,0.15)',
                        padding: '2px 8px',
                        borderRadius: 10
                    }}>
                        {formatTime(trimDuration)} / {formatTime(duration)}
                    </span>
                    <span style={{ fontSize: 12, color: '#00a884', fontWeight: 600 }}>
                        {formatTime(endTime)}
                    </span>
                </div>
            </div>

            {/* Video Preview */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', padding: 16
            }}>
                <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            display: 'block',
                            borderRadius: 12,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                        playsInline
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onClick={togglePlay}
                    />

                    {/* Play/Pause overlay */}
                    {!isPlaying && (
                        <div
                            onClick={togglePlay}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                borderRadius: 12
                            }}
                        >
                            <div style={{
                                width: 64, height: 64,
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom info */}
            <div style={{
                padding: '12px 20px',
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                background: '#1f2c34',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16
            }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                    {fileSize}
                </span>
                {!noTrimApplied && (
                    <span style={{
                        fontSize: 12, color: '#00a884', fontWeight: 600,
                        background: 'rgba(0,168,132,0.15)',
                        padding: '4px 12px',
                        borderRadius: 12
                    }}>
                        Trimmed to {formatTime(trimDuration)}
                    </span>
                )}
            </div>

            {/* Processing overlay */}
            {processing && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 100
                }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
                        Processing video...
                    </div>
                    <div style={{
                        width: 200, height: 4, borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%', borderRadius: 2,
                            background: '#00a884',
                            transition: 'width 200ms',
                            width: `${progress}%`
                        }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                        {progress.toFixed(0)}%
                    </div>
                </div>
            )}
        </div>
    );
}

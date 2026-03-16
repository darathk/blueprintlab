import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Play, Scissors } from 'lucide-react';

interface Props {
    file: File;
    onCancel: () => void;
    onComplete: (file: File, trimStart?: number, trimEnd?: number) => void;
}

export default function VideoCropper({ file, onCancel, onComplete }: Props) {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [fileSize, setFileSize] = useState('');

    // Drag state stored in refs for window-level listeners
    const draggingRef = useRef<'start' | 'end' | null>(null);
    const startTimeRef = useRef(0);
    const endTimeRef = useRef(0);
    const durationRef = useRef(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const filmstripRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setFileSize(`${sizeMB} MB`);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Generate filmstrip thumbnails (optimized: fewer thumbs, smaller canvas)
    const generateThumbnails = useCallback(async () => {
        if (!videoUrl || duration <= 0) return;

        const thumbCount = 8;
        const thumbVideo = document.createElement('video');
        thumbVideo.src = videoUrl;
        thumbVideo.muted = true;
        thumbVideo.playsInline = true;
        thumbVideo.crossOrigin = 'anonymous';

        await new Promise<void>((resolve) => {
            thumbVideo.onloadeddata = () => resolve();
            thumbVideo.load();
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 40;
        canvas.height = 53;

        const thumbs: string[] = [];

        for (let i = 0; i < thumbCount; i++) {
            const time = (i / thumbCount) * duration;
            thumbVideo.currentTime = time;
            await new Promise<void>((resolve) => {
                thumbVideo.onseeked = () => {
                    ctx.drawImage(thumbVideo, 0, 0, canvas.width, canvas.height);
                    thumbs.push(canvas.toDataURL('image/jpeg', 0.3));
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
            durationRef.current = d;
            endTimeRef.current = d;
        }
    };

    useEffect(() => {
        if (duration > 0) generateThumbnails();
    }, [duration, generateThumbnails]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const ct = videoRef.current.currentTime;
            setCurrentTime(ct);
            // Loop back to start of trim range when reaching the end
            if (ct >= endTimeRef.current) {
                videoRef.current.currentTime = startTimeRef.current;
                // Keep playing — continuous loop
            }
        }
    };

    // Auto-play video on load, looping within trim range
    const handleVideoReady = () => {
        if (videoRef.current && !isPlaying) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            if (videoRef.current.currentTime < startTimeRef.current || videoRef.current.currentTime >= endTimeRef.current) {
                videoRef.current.currentTime = startTimeRef.current;
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

    // Convert clientX to time using the filmstrip rect
    const getTimeFromX = useCallback((clientX: number) => {
        if (!filmstripRef.current) return 0;
        const rect = filmstripRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * durationRef.current;
    }, []);

    // Window-level pointer move/up for smooth dragging beyond the filmstrip
    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            const time = getTimeFromX(e.clientX);
            if (draggingRef.current === 'start') {
                const newStart = Math.max(0, Math.min(time, endTimeRef.current - 0.5));
                startTimeRef.current = newStart;
                setStartTime(newStart);
                // Seek video to new start so preview matches the trim
                if (videoRef.current) {
                    videoRef.current.currentTime = newStart;
                }
            } else if (draggingRef.current === 'end') {
                const newEnd = Math.max(startTimeRef.current + 0.5, Math.min(time, durationRef.current));
                endTimeRef.current = newEnd;
                setEndTime(newEnd);
                // Seek near the end so user can see where they're trimming to
                if (videoRef.current && videoRef.current.currentTime > newEnd) {
                    videoRef.current.currentTime = Math.max(startTimeRef.current, newEnd - 0.5);
                }
            }
        };

        const handleUp = () => {
            if (draggingRef.current && videoRef.current) {
                // Resume playing from start of trim range after drag ends
                videoRef.current.currentTime = startTimeRef.current;
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
            draggingRef.current = null;
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
        };
    }, [getTimeFromX]);

    const handlePointerDown = (type: 'start' | 'end') => (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = type;
    };

    // Tap on filmstrip to seek
    const handleFilmstripTap = (e: React.MouseEvent) => {
        if (draggingRef.current) return;
        const time = getTimeFromX(e.clientX);
        if (time >= startTime && time <= endTime && videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const processVideo = async () => {
        if (!videoRef.current) return;

        const noTrimmingApplied = Math.abs(startTime) < 0.1 && Math.abs(endTime - duration) < 0.1;

        if (noTrimmingApplied) {
            // No trim — pass file through with no trim metadata
            onComplete(file);
        } else {
            // Pass original file + trim bounds — no re-encoding needed.
            // The player will use Media Fragment URI (#t=start,end) for playback trimming.
            onComplete(file, Math.round(startTime * 100) / 100, Math.round(endTime * 100) / 100);
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
                        gap: 6
                    }}
                >
                    <Check size={18} /> Done
                </button>
            </div>

            {/* Filmstrip Timeline */}
            <div style={{ padding: '12px 44px 8px', background: '#1f2c34' }}>
                <div
                    ref={filmstripRef}
                    onClick={handleFilmstripTap}
                    style={{
                        position: 'relative',
                        height: 56,
                        borderRadius: 8,
                        overflow: 'visible',
                        cursor: 'pointer',
                        touchAction: 'none'
                    }}
                >
                    {/* Thumbnail images */}
                    <div style={{ display: 'flex', height: '100%', width: '100%', borderRadius: 8, overflow: 'hidden' }}>
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
                        borderRadius: '8px 0 0 8px',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: `${100 - endPct}%`, height: '100%',
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '0 8px 8px 0',
                        pointerEvents: 'none'
                    }} />

                    {/* Selected range top/bottom border */}
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

                    {/* Left handle — drag from left */}
                    <div
                        onPointerDown={handlePointerDown('start')}
                        style={{
                            position: 'absolute',
                            top: -4,
                            bottom: -4,
                            left: `${startPct}%`,
                            transform: 'translateX(-100%)',
                            width: 22,
                            background: '#00a884',
                            borderRadius: '8px 0 0 8px',
                            cursor: 'ew-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'none',
                            zIndex: 10
                        }}
                    >
                        <div style={{
                            width: 3, height: 24, background: 'rgba(255,255,255,0.9)', borderRadius: 2
                        }} />
                    </div>

                    {/* Right handle — drag from right */}
                    <div
                        onPointerDown={handlePointerDown('end')}
                        style={{
                            position: 'absolute',
                            top: -4,
                            bottom: -4,
                            left: `${endPct}%`,
                            width: 22,
                            background: '#00a884',
                            borderRadius: '0 8px 8px 0',
                            cursor: 'ew-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            touchAction: 'none',
                            zIndex: 10
                        }}
                    >
                        <div style={{
                            width: 3, height: 24, background: 'rgba(255,255,255,0.9)', borderRadius: 2
                        }} />
                    </div>

                    {/* Playhead indicator */}
                    {currentPct >= startPct && currentPct <= endPct && (
                        <div style={{
                            position: 'absolute',
                            top: -2,
                            bottom: -2,
                            left: `${currentPct}%`,
                            width: 2,
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
                        autoPlay
                        onLoadedMetadata={handleLoadedMetadata}
                        onCanPlay={handleVideoReady}
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

        </div>
    );
}

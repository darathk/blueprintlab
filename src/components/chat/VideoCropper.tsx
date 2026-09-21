"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Play, Scissors, Clock, Film } from 'lucide-react';

interface Props {
    file: File;
    onCancel: () => void;
    onComplete: (file: File, trimStart?: number, trimEnd?: number) => void;
}

type CropperStatus = 'loading' | 'thumbnailing' | 'ready' | 'error';

export default function VideoCropper({ file, onCancel, onComplete }: Props) {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [fileSize, setFileSize] = useState('');
    const [status, setStatus] = useState<CropperStatus>('loading');
    const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);

    // Drag state stored in refs for window-level 60fps listeners
    const draggingRef = useRef<'start' | 'end' | null>(null);
    const startTimeRef = useRef(0);
    const endTimeRef = useRef(0);
    const durationRef = useRef(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const filmstripRef = useRef<HTMLDivElement>(null);
    const isGeneratingThumbsRef = useRef(false);

    // Format file size & create safe blob URL
    useEffect(() => {
        let active = true;
        const url = URL.createObjectURL(file);
        setVideoUrl(url);

        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setFileSize(`${sizeMB} MB`);

        return () => {
            active = false;
            URL.revokeObjectURL(url);
        };
    }, [file]);

    // Format seconds into m:ss or m:ss.s
    const formatTime = (t: number) => {
        if (!isFinite(t) || t < 0) return '0:00';
        const mins = Math.floor(t / 60);
        const secs = (t % 60).toFixed(1);
        const [wholeSecs, frac] = secs.split('.');
        return `${mins}:${wholeSecs.padStart(2, '0')}.${frac || '0'}`;
    };

    const formatTimeShort = (t: number) => {
        if (!isFinite(t) || t < 0) return '0:00';
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Fast, resilient filmstrip thumbnail generation
    const generateThumbnails = useCallback(async (videoDuration: number, mediaUrl: string) => {
        if (!mediaUrl || videoDuration <= 0 || isGeneratingThumbsRef.current) return;
        isGeneratingThumbsRef.current = true;
        setStatus('thumbnailing');

        const thumbCount = 8;
        const thumbVideo = document.createElement('video');
        thumbVideo.src = mediaUrl;
        thumbVideo.muted = true;
        thumbVideo.playsInline = true;
        thumbVideo.preload = 'auto';

        // Wait for video load with safety timeout
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => resolve(), 1200);
            thumbVideo.onloadeddata = () => {
                clearTimeout(timer);
                resolve();
            };
            thumbVideo.load();
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            isGeneratingThumbsRef.current = false;
            setStatus('ready');
            return;
        }

        canvas.width = 48;
        canvas.height = 64;
        const thumbs: string[] = [];

        for (let i = 0; i < thumbCount; i++) {
            const targetTime = (i / (thumbCount - 1 || 1)) * Math.max(0.1, videoDuration - 0.05);
            thumbVideo.currentTime = targetTime;

            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    // Fallback if seek takes too long on slower decoders
                    try {
                        ctx.drawImage(thumbVideo, 0, 0, canvas.width, canvas.height);
                        thumbs.push(canvas.toDataURL('image/jpeg', 0.45));
                    } catch {}
                    resolve();
                }, 300);

                thumbVideo.onseeked = () => {
                    clearTimeout(timeout);
                    try {
                        ctx.drawImage(thumbVideo, 0, 0, canvas.width, canvas.height);
                        thumbs.push(canvas.toDataURL('image/jpeg', 0.45));
                    } catch {}
                    resolve();
                };
            });
        }

        if (thumbs.length > 0) {
            setThumbnails(thumbs);
        }

        // Cleanup hardware decoder instance
        thumbVideo.pause();
        thumbVideo.src = '';
        thumbVideo.load();
        thumbVideo.remove();

        isGeneratingThumbsRef.current = false;
        setStatus('ready');
    }, []);

    // Loaded metadata handler
    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        const d = videoRef.current.duration;
        if (!isFinite(d) || d <= 0) return;

        setDuration(d);
        setEndTime(d);
        durationRef.current = d;
        endTimeRef.current = d;

        // Kick off thumbnail generation safely
        generateThumbnails(d, videoUrl);
    };

    // Continuous video loop inside trim range
    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const ct = videoRef.current.currentTime;
        setCurrentTime(ct);

        // Loop seamlessly within [startTime, endTime]
        if (ct >= endTimeRef.current) {
            videoRef.current.currentTime = startTimeRef.current;
        } else if (ct < startTimeRef.current - 0.2) {
            videoRef.current.currentTime = startTimeRef.current;
        }
    };

    // Auto-start playback on canplay (muted to guarantee zero browser autoplay blocks)
    const handleCanPlay = () => {
        if (videoRef.current && !isPlaying && !draggingRef.current) {
            videoRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => {
                    // Browser policy blocked playback, leave paused cleanly
                    setIsPlaying(false);
                });
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
            videoRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        }
    };

    // Convert clientX to timeline seconds
    const getTimeFromX = useCallback((clientX: number) => {
        if (!filmstripRef.current || durationRef.current <= 0) return 0;
        const rect = filmstripRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * durationRef.current;
    }, []);

    // Window-level smooth pointer tracking for handles
    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            if (!draggingRef.current || durationRef.current <= 0) return;
            e.preventDefault();
            const time = getTimeFromX(e.clientX);

            if (draggingRef.current === 'start') {
                const newStart = Math.max(0, Math.min(time, endTimeRef.current - 0.5));
                startTimeRef.current = newStart;
                setStartTime(newStart);
                if (videoRef.current) {
                    videoRef.current.currentTime = newStart;
                }
            } else if (draggingRef.current === 'end') {
                const newEnd = Math.max(startTimeRef.current + 0.5, Math.min(time, durationRef.current));
                endTimeRef.current = newEnd;
                setEndTime(newEnd);
                if (videoRef.current && videoRef.current.currentTime > newEnd) {
                    videoRef.current.currentTime = Math.max(startTimeRef.current, newEnd - 0.3);
                }
            }
        };

        const handleUp = () => {
            if (draggingRef.current) {
                draggingRef.current = null;
                setActiveDrag(null);
                // Resume loop from start of trim range
                if (videoRef.current) {
                    videoRef.current.currentTime = startTimeRef.current;
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
            }
        };

        window.addEventListener('pointermove', handleMove, { passive: false });
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
        setActiveDrag(type);
        if (videoRef.current && isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    // Tap on filmstrip to scrub within trim range
    const handleFilmstripTap = (e: React.MouseEvent) => {
        if (draggingRef.current || duration <= 0) return;
        const time = getTimeFromX(e.clientX);
        if (time >= startTime && time <= endTime && videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    // Complete processing
    const processVideo = () => {
        if (!videoRef.current) return;
        const noTrimmingApplied = Math.abs(startTime) < 0.1 && Math.abs(endTime - duration) < 0.1;

        if (noTrimmingApplied) {
            onComplete(file);
        } else {
            // Passes file + precise trim bounds for Media Fragment playback
            onComplete(file, Math.round(startTime * 100) / 100, Math.round(endTime * 100) / 100);
        }
    };

    const trimDuration = Math.max(0, endTime - startTime);
    const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPct = duration > 0 ? (endTime / duration) * 100 : 100;
    const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const isTrimmed = Math.abs(startTime) > 0.1 || Math.abs(endTime - duration) > 0.1;

    if (!videoUrl) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'radial-gradient(ellipse at 50% 15%, rgba(20, 24, 40, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            display: 'flex',
            flexDirection: 'column',
            color: '#fff',
            touchAction: 'none',
            userSelect: 'none',
            animation: 'fadeIn 0.2s ease',
        }}>
            {/* Header with Glass Surface */}
            <div style={{
                padding: '14px 20px',
                paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(12, 15, 24, 0.85)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
                zIndex: 10,
            }}>
                <button
                    onClick={onCancel}
                    className="chat-press"
                    style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.16s ease',
                    }}
                    title="Cancel"
                >
                    <X size={19} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(129, 140, 248, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 12px rgba(99, 102, 241, 0.3)',
                    }}>
                        <Scissors size={16} color="var(--primary, #818cf8)" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                            Trim Video
                        </div>
                    </div>
                </div>

                <button
                    onClick={processVideo}
                    className="chat-press"
                    style={{
                        background: 'linear-gradient(135deg, var(--primary, #6366f1) 0%, #8b5cf6 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        borderRadius: 22,
                        color: '#fff',
                        cursor: 'pointer',
                        padding: '8px 20px',
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.45)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                >
                    <Check size={17} strokeWidth={2.6} /> Done
                </button>
            </div>

            {/* Filmstrip & Trim Controls Section */}
            <div style={{
                padding: '16px 20px 14px',
                background: 'rgba(10, 12, 20, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                zIndex: 5,
            }}>
                <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
                    {/* Outer timeline container with padding for handles */}
                    <div style={{ padding: '0 14px' }}>
                        <div
                            ref={filmstripRef}
                            onClick={handleFilmstripTap}
                            style={{
                                position: 'relative',
                                height: 60,
                                borderRadius: 12,
                                overflow: 'visible',
                                cursor: 'pointer',
                                touchAction: 'none',
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            {/* Thumbnails strip or animated skeleton */}
                            <div style={{ display: 'flex', height: '100%', width: '100%', borderRadius: 10, overflow: 'hidden' }}>
                                {thumbnails.length > 0 ? (
                                    thumbnails.map((thumb, i) => (
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
                                                userSelect: 'none',
                                            }}
                                        />
                                    ))
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(99,102,241,0.09) 50%, rgba(255,255,255,0.03) 100%)',
                                        backgroundSize: '200% 100%',
                                        animation: 'pulse 1.5s infinite ease-in-out',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        fontSize: 12,
                                        color: 'rgba(255,255,255,0.4)',
                                        fontWeight: 500,
                                    }}>
                                        <Film size={15} color="var(--primary, #818cf8)" />
                                        <span>Analyzing clip frames…</span>
                                    </div>
                                )}
                            </div>

                            {/* Dimmed shaded areas outside active trim */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: `${startPct}%`,
                                height: '100%',
                                background: 'rgba(5, 7, 12, 0.78)',
                                backdropFilter: 'blur(2px)',
                                borderRadius: '10px 0 0 10px',
                                pointerEvents: 'none',
                            }} />
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: `${100 - endPct}%`,
                                height: '100%',
                                background: 'rgba(5, 7, 12, 0.78)',
                                backdropFilter: 'blur(2px)',
                                borderRadius: '0 10px 10px 0',
                                pointerEvents: 'none',
                            }} />

                            {/* Active range top & bottom neon borders */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: `${startPct}%`,
                                width: `${endPct - startPct}%`,
                                height: '100%',
                                borderTop: '3px solid var(--primary, #818cf8)',
                                borderBottom: '3px solid var(--primary, #818cf8)',
                                boxSizing: 'border-box',
                                pointerEvents: 'none',
                                boxShadow: 'inset 0 0 16px rgba(99, 102, 241, 0.15)',
                            }} />

                            {/* Left Handle — Start Trim */}
                            <div
                                onPointerDown={handlePointerDown('start')}
                                style={{
                                    position: 'absolute',
                                    top: -3,
                                    bottom: -3,
                                    left: `${startPct}%`,
                                    transform: 'translateX(-100%)',
                                    width: 24,
                                    background: 'linear-gradient(180deg, var(--primary, #6366f1) 0%, #4f46e5 100%)',
                                    borderRadius: '10px 0 0 10px',
                                    cursor: 'ew-resize',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    touchAction: 'none',
                                    zIndex: 12,
                                    boxShadow: activeDrag === 'start'
                                        ? '0 0 20px rgba(129, 140, 248, 0.8), -2px 0 8px rgba(0,0,0,0.5)'
                                        : '0 0 12px rgba(99, 102, 241, 0.45)',
                                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                                    filter: activeDrag === 'start' ? 'brightness(1.15)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', gap: 2 }}>
                                    <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.95)', borderRadius: 1 }} />
                                    <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.65)', borderRadius: 1 }} />
                                </div>
                            </div>

                            {/* Right Handle — End Trim */}
                            <div
                                onPointerDown={handlePointerDown('end')}
                                style={{
                                    position: 'absolute',
                                    top: -3,
                                    bottom: -3,
                                    left: `${endPct}%`,
                                    width: 24,
                                    background: 'linear-gradient(180deg, var(--primary, #6366f1) 0%, #4f46e5 100%)',
                                    borderRadius: '0 10px 10px 0',
                                    cursor: 'ew-resize',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    touchAction: 'none',
                                    zIndex: 12,
                                    boxShadow: activeDrag === 'end'
                                        ? '0 0 20px rgba(129, 140, 248, 0.8), 2px 0 8px rgba(0,0,0,0.5)'
                                        : '0 0 12px rgba(99, 102, 241, 0.45)',
                                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                                    filter: activeDrag === 'end' ? 'brightness(1.15)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', gap: 2 }}>
                                    <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.65)', borderRadius: 1 }} />
                                    <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.95)', borderRadius: 1 }} />
                                </div>
                            </div>

                            {/* Moving Playhead */}
                            {currentPct >= startPct && currentPct <= endPct && (
                                <div style={{
                                    position: 'absolute',
                                    top: -2,
                                    bottom: -2,
                                    left: `${currentPct}%`,
                                    width: 3,
                                    background: '#ffffff',
                                    borderRadius: 1.5,
                                    pointerEvents: 'none',
                                    zIndex: 11,
                                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.8), 0 0 2px rgba(0, 0, 0, 0.8)',
                                }} />
                            )}
                        </div>
                    </div>

                    {/* Time Indicator Pills */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 10,
                        padding: '0 14px',
                    }}>
                        <div style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--primary, #818cf8)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                        }}>
                            {formatTimeShort(startTime)}
                        </div>

                        <div style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isTrimmed ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
                            background: isTrimmed ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: isTrimmed ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '3px 12px',
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: isTrimmed ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none',
                        }}>
                            <Clock size={12} />
                            <span>{formatTimeShort(trimDuration)} selected</span>
                        </div>

                        <div style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--primary, #818cf8)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                        }}>
                            {formatTimeShort(endTime)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Video Preview Center Area */}
            <div
                onClick={togglePlay}
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '20px 16px',
                    cursor: 'pointer',
                }}
            >
                <div style={{
                    position: 'relative',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        playsInline
                        webkit-playsinline="true"
                        muted
                        preload="auto"
                        onLoadedMetadata={handleLoadedMetadata}
                        onCanPlay={handleCanPlay}
                        onTimeUpdate={handleTimeUpdate}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        style={{
                            maxWidth: '100%',
                            maxHeight: 'min(52vh, 460px)',
                            borderRadius: 16,
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                            display: 'block',
                            background: '#000',
                        }}
                    />

                    {/* Centered Frosted Glass Play Overlay */}
                    {!isPlaying && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                width: 68,
                                height: 68,
                                borderRadius: '50%',
                                background: 'rgba(12, 15, 26, 0.75)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)',
                                transform: 'scale(1)',
                                transition: 'transform 0.15s ease',
                            }}>
                                <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Glass Footer Info */}
            <div style={{
                padding: '12px 20px',
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                background: 'rgba(12, 15, 24, 0.85)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
                zIndex: 10,
            }}>
                <div style={{
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.65)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                    Original: {fileSize}
                </div>

                {isTrimmed && (
                    <div style={{
                        fontSize: 12,
                        color: '#38bdf8',
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '4px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}>
                        Trimmed ({formatTime(startTime)} – {formatTime(endTime)})
                    </div>
                )}

                <div style={{
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}>
                    <span>Tip: Drag handles to adjust clip duration</span>
                </div>
            </div>
        </div>
    );
}

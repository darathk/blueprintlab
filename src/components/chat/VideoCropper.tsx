import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Crop, Scissors } from 'lucide-react';

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
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Spatial Crop State (0 to 1)
    const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });
    const [isSelectingCrop, setIsSelectingCrop] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const d = videoRef.current.duration;
            setDuration(d);
            setEndTime(d);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const ct = videoRef.current.currentTime;
            setCurrentTime(ct);
            if (ct >= endTime) {
                videoRef.current.currentTime = startTime;
            }
        }
    };

    const processVideo = async () => {
        if (!videoRef.current) return;
        setProcessing(true);
        setProgress(0);

        const video = videoRef.current;
        const originalWidth = video.videoWidth;
        const originalHeight = video.videoHeight;

        const targetWidth = originalWidth * crop.width;
        const targetHeight = originalHeight * crop.height;
        const startX = originalWidth * crop.x;
        const startY = originalHeight * crop.y;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const stream = canvas.captureStream(30); // 30 FPS

        // Audio handling
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(video);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioCtx.destination); // Also play to user

        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const croppedFile = new File([blob], `cropped_${file.name.split('.')[0]}.webm`, { type: 'video/webm' });
            onComplete(croppedFile);
            setProcessing(false);
        };

        video.pause();
        video.currentTime = startTime;
        video.playbackRate = 1.0;
        video.muted = false; // Need audio to record it

        await new Promise(r => video.onseeked = r);

        recorder.start();
        video.play();

        const totalTime = endTime - startTime;
        const updateInterval = setInterval(() => {
            const elapsed = video.currentTime - startTime;
            setProgress(Math.min((elapsed / totalTime) * 100, 100));

            // Draw frame to canvas
            ctx.drawImage(
                video,
                startX, startY, targetWidth, targetHeight,
                0, 0, targetWidth, targetHeight
            );

            if (video.currentTime >= endTime || video.ended) {
                clearInterval(updateInterval);
                video.pause();
                recorder.stop();
                audioCtx.close();
            }
        }, 1000 / 30);
    };

    // Very basic spatial selector logic
    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        setIsSelectingCrop(true);
        const rect = containerRef.current.getBoundingClientRect();
        const startX = (e.clientX - rect.left) / rect.width;
        const startY = (e.clientY - rect.top) / rect.height;
        setCrop(prev => ({ ...prev, x: startX, y: startY, width: 0.1, height: 0.1 }));
    };

    const handleCropMouseMove = (e: React.MouseEvent) => {
        if (!isSelectingCrop || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / rect.width;
        const currentY = (e.clientY - rect.top) / rect.height;
        setCrop(prev => ({
            ...prev,
            width: Math.abs(currentX - prev.x),
            height: Math.abs(currentY - prev.y)
        }));
    };

    const handleCropMouseUp = () => setIsSelectingCrop(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!containerRef.current) return;
        setIsSelectingCrop(true);
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const startX = (touch.clientX - rect.left) / rect.width;
        const startY = (touch.clientY - rect.top) / rect.height;
        setCrop(prev => ({ ...prev, x: startX, y: startY, width: 0.1, height: 0.1 }));
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSelectingCrop || !containerRef.current) return;
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = (touch.clientX - rect.left) / rect.width;
        const currentY = (touch.clientY - rect.top) / rect.height;
        setCrop(prev => ({
            ...prev,
            width: Math.abs(currentX - prev.x),
            height: Math.abs(currentY - prev.y)
        }));
    };

    if (!videoUrl) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', color: '#fff', touchAction: 'none' }}>
            {/* Header */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
                <div style={{ fontWeight: 600 }}>Crop & Trim Video</div>
                <button onClick={processVideo} disabled={processing} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                    {processing ? `${progress.toFixed(0)}%` : <Check size={24} />}
                </button>
            </div>

            {/* Video Preview & Crop Area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: 16, position: 'relative' }}>
                <div
                    ref={containerRef}
                    onMouseDown={handleCropMouseDown}
                    onMouseMove={handleCropMouseMove}
                    onMouseUp={handleCropMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleCropMouseUp}
                    style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', cursor: 'crosshair' }}
                >
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                        autoPlay
                        playsInline
                        loop
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                    />

                    {/* Visual Crop Box */}
                    <div style={{
                        position: 'absolute',
                        top: `${crop.y * 100}%`,
                        left: `${crop.x * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                        border: '2px solid var(--primary)',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                        pointerEvents: 'none'
                    }} />
                </div>
            </div>

            {/* Controls */}
            <div style={{ padding: '24px 16px', background: 'rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: 16 }}>
                    <Scissors size={16} color="var(--primary)" />
                    <div style={{ flex: 1, position: 'relative', height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                        <div style={{
                            position: 'absolute',
                            left: `${(startTime / duration) * 100}%`,
                            width: `${((endTime - startTime) / duration) * 100}%`,
                            height: '100%',
                            background: 'rgba(6, 182, 212, 0.3)',
                            borderLeft: '2px solid var(--primary)',
                            borderRight: '2px solid var(--primary)'
                        }} />
                        <input
                            type="range" min="0" max={duration} step="0.1" value={startTime}
                            onChange={e => setStartTime(parseFloat(e.target.value))}
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', zIndex: 10 }}
                        />
                        <input
                            type="range" min="0" max={duration} step="0.1" value={endTime}
                            onChange={e => setEndTime(parseFloat(e.target.value))}
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', zIndex: 11 }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Crop size={16} color="var(--primary)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Click and drag on the video to crop spatially</span>
                </div>
            </div>
        </div>
    );
}


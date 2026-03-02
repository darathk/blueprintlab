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

        const noCroppingApplied = crop.width <= 0.01 || crop.height <= 0.01;
        const noTrimmingApplied = Math.abs(startTime) < 0.1 && Math.abs(endTime - duration) < 0.1;

        // Fast path: no meaningful changes — just pass original file through
        if (noCroppingApplied && noTrimmingApplied) {
            onComplete(file);
            setProcessing(false);
            return;
        }

        // Slow path: attempt canvas re-encode for crop/trim
        try {
            const video = videoRef.current;
            const originalWidth = video.videoWidth;
            const originalHeight = video.videoHeight;

            // Determine target area; if no crop was applied, use full frame
            const cropX = noCroppingApplied ? 0 : crop.x;
            const cropY = noCroppingApplied ? 0 : crop.y;
            const cropWidth = noCroppingApplied ? 1 : crop.width;
            const cropHeight = noCroppingApplied ? 1 : crop.height;

            const srcX = Math.round(originalWidth * cropX);
            const srcY = Math.round(originalHeight * cropY);
            const srcW = Math.round(originalWidth * cropWidth);
            const srcH = Math.round(originalHeight * cropHeight);

            const canvas = document.createElement('canvas');
            canvas.width = srcW;
            canvas.height = srcH;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2d context unavailable');

            // captureStream is not on iOS Safari — check first
            if (typeof (canvas as any).captureStream !== 'function') {
                throw new Error('captureStream not supported');
            }

            const stream = (canvas as any).captureStream(30) as MediaStream;

            // Detect best recording format
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
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
                            // Too small — likely empty recording
                            reject(new Error('Empty recording'));
                            return;
                        }
                        const ext = 'webm';
                        const outFile = new File([blob], `cropped_${file.name.split('.')[0]}.${ext}`, { type: finalMime });
                        resolve(outFile);
                    } catch (e) {
                        reject(e);
                    }
                };
                recorder.onerror = reject;
            });

            // Seek and record
            video.pause();
            video.muted = true; // muted for autoplay/recording policy
            video.currentTime = startTime;
            await new Promise<void>((r) => { video.onseeked = () => r(); });

            recorder.start(100); // collect chunks every 100ms
            await video.play();

            const totalTime = endTime - startTime;
            await new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    const elapsed = video.currentTime - startTime;
                    setProgress(Math.min((elapsed / totalTime) * 100, 99));

                    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

                    if (video.currentTime >= endTime || video.ended || video.paused) {
                        clearInterval(interval);
                        video.pause();
                        recorder.stop();
                        resolve();
                    }
                }, 1000 / 30);

                // Safety timeout
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
            // Gracefully fall back to the original file
            onComplete(file);
        } finally {
            setProcessing(false);
        }
    };

    // Spatial Selector Logic
    const [anchor, setAnchor] = useState({ x: 0, y: 0 });

    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        setIsSelectingCrop(true);
        const rect = containerRef.current.getBoundingClientRect();
        const startX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const startY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setAnchor({ x: startX, y: startY });
        setCrop({ x: startX, y: startY, width: 0, height: 0 });
    };

    const handleCropMouseMove = (e: React.MouseEvent) => {
        if (!isSelectingCrop || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        setCrop({
            x: Math.min(anchor.x, currentX),
            y: Math.min(anchor.y, currentY),
            width: Math.abs(currentX - anchor.x),
            height: Math.abs(currentY - anchor.y)
        });
    };

    const handleCropMouseUp = () => setIsSelectingCrop(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!containerRef.current) return;
        setIsSelectingCrop(true);
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const startX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        const startY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
        setAnchor({ x: startX, y: startY });
        setCrop({ x: startX, y: startY, width: 0, height: 0 });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSelectingCrop || !containerRef.current) return;
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        const currentY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));

        setCrop({
            x: Math.min(anchor.x, currentX),
            y: Math.min(anchor.y, currentY),
            width: Math.abs(currentX - anchor.x),
            height: Math.abs(currentY - anchor.y)
        });
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


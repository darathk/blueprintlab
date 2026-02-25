/**
 * Browser-native video compression using Canvas + MediaRecorder.
 * Zero external dependencies — works with any bundler.
 *
 * Strategy:
 *  1. Try MP4 output (Safari supports this natively)
 *  2. If MP4 not available, skip compression and return null
 *     (caller will upload the original file — better than unplayable WebM)
 *  3. Scales video to 720p, 1Mbps bitrate
 */

const TARGET_HEIGHT = 720;
const VIDEO_BITRATE = 1_000_000; // 1 Mbps

/**
 * Compress a video file using the browser's native MediaRecorder API.
 * Returns a compressed MP4 blob, or null if the browser doesn't support MP4 output.
 */
export async function compressVideo(
    file: File,
    onProgress?: (percent: number) => void
): Promise<Blob | null> {
    // Only compress if the browser supports MP4 MediaRecorder output
    // (Safari does, Chrome/Firefox only support WebM which won't play in QuickTime)
    const mp4Supported = MediaRecorder.isTypeSupported('video/mp4')
        || MediaRecorder.isTypeSupported('video/mp4;codecs=avc1');

    if (!mp4Supported) {
        // Can't produce MP4 — return null so the caller uploads the original
        console.info('MediaRecorder MP4 not supported in this browser, skipping compression');
        return null;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : 'video/mp4';

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';

        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
            // Calculate scaled dimensions (maintain aspect ratio, cap at 720p height)
            const scale = Math.min(1, TARGET_HEIGHT / video.videoHeight);
            const width = Math.round(video.videoWidth * scale);
            const height = Math.round(video.videoHeight * scale);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;

            // Capture the canvas as a video stream at 30fps
            const canvasStream = canvas.captureStream(30);

            // Try to capture audio from the original video
            let combinedStream: MediaStream;
            try {
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                source.connect(audioCtx.destination);

                combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks()
                ]);
            } catch {
                combinedStream = canvasStream;
            }

            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: VIDEO_BITRATE,
            });

            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                URL.revokeObjectURL(url);
                const blob = new Blob(chunks, { type: 'video/mp4' });
                onProgress?.(100);
                resolve(blob);
            };

            recorder.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('MediaRecorder error'));
            };

            recorder.start(100);

            const duration = video.duration;
            let animFrame: number;

            const drawFrame = () => {
                if (video.paused || video.ended) return;
                ctx.drawImage(video, 0, 0, width, height);
                if (duration && onProgress) {
                    const percent = Math.min(99, Math.round((video.currentTime / duration) * 100));
                    onProgress(percent);
                }
                animFrame = requestAnimationFrame(drawFrame);
            };

            video.onplay = () => drawFrame();
            video.onended = () => {
                cancelAnimationFrame(animFrame);
                recorder.stop();
            };

            video.play().catch(reject);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video file'));
        };
    });
}

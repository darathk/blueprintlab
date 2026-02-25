/**
 * Browser-native video compression using Canvas + MediaRecorder.
 * Zero external dependencies — works with any bundler (including Turbopack).
 *
 * Strategy:
 *  1. Load the video into a hidden <video> element
 *  2. Draw each frame onto a <canvas> scaled to 720p
 *  3. Capture the canvas stream + original audio via MediaRecorder
 *  4. Return the compressed WebM blob
 */

const TARGET_HEIGHT = 720;
const VIDEO_BITRATE = 1_000_000; // 1 Mbps

/**
 * Compress a video file using the browser's native MediaRecorder API.
 * Returns a compressed WebM blob (~60-80% smaller for typical phone videos).
 */
export async function compressVideo(
    file: File,
    onProgress?: (percent: number) => void
): Promise<Blob> {
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

            // Capture the canvas as a video stream
            const canvasStream = canvas.captureStream(30); // 30 fps

            // Try to capture audio from the original video
            let combinedStream: MediaStream;
            try {
                const videoEl = video as any;
                // Create an AudioContext to extract audio
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                source.connect(audioCtx.destination); // keep audio playing

                // Combine canvas video track + audio track
                combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks()
                ]);
            } catch {
                // If audio extraction fails, just use video-only stream
                combinedStream = canvasStream;
            }

            // Choose the best available codec
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                    ? 'video/webm;codecs=vp8'
                    : 'video/webm';

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
                const blob = new Blob(chunks, { type: 'video/webm' });
                onProgress?.(100);
                resolve(blob);
            };

            recorder.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('MediaRecorder error: ' + (e as any)?.error?.message || 'unknown'));
            };

            // Start recording
            recorder.start(100); // collect data every 100ms

            // Draw frames to canvas as video plays
            const duration = video.duration;
            let animFrame: number;

            const drawFrame = () => {
                if (video.paused || video.ended) return;

                ctx.drawImage(video, 0, 0, width, height);

                // Report progress
                if (duration && onProgress) {
                    const percent = Math.min(99, Math.round((video.currentTime / duration) * 100));
                    onProgress(percent);
                }

                animFrame = requestAnimationFrame(drawFrame);
            };

            video.onplay = () => {
                drawFrame();
            };

            video.onended = () => {
                cancelAnimationFrame(animFrame);
                recorder.stop();
            };

            // Start playback (which drives the recording)
            video.play().catch(reject);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video file'));
        };
    });
}

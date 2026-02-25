import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Compress a video file using FFmpeg WASM.
 * - Scales to 720p, 30fps, ~1Mbps bitrate
 * - Runs entirely in the browser (no server needed)
 * - Returns a compressed MP4 Blob
 */
export async function compressVideo(
    file: File,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    // Initialize FFmpeg (lazy singleton)
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();

        // Load FFmpeg WASM from CDN
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
    }

    // Track progress via FFmpeg log output
    if (onProgress) {
        let duration = 0;

        ffmpeg.on('log', ({ message }) => {
            // Parse duration from FFmpeg output: "Duration: 00:00:10.50"
            const durationMatch = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (durationMatch) {
                duration =
                    parseInt(durationMatch[1]) * 3600 +
                    parseInt(durationMatch[2]) * 60 +
                    parseInt(durationMatch[3]) +
                    parseInt(durationMatch[4]) / 100;
            }

            // Parse current time: "time=00:00:05.25"
            const timeMatch = message.match(/time=\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (timeMatch && duration > 0) {
                const currentTime =
                    parseInt(timeMatch[1]) * 3600 +
                    parseInt(timeMatch[2]) * 60 +
                    parseInt(timeMatch[3]) +
                    parseInt(timeMatch[4]) / 100;
                const percent = Math.min(99, Math.round((currentTime / duration) * 100));
                onProgress(percent);
            }
        });
    }

    // Write input file to FFmpeg's virtual filesystem
    const inputName = 'input' + getExtension(file.name);
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Compress: 720p, 30fps, ~1Mbps bitrate, fast preset
    await ffmpeg.exec([
        '-i', inputName,
        '-vf', 'scale=-2:720',         // Scale to 720p height, auto-width
        '-r', '30',                      // 30fps
        '-b:v', '1M',                   // ~1Mbps video bitrate
        '-c:v', 'libx264',              // H.264 codec
        '-preset', 'fast',              // Balance speed vs compression
        '-c:a', 'aac',                  // AAC audio
        '-b:a', '128k',                 // 128kbps audio
        '-movflags', '+faststart',      // Optimize for web streaming
        'output.mp4'
    ]);

    // Read compressed output
    const data = await ffmpeg.readFile('output.mp4');

    // Cleanup virtual filesystem
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile('output.mp4');

    if (onProgress) onProgress(100);

    // Convert to Blob (FFmpeg FileData type needs explicit cast for strict TS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Blob([data as any], { type: 'video/mp4' });
}

function getExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot) : '.mp4';
}

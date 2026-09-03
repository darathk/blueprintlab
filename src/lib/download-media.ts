/**
 * Robust media download utility that works across all browsers including
 * Brave Browser (which blocks cross-origin synthetic downloads and third-party tracking downloads),
 * Safari / iOS (which requires same-origin blob or native Web Share to save to Photos),
 * Chrome, and Firefox.
 */

interface DownloadOptions {
    url: string;
    filename: string;
    onProgress?: (percent: number) => void;
}

export async function downloadMediaFile({
    url,
    filename,
    onProgress,
}: DownloadOptions): Promise<{ success: boolean; method: string; error?: any }> {
    if (!url) {
        throw new Error('URL is required for download');
    }

    // Determine clean file extension and filename
    const ext = url.includes('.mov') ? '.mov' : url.includes('.webm') ? '.webm' : url.includes('.jpg') ? '.jpg' : url.includes('.png') ? '.png' : '.mp4';
    let cleanFilename = filename.trim();
    if (!cleanFilename.match(/\.(mp4|mov|webm|jpg|jpeg|png)$/i)) {
        cleanFilename += ext;
    }
    cleanFilename = cleanFilename.replace(/[^\w\s.-]/gi, '_').replace(/\s+/g, '_');

    // Strategy 1: Fetch directly into a same-origin Blob
    // Supabase Storage buckets send `access-control-allow-origin: *`, so the browser can read the stream.
    // Creating a `blob:` URL makes the download SAME-ORIGIN (`blob:https://blueprintlab...`),
    // which guarantees that Brave Shields, Chromium, and Safari will honor the `download` attribute
    // and will NOT block it as a cross-site automated download.
    try {
        if (onProgress) onProgress(5);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            throw new Error(`Direct fetch failed with status ${response.status}`);
        }

        const contentLengthHeader = response.headers.get('content-length');
        const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

        let blob: Blob;

        if (response.body && totalBytes > 0 && typeof ReadableStream !== 'undefined') {
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    receivedBytes += value.length;
                    if (onProgress && totalBytes > 0) {
                        const pct = Math.min(98, Math.round((receivedBytes / totalBytes) * 100));
                        onProgress(pct);
                    }
                }
            }

            const contentType = response.headers.get('content-type') || (cleanFilename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
            blob = new Blob(chunks, { type: contentType });
        } else {
            blob = await response.blob();
        }

        if (onProgress) onProgress(100);

        // Mobile enhancement: iOS/Android native share sheet lets users save directly to Camera Roll / Photos
        if (typeof navigator !== 'undefined' && navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            try {
                const file = new File([blob], cleanFilename, { type: blob.type || 'video/mp4' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file] });
                    return { success: true, method: 'web-share' };
                }
            } catch (shareErr: any) {
                if (shareErr?.name === 'AbortError') {
                    // User closed the share sheet
                    return { success: true, method: 'web-share-dismissed' };
                }
                // If sharing failed, fall through to blob download
            }
        }

        // Trigger native download via same-origin blob URL
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        }, 30000);

        return { success: true, method: 'blob' };
    } catch (directError) {
        console.warn('Direct blob download failed, attempting same-origin proxy fallback:', directError);
    }

    // Strategy 2: Same-Origin Server Proxy Route (`/api/highlights/download`)
    // If Brave Shields or browser network policy blocks client-side CORS to third-party storage,
    // this route streams the file directly from our own backend domain with `Content-Disposition: attachment`.
    // Brave Shields treats same-origin downloads as completely trusted.
    try {
        if (onProgress) onProgress(50);
        const proxyUrl = `/api/highlights/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(cleanFilename)}`;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = proxyUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
        }, 5000);

        if (onProgress) onProgress(100);
        return { success: true, method: 'proxy' };
    } catch (proxyError) {
        console.error('Proxy download failed, falling back to direct window.open:', proxyError);
    }

    // Strategy 3: Direct window.open fallback
    window.open(url, '_blank');
    return { success: false, method: 'window-open' };
}

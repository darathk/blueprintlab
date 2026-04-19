/**
 * Module-level chat-upload manager.
 *
 * Lives outside React's component tree so uploads keep running even after
 * <ChatInterface /> unmounts (e.g., the user leaves the chat screen). UI
 * components subscribe via `useChatUploadJobs` to render progress, and the
 * manager dispatches a `chat-upload-complete` window event when each upload
 * finishes so any open ChatInterface can swap its optimistic placeholder for
 * the real saved message.
 *
 * Caveats:
 *  - Uploads only survive in-page navigation. If the browser tab closes the
 *    XHR is cancelled by the platform — that's a hard limit without using a
 *    Service Worker / Background Fetch API.
 */

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

export type UploadStatus = 'compressing' | 'uploading' | 'sending' | 'done' | 'error';

export interface ChatUploadJob {
    id: string;                  // unique upload id
    tempMessageId: string;       // optimistic message id used by ChatInterface
    athleteId: string;           // scoping (used for storage path + chat filtering)
    conversationKey: string;     // `${currentUserId}:${otherUserId}` so chats can filter
    filename: string;
    mime: string;
    progress: number;            // 0-100
    status: UploadStatus;
    error?: string;
    startedAt: number;
}

export interface StartUploadPayload {
    file: File;
    tempMessageId: string;
    athleteId: string;
    currentUserId: string;
    otherUserId: string;
    content: string;
    replyToId: string | null;
    trim?: { start: number; end: number };
}

export interface UploadCompleteDetail {
    tempMessageId: string;
    realMessage: any;
}

const isBrowser = typeof window !== 'undefined';

class ChatUploadManager {
    private jobs = new Map<string, ChatUploadJob>();
    private listeners = new Set<() => void>();
    private cachedSnapshot: ChatUploadJob[] = [];

    getJobs(): ChatUploadJob[] {
        return this.cachedSnapshot;
    }

    getJobByTempId(tempMessageId: string): ChatUploadJob | undefined {
        for (const j of this.jobs.values()) {
            if (j.tempMessageId === tempMessageId) return j;
        }
        return undefined;
    }

    subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => { this.listeners.delete(cb); };
    }

    dismissJob(id: string) {
        if (this.jobs.delete(id)) this.notify();
    }

    clearFinished() {
        let changed = false;
        for (const [id, j] of this.jobs) {
            if (j.status === 'done' || j.status === 'error') {
                this.jobs.delete(id);
                changed = true;
            }
        }
        if (changed) this.notify();
    }

    /**
     * Kick off an upload + message-create. Returns the job id immediately —
     * the caller does NOT await this. Progress is reported via the store.
     */
    startUpload(payload: StartUploadPayload): string {
        const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const job: ChatUploadJob = {
            id,
            tempMessageId: payload.tempMessageId,
            athleteId: payload.athleteId,
            conversationKey: `${payload.currentUserId}:${payload.otherUserId}`,
            filename: payload.file.name,
            mime: payload.file.type || 'application/octet-stream',
            progress: 0,
            status: payload.file.type.startsWith('image/') ? 'compressing' : 'uploading',
            startedAt: Date.now(),
        };
        this.jobs.set(id, job);
        this.notify();
        // Fire-and-forget — errors are surfaced via job.status === 'error'
        this.runUpload(id, payload).catch(err => {
            console.error('[chat-upload-manager] unhandled error', err);
            this.update(id, { status: 'error', error: err?.message || 'Upload failed' });
        });
        return id;
    }

    private async runUpload(id: string, payload: StartUploadPayload) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            this.update(id, { status: 'error', error: 'Supabase not configured' });
            return;
        }

        let blob: Blob = payload.file;
        let mime = payload.file.type;

        // Image compression (in-place; no UI-blocking)
        if (payload.file.type.startsWith('image/')) {
            try {
                const imageCompression = (await import('browser-image-compression')).default;
                const compressed = await (imageCompression as any)(payload.file, {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1280,
                    useWebWorker: true,
                });
                blob = compressed;
                mime = compressed.type || mime;
            } catch {
                /* fall back to original */
            }
        }

        // Fix missing MIME (iOS / native picker quirk)
        if (!mime) {
            const name = payload.file.name.toLowerCase();
            if (name.endsWith('.mp4')) mime = 'video/mp4';
            else if (name.endsWith('.mov')) mime = 'video/quicktime';
            else if (name.endsWith('.webm')) mime = 'video/webm';
            else if (name.endsWith('.m4a')) mime = 'audio/mp4';
            else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (name.endsWith('.png')) mime = 'image/png';
            else mime = 'application/octet-stream';
        }

        const ext = mime.includes('png') ? '.png'
            : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg'
            : mime.includes('quicktime') ? '.mov'
            : mime.includes('webm') ? '.webm'
            : mime.includes('audio') ? '.m4a'
            : '.mp4';
        const uploadPath = `${payload.athleteId}/${Date.now()}-${id}${ext}`;

        this.update(id, { status: 'uploading', mime, progress: 0 });

        // XHR for progress events
        const publicUrl = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${supabaseUrl}/storage/v1/object/lift-videos/${uploadPath}`;

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    this.update(id, { progress: pct });
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const { data: u } = supabase.storage.from('lift-videos').getPublicUrl(uploadPath);
                    resolve(u.publicUrl);
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            xhr.timeout = 300000;

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
            xhr.setRequestHeader('apikey', supabaseKey);
            xhr.setRequestHeader('Content-Type', mime);
            xhr.setRequestHeader('Cache-Control', '604800');
            xhr.setRequestHeader('x-upsert', 'true');
            xhr.send(blob);
        }).catch((err: Error) => {
            this.update(id, { status: 'error', error: err.message, progress: 0 });
            if (isBrowser) {
                window.dispatchEvent(new CustomEvent('chat-upload-error', {
                    detail: { tempMessageId: payload.tempMessageId, error: err.message },
                }));
            }
            throw err;
        });

        const mediaUrl = payload.trim
            ? `${publicUrl}#t=${payload.trim.start},${payload.trim.end}`
            : publicUrl;

        this.update(id, { status: 'sending', progress: 100 });

        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: payload.currentUserId,
                receiverId: payload.otherUserId,
                content: payload.content,
                mediaUrl,
                mediaType: mime,
                replyToId: payload.replyToId,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.update(id, { status: 'error', error: `Save failed: ${res.status} ${body}` });
            if (isBrowser) {
                window.dispatchEvent(new CustomEvent('chat-upload-error', {
                    detail: { tempMessageId: payload.tempMessageId, error: `Save failed: ${res.status}` },
                }));
            }
            return;
        }

        const realMessage = await res.json();
        this.update(id, { status: 'done', progress: 100 });

        if (isBrowser) {
            window.dispatchEvent(new CustomEvent<UploadCompleteDetail>('chat-upload-complete', {
                detail: { tempMessageId: payload.tempMessageId, realMessage },
            }));
            window.dispatchEvent(new Event('inbox-refresh'));
        }

        // Auto-dismiss successful jobs after a short delay so the global
        // banner doesn't keep "100%" stuck on screen forever.
        setTimeout(() => this.dismissJob(id), 4000);
    }

    private update(id: string, patch: Partial<ChatUploadJob>) {
        const j = this.jobs.get(id);
        if (!j) return;
        Object.assign(j, patch);
        this.notify();
    }

    private notify() {
        // Rebuild the snapshot once per change — useSyncExternalStore needs
        // a stable reference between calls when nothing changed.
        this.cachedSnapshot = Array.from(this.jobs.values());
        this.listeners.forEach(l => l());
    }
}

export const chatUploadManager = new ChatUploadManager();

const EMPTY: ChatUploadJob[] = [];

/** React hook: subscribes to all jobs (re-renders on any change). */
export function useChatUploadJobs(): ChatUploadJob[] {
    return useSyncExternalStore(
        cb => chatUploadManager.subscribe(cb),
        () => chatUploadManager.getJobs(),
        () => EMPTY,
    );
}

/** React hook: only re-renders when jobs matching the conversation change. */
export function useChatUploadJobsForConversation(currentUserId: string, otherUserId: string): ChatUploadJob[] {
    const all = useChatUploadJobs();
    const key = `${currentUserId}:${otherUserId}`;
    return all.filter(j => j.conversationKey === key);
}

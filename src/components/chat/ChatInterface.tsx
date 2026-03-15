'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Mic, MoreVertical, Reply, Copy, Download, Paperclip, X, Send, Search, Scissors, Pencil } from 'lucide-react';
import VideoCropper from './VideoCropper';

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    createdAt: string | Date;
    read: boolean;
    replyToId?: string | null;
    replyTo?: { id: string; content: string; mediaUrl?: string | null; mediaType?: string | null; sender: { name: string } } | null;
    sender: { id: string; name: string; email: string };
    receiver: { id: string; name: string; email: string };
    reactions?: Record<string, string[]> | null; // { emoji: [userIds] }
}

interface Props {
    currentUserId: string;
    otherUserId: string;
    currentUserName: string;
    otherUserName: string;
    athleteId: string;
    initialMessages?: Message[];
    isEmbedded?: boolean;
    onBack?: () => void;
    headerActions?: React.ReactNode;
}

export default function ChatInterface({
    currentUserId, otherUserId, currentUserName, otherUserName, athleteId,
    initialMessages = [], isEmbedded = false, onBack, headerActions
}: Props) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [compressProgress, setCompressProgress] = useState(-1);
    const [statusText, setStatusText] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [stagedFileUrls, setStagedFileUrls] = useState<string[]>([]);
    const [stagedPosters, setStagedPosters] = useState<Record<number, string>>({});
    const [stagedPreviewIndex, setStagedPreviewIndex] = useState(0);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Video Cropper state
    const [cropFile, setCropFile] = useState<File | null>(null);

    // Upload progress per message (tempId → 0-100)
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Editing state
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // Multi-select state
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    const isMultiSelecting = selectedMessageIds.size > 0;

    const toggleSelection = (msgId: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    };

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isCompressing = compressProgress >= 0 && compressProgress <= 100;

    // Initial fetch — once
    useEffect(() => {
        if (initialMessages.length === 0) {
            fetch(`/api/messages?athleteId=${athleteId}`)
                .then(r => r.ok ? r.json() : [])
                .then(data => { setMessages(data); setLoaded(true); });
        } else {
            setLoaded(true);
        }
        // Mark as read
        fetch('/api/messages', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
        });
    }, [athleteId, currentUserId, otherUserId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Track if user has scrolled up — if so, don't auto-jump on polling updates
    const userScrolledUp = useRef(false);

    const scrollToBottom = useCallback((force = false) => {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        const el = scrollContainerRef.current;
        if (!el) return;

        requestAnimationFrame(() => {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const shouldScroll = force || !userScrolledUp.current || distFromBottom < 200;

            if (shouldScroll && messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: force ? 'auto' : 'smooth', block: 'end' });
            }

            scrollTimeoutRef.current = setTimeout(() => {
                const elAfter = scrollContainerRef.current;
                if (!elAfter) return;
                const dist = elAfter.scrollHeight - elAfter.scrollTop - elAfter.clientHeight;
                if ((force || !userScrolledUp.current || dist < 200) && messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                }
            }, 300); // Wait for images/DOM to fully settle
        });
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        // If user scrolls up by more than a couple messages, flag it
        userScrolledUp.current = distFromBottom > 250;
    }, []);

    // Only force-scroll when user sends/receives a new message (not on background polls)
    const prevMsgCount = useRef(0);
    useEffect(() => {
        if (!loaded) return;
        const newCount = messages.length;
        const isNewMsg = newCount > prevMsgCount.current;
        prevMsgCount.current = newCount;
        if (isNewMsg) {
            // New message: scroll to bottom only if user was already near bottom
            scrollToBottom(false);
        }
    }, [messages, loaded, scrollToBottom]);

    // Force scroll to bottom on initial load (multiple attempts for media loading)
    useEffect(() => {
        if (loaded) {
            scrollToBottom(true);
            // Retry after media may have loaded
            const t1 = setTimeout(() => scrollToBottom(true), 500);
            const t2 = setTimeout(() => scrollToBottom(true), 1200);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [loaded, scrollToBottom]);

    // Realtime — append only, no re-fetch
    useEffect(() => {
        const ch = supabase.channel(`chat-${athleteId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: `senderId=eq.${otherUserId}` },
                (payload) => {
                    fetch(`/api/messages?athleteId=${athleteId}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => { if (data) setMessages(data); });
                    fetch('/api/messages', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
                    });
                }
            ).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [athleteId, currentUserId, otherUserId]);

    // Optimized Polling Fallback (Runs safely if Supabase keys are missing)
    useEffect(() => {
        const poll = setInterval(() => {
            fetch(`/api/messages?athleteId=${athleteId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.length > 0) {
                        setMessages(prev => {
                            // Only trigger re-render if new messages arrived
                            if (prev.length !== data.length || prev[prev.length - 1]?.id !== data[data.length - 1]?.id) {
                                const hasUnread = data.some((m: any) => m.receiverId === currentUserId && !m.read);
                                if (hasUnread) {
                                    fetch('/api/messages', {
                                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
                                    });
                                }
                                return data;
                            }
                            return prev;
                        });
                    }
                });
        }, 10000); // Increased from 3s to 10s — Supabase realtime handles instant delivery
        return () => clearInterval(poll);
    }, [athleteId, currentUserId, otherUserId]);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Critical: iOS/Safari needs audio/mp4 for smooth recording/playback in native players
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
                mimeType = 'audio/mpeg';
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const ext = mimeType.includes('mp4') || mimeType.includes('mpeg') ? 'm4a' : 'webm';
                // Use a more descriptive filename but keep content clean
                const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mimeType });
                setStagedFiles(prev => [...prev, audioFile]);
                setStagedFileUrls(prev => [...prev, URL.createObjectURL(audioBlob)]);
                setIsRecording(false);
                setRecordingTime(0);
                if (timerRef.current) clearInterval(timerRef.current);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            setRecordingTime(0);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    // Close action menu on click outside but ignore if multi-selecting
    useEffect(() => { const c = () => setActiveMenu(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);

    // Send — optimistic
    const handleSend = async () => {
        const text = newMessage.trim();
        if (!text && stagedFiles.length === 0) return;

        // Copy the files and clear UI state immediately
        const filesToSend = [...stagedFiles];
        const urlsToSend = [...stagedFileUrls];

        setNewMessage('');
        setReplyingTo(null);
        setStagedFiles([]);
        setStagedFileUrls([]);
        setStagedPosters({});
        if (fileRef.current) fileRef.current.value = '';

        // Create optimistic messages
        const optimisticMessages: Message[] = [];

        if (filesToSend.length === 0) {
            // Just text
            const tempId = `temp-${Date.now()}`;
            optimisticMessages.push({
                id: tempId, senderId: currentUserId, receiverId: otherUserId, content: text,
                mediaUrl: null, mediaType: null,
                createdAt: new Date().toISOString(), read: false,
                replyToId: replyingTo?.id || null, replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, mediaUrl: replyingTo.mediaUrl, mediaType: replyingTo.mediaType, sender: replyingTo.sender } : null,
                sender: { id: currentUserId, name: currentUserName, email: '' },
                receiver: { id: otherUserId, name: otherUserName, email: '' },
            });
        } else {
            // Files (with text on the first one)
            filesToSend.forEach((file, index) => {
                const tempId = `temp-${Date.now()}-${index}`;
                const isVid = file.type.startsWith('video/');
                const isAudio = file.type.startsWith('audio/');
                const content = index === 0 && text ? text : isAudio ? 'Voice Message' : (isVid ? 'Video' : 'Photo');
                optimisticMessages.push({
                    id: tempId, senderId: currentUserId, receiverId: otherUserId, content,
                    mediaUrl: urlsToSend[index],
                    mediaType: file.type,
                    createdAt: new Date().toISOString(), read: false,
                    replyToId: index === 0 ? (replyingTo?.id || null) : null,
                    replyTo: index === 0 ? (replyingTo ? { id: replyingTo.id, content: replyingTo.content, mediaUrl: replyingTo.mediaUrl, mediaType: replyingTo.mediaType, sender: replyingTo.sender } : null) : null,
                    sender: { id: currentUserId, name: currentUserName, email: '' },
                    receiver: { id: otherUserId, name: otherUserName, email: '' },
                });
            });
        }

        setMessages(prev => [...prev, ...optimisticMessages]);
        setSending(true);

        try {
            if (filesToSend.length === 0) {
                // Just send the text message
                const tempId = optimisticMessages[0].id;
                const res = await fetch('/api/messages', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderId: currentUserId, receiverId: otherUserId, content: text, mediaUrl: null, mediaType: null, replyToId: replyingTo?.id || null })
                });
                if (res.ok) {
                    const real = await res.json();
                    setMessages(prev => prev.map(m => m.id === tempId ? real : m));
                } else {
                    console.error('[API] Text message failed:', res.status);
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                    alert('Failed to send message. Please try again.');
                }
            } else {
                // Send files sequentially
                setUploading(true);
                for (let i = 0; i < filesToSend.length; i++) {
                    const file = filesToSend[i];
                    const tempId = optimisticMessages[i].id;
                    const isVid = file.type.startsWith('video/');
                    let blob: File | Blob = file;
                    let mime = file.type;

                    setStatusText(filesToSend.length > 1 ? `Uploading ${i + 1} of ${filesToSend.length}…` : 'Uploading…');
                    setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));
                    setCompressProgress(10);

                    const isImage = file.type.startsWith('image/');
                    if (isImage) {
                        try {
                            const imageCompression = (await import('browser-image-compression')).default;
                            const c = await (imageCompression as any)(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: false });
                            blob = c; mime = c.type; setCompressProgress(40);
                        } catch { /* skip compression */ }
                    }

                    // Ensure we have a valid MIME type
                    if (!mime) {
                        const fileName = file.name.toLowerCase();
                        if (fileName.endsWith('.mp4')) mime = 'video/mp4';
                        else if (fileName.endsWith('.mov')) mime = 'video/quicktime';
                        else if (fileName.endsWith('.webm')) mime = 'video/webm';
                        else if (fileName.endsWith('.m4a')) mime = 'audio/mp4';
                        else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mime = 'image/jpeg';
                        else if (fileName.endsWith('.png')) mime = 'image/png';
                        else mime = 'application/octet-stream';
                    }

                    setCompressProgress(80);
                    const ext = mime.includes('png') ? '.png' : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : mime.includes('quicktime') ? '.mov' : mime.includes('webm') ? '.webm' : mime.includes('audio') ? '.m4a' : '.mp4';
                    const uploadPath = `${athleteId}/${Date.now()}-${i}${ext}`;

                    // Upload with XHR for progress tracking
                    let publicUrl = '';
                    try {
                        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                        if (!supabaseUrl || !supabaseKey) {
                            throw new Error('Supabase not configured');
                        }

                        publicUrl = await new Promise<string>((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            const url = `${supabaseUrl}/storage/v1/object/lift-videos/${uploadPath}`;

                            xhr.upload.onprogress = (e) => {
                                if (e.lengthComputable) {
                                    const pct = Math.round((e.loaded / e.total) * 100);
                                    setUploadProgress(prev => ({ ...prev, [tempId]: pct }));
                                    setCompressProgress(80 + Math.round(pct * 0.2));
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
                            xhr.timeout = 300000; // 5 min timeout

                            xhr.open('POST', url, true);
                            xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
                            xhr.setRequestHeader('apikey', supabaseKey);
                            xhr.setRequestHeader('Content-Type', mime);
                            xhr.setRequestHeader('Cache-Control', '604800');
                            xhr.setRequestHeader('x-upsert', 'true');
                            xhr.send(blob);
                        });
                    } catch (uploadErr: any) {
                        console.error('[Upload] Failed:', uploadErr);
                        setMessages(prev => prev.filter(m => m.id !== tempId));
                        setUploadProgress(prev => { const n = { ...prev }; delete n[tempId]; return n; });
                        alert(`Upload failed: ${uploadErr.message}`);
                        continue;
                    }

                    setCompressProgress(100);
                    setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));

                    const isAudio = file.type.startsWith('audio/');
                    const content = i === 0 && text ? text : isAudio ? 'Voice Message' : isVid ? 'Video' : 'Photo';
                    const replyToId = i === 0 ? (replyingTo?.id || null) : null;

                    const res = await fetch('/api/messages', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senderId: currentUserId, receiverId: otherUserId, content, mediaUrl: publicUrl, mediaType: mime, replyToId })
                    });

                    if (res.ok) {
                        const real = await res.json();
                        setMessages(prev => prev.map(m => m.id === tempId ? real : m));
                    } else {
                        const errBody = await res.text();
                        console.error('[API] Message create failed:', res.status, errBody);
                        setMessages(prev => prev.filter(m => m.id !== tempId));
                        alert(`Failed to send message: ${res.status} - ${errBody}`);
                    }

                    setUploadProgress(prev => { const n = { ...prev }; delete n[tempId]; return n; });
                    URL.revokeObjectURL(urlsToSend[i]);
                }
            }
        } catch (e: any) {
            console.error('[Send] Failed:', e);
            alert(`Send failed: ${e?.message || 'Unknown error'}`);
        }
        finally {
            setSending(false);
            setUploading(false);
            setCompressProgress(-1);
            setStatusText('');
        }
    };

    // Toggle reaction
    const handleToggleReaction = async (messageId: string, emoji: string) => {
        // Optimistic UI update
        const currentUser = currentUserId;
        setMessages(prev => prev.map(m => {
            if (m.id !== messageId) return m;

            const currentReactions = { ...(m.reactions || {}) } as Record<string, string[]>;
            const userIds = currentReactions[emoji] || [];

            let updatedUserIds: string[];
            if (userIds.includes(currentUser)) {
                updatedUserIds = userIds.filter(id => id !== currentUser);
            } else {
                updatedUserIds = [...userIds, currentUser];
            }

            if (updatedUserIds.length > 0) {
                currentReactions[emoji] = updatedUserIds;
            } else {
                delete currentReactions[emoji];
            }

            return { ...m, reactions: currentReactions };
        }));

        try {
            const res = await fetch('/api/messages/reactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, userId: currentUserId, emoji })
            });

            if (!res.ok) {
                console.error('Failed to toggle reaction');
            }
        } catch (e) {
            console.error('Reaction toggle error:', e);
        }
    };

    // Staging media
    const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const validFiles = files.filter(f => {
            const isVid = f.type.startsWith('video/'), isImg = f.type.startsWith('image/'), isAudio = f.type.startsWith('audio/');
            return (isVid || isImg || isAudio) && f.size <= 200 * 1024 * 1024;
        });

        if (validFiles.length < files.length) {
            alert('Some files were ignored (must be image/video under 200MB)');
        }
        if (validFiles.length === 0) return;

        // Go straight to staging (user can optionally trim videos from the staging overlay)
        const startIndex = stagedFiles.length;
        setStagedFiles(prev => [...prev, ...validFiles]);
        setStagedFileUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

        // Generate poster thumbnails for videos (iOS won't show preview otherwise)
        validFiles.forEach((f, i) => {
            if (f.type.startsWith('video/')) {
                generateVideoPoster(f, startIndex + i);
            }
        });

        // Reset input so selecting the same file again triggers onChange
        if (fileRef.current) fileRef.current.value = '';
    };

    const generateVideoPoster = (file: File, index: number) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = URL.createObjectURL(file);

        video.onloadeddata = () => {
            video.currentTime = 0.5;
        };
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0);
                    const poster = canvas.toDataURL('image/jpeg', 0.7);
                    setStagedPosters(prev => ({ ...prev, [index]: poster }));
                }
            } catch (e) {
                console.error('Poster generation failed:', e);
            }
            URL.revokeObjectURL(video.src);
            video.remove();
        };
    };

    const handleCropComplete = (croppedFile: File) => {
        // Check if we're re-trimming an already staged file
        const existingIndex = stagedFiles.findIndex(f => f === cropFile);
        if (existingIndex >= 0) {
            // Replace the existing staged file with the trimmed version
            URL.revokeObjectURL(stagedFileUrls[existingIndex]);
            setStagedFiles(prev => prev.map((f, i) => i === existingIndex ? croppedFile : f));
            setStagedFileUrls(prev => prev.map((url, i) => i === existingIndex ? URL.createObjectURL(croppedFile) : url));
            generateVideoPoster(croppedFile, existingIndex);
        } else {
            const newIndex = stagedFiles.length;
            setStagedFiles(prev => [...prev, croppedFile]);
            setStagedFileUrls(prev => [...prev, URL.createObjectURL(croppedFile)]);
            generateVideoPoster(croppedFile, newIndex);
        }
        setCropFile(null);
    };

    const clearStagedMedia = (index?: number) => {
        if (index !== undefined) {
            URL.revokeObjectURL(stagedFileUrls[index]);
            setStagedFiles(prev => prev.filter((_, i) => i !== index));
            setStagedFileUrls(prev => prev.filter((_, i) => i !== index));
            setStagedPosters(prev => { const n = { ...prev }; delete n[index]; return n; });
        } else {
            stagedFileUrls.forEach(url => URL.revokeObjectURL(url));
            setStagedFiles([]);
            setStagedFileUrls([]);
            setStagedPosters({});
        }
        if (fileRef.current) fileRef.current.value = '';
    };

    const saveMedia = async (url: string, isImg?: boolean) => {
        try {
            const r = await fetch(url); const b = await r.blob(); const a = document.createElement('a');
            const ext = isImg ? '.jpg' : url.includes('.webm') ? '.webm' : '.mp4';
            a.href = URL.createObjectURL(b); a.download = `lift_${Date.now()}${ext}`; a.click(); URL.revokeObjectURL(a.href);
        } catch { window.open(url, '_blank'); }
    };

    const fmtTime = (s: string | Date) => {
        const d = new Date(s), n = new Date();
        return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const fmtDate = (s: string | Date) => {
        const d = new Date(s), n = new Date(), y = new Date(n); y.setDate(y.getDate() - 1);
        return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday'
            : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };

    const showDateSep = (i: number) => i === 0 || new Date(messages[i].createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();
    const showTime = (i: number) => i === 0 || messages[i].senderId !== messages[i - 1].senderId ||
        new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 300000;

    // Filter messages for search
    const filteredMessages = useMemo(() => {
        if (!searchText.trim()) return messages;
        const low = searchText.toLowerCase();
        return messages.filter(m =>
            m.content.toLowerCase().includes(low) ||
            m.sender.name.toLowerCase().includes(low)
        );
    }, [messages, searchText]);

    // Highlighting helper
    const highlightMatch = (text: string) => {
        if (!searchText.trim()) return text;
        const parts = text.split(new RegExp(`(${searchText})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === searchText.toLowerCase()
                        ? <mark key={i} style={{ background: 'rgba(6, 182, 212, 0.4)', color: '#fff', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
                        : part
                )}
            </>
        );
    };

    const handleCopyMultiple = () => {
        const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const textToCopy = selectedMsgs.map(m => `[${fmtTime(m.createdAt)}] ${m.sender.name}: ${m.content}`).join('\n');
        navigator.clipboard.writeText(textToCopy);
        setSelectedMessageIds(new Set());
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!confirm('Are you sure you want to delete this message? This will also remove any attached media.')) return;

        // Optimistic UI
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setActiveMenu(null);

        try {
            const res = await fetch(`/api/messages?id=${msgId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                console.error('Delete failed:', err);
                alert('Failed to delete message. Refreshing…');
                window.location.reload();
            }
        } catch (e) {
            console.error('Delete error:', e);
            alert('Delete failed.');
            window.location.reload();
        }
    };

    const handleEditMessage = async (msgId: string, newContent: string) => {
        const trimmed = newContent.trim();
        if (!trimmed) return;

        // Optimistic update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m));
        setEditingMessageId(null);
        setEditText('');

        try {
            const res = await fetch('/api/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msgId, content: trimmed })
            });
            if (!res.ok) {
                console.error('Edit failed:', res.status);
                alert('Failed to edit message.');
            }
        } catch (e) {
            console.error('Edit error:', e);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: isEmbedded ? '100%' : '100dvh',
            width: '100%',
            flex: 1,
            minHeight: 0,
            background: 'var(--background)',
            overscrollBehavior: 'none',
            borderRadius: 0,
            border: 'none',
            position: 'relative' // Added for absolute positioning of glass elements
        }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '12px 16px',
                paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                background: 'rgba(15, 23, 42, 0.75)', // Glassmorphic background
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
                height: 'calc(var(--header-height) + env(safe-area-inset-top, 0px))',
                width: '100%',
                zIndex: 40 // Keep above messages
            }}>
                {isMultiSelecting ? (
                    <>
                        <button onClick={() => setSelectedMessageIds(new Set())} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
                        <div style={{ flex: 1, fontWeight: 600, color: 'var(--primary)', fontSize: 16 }}>{selectedMessageIds.size} Selected</div>
                        <button onClick={handleCopyMultiple} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginRight: 8 }}><Copy size={16} color="#fff" /> Copy</button>
                        <button onClick={async () => { if (!confirm(`Delete ${selectedMessageIds.size} message(s)?`)) return; for (const id of selectedMessageIds) { setMessages(prev => prev.filter(m => m.id !== id)); await fetch(`/api/messages?id=${id}`, { method: 'DELETE' }); } setSelectedMessageIds(new Set()); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><X size={16} color="#ef4444" /> Delete</button>
                    </>
                ) : (
                    <>
                        {onBack ? (
                            <button onClick={onBack} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>← Back</button>
                        ) : (
                            <Link href={`/athlete/${athleteId}/dashboard`} style={{ color: 'var(--primary)', background: 'none', border: 'none', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>← Back</Link>
                        )}
                        {isSearchOpen ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '4px 10px', margin: '0 8px' }}>
                                <Search size={14} style={{ color: 'rgba(255,255,255,0.3)', marginRight: 8 }} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: 13, outline: 'none', flex: 1 }}
                                />
                                <button onClick={() => { setIsSearchOpen(false); setSearchText(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
                            </div>
                        ) : (
                            <>
                                <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', fontSize: 15 }}>{otherUserName}</div>
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}
                                >
                                    <Search size={18} />
                                </button>
                                {headerActions}
                            </>
                        )}

                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #7d87d2, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13, flexShrink: 0 }}>
                            {otherUserName.charAt(0).toUpperCase()}
                        </div>
                    </>
                )}
            </div>

            {/* Video Cropper Overlay */}
            {cropFile && (
                <VideoCropper
                    file={cropFile}
                    onCancel={() => setCropFile(null)}
                    onComplete={handleCropComplete}
                />
            )}

            {/* Messages */}
            <div ref={scrollContainerRef} onScroll={handleScroll} style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '12px 16px',
                minHeight: 0,
                paddingTop: 'calc(var(--header-height) + 16px + env(safe-area-inset-top, 0px))',
                paddingBottom: 0,
                willChange: 'scroll-position',
                transform: 'translateZ(0)',
                WebkitOverflowScrolling: 'touch' as any,
                overscrollBehavior: 'contain',
                backgroundImage: 'radial-gradient(rgba(0,0,0,0.1) 1px, transparent 0)',
                backgroundSize: '30px 30px',
                backgroundPosition: '-19px -19px',
                backgroundColor: '#0b141a' // WhatsApp Dark Mode background
            }}>
                {!loaded && <div style={{ textAlign: 'center', padding: 40, color: 'var(--secondary-foreground)' }}>Loading…</div>}
                {loaded && messages.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--secondary-foreground)', fontSize: 14 }}>No messages yet. Start the conversation!</div>}
                {loaded && searchText && filteredMessages.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--secondary-foreground)', fontSize: 14 }}>No messages found matching "{searchText}"</div>}

                {filteredMessages.map((msg, i) => {
                    const mine = msg.senderId === currentUserId;
                    const isVid = msg.mediaType?.startsWith('video');
                    const isImg = msg.mediaType?.startsWith('image');
                    const isAudio = msg.mediaType?.startsWith('audio');
                    const dateSep = showDateSep(i);
                    const timeSep = showTime(i);

                    const isSelected = selectedMessageIds.has(msg.id);

                    return (
                        <div key={msg.id} style={{ position: 'relative' }}>
                            {isSelected && <div style={{ position: 'absolute', inset: -4, background: 'rgba(6, 182, 212, 0.1)', zIndex: 0, borderRadius: 8, pointerEvents: 'none' }} />}
                            <div style={{ position: 'relative', zIndex: 1 }} onClick={() => isMultiSelecting && toggleSelection(msg.id)}>
                                {dateSep && <div style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{fmtDate(msg.createdAt)}</div>}
                                {timeSep && !dateSep && <div style={{ textAlign: 'center', margin: '10px 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{fmtTime(msg.createdAt)}</div>}

                                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: timeSep && i > 0 ? 8 : 2, gap: 4, position: 'relative' }}>

                                    {/* Action button — left side for own messages */}
                                    {mine ? (
                                        <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                            title="Actions"><MoreVertical size={16} color="#ffffff" /></button>
                                    ) : (
                                        <div style={{ width: 16, flexShrink: 0 }} /> // Spacer for alignment
                                    )}

                                    <div style={{ position: 'relative', maxWidth: '75%', cursor: isMultiSelecting ? 'pointer' : 'default' }}>
                                        <div
                                            onClick={(e) => {
                                                if (isMultiSelecting) { e.stopPropagation(); toggleSelection(msg.id); }
                                            }}
                                            style={{
                                                padding: msg.mediaUrl ? '4px 4px 8px' : '8px 12px',
                                                borderRadius: mine ? '10px 0px 10px 10px' : '0px 10px 10px 10px',
                                                background: isSelected ? 'rgba(125,135,210,0.4)' : mine ? '#005c4b' : '#202c33',
                                                border: isSelected ? '1px solid var(--primary)' : 'none',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                transition: 'background 0.15s ease',
                                                position: 'relative'
                                            }}>
                                            {/* WhatsApp Tail */}
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                [mine ? 'right' : 'left']: -8,
                                                width: 0,
                                                height: 0,
                                                borderStyle: 'solid',
                                                borderWidth: mine ? '0 8px 10px 0' : '0 0 10px 8px',
                                                borderColor: `transparent ${mine ? '#005c4b' : '#202c33'} transparent transparent`,
                                                transform: mine ? 'none' : 'scaleX(-1)',
                                                display: timeSep ? 'block' : 'none'
                                            }} />
                                            {/* Reply */}
                                            {msg.replyTo && (
                                                <div style={{ margin: msg.mediaUrl ? '4px 8px 6px' : '0 0 6px', padding: '6px 8px', borderRadius: 10, background: 'rgba(0,0,0,0.15)', borderLeft: mine ? '2px solid rgba(255,255,255,0.7)' : '2px solid var(--primary)', fontSize: 11 }}>
                                                    <div style={{ fontWeight: 600, color: mine ? '#fff' : 'var(--primary)', marginBottom: 2 }}>{msg.replyTo.sender.name}</div>
                                                    <div style={{ color: mine ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {msg.replyTo.mediaUrl ? (msg.replyTo.mediaType?.startsWith('image') ? 'Photo' : msg.replyTo.mediaType?.startsWith('audio') ? 'Voice' : 'Video') : msg.replyTo.content}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video */}
                                            {msg.mediaUrl && isVid && (
                                                <div style={{ minHeight: 120, background: '#000', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                                                    <video
                                                        controls
                                                        playsInline
                                                        webkit-playsinline="true"
                                                        muted
                                                        preload="metadata"
                                                        onLoadedData={() => scrollToBottom(false)}
                                                        style={{ width: '100%', maxWidth: '100%', maxHeight: 300, display: 'block', objectFit: 'contain' }}
                                                    >
                                                        <source src={`${msg.mediaUrl}#t=0.001`} />
                                                    </video>
                                                    {/* Upload/processing progress overlay */}
                                                    {uploadProgress[msg.id] !== undefined && uploadProgress[msg.id] < 100 && (
                                                        <>
                                                            <div style={{
                                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                                                padding: '16px 10px 8px',
                                                                display: 'flex', flexDirection: 'column', gap: 4
                                                            }}>
                                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                                                                    {uploadProgress[msg.id] < 5 ? 'Processing…' : `Sending ${uploadProgress[msg.id]}%`}
                                                                </div>
                                                                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%',
                                                                        background: '#00a884',
                                                                        borderRadius: 2,
                                                                        transition: 'width 150ms ease',
                                                                        width: `${Math.max(uploadProgress[msg.id], 2)}%`
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Image */}
                                            {msg.mediaUrl && isImg && (
                                                <div style={{ position: 'relative' }}>
                                                    <img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')} onLoad={() => scrollToBottom(false)}
                                                        style={{ width: '100%', maxWidth: '100%', maxHeight: 200, borderRadius: 14, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
                                                    {uploadProgress[msg.id] !== undefined && uploadProgress[msg.id] < 100 && (
                                                        <div style={{
                                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                                                            padding: '12px 10px 6px',
                                                            borderRadius: '0 0 14px 14px',
                                                            display: 'flex', flexDirection: 'column', gap: 3
                                                        }}>
                                                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                                                                {uploadProgress[msg.id] < 5 ? 'Processing…' : `Sending ${uploadProgress[msg.id]}%`}
                                                            </div>
                                                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', background: '#00a884', borderRadius: 2, transition: 'width 150ms ease', width: `${Math.max(uploadProgress[msg.id], 2)}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Audio (WhatsApp Style) */}
                                            {msg.mediaUrl && isAudio && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px', minWidth: 240 }}>
                                                    {/* Profile Pic on left */}
                                                    <div style={{ width: 45, height: 45, borderRadius: '50%', background: mine ? 'rgba(255,255,255,0.1)' : '#74bacd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                        <span style={{ fontSize: 18, color: '#fff', fontWeight: 600 }}>{msg.sender.name[0]}</span>
                                                    </div>

                                                    {/* Waveform and Play */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            {/* We'll use a custom audio player UI here for WhatsApp look */}
                                                            <audio
                                                                controls
                                                                preload="metadata"
                                                                style={{ height: 35, width: '100%', filter: mine ? 'invert(100%) opacity(0.8)' : 'invert(20%) opacity(0.8)' }}
                                                            >
                                                                <source src={msg.mediaUrl} type={msg.mediaType || 'audio/mpeg'} />
                                                            </audio>
                                                        </div>
                                                        {/* Pseudo Waveform (static bars for aesthetic) */}
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, paddingLeft: 8 }}>
                                                            {[3, 7, 5, 9, 4, 11, 6, 8, 5, 10, 4, 7, 3, 6, 9, 5].map((h, idx) => (
                                                                <div key={idx} style={{ width: 2, height: `${(h / 12) * 100}%`, background: mine ? 'rgba(255,255,255,0.4)' : '#8696a0', borderRadius: 1 }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Text */}
                                            {/* Text content or inline edit */}
                                            {editingMessageId === msg.id ? (
                                                <div style={{ padding: msg.mediaUrl ? '0 10px' : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editText}
                                                        onChange={e => setEditText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleEditMessage(msg.id, editText);
                                                            if (e.key === 'Escape') { setEditingMessageId(null); setEditText(''); }
                                                        }}
                                                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,168,132,0.5)', borderRadius: 8, color: '#fff', fontSize: 14, padding: '6px 10px', outline: 'none', minWidth: 0 }}
                                                    />
                                                    <button onClick={() => handleEditMessage(msg.id, editText)}
                                                        style={{ background: '#00a884', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                        <Send size={14} color="#fff" />
                                                    </button>
                                                    <button onClick={() => { setEditingMessageId(null); setEditText(''); }}
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                        <X size={14} color="#8696a0" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 14, lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', padding: msg.mediaUrl ? '0 10px' : 0, whiteSpace: 'pre-wrap' }}>{highlightMatch(msg.content)}</div>
                                            )}

                                            {/* Time + Status */}
                                            <div style={{
                                                fontSize: 10,
                                                color: 'rgba(255,255,255,0.5)',
                                                marginTop: 4,
                                                textAlign: 'right',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                gap: 4,
                                                padding: msg.mediaUrl ? '0 8px' : 0
                                            }}>
                                                {fmtTime(msg.createdAt)}
                                                {mine && <span style={{ color: msg.read ? '#53bdeb' : 'inherit', fontSize: 12 }}>✓✓</span>}
                                            </div>
                                        </div>

                                        {/* Reactions display */}
                                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                                                {Object.entries(msg.reactions as Record<string, string[]>).map(([emoji, userIds]) => {
                                                    const hasReacted = userIds.includes(currentUserId);
                                                    return (
                                                        <button
                                                            key={emoji}
                                                            onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg.id, emoji); }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                                padding: '2px 6px',
                                                                borderRadius: 10,
                                                                background: hasReacted ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                border: hasReacted ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                            }}
                                                        >
                                                            <span style={{ fontSize: 12 }}>{emoji}</span>
                                                            <span style={{ fontSize: 10, color: hasReacted ? 'var(--primary)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{userIds.length}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Dropdown action menu — opens upward to avoid bottom cutoff */}
                                        {activeMenu === msg.id && !isMultiSelecting && (
                                            <>
                                                <div onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                                                <div
                                                    onClick={e => e.stopPropagation()}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        [mine ? 'right' : 'left']: 0,
                                                        zIndex: 1000,
                                                        background: '#1f2c34',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: 12,
                                                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                                        padding: '8px 0',
                                                        width: 200,
                                                        animation: 'scaleIn 0.15s ease-out'
                                                    }}
                                                >
                                                    {/* Emoji reactions row */}
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-around',
                                                        padding: '4px 8px 8px',
                                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                                        marginBottom: 4
                                                    }}>
                                                        {['❤️', '🔥', '👍', '💪', '🙌', '💯'].map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => { handleToggleReaction(msg.id, emoji); setActiveMenu(null); }}
                                                                style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#e9edef', cursor: 'pointer' }}><Reply size={16} color="#8696a0" /> Reply</button>
                                                    {mine && msg.content && !msg.mediaUrl && (
                                                        <button onClick={() => { setEditingMessageId(msg.id); setEditText(msg.content); setActiveMenu(null); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#e9edef', cursor: 'pointer' }}><Pencil size={16} color="#8696a0" /> Edit</button>
                                                    )}
                                                    <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenu(null); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#e9edef', cursor: 'pointer' }}><Copy size={16} color="#8696a0" /> Copy</button>
                                                    <button onClick={() => { toggleSelection(msg.id); setActiveMenu(null); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#e9edef', cursor: 'pointer' }}><MoreVertical size={16} color="#8696a0" /> Select</button>
                                                    {msg.mediaUrl && <button onClick={() => { saveMedia(msg.mediaUrl!, msg.mediaType?.startsWith('image')); setActiveMenu(null); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#e9edef', cursor: 'pointer' }}><Download size={16} color="#8696a0" /> Save</button>}
                                                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                                                    <button onClick={() => handleDeleteMessage(msg.id)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}><X size={16} color="#ef4444" /> Delete</button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Action button — right side for other's messages */}
                                    {!mine && (
                                        <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                            title="Actions"><MoreVertical size={16} color="#ffffff" /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} style={{ height: 'calc(80px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, width: '100%' }} />
            </div>

            {/* Reply bar */}
            {
                replyingTo && (
                    <div style={{ padding: '8px 16px', background: 'var(--card-bg)', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <div style={{ flex: 1, paddingLeft: 10, borderLeft: '2px solid var(--primary)', minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Replying to {replyingTo.sender.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {replyingTo.mediaUrl ? (replyingTo.mediaType?.startsWith('image') ? 'Photo' : replyingTo.mediaType?.startsWith('audio') ? 'Voice' : 'Video') : replyingTo.content}
                            </div>
                        </div>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
                    </div>
                )
            }

            {/* Upload progress */}
            {
                uploading && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                            {isCompressing ? `${statusText} ${compressProgress}%` : statusText || 'Uploading…'}
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #7d87d2, #a855f7)', transition: 'width 200ms', width: isCompressing ? `${compressProgress}%` : '100%' }} />
                        </div>
                    </div>
                )
            }

            {/* Input */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '8px 12px',
                paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 4px))',
                background: 'rgba(15, 23, 42, 0.75)', // Glassmorphism background
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
                zIndex: 40
            }}>
                <input ref={fileRef} type="file" multiple accept="video/*,image/*" onChange={handleMedia} style={{ display: 'none' }} />
                {isCompressing && stagedFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', fontSize: 12, padding: 6, color: 'var(--secondary-foreground)' }}>Processing…</div>
                ) : isRecording ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '0 8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, flex: 1 }}>
                            {formatRecordingTime(recordingTime)}
                        </div>
                        <button onClick={cancelRecording} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', fontSize: 13, cursor: 'pointer', padding: '6px 12px' }}>
                            Cancel
                        </button>
                        <button onClick={stopRecording} style={{ background: 'var(--primary)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 16px', cursor: 'pointer' }}>
                            Done
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Plus button outside */}
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: 'transparent',
                                border: 'none',
                                color: '#8696a0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                            <Paperclip size={24} />
                        </button>

                        {/* Input Pill */}
                        <div style={{
                            flex: 1, display: 'flex', alignItems: 'center',
                            background: '#2a3942', // WhatsApp input background
                            borderRadius: 24,
                            padding: '4px 16px',
                            minHeight: 48,
                            boxShadow: '0 1px 1px rgba(0,0,0,0.2)'
                        }}>
                            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder="Type a message"
                                disabled={uploading}
                                style={{ flex: 1, padding: '8px 0', background: 'transparent', border: 'none', color: '#e9edef', fontSize: 16, outline: 'none', minWidth: 0, opacity: uploading ? 0.5 : 1 }} />
                        </div>

                        {/* Mic/Send circular button */}
                        {!newMessage.trim() && stagedFiles.length === 0 ? (
                            <button onClick={startRecording} disabled={uploading}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: '#00a884', // WhatsApp Green
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    color: '#fff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                }}>
                                <Mic size={24} />
                            </button>
                        ) : (
                            <button onClick={() => handleSend()} disabled={uploading}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: '#00a884',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    opacity: uploading ? 0.3 : 1,
                                    color: '#fff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                }}>
                                <Send size={24} />
                            </button>
                        )}
                    </div>
                )}
            </div>
            {/* Full Screen Media Staging Overlay (WhatsApp-style) */}
            {stagedFiles.length > 0 && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    background: '#0b141a',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    {/* Top Bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                        color: '#fff', background: '#1f2c34'
                    }}>
                        <button onClick={() => { setStagedFiles([]); setStagedFileUrls([]); setStagedPosters({}); setStagedPreviewIndex(0); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
                            <X size={26} />
                        </button>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') && (
                                <button
                                    onClick={() => setCropFile(stagedFiles[stagedPreviewIndex])}
                                    style={{
                                        background: 'rgba(0,168,132,0.2)', border: 'none', color: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                        borderRadius: 20
                                    }}
                                >
                                    <Scissors size={18} color="#00a884" />
                                    <span style={{ fontSize: 13, color: '#00a884', fontWeight: 600 }}>Trim</span>
                                </button>
                            )}
                            <div style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>HD</div>
                            <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', padding: 4 }}>
                                <Paperclip size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Main Preview Container */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 16 }}>
                        {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') ? (
                            <video
                                key={stagedFileUrls[stagedPreviewIndex]}
                                src={stagedFileUrls[stagedPreviewIndex]}
                                poster={stagedPosters[stagedPreviewIndex] || undefined}
                                controls
                                playsInline
                                webkit-playsinline="true"
                                preload="auto"
                                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                            />
                        ) : stagedFiles[stagedPreviewIndex]?.type.startsWith('audio/') ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}>
                                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Mic size={48} color="#fff" />
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Voice Message</span>
                                <audio controls src={stagedFileUrls[stagedPreviewIndex]} style={{ marginTop: 16 }} />
                            </div>
                        ) : (
                            <img
                                src={stagedFileUrls[stagedPreviewIndex]}
                                alt=""
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                            />
                        )}

                        {/* File info overlay */}
                        {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') && (
                            <div style={{
                                position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                                borderRadius: 16, padding: '6px 14px',
                                fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500
                            }}>
                                {(stagedFiles[stagedPreviewIndex].size / (1024 * 1024)).toFixed(1)} MB
                            </div>
                        )}
                    </div>

                    {/* Bottom Staging Area */}
                    <div style={{ background: '#111b21', padding: '12px 12px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
                        {/* Mini Thumbnails Row (only show if multiple files) */}
                        {stagedFiles.length > 1 && (
                            <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto', paddingLeft: 4 }}>
                                {stagedFileUrls.map((url, i) => (
                                    <div key={i} onClick={() => setStagedPreviewIndex(i)} style={{
                                        width: 54, height: 54, borderRadius: 8, overflow: 'hidden',
                                        border: i === stagedPreviewIndex ? '2px solid #00a884' : '2px solid transparent',
                                        cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'all 0.15s ease'
                                    }}>
                                        {stagedFiles[i]?.type.startsWith('video/') ? (
                                            stagedPosters[i] ? (
                                                <img src={stagedPosters[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                            ) : (
                                                <video src={url} muted playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                            )
                                        ) : stagedFiles[i]?.type.startsWith('audio/') ? (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a3942', opacity: i === stagedPreviewIndex ? 1 : 0.5 }}>
                                                <Mic size={18} color="#8696a0" />
                                            </div>
                                        ) : (
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); clearStagedMedia(i); if (stagedPreviewIndex >= stagedFiles.length - 1) setStagedPreviewIndex(Math.max(0, stagedFiles.length - 2)); }}
                                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#fff', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => fileRef.current?.click()} style={{ width: 54, height: 54, borderRadius: 8, border: '2px dashed rgba(134,150,160,0.4)', background: 'none', color: '#8696a0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                    <div style={{ fontSize: 26, fontWeight: 300 }}>+</div>
                                </button>
                            </div>
                        )}

                        {/* Caption Input and Send */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                flex: 1, background: '#2a3942', borderRadius: 24, padding: '4px 16px',
                                display: 'flex', alignItems: 'center', minHeight: 48,
                                boxShadow: '0 1px 1px rgba(0,0,0,0.2)'
                            }}>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder="Add a caption..."
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#e9edef', outline: 'none', fontSize: 16, padding: '8px 0' }}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                />
                            </div>
                            <button onClick={() => handleSend()} disabled={uploading}
                                style={{
                                    width: 52, height: 52, borderRadius: '50%', background: '#00a884',
                                    border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', opacity: uploading ? 0.3 : 1,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)', flexShrink: 0
                                }}>
                                <Send size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

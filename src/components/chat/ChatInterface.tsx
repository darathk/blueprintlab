'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Mic, Video as VideoIcon, Image as ImageIcon, MoreVertical, Reply, Copy, Download, Paperclip, X, Send } from 'lucide-react';
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
}

export default function ChatInterface({
    currentUserId, otherUserId, currentUserName, otherUserName, athleteId,
    initialMessages = [], isEmbedded = false, onBack
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
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Video Cropper state
    const [cropFile, setCropFile] = useState<File | null>(null);

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
    // Track if user has scrolled up — if so, don't auto-jump on polling updates
    const userScrolledUp = useRef(false);

    const scrollToBottom = useCallback((force = false) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (force || distFromBottom < 120) {
            el.scrollTop = el.scrollHeight;
            userScrolledUp.current = false;
        }
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

    // Force scroll to bottom on initial load
    useEffect(() => {
        if (loaded) {
            scrollToBottom(true);
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
                // Ensure no emojis in content
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
                    setCompressProgress(10);

                    if (!isVid) {
                        try {
                            const imageCompression = (await import('browser-image-compression')).default;
                            const c = await (imageCompression as any)(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: false });
                            blob = c; mime = c.type; setCompressProgress(40);
                        } catch { /* skip compression */ }
                    }

                    setCompressProgress(80);
                    const ext = mime.includes('png') ? '.png' : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : mime.includes('quicktime') ? '.mov' : mime.includes('webm') ? '.webm' : '.mp4';
                    const { data, error } = await supabase.storage.from('lift-videos').upload(`${athleteId}/${Date.now()}-${i}${ext}`, blob, { cacheControl: '604800', upsert: false, contentType: mime });

                    if (error) {
                        console.error('Upload failed:', error);
                        continue;
                    }

                    setCompressProgress(100);
                    const { data: u } = supabase.storage.from('lift-videos').getPublicUrl(data.path);

                    const isAudio = file.type.startsWith('audio/');
                    const content = i === 0 && text ? text : isAudio ? 'Voice Message' : (isVid ? 'Video' : 'Photo');
                    const replyToId = i === 0 ? (replyingTo?.id || null) : null;

                    const res = await fetch('/api/messages', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senderId: currentUserId, receiverId: otherUserId, content, mediaUrl: u.publicUrl, mediaType: mime, replyToId })
                    });

                    if (res.ok) {
                        const real = await res.json();
                        setMessages(prev => prev.map(m => m.id === tempId ? real : m));
                    }

                    URL.revokeObjectURL(urlsToSend[i]);
                }
            }
        } catch (e) { console.error('Send failed:', e); }
        finally {
            setSending(false);
            setUploading(false);
            setCompressProgress(-1);
            setStatusText('');
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

        // If there's a video, crop the first one (for simplicity, only crop 1 at a time if batch uploading multiple)
        const firstVideo = validFiles.find(f => f.type.startsWith('video/'));
        if (firstVideo && validFiles.length === 1) {
            setCropFile(firstVideo);
            if (fileRef.current) fileRef.current.value = '';
            return;
        }

        setStagedFiles(prev => [...prev, ...validFiles]);
        setStagedFileUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

        // Reset input so selecting the same file again triggers onChange
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleCropComplete = (croppedFile: File) => {
        setStagedFiles(prev => [...prev, croppedFile]);
        setStagedFileUrls(prev => [...prev, URL.createObjectURL(croppedFile)]);
        setCropFile(null);
    };

    const clearStagedMedia = (index?: number) => {
        if (index !== undefined) {
            URL.revokeObjectURL(stagedFileUrls[index]);
            setStagedFiles(prev => prev.filter((_, i) => i !== index));
            setStagedFileUrls(prev => prev.filter((_, i) => i !== index));
        } else {
            stagedFileUrls.forEach(url => URL.revokeObjectURL(url));
            setStagedFiles([]);
            setStagedFileUrls([]);
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
                        <button onClick={handleCopyMultiple} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}><Copy size={16} color="#fff" /> Copy</button>
                    </>
                ) : (
                    <>
                        {onBack ? (
                            <button onClick={onBack} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>← Back</button>
                        ) : (
                            <Link href={`/athlete/${athleteId}/dashboard`} style={{ color: 'var(--primary)', background: 'none', border: 'none', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>← Back</Link>
                        )}
                        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', fontSize: 15 }}>{otherUserName}</div>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #7d87d2, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13 }}>
                            {otherUserName.charAt(0).toUpperCase()}
                        </div>
                    </>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px', minHeight: 0, paddingTop: 'calc(var(--header-height) + 16px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', willChange: 'scroll-position', transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' as any, overscrollBehavior: 'contain' }}>
                {!loaded && <div style={{ textAlign: 'center', padding: 40, color: 'var(--secondary-foreground)' }}>Loading…</div>}
                {loaded && messages.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--secondary-foreground)', fontSize: 14 }}>No messages yet. Start the conversation!</div>}

                {messages.map((msg, i) => {
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
                                                padding: msg.mediaUrl ? '4px 4px 8px' : '8px 14px',
                                                borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                background: isSelected ? 'rgba(125,135,210,0.4)' : mine ? 'linear-gradient(135deg, rgba(125,135,210,0.9), rgba(168,85,247,0.7))' : 'rgba(30, 41, 59, 0.85)',
                                                // Removed backdropFilter from per-bubble: caused GPU repaint on every scroll frame
                                                border: isSelected ? '1px solid var(--primary)' : mine ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                                                boxShadow: mine ? '0 4px 12px rgba(125,135,210,0.2)' : '0 2px 8px rgba(0,0,0,0.2)',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                transition: 'background 0.15s ease',
                                            }}>
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
                                                <div>
                                                    <video controls playsInline muted preload="metadata" style={{ width: '100%', maxWidth: '100%', maxHeight: 200, borderRadius: 14, background: '#000', display: 'block', objectFit: 'cover' }}>
                                                        <source src={`${msg.mediaUrl}#t=0.001`} />
                                                    </video>
                                                </div>
                                            )}

                                            {/* Image */}
                                            {msg.mediaUrl && isImg && (
                                                <div>
                                                    <img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                        style={{ width: '100%', maxWidth: '100%', maxHeight: 200, borderRadius: 14, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
                                                </div>
                                            )}

                                            {/* Audio */}
                                            {msg.mediaUrl && isAudio && (
                                                <div style={{ padding: '4px 0' }}>
                                                    <audio
                                                        controls
                                                        preload="metadata"
                                                        playsInline
                                                        style={{ width: '100%', minWidth: 200, height: 40, borderRadius: 20 }}
                                                    >
                                                        <source src={msg.mediaUrl} type={msg.mediaType || 'audio/mpeg'} />
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                </div>
                                            )}

                                            {/* Text */}
                                            <div style={{ fontSize: 14, lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', padding: msg.mediaUrl ? '0 10px' : 0 }}>{msg.content}</div>

                                            {/* Time */}
                                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 2, textAlign: mine ? 'right' : 'left', padding: msg.mediaUrl ? '0 10px' : 0 }}>{fmtTime(msg.createdAt)}</div>
                                        </div>

                                        {/* Inline action menu */}
                                        {activeMenu === msg.id && !isMultiSelecting && (
                                            <div onClick={e => e.stopPropagation()} style={{
                                                position: 'absolute', zIndex: 50, top: 0, ...(mine ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
                                                background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.5)', padding: '3px 0', minWidth: 120, whiteSpace: 'nowrap'
                                            }}>
                                                <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 13, color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}><Reply size={16} color="#fff" /> Reply</button>
                                                <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenu(null); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 13, color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}><Copy size={16} color="#fff" /> Copy</button>
                                                <button onClick={() => { toggleSelection(msg.id); setActiveMenu(null); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 13, color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}><MoreVertical size={16} color="#fff" /> Select Multiple</button>
                                                {msg.mediaUrl && <button onClick={() => { saveMedia(msg.mediaUrl!, msg.mediaType?.startsWith('image')); setActiveMenu(null); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 13, color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}><Download size={16} color="#fff" /> Save</button>}
                                                <button onClick={() => handleDeleteMessage(msg.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 13, color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}><X size={16} color="#ef4444" /> Delete</button>
                                            </div>
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
                <div ref={messagesEndRef} />
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

            {/* Staged Media Preview */}
            {
                stagedFiles.length > 0 && (
                    <div style={{ padding: '8px 16px', background: 'var(--card-bg)', borderTop: '1px solid var(--card-border)', flexShrink: 0, display: 'flex', gap: 8, overflowX: 'auto' }}>
                        {stagedFiles.map((f, i) => (
                            <div key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid var(--card-border)', background: '#000', flexShrink: 0 }}>
                                {f.type.startsWith('image/') ? (
                                    <img src={stagedFileUrls[i]} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : f.type.startsWith('audio/') ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                                        <Mic size={24} />
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                                        <VideoIcon size={24} />
                                    </div>
                                )}
                                <button onClick={() => clearStagedMedia(i)} disabled={uploading} style={{
                                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}><X size={12} /></button>
                            </div>
                        ))}
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
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
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
                        <button onClick={stopRecording} style={{ background: 'linear-gradient(135deg, #7d87d2, #a855f7)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 16px', cursor: 'pointer' }}>
                            Done
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Paperclip size={16} />
                        </button>
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={(stagedFiles.length > 0 && !newMessage) ? "Add a caption..." : "Message"}
                            disabled={uploading}
                            style={{ flex: 1, padding: '8px 16px', borderRadius: 20, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)', color: 'var(--foreground)', fontSize: 14, outline: 'none', minWidth: 0, opacity: uploading ? 0.5 : 1 }} />

                        {!newMessage.trim() && stagedFiles.length === 0 ? (
                            <button onClick={startRecording} disabled={uploading}
                                style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--secondary-foreground)' }}>
                                <Mic size={16} />
                            </button>
                        ) : (
                            <button onClick={() => handleSend()} disabled={uploading}
                                style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #7d87d2, #a855f7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploading ? 0.3 : 1, color: '#fff' }}>
                                <Send size={15} style={{ marginLeft: 2 }} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

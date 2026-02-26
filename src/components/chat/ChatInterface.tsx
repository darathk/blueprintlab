'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    createdAt: string;
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
}

export default function ChatInterface({ currentUserId, otherUserId, currentUserName, otherUserName, athleteId }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [compressProgress, setCompressProgress] = useState(-1);
    const [statusText, setStatusText] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isCompressing = compressProgress >= 0 && compressProgress <= 100;

    // Initial fetch — once
    useEffect(() => {
        fetch(`/api/messages?athleteId=${athleteId}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => { setMessages(data); setLoaded(true); });
        // Mark as read
        fetch('/api/messages', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
        });
    }, [athleteId, currentUserId, otherUserId]);

    // Scroll to bottom after render
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) {
            setTimeout(() => {
                el.scrollTop = el.scrollHeight;
            }, 100);
        }
    }, [messages]);

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



    // Close action menu on click outside
    useEffect(() => { const c = () => setActiveMenu(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);

    // Send — optimistic
    const handleSend = async (mediaUrl?: string, mediaType?: string) => {
        const text = newMessage.trim();
        if (!text && !mediaUrl) return;
        const content = text || (mediaType?.startsWith('image') ? '📷 Photo' : '📎 Video');

        // Optimistic message
        const tempId = `temp-${Date.now()}`;
        const optimistic: Message = {
            id: tempId, senderId: currentUserId, receiverId: otherUserId, content,
            mediaUrl: mediaUrl || null, mediaType: mediaType || null,
            createdAt: new Date().toISOString(), read: false,
            replyToId: replyingTo?.id || null, replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, mediaUrl: replyingTo.mediaUrl, mediaType: replyingTo.mediaType, sender: replyingTo.sender } : null,
            sender: { id: currentUserId, name: currentUserName, email: '' },
            receiver: { id: otherUserId, name: otherUserName, email: '' },
        };
        setMessages(prev => [...prev, optimistic]);
        setNewMessage('');
        setReplyingTo(null);

        setSending(true);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: currentUserId, receiverId: otherUserId, content, mediaUrl, mediaType, replyToId: replyingTo?.id || null })
            });
            if (res.ok) {
                const real = await res.json();
                setMessages(prev => prev.map(m => m.id === tempId ? real : m));
            }
        } catch (e) { console.error('Send failed:', e); }
        finally { setSending(false); }
    };

    // Media upload
    const handleMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const isVid = file.type.startsWith('video/'), isImg = file.type.startsWith('image/');
        if (!isVid && !isImg) { alert('Upload a photo or video'); return; }
        if (file.size > 200 * 1024 * 1024) { alert('File must be under 200MB'); return; }

        setUploading(true); setCompressProgress(0);
        try {
            let blob: File | Blob = file, mime = file.type;
            if (isVid) {
                setStatusText('Compressing video…');
                try {
                    const { compressVideo } = await import('@/lib/videoCompressor');
                    const c = await compressVideo(file, p => setCompressProgress(p));
                    if (c) {
                        blob = new File([c], file.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' }); mime = 'video/mp4';
                    } else {
                        // Browser doesn't support MP4 compression — upload original
                        setStatusText('Uploading video…'); setCompressProgress(50);
                    }
                } catch (compErr) {
                    console.warn('Video compression failed, uploading original:', compErr);
                    setCompressProgress(50);
                }
            } else {
                setStatusText('Compressing photo…'); setCompressProgress(40);
                try {
                    const imageCompression = (await import('browser-image-compression')).default;
                    const c = await (imageCompression as any)(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false });
                    blob = c; mime = c.type; setCompressProgress(80);
                } catch { /* skip compression if it fails */ }
            }
            setCompressProgress(101); setStatusText('Uploading…');
            const ext = mime.includes('png') ? '.png' : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : '.mp4';
            const { data, error } = await supabase.storage.from('lift-videos').upload(`${athleteId}/${Date.now()}${ext}`, blob, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            const { data: u } = supabase.storage.from('lift-videos').getPublicUrl(data.path);
            await handleSend(u.publicUrl, mime);
        } catch (err) { console.error('Upload failed:', err); alert('Upload failed.'); }
        finally { setUploading(false); setCompressProgress(-1); setStatusText(''); if (fileRef.current) fileRef.current.value = ''; }
    };

    const saveMedia = async (url: string, isImg?: boolean) => {
        try {
            const r = await fetch(url); const b = await r.blob(); const a = document.createElement('a');
            const ext = isImg ? '.jpg' : url.includes('.webm') ? '.webm' : '.mp4';
            a.href = URL.createObjectURL(b); a.download = `lift_${Date.now()}${ext}`; a.click(); URL.revokeObjectURL(a.href);
        } catch { window.open(url, '_blank'); }
    };

    const fmtTime = (s: string) => {
        const d = new Date(s), n = new Date();
        return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const fmtDate = (s: string) => {
        const d = new Date(s), n = new Date(), y = new Date(n); y.setDate(y.getDate() - 1);
        return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday'
            : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };

    const showDateSep = (i: number) => i === 0 || new Date(messages[i].createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();
    const showTime = (i: number) => i === 0 || messages[i].senderId !== messages[i - 1].senderId ||
        new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 300000;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button onClick={() => window.history.back()} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>← Back</button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: 'var(--foreground)', fontSize: 15 }}>{otherUserName}</div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 13 }}>
                    {otherUserName.charAt(0).toUpperCase()}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px' }}>
                {!loaded && <div style={{ textAlign: 'center', padding: 40, color: 'var(--secondary-foreground)' }}>Loading…</div>}
                {loaded && messages.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--secondary-foreground)', fontSize: 14 }}>No messages yet. Start the conversation!</div>}

                {messages.map((msg, i) => {
                    const mine = msg.senderId === currentUserId;
                    const isVid = msg.mediaType?.startsWith('video');
                    const isImg = msg.mediaType?.startsWith('image');
                    const dateSep = showDateSep(i);
                    const timeSep = showTime(i);

                    return (
                        <div key={msg.id}>
                            {dateSep && <div style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{fmtDate(msg.createdAt)}</div>}
                            {timeSep && !dateSep && <div style={{ textAlign: 'center', margin: '10px 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{fmtTime(msg.createdAt)}</div>}

                            <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: timeSep && i > 0 ? 8 : 2, gap: 4, position: 'relative' }}>

                                {/* Action button — left side for own messages */}
                                {mine && (
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.2)', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                                        title="Actions">⋮</button>
                                )}

                                <div style={{ position: 'relative', maxWidth: '75%' }}>
                                    <div style={{
                                        padding: msg.mediaUrl ? '4px 4px 8px' : '8px 14px',
                                        borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                        background: mine ? 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(16,185,129,0.2))' : 'var(--card-bg)',
                                        border: mine ? '1px solid rgba(6,182,212,0.12)' : '1px solid var(--card-border)',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'break-word',
                                    }}>
                                        {/* Reply */}
                                        {msg.replyTo && (
                                            <div style={{ margin: msg.mediaUrl ? '4px 8px 6px' : '0 0 6px', padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(6,182,212,0.5)', fontSize: 11 }}>
                                                <div style={{ fontWeight: 600, color: 'rgba(6,182,212,0.7)', marginBottom: 2 }}>{msg.replyTo.sender.name}</div>
                                                <div style={{ color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {msg.replyTo.mediaUrl ? (msg.replyTo.mediaType?.startsWith('image') ? '📷 Photo' : '📹 Video') : msg.replyTo.content}
                                                </div>
                                            </div>
                                        )}

                                        {/* Video */}
                                        {msg.mediaUrl && isVid && (
                                            <div>
                                                <video controls playsInline muted preload="metadata" style={{ width: '100%', maxWidth: 280, borderRadius: 14, background: '#000', display: 'block' }}>
                                                    <source src={msg.mediaUrl} type={msg.mediaType || 'video/mp4'} />
                                                </video>
                                            </div>
                                        )}

                                        {/* Image */}
                                        {msg.mediaUrl && isImg && (
                                            <div>
                                                <img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                    style={{ width: '100%', maxWidth: 280, borderRadius: 14, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
                                            </div>
                                        )}

                                        {/* Text */}
                                        <div style={{ fontSize: 14, lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', padding: msg.mediaUrl ? '0 10px' : 0 }}>{msg.content}</div>

                                        {/* Time */}
                                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 2, textAlign: mine ? 'right' : 'left', padding: msg.mediaUrl ? '0 10px' : 0 }}>{fmtTime(msg.createdAt)}</div>
                                    </div>

                                    {/* Inline action menu */}
                                    {activeMenu === msg.id && (
                                        <div onClick={e => e.stopPropagation()} style={{
                                            position: 'absolute', zIndex: 50, top: 0, ...(mine ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
                                            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.5)', padding: '3px 0', minWidth: 120, whiteSpace: 'nowrap'
                                        }}>
                                            <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 12, color: 'var(--foreground)', cursor: 'pointer' }}>↩️ Reply</button>
                                            <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenu(null); }}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 12, color: 'var(--foreground)', cursor: 'pointer' }}>📋 Copy</button>
                                            {msg.mediaUrl && <button onClick={() => { saveMedia(msg.mediaUrl!, msg.mediaType?.startsWith('image')); setActiveMenu(null); }}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', fontSize: 12, color: 'var(--foreground)', cursor: 'pointer' }}>💾 Save</button>}
                                        </div>
                                    )}
                                </div>

                                {/* Action button — right side for other's messages */}
                                {!mine && (
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.2)', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                                        title="Actions">⋮</button>
                                )}
                            </div>
                        </div>
                    );
                })}

            </div>



            {/* Reply bar */}
            {replyingTo && (
                <div style={{ padding: '8px 16px', background: 'var(--card-bg)', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, paddingLeft: 10, borderLeft: '2px solid var(--primary)', minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Replying to {replyingTo.sender.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {replyingTo.mediaUrl ? (replyingTo.mediaType?.startsWith('image') ? '📷 Photo' : '📹 Video') : replyingTo.content}
                        </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
            )}

            {/* Upload progress */}
            {uploading && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                        {isCompressing ? `${statusText} ${compressProgress}%` : statusText || 'Uploading…'}
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #06b6d4, #10b981)', transition: 'width 200ms', width: isCompressing ? `${compressProgress}%` : '100%' }} />
                    </div>
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '8px 12px 12px', background: 'var(--card-bg)', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
                <input ref={fileRef} type="file" accept="video/*,image/*" onChange={handleMedia} style={{ display: 'none' }} />
                {isCompressing ? (
                    <div style={{ textAlign: 'center', fontSize: 12, padding: 6, color: 'var(--secondary-foreground)' }}>Processing…</div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            📎
                        </button>
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder="Message"
                            style={{ flex: 1, padding: '8px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--foreground)', fontSize: 14, outline: 'none', minWidth: 0 }} />
                        <button onClick={() => handleSend()} disabled={sending || !newMessage.trim()}
                            style={{ width: 34, height: 34, borderRadius: '50%', background: newMessage.trim() ? 'linear-gradient(135deg, #06b6d4, #10b981)' : 'rgba(255,255,255,0.05)', border: 'none', cursor: newMessage.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: newMessage.trim() ? 1 : 0.4, color: newMessage.trim() ? '#000' : 'var(--secondary-foreground)', fontSize: 16, fontWeight: 700 }}>
                            →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

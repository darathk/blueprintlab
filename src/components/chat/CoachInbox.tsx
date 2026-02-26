'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
    id: string; senderId: string; receiverId: string; content: string;
    mediaUrl?: string | null; mediaType?: string | null; createdAt: string; read: boolean;
    replyToId?: string | null;
    replyTo?: { id: string; content: string; mediaUrl?: string | null; mediaType?: string | null; sender: { name: string } } | null;
    sender: { id: string; name: string; email: string }; receiver: { id: string; name: string; email: string };
}

interface ConvSummary { athleteId: string; athleteName: string; lastMessage: string; lastMessageAt: string; unreadCount: number; }

interface Props { coachId: string; coachName: string; }

export default function CoachInbox({ coachId, coachName }: Props) {
    const [convos, setConvos] = useState<ConvSummary[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [msgLoading, setMsgLoading] = useState(false);
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [compressProgress, setCompressProgress] = useState(-1);
    const [statusText, setStatusText] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isCompressing = compressProgress >= 0 && compressProgress <= 100;
    const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);
    const selectedConvo = convos.find(c => c.athleteId === selectedId);

    // Fetch lightweight conversation list
    const fetchConvos = useCallback(async () => {
        const r = await fetch(`/api/messages/inbox?coachId=${coachId}`);
        if (r.ok) setConvos(await r.json());
    }, [coachId]);

    // Fetch messages for selected conversation
    const fetchMessages = useCallback(async (athleteId: string) => {
        setMsgLoading(true);
        const r = await fetch(`/api/messages?athleteId=${athleteId}`);
        if (r.ok) setMessages(await r.json());
        setMsgLoading(false);
        // Mark as read
        fetch('/api/messages', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ athleteId, readerId: coachId })
        }).then(() => fetchConvos());
    }, [coachId, fetchConvos]);

    useEffect(() => { fetchConvos(); }, [fetchConvos]);

    // When selecting a conversation, load its messages
    useEffect(() => { if (selectedId) { setMessages([]); fetchMessages(selectedId); } }, [selectedId, fetchMessages]);

    // Scroll to bottom after render
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) {
            setTimeout(() => {
                el.scrollTop = el.scrollHeight;
            }, 100);
        }
    }, [messages]);

    // Realtime — only refetch if relevant
    useEffect(() => {
        const ch = supabase.channel('coach-inbox-rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: `receiverId=eq.${coachId}` },
                () => { fetchConvos(); if (selectedId) fetchMessages(selectedId); })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [coachId, selectedId, fetchConvos, fetchMessages]);

    // Optimized Polling Fallback (Runs safely if Supabase keys are missing)
    useEffect(() => {
        const poll = setInterval(() => {
            fetchConvos();
            if (selectedId) {
                fetch(`/api/messages?athleteId=${selectedId}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && Array.isArray(data)) {
                            setMessages(prev => {
                                // Only trigger expensive render and PATCH if new messages arrived
                                if (prev.length !== data.length || prev[prev.length - 1]?.id !== data[data.length - 1]?.id) {
                                    const hasUnread = data.some((m: any) => m.receiverId === coachId && !m.read);
                                    if (hasUnread) {
                                        fetch('/api/messages', {
                                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ athleteId: selectedId, readerId: coachId })
                                        });
                                    }
                                    return data;
                                }
                                return prev;
                            });
                        }
                    });
            }
        }, 3000);
        return () => clearInterval(poll);
    }, [coachId, selectedId, fetchConvos]);



    useEffect(() => { const c = () => setActiveMenu(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);

    // Optimistic send
    const handleSend = async (mediaUrl?: string, mediaType?: string) => {
        const text = newMsg.trim();
        if (!text && !mediaUrl) return;
        if (!selectedId) return;
        const content = text || (mediaType?.startsWith('image') ? '📷 Photo' : '📎 Video');

        const tempId = `temp-${Date.now()}`;
        const opt: Message = {
            id: tempId, senderId: coachId, receiverId: selectedId, content,
            mediaUrl: mediaUrl || null, mediaType: mediaType || null,
            createdAt: new Date().toISOString(), read: false, replyToId: replyingTo?.id || null,
            replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, mediaUrl: replyingTo.mediaUrl, mediaType: replyingTo.mediaType, sender: replyingTo.sender } : null,
            sender: { id: coachId, name: coachName, email: '' }, receiver: { id: selectedId, name: selectedConvo?.athleteName || '', email: '' },
        };
        setMessages(prev => [...prev, opt]);
        setNewMsg(''); setReplyingTo(null);

        setSending(true);
        try {
            const r = await fetch('/api/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: coachId, receiverId: selectedId, content, mediaUrl, mediaType, replyToId: replyingTo?.id || null })
            });
            if (r.ok) { const real = await r.json(); setMessages(prev => prev.map(m => m.id === tempId ? real : m)); fetchConvos(); }
        } catch (e) { console.error('Send failed:', e); } finally { setSending(false); }
    };

    const handleMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const isVid = file.type.startsWith('video/'), isImg = file.type.startsWith('image/');
        if (!isVid && !isImg) { alert('Upload a photo or video'); return; }
        if (file.size > 200 * 1024 * 1024) { alert('File must be under 200MB'); return; }
        setUploading(true); setCompressProgress(0);
        try {
            let blob: File | Blob = file, mime = file.type;
            if (isVid) {
                setStatusText('Uploading video…');
                setCompressProgress(50);
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
            const { data, error } = await supabase.storage.from('lift-videos').upload(`${selectedId}/${Date.now()}${ext}`, blob, { cacheControl: '3600', upsert: false });
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
        <div className="glass-panel" style={{ display: 'flex', height: 580, overflow: 'hidden', borderRadius: 12 }}>
            {/* Sidebar */}
            <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', background: 'rgba(15,23,42,0.3)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Messages</span>
                    {totalUnread > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px', minWidth: 18, textAlign: 'center' as const }}>{totalUnread}</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {convos.length === 0 && <div style={{ textAlign: 'center', padding: 32, fontSize: 12, color: 'var(--secondary-foreground)' }}>No conversations</div>}
                    {convos.map(c => (
                        <button key={c.athleteId} onClick={() => setSelectedId(c.athleteId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                                background: selectedId === c.athleteId ? 'rgba(6,182,212,0.08)' : 'transparent',
                                borderLeft: selectedId === c.athleteId ? '2px solid var(--primary)' : '2px solid transparent',
                            }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 12 }}>
                                    {c.athleteName.charAt(0).toUpperCase()}
                                </div>
                                {c.unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unreadCount}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: c.unreadCount > 0 ? 700 : 400, color: c.unreadCount > 0 ? 'var(--foreground)' : 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.athleteName}</span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginLeft: 6 }}>{fmtTime(c.lastMessageAt)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: c.unreadCount > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 1 }}>{c.lastMessage}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {!selectedConvo ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--secondary-foreground)' }}>
                        <span style={{ fontSize: 40 }}>💬</span>
                        <span style={{ fontSize: 13 }}>Select a conversation</span>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 11, flexShrink: 0 }}>
                                {selectedConvo.athleteName.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>{selectedConvo.athleteName}</span>
                        </div>

                        {/* Messages */}
                        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 14px' }}>
                            {msgLoading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--secondary-foreground)', fontSize: 13 }}>Loading…</div>}

                            {!msgLoading && messages.map((msg, i) => {
                                const mine = msg.senderId === coachId;
                                const isVid = msg.mediaType?.startsWith('video');
                                const isImg = msg.mediaType?.startsWith('image');
                                const dateSep = showDateSep(i);
                                const timeSep = showTime(i);

                                return (
                                    <div key={msg.id}>
                                        {dateSep && <div style={{ textAlign: 'center', margin: '12px 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{fmtDate(msg.createdAt)}</div>}
                                        {timeSep && !dateSep && <div style={{ textAlign: 'center', margin: '8px 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{fmtTime(msg.createdAt)}</div>}

                                        <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: timeSep && i > 0 ? 6 : 2, gap: 4, position: 'relative' }}>

                                            {mine && (
                                                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.2)', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                                                    title="Actions">⋮</button>
                                            )}

                                            <div style={{ position: 'relative', maxWidth: '75%' }}>
                                                <div style={{
                                                    padding: msg.mediaUrl ? '4px 4px 6px' : '7px 12px',
                                                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                                    background: mine ? 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(16,185,129,0.2))' : 'var(--card-bg)',
                                                    border: mine ? '1px solid rgba(6,182,212,0.12)' : '1px solid var(--card-border)',
                                                    wordBreak: 'break-word', overflowWrap: 'break-word',
                                                }}>
                                                    {msg.replyTo && (
                                                        <div style={{ margin: msg.mediaUrl ? '3px 6px 4px' : '0 0 4px', padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(6,182,212,0.5)', fontSize: 10 }}>
                                                            <div style={{ fontWeight: 600, color: 'rgba(6,182,212,0.7)' }}>{msg.replyTo.sender.name}</div>
                                                            <div style={{ color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.replyTo.content}</div>
                                                        </div>
                                                    )}
                                                    {msg.mediaUrl && isVid && (
                                                        <div><video controls playsInline muted preload="metadata" style={{ width: '100%', maxWidth: 260, borderRadius: 12, background: '#000', display: 'block' }}>
                                                            <source src={msg.mediaUrl} type={msg.mediaType || 'video/mp4'} /></video></div>
                                                    )}
                                                    {msg.mediaUrl && isImg && (
                                                        <div><img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                            style={{ width: '100%', maxWidth: 260, borderRadius: 12, display: 'block', cursor: 'pointer', objectFit: 'cover' }} /></div>
                                                    )}
                                                    <div style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', padding: msg.mediaUrl ? '0 8px' : 0 }}>{msg.content}</div>
                                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 1, textAlign: mine ? 'right' : 'left', padding: msg.mediaUrl ? '0 8px' : 0 }}>{fmtTime(msg.createdAt)}</div>
                                                </div>

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

                        {/* Reply */}
                        {replyingTo && (
                            <div style={{ padding: '6px 14px', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                <div style={{ flex: 1, paddingLeft: 8, borderLeft: '2px solid var(--primary)', minWidth: 0 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)' }}>Replying to {replyingTo.sender.name}</div>
                                    <div style={{ fontSize: 10, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyingTo.content}</div>
                                </div>
                                <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                            </div>
                        )}

                        {/* Progress */}
                        {uploading && (
                            <div style={{ padding: '6px 14px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 3 }}>{isCompressing ? `${statusText} ${compressProgress}%` : statusText || 'Uploading…'}</div>
                                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #06b6d4, #10b981)', transition: 'width 200ms', width: isCompressing ? `${compressProgress}%` : '100%' }} />
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
                            <input ref={fileRef} type="file" accept="video/*,image/*" onChange={handleMedia} style={{ display: 'none' }} />
                            {isCompressing ? (
                                <div style={{ textAlign: 'center', fontSize: 11, padding: 4, color: 'var(--secondary-foreground)' }}>Processing…</div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                        style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--secondary-foreground)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        📎
                                    </button>
                                    <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                        placeholder="Message"
                                        style={{ flex: 1, padding: '6px 14px', borderRadius: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--foreground)', fontSize: 13, outline: 'none', minWidth: 0 }} />
                                    <button onClick={() => handleSend()} disabled={sending || !newMsg.trim()}
                                        style={{ width: 30, height: 30, borderRadius: '50%', background: newMsg.trim() ? 'linear-gradient(135deg, #06b6d4, #10b981)' : 'rgba(255,255,255,0.05)', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: newMsg.trim() ? 1 : 0.4, color: newMsg.trim() ? '#000' : 'var(--secondary-foreground)', fontSize: 14, fontWeight: 700 }}>
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )
                }
            </div>
        </div>
    );
}

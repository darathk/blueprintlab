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
        if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }, [messages.length]);

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

    // Polling fallback — check for new messages every 3s
    useEffect(() => {
        const poll = setInterval(() => {
            fetch(`/api/messages?athleteId=${athleteId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data) {
                        setMessages(data);
                        fetch('/api/messages', {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
                        });
                    }
                });
        }, 3000);
        return () => clearInterval(poll);
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
    <div className="flex flex-col h-[100dvh] bg-slate-50">
        {/* Header */}
        <div className="flex items-center gap-3 shrink-0 p-3 bg-white border-b border-slate-200">
            <button onClick={() => window.history.back()} className="text-blue-600 bg-transparent border-none cursor-pointer text-sm font-medium">← Back</button>
            <div className="flex-1 text-center font-semibold text-slate-900 text-base">{otherUserName}</div>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                {otherUserName.charAt(0).toUpperCase()}
            </div>
        </div>

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 bg-slate-50">
            {!loaded && <div className="text-center p-10 text-slate-500">Loading…</div>}
            {loaded && messages.length === 0 && <div className="text-center p-16 text-slate-500 text-sm">No messages yet. Start the conversation!</div>}

            {messages.map((msg, i) => {
                const mine = msg.senderId === currentUserId;
                const isVid = msg.mediaType?.startsWith('video');
                const isImg = msg.mediaType?.startsWith('image');
                const dateSep = showDateSep(i);
                const timeSep = showTime(i);

                return (
                    <div key={msg.id}>
                        {dateSep && <div className="text-center my-4 text-xs text-slate-400 font-medium">{fmtDate(msg.createdAt)}</div>}
                        {timeSep && !dateSep && <div className="text-center my-2 text-[10px] text-slate-400">{fmtTime(msg.createdAt)}</div>}

                        <div className={`flex items-center gap-1 relative ${mine ? 'justify-end' : 'justify-start'} ${timeSep && i > 0 ? 'mt-2' : 'mt-0.5'}`}>

                            {/* Action button — left side for own messages */}
                            {mine && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                    className="bg-transparent border-none cursor-pointer text-sm text-slate-400 px-1 shrink-0 leading-none"
                                    title="Actions">⋮</button>
                            )}

                            <div className="relative max-w-[75%]">
                                <div className={`
                                        ${msg.mediaUrl ? 'p-1 pb-2' : 'py-2 px-3'}
                                        ${mine ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm bg-blue-600 text-white' : 'rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-2xl bg-white text-slate-900 border border-slate-200 shadow-sm'}
                                        break-words
                                    `}>
                                    {/* Reply */}
                                    {msg.replyTo && (
                                        <div className={`mb-1.5 p-1.5 rounded-md border-l-2 text-[11px] ${mine ? 'bg-blue-700/50 border-blue-300' : 'bg-slate-100 border-blue-500'}`}>
                                            <div className={`font-semibold mb-0.5 ${mine ? 'text-blue-100' : 'text-blue-600'}`}>{msg.replyTo.sender.name}</div>
                                            <div className={`overflow-hidden text-ellipsis whitespace-nowrap ${mine ? 'text-blue-100/80' : 'text-slate-500'}`}>
                                                {msg.replyTo.mediaUrl ? (msg.replyTo.mediaType?.startsWith('image') ? '📷 Photo' : '📹 Video') : msg.replyTo.content}
                                            </div>
                                        </div>
                                    )}

                                    {/* Video */}
                                    {msg.mediaUrl && isVid && (
                                        <div>
                                            <video controls playsInline muted preload="metadata" className="w-full max-w-[280px] rounded-xl bg-black block">
                                                <source src={msg.mediaUrl} type={msg.mediaType || 'video/mp4'} />
                                            </video>
                                        </div>
                                    )}

                                    {/* Image */}
                                    {msg.mediaUrl && isImg && (
                                        <div>
                                            <img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                className="w-full max-w-[280px] rounded-xl block cursor-pointer object-cover" />
                                        </div>
                                    )}

                                    {/* Text */}
                                    <div className={`text-sm leading-relaxed ${msg.mediaUrl ? 'px-2.5' : 'px-0'} ${mine ? 'text-white' : 'text-slate-900'}`}>{msg.content}</div>

                                    {/* Time */}
                                    <div className={`text-[9px] mt-0.5 ${mine ? 'text-blue-200 text-right' : 'text-slate-400 text-left'} ${msg.mediaUrl ? 'px-2.5' : 'px-0'}`}>{fmtTime(msg.createdAt)}</div>
                                </div>

                                {/* Inline action menu */}
                                {activeMenu === msg.id && (
                                    <div onClick={e => e.stopPropagation()} className={`absolute z-50 top-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px] whitespace-nowrap ${mine ? 'right-full mr-1' : 'left-full ml-1'}`}>
                                        <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }}
                                            className="block w-full text-left px-3 py-1.5 bg-transparent border-none text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">↩️ Reply</button>
                                        <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenu(null); }}
                                            className="block w-full text-left px-3 py-1.5 bg-transparent border-none text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">📋 Copy</button>
                                        {msg.mediaUrl && <button onClick={() => { saveMedia(msg.mediaUrl!, msg.mediaType?.startsWith('image')); setActiveMenu(null); }}
                                            className="block w-full text-left px-3 py-1.5 bg-transparent border-none text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">💾 Save</button>}
                                    </div>
                                )}
                            </div>

                            {/* Action button — right side for other's messages */}
                            {!mine && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                    className="bg-transparent border-none cursor-pointer text-sm text-slate-400 px-1 shrink-0 leading-none"
                                    title="Actions">⋮</button>
                            )}
                        </div>
                    </div>
                );
            })}

        </div>



        {/* Reply bar */}
        {replyingTo && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-3 shrink-0">
                <div className="flex-1 pl-2.5 border-l-2 border-blue-600 min-w-0">
                    <div className="text-[11px] font-semibold text-blue-600">Replying to {replyingTo.sender.name}</div>
                    <div className="text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {replyingTo.mediaUrl ? (replyingTo.mediaType?.startsWith('image') ? '📷 Photo' : '📹 Video') : replyingTo.content}
                    </div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="bg-transparent border-none text-slate-500 hover:text-slate-700 cursor-pointer text-base">✕</button>
            </div>
        )}

        {/* Upload progress */}
        {uploading && (
            <div className="px-4 py-2 border-t border-slate-200 shrink-0 bg-slate-50">
                <div className="text-xs text-blue-600 font-semibold mb-1">
                    {isCompressing ? `${statusText} ${compressProgress}%` : statusText || 'Uploading…'}
                </div>
                <div className="h-1 rounded-sm bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-sm bg-blue-600 transition-all duration-200" style={{ width: isCompressing ? `${compressProgress}%` : '100%' }} />
                </div>
            </div>
        )}

        {/* Input */}
        <div className="px-3 pt-2 pb-3 bg-white border-t border-slate-200 shrink-0">
            <input ref={fileRef} type="file" accept="video/*,image/*" onChange={handleMedia} className="hidden" />
            {isCompressing ? (
                <div className="text-center text-xs p-1.5 text-slate-500">Processing…</div>
            ) : (
                <div className="flex items-center gap-2">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 cursor-pointer text-base flex items-center justify-center shrink-0 transition-colors">
                        📎
                    </button>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Message"
                        className="flex-1 px-4 py-2 rounded-full bg-slate-100 border border-slate-300 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-0 transition-all" />
                    <button onClick={() => handleSend()} disabled={sending || !newMessage.trim()}
                        className={`w-9 h-9 rounded-full border-none flex items-center justify-center shrink-0 text-base font-bold transition-all ${newMessage.trim() ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-default'}`}>
                        →
                    </button>
                </div>
            )}
        </div>
    </div>
);
}

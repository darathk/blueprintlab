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
        if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }, [messages.length]);

    // Realtime — only refetch if relevant
    useEffect(() => {
        const ch = supabase.channel('coach-inbox-rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: `receiverId=eq.${coachId}` },
                () => { fetchConvos(); if (selectedId) fetchMessages(selectedId); })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [coachId, selectedId, fetchConvos, fetchMessages]);

    // Polling fallback — check for new messages every 3s
    useEffect(() => {
        const poll = setInterval(() => {
            fetchConvos();
            if (selectedId) {
                fetch(`/api/messages?athleteId=${selectedId}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data) {
                            setMessages(data);
                            fetch('/api/messages', {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ athleteId: selectedId, readerId: coachId })
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
                setStatusText('Compressing video…');
                try {
                    const { compressVideo } = await import('@/lib/videoCompressor');
                    const c = await compressVideo(file, p => setCompressProgress(p));
                    if (c) {
                        blob = new File([c], file.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' }); mime = 'video/mp4';
                    } else {
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
    <div className="flex h-[580px] overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
        {/* Sidebar */}
        <div className="w-[260px] shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-100/50">
                <span className="font-semibold text-sm text-slate-900">Messages</span>
                {totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">{totalUnread}</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
                {convos.length === 0 && <div className="text-center p-8 text-xs text-slate-500">No conversations</div>}
                {convos.map(c => (
                    <button key={c.athleteId} onClick={() => setSelectedId(c.athleteId)}
                        className={`flex items-center gap-2.5 w-full py-2.5 px-3 border-none cursor-pointer text-left transition-colors ${selectedId === c.athleteId ? 'bg-blue-50/50 border-l-2 border-l-blue-600' : 'bg-transparent border-l-2 border-l-transparent hover:bg-slate-100/50'}`}>
                        <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                                {c.athleteName.charAt(0).toUpperCase()}
                            </div>
                            {c.unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">{c.unreadCount}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <span className={`text-[13px] overflow-hidden text-ellipsis whitespace-nowrap ${c.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{c.athleteName}</span>
                                <span className="text-[10px] text-slate-400 shrink-0 ml-1.5">{fmtTime(c.lastMessageAt)}</span>
                            </div>
                            <div className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap mt-0.5 ${c.unreadCount > 0 ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>{c.lastMessage}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
            {!selectedConvo ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50">
                    <span className="text-4xl text-slate-300">💬</span>
                    <span className="text-[13px] text-slate-500 font-medium">Select a conversation</span>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2.5 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                            {selectedConvo.athleteName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-sm text-slate-900">{selectedConvo.athleteName}</span>
                    </div>

                    {/* Messages */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 bg-slate-50">
                        {msgLoading && <div className="text-center p-8 text-slate-500 text-[13px]">Loading…</div>}

                        {!msgLoading && messages.map((msg, i) => {
                            const mine = msg.senderId === coachId;
                            const isVid = msg.mediaType?.startsWith('video');
                            const isImg = msg.mediaType?.startsWith('image');
                            const dateSep = showDateSep(i);
                            const timeSep = showTime(i);

                            return (
                                <div key={msg.id}>
                                    {dateSep && <div className="text-center my-3 text-[10px] text-slate-400 font-medium">{fmtDate(msg.createdAt)}</div>}
                                    {timeSep && !dateSep && <div className="text-center my-2 text-[10px] text-slate-400">{fmtTime(msg.createdAt)}</div>}

                                    <div className={`flex items-center gap-1 relative ${mine ? 'justify-end' : 'justify-start'} ${timeSep && i > 0 ? 'mt-1.5' : 'mt-0.5'}`}>

                                        {mine && (
                                            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                                className="bg-transparent border-none cursor-pointer text-sm text-slate-400 hover:text-slate-600 px-1 shrink-0 leading-none"
                                                title="Actions">⋮</button>
                                        )}

                                        <div className="relative max-w-[75%]">
                                            <div className={`
                                                    ${msg.mediaUrl ? 'p-1 pb-1.5' : 'py-1.5 px-3'}
                                                    ${mine ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm bg-blue-600 text-white shadow-sm' : 'rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-2xl bg-white text-slate-900 border border-slate-200 shadow-sm'}
                                                    break-words
                                                `}>
                                                {msg.replyTo && (
                                                    <div className={`mb-1 p-1.5 rounded-md border-l-2 text-[10px] ${mine ? 'bg-blue-700/50 border-blue-300' : 'bg-slate-100 border-blue-500'}`}>
                                                        <div className={`font-semibold ${mine ? 'text-blue-100' : 'text-blue-600'}`}>{msg.replyTo.sender.name}</div>
                                                        <div className={`overflow-hidden text-ellipsis whitespace-nowrap ${mine ? 'text-blue-100/80' : 'text-slate-500'}`}>{msg.replyTo.content}</div>
                                                    </div>
                                                )}
                                                {msg.mediaUrl && isVid && (
                                                    <div><video controls playsInline muted preload="metadata" className="w-full max-w-[260px] rounded-xl bg-black block">
                                                        <source src={msg.mediaUrl} type={msg.mediaType || 'video/mp4'} /></video></div>
                                                )}
                                                {msg.mediaUrl && isImg && (
                                                    <div><img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                        className="w-full max-w-[260px] rounded-xl block cursor-pointer object-cover bg-slate-100" /></div>
                                                )}
                                                <div className={`text-[13px] leading-relaxed ${msg.mediaUrl ? 'px-2' : 'px-0'} ${mine ? 'text-white' : 'text-slate-900'}`}>{msg.content}</div>
                                                <div className={`text-[9px] mt-0.5 ${mine ? 'text-blue-200 text-right' : 'text-slate-400 text-left'} ${msg.mediaUrl ? 'px-2' : 'px-0'}`}>{fmtTime(msg.createdAt)}</div>
                                            </div>

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

                                        {!mine && (
                                            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                                className="bg-transparent border-none cursor-pointer text-sm text-slate-400 hover:text-slate-600 px-1 shrink-0 leading-none"
                                                title="Actions">⋮</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Reply */}
                    {replyingTo && (
                        <div className="px-3.5 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5 shrink-0">
                            <div className="flex-1 pl-2 border-l-2 border-blue-600 min-w-0">
                                <div className="text-[10px] font-semibold text-blue-600">Replying to {replyingTo.sender.name}</div>
                                <div className="text-[10px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{replyingTo.content}</div>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="bg-transparent border-none text-slate-400 hover:text-slate-700 cursor-pointer text-sm">✕</button>
                        </div>
                    )}

                    {/* Progress */}
                    {uploading && (
                        <div className="px-3.5 py-1.5 border-t border-slate-200 shrink-0 bg-slate-50">
                            <div className="text-[11px] text-blue-600 font-semibold mb-1">{isCompressing ? `${statusText} ${compressProgress}%` : statusText || 'Uploading…'}</div>
                            <div className="h-1 rounded-sm bg-slate-200 overflow-hidden">
                                <div className="h-full rounded-sm bg-blue-600 transition-all duration-200" style={{ width: isCompressing ? `${compressProgress}%` : '100%' }} />
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-2.5 pt-2 pb-2.5 border-t border-slate-200 shrink-0 bg-white">
                        <input ref={fileRef} type="file" accept="video/*,image/*" onChange={handleMedia} className="hidden" />
                        {isCompressing ? (
                            <div className="text-center text-[11px] p-1 text-slate-500">Processing…</div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 cursor-pointer text-sm flex items-center justify-center shrink-0 transition-colors">
                                    📎
                                </button>
                                <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Message"
                                    className="flex-1 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-slate-900 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-0 transition-all" />
                                <button onClick={() => handleSend()} disabled={sending || !newMsg.trim()}
                                    className={`w-8 h-8 rounded-full border-none flex items-center justify-center shrink-0 text-sm font-bold transition-all ${newMsg.trim() ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-default'}`}>
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

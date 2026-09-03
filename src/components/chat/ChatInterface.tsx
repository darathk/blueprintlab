'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { chatUploadManager, useChatUploadJobsForConversation, usePreUploadJobs, type UploadCompleteDetail } from '@/lib/chat-upload-manager';
import { downloadMediaFile } from '@/lib/download-media';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Mic, MoreVertical, Reply, Copy, Download, Paperclip, X, Send, Search, Scissors, Pencil, Play, Maximize, Minimize2, Plus, ChevronLeft } from 'lucide-react';
const VideoCropper = dynamic(() => import('./VideoCropper'), { ssr: false });
const EmojiPicker = dynamic(() => import('./EmojiPicker'), { ssr: false });
const GifPicker = dynamic(() => import('./GifPicker'), { ssr: false });

// Lazy-loading video component for iOS reliability
function LazyVideo({ src, onLoadedData, style, onExpand }: { src: string; onLoadedData?: () => void; style?: React.CSSProperties; onExpand?: (src: string) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    const handleRetry = useCallback(() => {
        setHasError(false);
        const vid = videoRef.current;
        if (vid) { vid.load(); }
    }, []);

    const handleFullscreen = useCallback(() => {
        // If an onExpand callback is provided (desktop side-panel), use it
        if (onExpand) {
            onExpand(src);
            return;
        }
        // Otherwise fall back to native fullscreen (mobile)
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.requestFullscreen) {
            vid.requestFullscreen();
        } else if ((vid as any).webkitEnterFullscreen) {
            (vid as any).webkitEnterFullscreen();
        } else if ((vid as any).webkitRequestFullscreen) {
            (vid as any).webkitRequestFullscreen();
        }
    }, [onExpand, src]);

    return (
        <div ref={containerRef} style={{ minHeight: 120, background: '#000', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
            {isVisible && !hasError ? (
                <>
                    <video
                        ref={videoRef}
                        controls
                        playsInline
                        webkit-playsinline="true"
                        muted
                        preload="metadata"
                        onLoadedData={onLoadedData}
                        onError={handleError}
                        src={src.includes('#t=') ? src : `${src}#t=0.001`}
                        style={style}
                    />
                    <button
                        onClick={handleFullscreen}
                        style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 5,
                            backdropFilter: 'blur(4px)',
                            WebkitBackdropFilter: 'blur(4px)',
                        }}
                        title="Fullscreen"
                    >
                        <Maximize size={16} />
                    </button>
                </>
            ) : hasError ? (
                <div
                    onClick={handleRetry}
                    style={{
                        minHeight: 120, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 8,
                        cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 20
                    }}
                >
                    <Play size={32} />
                    <span style={{ fontSize: 12 }}>Tap to load video</span>
                </div>
            ) : (
                <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
            )}
        </div>
    );
}

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
    _uploadError?: boolean; // client-only flag for failed uploads
}

// Helper to fix missing or generic MIME types on iOS/Android/native uploads.
// Android often sends video files as 'application/octet-stream'; iOS MOV files
// sometimes arrive with no type at all. We fall back to the file extension.
const fixFileMimeType = (f: File): File => {
    const isGeneric = !f.type || f.type === 'application/octet-stream' || f.type === 'application/x-www-form-urlencoded';
    if (isGeneric) {
        const name = f.name.toLowerCase();
        let type = '';
        if (name.endsWith('.mov')) type = 'video/quicktime';
        else if (name.endsWith('.mp4')) type = 'video/mp4';
        else if (name.endsWith('.webm')) type = 'video/webm';
        else if (name.endsWith('.3gp')) type = 'video/3gpp';
        else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) type = 'image/jpeg';
        else if (name.endsWith('.png')) type = 'image/png';
        else if (name.endsWith('.gif')) type = 'image/gif';
        else if (name.endsWith('.heic')) type = 'image/heic';
        else if (name.endsWith('.m4a')) type = 'audio/mp4';
        else if (name.endsWith('.ogg')) type = 'audio/ogg';

        if (type) {
            return new File([f], f.name, { type, lastModified: f.lastModified });
        }
    }
    return f;
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

const isUrl = (text: string) => /^https?:\/\//.test(text);

function highlightMatch(text: string, searchText?: string) {
    if (!text) return null;
    const parts = text.split(/(https?:\/\/[^\s<]+)/g);
    if (!searchText?.trim()) {
        return (
            <>
                {parts.map((part, i) =>
                    isUrl(part)
                        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'underline' }}>{part}</a>
                        : part
                )}
            </>
        );
    }

    const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return (
        <>
            {parts.map((part, i) => {
                if (isUrl(part)) {
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'underline' }}>{part}</a>;
                }
                const searchParts = part.split(new RegExp(`(${escapedSearch})`, 'gi'));
                return searchParts.map((sp, j) =>
                    sp.toLowerCase() === searchText.toLowerCase()
                        ? <mark key={`${i}-${j}`} style={{ background: 'rgba(6, 182, 212, 0.4)', color: '#fff', borderRadius: 2, padding: '0 2px' }}>{sp}</mark>
                        : sp
                );
            })}
        </>
    );
}

interface MessageListProps {
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    handleScroll: () => void;
    loaded: boolean;
    searchText: string;
    filteredMessages: Message[];
    currentUserId: string;
    otherUserName: string;
    selectedMessageIds: Set<string>;
    isMultiSelecting: boolean;
    toggleSelection: (id: string) => void;
    activeMenu: string | null;
    setActiveMenu: (id: string | null) => void;
    scrollToMessage: (id: string) => void;
    scrollToBottom: (smooth?: boolean) => void;
    setExpandedMedia: (media: { url: string; type: 'video' | 'image'; message?: Message } | null) => void;
    uploadProgress: Record<string, number>;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    handleToggleReaction: (msgId: string, emoji: string) => void;
    emojiPickerMessageId: string | null;
    setEmojiPickerMessageId: (id: string | null) => void;
    setReplyingTo: (msg: Message | null) => void;
    setEditingMessage: (msg: Message | null) => void;
    setNewMessage: (text: string) => void;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    saveMedia: (url: string, isImg?: boolean) => void;
    handleDeleteMessage: (msgId: string) => void;
    confirmDeleteId: string | null;
}

// Helper to calculate Apple/Linear style grouped bubble corners
const getBubbleRadius = (mine: boolean, isFirst: boolean, isLast: boolean, isSolo: boolean) => {
    if (isSolo) return '18px';
    if (mine) {
        if (isFirst) return '18px 18px 4px 18px';
        if (isLast) return '18px 4px 18px 18px';
        return '18px 4px 4px 18px'; // middle
    } else {
        if (isFirst) return '18px 18px 18px 4px';
        if (isLast) return '4px 18px 18px 18px';
        return '4px 18px 18px 4px'; // middle
    }
};

const MemoizedMessageList = memo(function MemoizedMessageList({
    scrollContainerRef,
    messagesEndRef,
    handleScroll,
    loaded,
    searchText,
    filteredMessages,
    currentUserId,
    otherUserName,
    selectedMessageIds,
    isMultiSelecting,
    toggleSelection,
    activeMenu,
    setActiveMenu,
    scrollToMessage,
    scrollToBottom,
    setExpandedMedia,
    uploadProgress,
    setMessages,
    handleToggleReaction,
    emojiPickerMessageId,
    setEmojiPickerMessageId,
    setReplyingTo,
    setEditingMessage,
    setNewMessage,
    inputRef,
    saveMedia,
    handleDeleteMessage,
    confirmDeleteId,
}: MessageListProps) {
    const longPressRef = useRef<NodeJS.Timeout | null>(null);

    return (
        <div ref={scrollContainerRef} onScroll={handleScroll} style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 20px',
            minHeight: 0,
            paddingBottom: 0,
            willChange: 'scroll-position',
            transform: 'translateZ(0)',
            WebkitOverflowScrolling: 'touch' as any,
            overscrollBehavior: 'contain',
            background: 'var(--background)',
        }}>
            {!loaded && <div style={{ textAlign: 'center', padding: 40, color: 'var(--secondary-foreground)' }}>Loading…</div>}
            {loaded && filteredMessages.length === 0 && !searchText && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 40 }}>
                    <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Start the conversation</div>
                    <div style={{ fontSize: 14, color: 'var(--secondary-foreground)' }}>Send a message to {otherUserName}</div>
                </div>
            )}
            {loaded && searchText && filteredMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--secondary-foreground)', fontSize: 14 }}>
                    No messages found matching &ldquo;{searchText}&rdquo;
                </div>
            )}

            {filteredMessages.map((msg, i) => {
                const mine = msg.senderId === currentUserId;
                const isVid = msg.mediaType?.startsWith('video');
                const isImg = msg.mediaType?.startsWith('image');
                const isAudio = msg.mediaType?.startsWith('audio');
                const dateSep = i === 0 || new Date(filteredMessages[i].createdAt).toDateString() !== new Date(filteredMessages[i - 1].createdAt).toDateString();
                const timeSep = i === 0 || filteredMessages[i].senderId !== filteredMessages[i - 1].senderId ||
                    new Date(filteredMessages[i].createdAt).getTime() - new Date(filteredMessages[i - 1].createdAt).getTime() > 300000;

                // Grouping logic for consecutive messages
                const prevMsg = i > 0 ? filteredMessages[i - 1] : null;
                const nextMsg = i < filteredMessages.length - 1 ? filteredMessages[i + 1] : null;
                const sameSenderPrev = prevMsg?.senderId === msg.senderId && !timeSep && !dateSep;
                const sameSenderNext = nextMsg?.senderId === msg.senderId &&
                    (new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() <= 300000) &&
                    (new Date(nextMsg.createdAt).toDateString() === new Date(msg.createdAt).toDateString());

                const isSolo = !sameSenderPrev && !sameSenderNext;
                const isFirst = !sameSenderPrev && sameSenderNext;
                const isLast = sameSenderPrev && !sameSenderNext;
                const bubbleRadius = getBubbleRadius(mine, isFirst, isLast, isSolo);

                const isSelected = selectedMessageIds.has(msg.id);

                return (
                    <div key={msg.id} id={`msg-${msg.id}`} style={{ position: 'relative' }}>
                        {isSelected && <div style={{ position: 'absolute', inset: -4, background: 'rgba(6, 182, 212, 0.1)', zIndex: 0, borderRadius: 8, pointerEvents: 'none' }} />}
                        <div style={{ position: 'relative', zIndex: 1 }} onClick={() => isMultiSelecting && toggleSelection(msg.id)}>
                            {dateSep && (
                                <div style={{ textAlign: 'center', margin: '20px 0 10px' }}>
                                    <span style={{
                                        fontSize: 10,
                                        color: 'rgba(255,255,255,0.45)',
                                        fontWeight: 600,
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        background: 'rgba(255,255,255,0.04)',
                                        backdropFilter: 'blur(8px)',
                                        WebkitBackdropFilter: 'blur(8px)',
                                        padding: '5px 14px',
                                        borderRadius: 20,
                                        border: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        {fmtDate(msg.createdAt)}
                                    </span>
                                </div>
                            )}
                            {timeSep && !dateSep && (
                                <div style={{ textAlign: 'center', margin: '12px 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                                    {fmtTime(msg.createdAt)}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: sameSenderPrev ? 2 : (i > 0 ? 8 : 2), gap: 4, position: 'relative' }}>

                                {/* Action button — left side for own messages */}
                                {mine ? (
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                        className="chat-press"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s' }}
                                        title="Actions"><MoreVertical size={14} color="rgba(255,255,255,0.3)" /></button>
                                ) : (
                                    <div style={{ width: 14, flexShrink: 0 }} />
                                )}

                                <div style={{ position: 'relative', maxWidth: '75%', cursor: isMultiSelecting ? 'pointer' : 'default' }}>
                                    <div
                                        onTouchStart={() => {
                                            longPressRef.current = setTimeout(() => {
                                                setActiveMenu(activeMenu === msg.id ? null : msg.id);
                                            }, 500);
                                        }}
                                        onTouchEnd={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                                        onTouchMove={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                                        onClick={(e) => {
                                            if (isMultiSelecting) { e.stopPropagation(); toggleSelection(msg.id); }
                                        }}
                                        style={{
                                            padding: msg.mediaUrl ? '4px 4px 8px' : '10px 14px',
                                            borderRadius: bubbleRadius,
                                            background: isSelected ? 'rgba(125,135,210,0.3)' : mine ? 'var(--bubble-mine)' : 'var(--bubble-theirs)',
                                            border: isSelected ? '1px solid rgba(125,135,210,0.4)' : '1px solid ' + (mine ? 'var(--bubble-mine-border)' : 'var(--bubble-theirs-border)'),
                                            boxShadow: mine ? '0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                                            wordBreak: 'break-word',
                                            overflowWrap: 'break-word',
                                            transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out)',
                                            position: 'relative'
                                        }}>
                                        {/* Reply */}
                                        {msg.replyTo && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                                                className="chat-press"
                                                style={{ margin: msg.mediaUrl ? '4px 8px 6px' : '0 0 6px', padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid var(--primary)', fontSize: 11, cursor: 'pointer' }}
                                            >
                                                <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>{msg.replyTo.sender.name}</div>
                                                <div style={{ color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {msg.replyTo.mediaUrl ? (msg.replyTo.mediaType === 'image/gif' ? 'GIF' : msg.replyTo.mediaType?.startsWith('image') ? 'Photo' : msg.replyTo.mediaType?.startsWith('audio') ? 'Voice' : 'Video') : msg.replyTo.content}
                                                </div>
                                            </div>
                                        )}

                                        {/* Video */}
                                        {msg.mediaUrl && isVid && (
                                            <div style={{ position: 'relative' }}>
                                                <LazyVideo
                                                    src={msg.mediaUrl}
                                                    onLoadedData={() => scrollToBottom(false)}
                                                    style={{ width: '100%', maxWidth: '100%', maxHeight: 300, display: 'block', objectFit: 'contain' }}
                                                    onExpand={(videoSrc) => setExpandedMedia({ url: videoSrc, type: 'video', message: msg })}
                                                />
                                                {/* Upload/processing progress overlay */}
                                                {uploadProgress[msg.id] !== undefined && uploadProgress[msg.id] < 100 && (
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
                                                                background: 'var(--primary)',
                                                                borderRadius: 2,
                                                                transition: 'width 200ms var(--ease-out)',
                                                                width: `${Math.max(uploadProgress[msg.id], 2)}%`
                                                            }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Image */}
                                        {msg.mediaUrl && isImg && (
                                            <div style={{ position: 'relative' }}>
                                                <img src={msg.mediaUrl} alt="" loading="lazy" onClick={() => setExpandedMedia({ url: msg.mediaUrl!, type: 'image', message: msg })} onLoad={() => scrollToBottom(false)}
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
                                                            <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 2, transition: 'width 200ms var(--ease-out)', width: `${Math.max(uploadProgress[msg.id], 2)}%` }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Audio (WhatsApp Style) */}
                                        {msg.mediaUrl && isAudio && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px', minWidth: 240 }}>
                                                <div style={{ width: 45, height: 45, borderRadius: '50%', background: mine ? 'rgba(125,135,210,0.2)' : 'rgba(125,135,210,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                    <span style={{ fontSize: 18, color: '#fff', fontWeight: 600 }}>{msg.sender.name[0]}</span>
                                                </div>

                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <audio
                                                            controls
                                                            preload="metadata"
                                                            style={{ height: 35, width: '100%', filter: 'brightness(0.8) contrast(1.1)', opacity: 0.8 }}
                                                        >
                                                            <source src={msg.mediaUrl} type={msg.mediaType || 'audio/mpeg'} />
                                                        </audio>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, paddingLeft: 8 }}>
                                                        {[3, 7, 5, 9, 4, 11, 6, 8, 5, 10, 4, 7, 3, 6, 9, 5].map((h, idx) => (
                                                            <div key={idx} style={{ width: 2, height: `${(h / 12) * 100}%`, background: 'rgba(125,135,210,0.4)', borderRadius: 1 }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Text */}
                                        {(!msg.mediaUrl || (msg.content && !['Video', 'Photo', 'GIF', 'Voice Message'].includes(msg.content.trim()))) ? (
                                            <div style={{ fontSize: 14, lineHeight: 1.4, color: 'rgba(255,255,255,0.9)', padding: msg.mediaUrl ? '0 10px' : 0, whiteSpace: 'pre-wrap' }}>
                                                {highlightMatch(msg.content, searchText)}
                                            </div>
                                        ) : null}

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
                                            {mine && !msg._uploadError && <span style={{ color: msg.read ? 'var(--primary)' : 'inherit', fontSize: 12 }}>✓✓</span>}
                                            {msg._uploadError && <span style={{ color: 'var(--error)', fontSize: 10, fontWeight: 600 }}>⚠ Failed</span>}
                                        </div>

                                        {/* Upload error banner */}
                                        {msg._uploadError && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                                padding: '6px 10px', marginTop: 4,
                                                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: 8, fontSize: 11, color: '#ef4444',
                                            }}>
                                                <span style={{ fontWeight: 600 }}>Failed to send</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMessages(prev => prev.filter(m => {
                                                            if (m.id !== msg.id) return true;
                                                            if (m.mediaUrl && m.mediaUrl.startsWith('blob:')) {
                                                                try { URL.revokeObjectURL(m.mediaUrl); } catch {}
                                                            }
                                                            return false;
                                                        }));
                                                    }}
                                                    className="chat-press"
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        color: '#ef4444', fontSize: 10, fontWeight: 600, padding: '2px 8px',
                                                        borderRadius: 6, cursor: 'pointer',
                                                    }}
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}
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
                                                        className="chat-press"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            padding: '2px 7px',
                                                            borderRadius: 10,
                                                            background: hasReacted ? 'rgba(125, 135, 210, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                            border: hasReacted ? '1px solid rgba(125, 135, 210, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                            cursor: 'pointer',
                                                            transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out)',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 12 }}>{emoji}</span>
                                                        <span style={{ fontSize: 10, color: hasReacted ? 'var(--primary)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{userIds.length}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Dropdown action menu */}
                                    {activeMenu === msg.id && !isMultiSelecting && (
                                        <>
                                            <div
                                                onTouchStart={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                                                style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                                            />
                                            <div
                                                onTouchStart={e => e.stopPropagation()}
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    [mine ? 'right' : 'left']: 0,
                                                    zIndex: 999,
                                                    background: 'rgba(20, 20, 30, 0.96)',
                                                    backdropFilter: 'blur(20px)',
                                                    WebkitBackdropFilter: 'blur(20px)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderTop: '1px solid var(--glass-specular)',
                                                    borderRadius: 14,
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08)',
                                                    padding: '6px 0',
                                                    width: 210,
                                                    transformOrigin: mine ? 'bottom right' : 'bottom left',
                                                    animation: 'popoverIn 200ms var(--ease-out)'
                                                }}
                                            >
                                                {/* Emoji reactions row */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-around',
                                                    alignItems: 'center',
                                                    padding: '4px 10px 8px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                                    marginBottom: 4,
                                                    position: 'relative',
                                                }}>
                                                    {['❤️', '🔥', '👍', '💪', '🙌', '💯'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => { handleToggleReaction(msg.id, emoji); setActiveMenu(null); setEmojiPickerMessageId(null); }}
                                                            className="chat-press"
                                                            style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setEmojiPickerMessageId(emojiPickerMessageId === msg.id ? null : msg.id)}
                                                        className="chat-press"
                                                        style={{
                                                            fontSize: 14,
                                                            background: emojiPickerMessageId === msg.id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '50%',
                                                            width: 24,
                                                            height: 24,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'var(--secondary-foreground)',
                                                            flexShrink: 0,
                                                        }}
                                                        title="More emojis"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                    {emojiPickerMessageId === msg.id && (
                                                        <EmojiPicker
                                                            onSelect={(emoji) => { handleToggleReaction(msg.id, emoji); setActiveMenu(null); setEmojiPickerMessageId(null); }}
                                                            onClose={() => setEmojiPickerMessageId(null)}
                                                            position="above"
                                                        />
                                                    )}
                                                </div>

                                                <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                                                    className="chat-press"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Reply size={16} color="var(--secondary-foreground)" /> Reply</button>
                                                {mine && msg.content && !msg.mediaUrl && (
                                                    <button onClick={() => { setEditingMessage(msg); setNewMessage(msg.content); setActiveMenu(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                                                        className="chat-press"
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Pencil size={16} color="var(--secondary-foreground)" /> Edit</button>
                                                )}
                                                <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenu(null); }}
                                                    className="chat-press"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Copy size={16} color="var(--secondary-foreground)" /> Copy</button>
                                                <button onClick={() => { toggleSelection(msg.id); setActiveMenu(null); }}
                                                    className="chat-press"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><MoreVertical size={16} color="var(--secondary-foreground)" /> Select</button>
                                                {msg.mediaUrl && <button onClick={() => { saveMedia(msg.mediaUrl!, msg.mediaType?.startsWith('image')); setActiveMenu(null); }}
                                                    className="chat-press"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Download size={16} color="var(--secondary-foreground)" /> Save</button>}
                                                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                                                <button onClick={() => handleDeleteMessage(msg.id)}
                                                    className="chat-press"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 14px', background: confirmDeleteId === msg.id ? 'rgba(239,68,68,0.15)' : 'none', border: 'none', fontSize: 13, color: '#ef4444', cursor: 'pointer', fontWeight: 600, borderRadius: 6, transition: 'background 150ms var(--ease-out)' }}
                                                    onMouseEnter={e => { if (confirmDeleteId !== msg.id) e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                                    onMouseLeave={e => { if (confirmDeleteId !== msg.id) e.currentTarget.style.background = confirmDeleteId === msg.id ? 'rgba(239,68,68,0.15)' : 'transparent'; }}><X size={16} color="#ef4444" /> {confirmDeleteId === msg.id ? 'Tap again to delete' : 'Delete'}</button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Action button — right side for other's messages */}
                                {!mine && (
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }}
                                        className="chat-press"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s' }}
                                        title="Actions"><MoreVertical size={14} color="rgba(255,255,255,0.3)" /></button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} style={{ height: 8, flexShrink: 0, width: '100%' }} />
        </div>
    );
});

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
    athletePosition?: { blockName: string; weekNum?: number; dayNum?: number; totalWeeks?: number; isFinished?: boolean };
}

export default function ChatInterface({
    currentUserId, otherUserId, currentUserName, otherUserName, athleteId,
    initialMessages = [], isEmbedded = false, onBack, headerActions, athletePosition
}: Props) {
    const router = useRouter();
    
    // Aggressively prefetch dashboards so exiting chat is instant
    useEffect(() => {
        router.prefetch('/dashboard');
        router.prefetch(`/athlete/${athleteId}/dashboard`);
    }, [router, athleteId]);

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [stagedFileUrls, setStagedFileUrls] = useState<string[]>([]);
    const [stagedPosters, setStagedPosters] = useState<Record<number, string>>({});
    const [stagedPreviewIndex, setStagedPreviewIndex] = useState(0);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [captionFocused, setCaptionFocused] = useState(false);

    // Emoji picker state (for reactions)
    const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);

    // GIF picker state
    const [showGifPicker, setShowGifPicker] = useState(false);

    // Video Cropper state
    const [cropFile, setCropFile] = useState<File | null>(null);

    // Trim metadata per staged file index (from VideoCropper)
    const [stagedTrimData, setStagedTrimData] = useState<Record<number, { start: number; end: number }>>({});

    // Pre-upload job IDs per staged file index — upload starts immediately on staging
    const [stagedPreUploadIds, setStagedPreUploadIds] = useState<Record<number, string>>({});
    // Expanded media panel state (desktop side-panel instead of native fullscreen)
    const [expandedMedia, setExpandedMedia] = useState<{ url: string, type: 'video' | 'image', message?: Message } | null>(null);
    // Subscribe to pre-upload progress so thumbnails update live
    const preUploadJobs = usePreUploadJobs();
    // Helper: get pre-upload progress (0-100) for a staged file index
    const getPreProgress = (index: number): { progress: number; status: string } | null => {
        const jobId = stagedPreUploadIds[index];
        if (!jobId) return null;
        const job = preUploadJobs.find(j => j.id === jobId);
        if (!job) return null;
        return { progress: job.progress, status: job.status };
    };

    // Upload progress per message (tempId → 0-100), driven by the global
    // chat-upload manager so that uploads (and their progress UI) survive
    // the chat unmounting.
    const conversationJobs = useChatUploadJobsForConversation(currentUserId, otherUserId);
    const uploadProgress = useMemo(() => {
        const map: Record<string, number> = {};
        for (const j of conversationJobs) {
            if (j.status === 'done') continue; // hide bar after success
            map[j.tempMessageId] = j.progress;
        }
        return map;
    }, [conversationJobs]);

    // Editing state (compose-bar approach — no inline bubble edit)
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);

    // Multi-select state
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    const isMultiSelecting = selectedMessageIds.size > 0;

    const toggleSelection = useCallback((msgId: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    }, []);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Initial fetch — once
    useEffect(() => {
        const ac = new AbortController();
        if (initialMessages.length === 0) {
            fetch(`/api/messages?athleteId=${athleteId}`, { signal: ac.signal })
                .then(r => r.ok ? r.json() : [])
                .then(data => { setMessages(data); setLoaded(true); })
                .catch(e => { if (e.name !== 'AbortError') console.error(e); });
        } else {
            setLoaded(true);
        }
        // Mark as read and immediately refresh nav badge
        fetch('/api/messages', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId }),
            signal: ac.signal
        }).then(() => {
            window.dispatchEvent(new Event('unread-refresh'));
        }).catch(e => { if (e.name !== 'AbortError') console.error(e); });

        return () => ac.abort();
    }, [athleteId, currentUserId, otherUserId, initialMessages.length]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Track if user has scrolled up — if so, don't auto-jump on polling updates
    const userScrolledUp = useRef(false);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    // Clean up staged blob URLs on unmount to prevent memory leaks
    const stagedUrlsRef = useRef(stagedFileUrls);
    stagedUrlsRef.current = stagedFileUrls;
    useEffect(() => {
        return () => {
            stagedUrlsRef.current.forEach(url => {
                try { URL.revokeObjectURL(url); } catch {}
            });
        };
    }, []);

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
            // Force scroll to bottom every time a new message is added
            scrollToBottom(true);
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

    // Track whether Supabase realtime is connected
    const realtimeConnected = useRef(false);

    // Realtime — fetch only the single new message, not all 100
    useEffect(() => {
        const ch = supabase.channel(`chat-${athleteId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: `senderId=eq.${otherUserId}` },
                (payload) => {
                    // Fetch only the new message by ID to avoid re-fetching all 100
                    const newMsgId = payload.new?.id;
                    if (newMsgId) {
                        fetch(`/api/messages/single?id=${newMsgId}`)
                            .then(r => r.ok ? r.json() : null)
                            .then(msg => {
                                if (msg) {
                                    setMessages(prev => {
                                        // Avoid duplicates (polling may have already added it)
                                        if (prev.some(m => m.id === msg.id)) return prev;
                                        return [...prev, msg];
                                    });
                                }
                            });
                    }
                    // Mark as read
                    fetch('/api/messages', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
                    }).then(() => window.dispatchEvent(new Event('unread-refresh')));
                }
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Message' }, (payload) => {
                // Handle reaction updates from the other user
                const updatedMsg = payload.new;
                if (updatedMsg && (updatedMsg.senderId === otherUserId || updatedMsg.receiverId === otherUserId)) {
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, reactions: updatedMsg.reactions, read: updatedMsg.read, content: updatedMsg.content } : m));
                }
            })
            .subscribe((status) => {
                realtimeConnected.current = status === 'SUBSCRIBED';
            });
        return () => { supabase.removeChannel(ch); realtimeConnected.current = false; };
    }, [athleteId, currentUserId, otherUserId]);

    // Polling fallback — only runs when realtime is disconnected, at a slower interval
    useEffect(() => {
        const poll = setInterval(() => {
            // Skip polling when realtime is actively handling delivery
            if (realtimeConnected.current) return;

            fetch(`/api/messages?athleteId=${athleteId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.length > 0) {
                        setMessages(prev => {
                            const optimisticMessages = prev.filter(m => String(m.id).startsWith('temp-'));
                            const serverIds = new Set(data.map((m: any) => m.id));
                            // Only keep optimistic messages that haven't been confirmed by the server yet
                            const pendingOptimistic = optimisticMessages.filter(m => !serverIds.has(m.id));
                            if (prev.length - optimisticMessages.length !== data.length || prev[prev.length - optimisticMessages.length - 1]?.id !== data[data.length - 1]?.id) {
                                const hasUnread = data.some((m: any) => m.receiverId === currentUserId && !m.read);
                                if (hasUnread) {
                                    fetch('/api/messages', {
                                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ athleteId: otherUserId, readerId: currentUserId })
                                    }).then(() => window.dispatchEvent(new Event('unread-refresh')));
                                }
                                // Return server data merged with only pending optimistic messages
                                return [...data, ...pendingOptimistic];
                            }
                            return prev;
                        });
                    }
                });
        }, 30000); // 30s fallback — realtime handles instant delivery when connected
        return () => clearInterval(poll);
    }, [athleteId, currentUserId, otherUserId]);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressRef = useRef<NodeJS.Timeout | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

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
    useEffect(() => { const c = () => { setActiveMenu(null); setConfirmDeleteId(null); }; window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);

    // When a background upload completes, swap the optimistic placeholder
    // for the real saved message and revoke its preview object URL. If the
    // chat happens to be unmounted at completion time the realtime/polling
    // subscription will pick it up on remount instead.
    useEffect(() => {
        const onComplete = (e: Event) => {
            const detail = (e as CustomEvent<UploadCompleteDetail>).detail;
            if (!detail) return;
            const { tempMessageId, realMessage } = detail;
            setMessages(prev => prev.map(m => {
                if (m.id !== tempMessageId) return m;
                if (m.mediaUrl && m.mediaUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(m.mediaUrl); } catch {}
                }
                return realMessage;
            }));
        };
        const onError = (e: Event) => {
            const detail = (e as CustomEvent<{ tempMessageId: string }>).detail;
            if (!detail) return;
            // Mark the message as failed instead of removing it so the athlete
            // can see it didn't send (prevents panic-resending duplicates).
            setMessages(prev => prev.map(m => {
                if (m.id !== detail.tempMessageId) return m;
                return { ...m, _uploadError: true };
            }));
        };
        window.addEventListener('chat-upload-complete', onComplete as EventListener);
        window.addEventListener('chat-upload-error', onError as EventListener);
        return () => {
            window.removeEventListener('chat-upload-complete', onComplete as EventListener);
            window.removeEventListener('chat-upload-error', onError as EventListener);
        };
    }, []);

    // Send — optimistic (with double-send guard)
    const sendingRef = useRef(false);
    const handleSend = async (overrideReplyTo?: any) => {
        const text = newMessage.trim();
        if (!text && stagedFiles.length === 0) return;
        if (sendingRef.current) return; // Prevent double-send
        sendingRef.current = true;

        // If in edit mode, update the existing message rather than sending a new one
        if (editingMessage) {
            setNewMessage('');
            await handleEditMessage(editingMessage.id, text);
            sendingRef.current = false;
            return;
        }

        const targetReplyTo = overrideReplyTo !== undefined ? overrideReplyTo : replyingTo;

        // Clear UI state immediately
        const filesToSend = [...stagedFiles];
        const urlsToSend = [...stagedFileUrls];
        const trimDataToSend = { ...stagedTrimData };
        const preUploadIdsToSend = { ...stagedPreUploadIds };

        setNewMessage('');
        setReplyingTo(null);
        setStagedFiles([]);
        setStagedFileUrls([]);
        setStagedPosters({});
        setStagedTrimData({});
        setStagedPreUploadIds({});
        if (fileRef.current) fileRef.current.value = '';

        // Create optimistic messages
        const optimisticMessages: Message[] = [];

        if (filesToSend.length === 0) {
            // Just text
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            optimisticMessages.push({
                id: tempId, senderId: currentUserId, receiverId: otherUserId, content: text,
                mediaUrl: null, mediaType: null,
                createdAt: new Date().toISOString(), read: false,
                replyToId: targetReplyTo?.id || null, replyTo: targetReplyTo ? { id: targetReplyTo.id, content: targetReplyTo.content, mediaUrl: targetReplyTo.mediaUrl, mediaType: targetReplyTo.mediaType, sender: targetReplyTo.sender } : null,
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
                    replyToId: index === 0 ? (targetReplyTo?.id || null) : null,
                    replyTo: index === 0 ? (targetReplyTo ? { id: targetReplyTo.id, content: targetReplyTo.content, mediaUrl: targetReplyTo.mediaUrl, mediaType: targetReplyTo.mediaType, sender: targetReplyTo.sender } : null) : null,
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
                    body: JSON.stringify({ senderId: currentUserId, receiverId: otherUserId, content: text, mediaUrl: null, mediaType: null, replyToId: targetReplyTo?.id || null })
                });
                if (res.ok) {
                    const real = await res.json();
                    setMessages(prev => prev.map(m => m.id === tempId ? real : m));
                    window.dispatchEvent(new Event('inbox-refresh'));
                } else {
                    console.error('[API] Text message failed:', res.status);
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                    alert('Failed to send message. Please try again.');
                }
            } else {
                // For each file, check if a pre-upload has already finished.
                // If so, we can save the message record immediately using the
                // ready public URL. Otherwise, fall back to the full
                // startUpload() path which handles upload + message creation.
                filesToSend.forEach((file, i) => {
                    const tempId = optimisticMessages[i].id;
                    const isVid = file.type.startsWith('video/');
                    const isAudio = file.type.startsWith('audio/');
                    const content = i === 0 && text
                        ? text
                        : isAudio ? 'Voice Message' : isVid ? 'Video' : 'Photo';
                    const replyToId = i === 0 ? (targetReplyTo?.id || null) : null;
                    const preJobId = preUploadIdsToSend[i];
                    const preResult = preJobId ? chatUploadManager.getPreUploadResult(preJobId) : null;

                    if (preResult) {
                        // Upload already done — just save the message record
                        const mediaUrl = trimDataToSend[i]
                            ? `${preResult.publicUrl}#t=${trimDataToSend[i].start},${trimDataToSend[i].end}`
                            : preResult.publicUrl;

                        fetch('/api/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                senderId: currentUserId,
                                receiverId: otherUserId,
                                content,
                                mediaUrl,
                                mediaType: preResult.mime,
                                replyToId,
                            }),
                        }).then(async r => {
                            if (r.ok) {
                                const real = await r.json();
                                setMessages(prev => prev.map(m => {
                                    if (m.id !== tempId) return m;
                                    if (m.mediaUrl?.startsWith('blob:')) try { URL.revokeObjectURL(m.mediaUrl); } catch {}
                                    return real;
                                }));
                                window.dispatchEvent(new Event('inbox-refresh'));
                            } else {
                                setMessages(prev => prev.filter(m => m.id !== tempId));
                            }
                        }).catch(() => setMessages(prev => prev.filter(m => m.id !== tempId)));

                        // Dismiss the pre-upload job now that we've consumed it
                        chatUploadManager.dismissPreJob(preJobId);
                    } else {
                        // Still uploading or no pre-upload — use the full upload manager path
                        chatUploadManager.startUpload({
                            file,
                            tempMessageId: tempId,
                            athleteId,
                            currentUserId,
                            otherUserId,
                            content,
                            replyToId,
                            trim: trimDataToSend[i],
                        });
                        // The pre-job (if any) is now superseded; dismiss it
                        if (preJobId) chatUploadManager.dismissPreJob(preJobId);
                    }
                });
            }
        } catch (e: any) {
            console.error('[Send] Failed:', e);
            alert(`Send failed: ${e?.message || 'Unknown error'}`);
        }
        finally {
            setSending(false);
            setUploading(false);
            setStatusText('');
            sendingRef.current = false;
        }
    };

    // Toggle reaction
    const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
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
                // Revert the optimistic reaction update
                setMessages(prev => prev.map(m => {
                    if (m.id !== messageId) return m;
                    const revertedReactions = { ...(m.reactions || {}) } as Record<string, string[]>;
                    const userIds = revertedReactions[emoji] || [];
                    if (userIds.includes(currentUser)) {
                        // Was added optimistically, remove it
                        const reverted = userIds.filter(id => id !== currentUser);
                        if (reverted.length > 0) { revertedReactions[emoji] = reverted; } else { delete revertedReactions[emoji]; }
                    } else {
                        // Was removed optimistically, add it back
                        revertedReactions[emoji] = [...userIds, currentUser];
                    }
                    return { ...m, reactions: revertedReactions };
                }));
            }
        } catch (e) {
            console.error('Reaction toggle error:', e);
            // Revert the optimistic reaction update
            setMessages(prev => prev.map(m => {
                if (m.id !== messageId) return m;
                const revertedReactions = { ...(m.reactions || {}) } as Record<string, string[]>;
                const userIds = revertedReactions[emoji] || [];
                if (userIds.includes(currentUser)) {
                    const reverted = userIds.filter(id => id !== currentUser);
                    if (reverted.length > 0) { revertedReactions[emoji] = reverted; } else { delete revertedReactions[emoji]; }
                } else {
                    revertedReactions[emoji] = [...userIds, currentUser];
                }
                return { ...m, reactions: revertedReactions };
            }));
        }
    }, [currentUserId]);

    // Send GIF as a message
    const handleSendGif = async (gifUrl: string) => {
        setShowGifPicker(false);
        const savedReplyTo = replyingTo;
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
            id: tempId,
            senderId: currentUserId,
            receiverId: otherUserId,
            content: 'GIF',
            mediaUrl: gifUrl,
            mediaType: 'image/gif',
            createdAt: new Date().toISOString(),
            read: false,
            replyToId: savedReplyTo?.id || null,
            replyTo: savedReplyTo ? { id: savedReplyTo.id, content: savedReplyTo.content, mediaUrl: savedReplyTo.mediaUrl, mediaType: savedReplyTo.mediaType, sender: savedReplyTo.sender } : null,
            sender: { id: currentUserId, name: currentUserName, email: '' },
            receiver: { id: otherUserId, name: otherUserName, email: '' },
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setReplyingTo(null);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: currentUserId,
                    receiverId: otherUserId,
                    content: 'GIF',
                    mediaUrl: gifUrl,
                    mediaType: 'image/gif',
                    replyToId: savedReplyTo?.id || null,
                }),
            });
            if (res.ok) {
                const real = await res.json();
                setMessages(prev => prev.map(m => m.id === tempId ? real : m));
                window.dispatchEvent(new Event('inbox-refresh'));
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch {
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    // Staging media
    const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).map(fixFileMimeType);
        if (files.length === 0) return;

        const validFiles = files.filter(f => {
            const isVid = f.type.startsWith('video/'), isImg = f.type.startsWith('image/'), isAudio = f.type.startsWith('audio/');
            return (isVid || isImg || isAudio) && f.size <= 200 * 1024 * 1024;
        });

        if (validFiles.length < files.length) {
            alert('Some files were ignored (must be image/video under 200MB)');
        }
        if (validFiles.length === 0) return;

        const startIndex = stagedFiles.length;
        setStagedFiles(prev => [...prev, ...validFiles]);
        setStagedFileUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

        // Start background pre-uploads immediately — so by the time the user
        // hits Send, the file may already be in Supabase Storage.
        validFiles.forEach((f, i) => {
            if (!f.type.startsWith('audio/')) { // voice memos skip pre-upload (tiny, negligible)
                const preJobId = chatUploadManager.preUpload(f, athleteId);
                setStagedPreUploadIds(prev => ({ ...prev, [startIndex + i]: preJobId }));
            }
        });

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

        let cleanedUp = false;
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            URL.revokeObjectURL(video.src);
            video.remove();
        };

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
            cleanup();
        };
        video.onerror = () => cleanup();
        setTimeout(cleanup, 5000);
    };

    // Handle pasting images from clipboard
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    const fixedFile = fixFileMimeType(file);
                    if ((fixedFile.type.startsWith('image/') || fixedFile.type.startsWith('video/')) && fixedFile.size <= 200 * 1024 * 1024) {
                        pastedFiles.push(fixedFile);
                    }
                }
            }
        }
        if (pastedFiles.length === 0) return;
        e.preventDefault();
        const startIndex = stagedFiles.length;
        setStagedFiles(prev => [...prev, ...pastedFiles]);
        setStagedFileUrls(prev => [...prev, ...pastedFiles.map(f => URL.createObjectURL(f))]);
        // Start pre-uploads immediately (was previously missing for pasted files)
        pastedFiles.forEach((f, i) => {
            if (!f.type.startsWith('audio/')) {
                const preJobId = chatUploadManager.preUpload(f, athleteId);
                setStagedPreUploadIds(prev => ({ ...prev, [startIndex + i]: preJobId }));
            }
        });
        pastedFiles.forEach((f, i) => {
            if (f.type.startsWith('video/')) generateVideoPoster(f, startIndex + i);
        });
    }, [stagedFiles.length, athleteId]);

    const handleCropComplete = (file: File, trimStart?: number, trimEnd?: number) => {
        // Check if we're re-trimming an already staged file
        const existingIndex = stagedFiles.findIndex(f => f === cropFile);
        if (existingIndex >= 0) {
            URL.revokeObjectURL(stagedFileUrls[existingIndex]);
            setStagedFiles(prev => prev.map((f, i) => i === existingIndex ? file : f));
            setStagedFileUrls(prev => prev.map((url, i) => i === existingIndex ? URL.createObjectURL(file) : url));
            generateVideoPoster(file, existingIndex);
            // Store or clear trim metadata
            if (trimStart !== undefined && trimEnd !== undefined) {
                setStagedTrimData(prev => ({ ...prev, [existingIndex]: { start: trimStart, end: trimEnd } }));
            } else {
                setStagedTrimData(prev => { const n = { ...prev }; delete n[existingIndex]; return n; });
            }
        } else {
            const newIndex = stagedFiles.length;
            setStagedFiles(prev => [...prev, file]);
            setStagedFileUrls(prev => [...prev, URL.createObjectURL(file)]);
            generateVideoPoster(file, newIndex);
            if (trimStart !== undefined && trimEnd !== undefined) {
                setStagedTrimData(prev => ({ ...prev, [newIndex]: { start: trimStart, end: trimEnd } }));
            }
        }
        setCropFile(null);
    };

    const clearStagedMedia = (index?: number) => {
        if (index !== undefined) {
            URL.revokeObjectURL(stagedFileUrls[index]);
            setStagedFiles(prev => prev.filter((_, i) => i !== index));
            setStagedFileUrls(prev => prev.filter((_, i) => i !== index));

            // Dismiss the pre-upload job for the removed file
            const preJobId = stagedPreUploadIds[index];
            if (preJobId) chatUploadManager.dismissPreJob(preJobId);

            // Re-map indices for posters, trim data, and pre-upload IDs
            setStagedPosters(prev => {
                const n: Record<number, string> = {};
                Object.entries(prev).forEach(([key, val]) => {
                    const k = parseInt(key);
                    if (k < index) n[k] = val;
                    else if (k > index) n[k - 1] = val;
                });
                return n;
            });
            setStagedTrimData(prev => {
                const n: Record<number, { start: number; end: number }> = {};
                Object.entries(prev).forEach(([key, val]) => {
                    const k = parseInt(key);
                    if (k < index) n[k] = val;
                    else if (k > index) n[k - 1] = val;
                });
                return n;
            });
            setStagedPreUploadIds(prev => {
                const n: Record<number, string> = {};
                Object.entries(prev).forEach(([key, val]) => {
                    const k = parseInt(key);
                    if (k < index) n[k] = val;
                    else if (k > index) n[k - 1] = val;
                });
                return n;
            });
        } else {
            stagedFileUrls.forEach(url => URL.revokeObjectURL(url));
            // Dismiss all pre-upload jobs
            Object.values(stagedPreUploadIds).forEach(id => chatUploadManager.dismissPreJob(id));
            setStagedFiles([]);
            setStagedFileUrls([]);
            setStagedPosters({});
            setStagedTrimData({});
            setStagedPreUploadIds({});
        }
        if (fileRef.current) fileRef.current.value = '';
    };

    const saveMedia = useCallback(async (url: string, isImg?: boolean) => {
        try {
            const ext = isImg ? '.jpg' : url.includes('.webm') ? '.webm' : url.includes('.mov') ? '.mov' : '.mp4';
            const filename = `lift_${Date.now()}${ext}`;
            await downloadMediaFile({ url, filename });
        } catch {
            window.open(url, '_blank');
        }
    }, []);

    // Filter messages for search
    const filteredMessages = useMemo(() => {
        if (!searchText.trim()) return messages;
        const low = searchText.toLowerCase();
        return messages.filter(m =>
            m.content.toLowerCase().includes(low) ||
            m.sender.name.toLowerCase().includes(low)
        );
    }, [messages, searchText]);

    const handleCopyMultiple = () => {
        const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const textToCopy = selectedMsgs.map(m => `[${fmtTime(m.createdAt)}] ${m.sender.name}: ${m.content}`).join('\n');
        navigator.clipboard.writeText(textToCopy);
        setSelectedMessageIds(new Set());
    };

    const scrollToMessage = useCallback((msgId: string) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight
        el.style.transition = 'background 0.3s ease';
        el.style.background = 'rgba(125, 135, 210, 0.25)';
        el.style.borderRadius = '8px';
        setTimeout(() => {
            el.style.background = 'transparent';
            setTimeout(() => { el.style.transition = ''; el.style.borderRadius = ''; }, 300);
        }, 1500);
    }, []);

    const handleDeleteMessage = useCallback(async (msgId: string) => {
        // First tap shows confirm, second tap deletes
        if (confirmDeleteId !== msgId) {
            setConfirmDeleteId(msgId);
            return;
        }

        setConfirmDeleteId(null);
        // Optimistic UI
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setActiveMenu(null);

        try {
            const res = await fetch(`/api/messages?id=${msgId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                console.error('Delete failed:', err);
                window.location.reload();
            }
        } catch (e) {
            console.error('Delete error:', e);
            window.location.reload();
        }
    }, [confirmDeleteId]);

    const handleEditMessage = async (msgId: string, newContent: string) => {
        const trimmed = newContent.trim();
        if (!trimmed) return;

        // Capture original so we can revert on failure
        const originalMsg = messages.find(m => m.id === msgId);

        // Optimistic update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m));
        setEditingMessage(null);

        try {
            const res = await fetch('/api/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msgId, content: trimmed })
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                console.error('Edit failed:', res.status, errBody);
                // Revert optimistic update
                if (originalMsg) setMessages(prev => prev.map(m => m.id === msgId ? originalMsg : m));
                alert(errBody?.error || 'Failed to edit message.');
            } else {
                const updated = await res.json().catch(() => null);
                if (updated) setMessages(prev => prev.map(m => m.id === msgId ? updated : m));
            }
        } catch (e) {
            console.error('Edit error:', e);
            if (originalMsg) setMessages(prev => prev.map(m => m.id === msgId ? originalMsg : m));
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
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Expanded Media Side Panel (desktop) */}
            {expandedMedia && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100dvh',
                    background: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                    {/* Panel header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        flexShrink: 0,
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>Expanded View</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {expandedMedia.type === 'image' && (
                                <button
                                    onClick={() => window.open(expandedMedia.url, '_blank')}
                                    className="chat-press"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8,
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                                    title="Open original image"
                                >
                                    <Maximize size={14} />
                                    Original
                                </button>
                            )}
                            <button
                                onClick={() => setExpandedMedia(null)}
                                className="chat-press"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8,
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                            >
                                <Minimize2 size={14} />
                                Close
                            </button>
                        </div>
                    </div>
                    {/* Media container */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        overflow: 'hidden',
                    }}>
                        {expandedMedia.type === 'video' ? (
                            <video
                                key={expandedMedia.url}
                                controls
                                autoPlay
                                playsInline
                                src={expandedMedia.url.includes('#t=') ? expandedMedia.url : `${expandedMedia.url}#t=0.001`}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    borderRadius: 16,
                                    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                                    background: '#000',
                                }}
                            />
                        ) : (
                            <img
                                key={expandedMedia.url}
                                src={expandedMedia.url}
                                alt="Expanded view"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    borderRadius: 16,
                                    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                                    objectFit: 'contain',
                                    background: 'transparent',
                                }}
                            />
                        )}
                    </div>

                    {/* Quick Reply Bar */}
                    <div style={{
                        padding: '16px 20px',
                        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: 24,
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px 6px 6px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            maxWidth: 800,
                            margin: '0 auto',
                        }}>
                            <input 
                                type="text"
                                value={newMessage} 
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newMessage.trim()) {
                                        handleSend(expandedMedia.message);
                                        setExpandedMedia(null);
                                    }
                                }}
                                placeholder="Type a reply..."
                                disabled={uploading}
                                style={{
                                    flex: 1, background: 'transparent', border: 'none',
                                    color: 'var(--foreground)', fontSize: 16, outline: 'none',
                                    opacity: uploading ? 0.5 : 1
                                }}
                            />
                            <button 
                                onClick={() => {
                                    handleSend(expandedMedia.message);
                                    setExpandedMedia(null);
                                }}
                                disabled={uploading || !newMessage.trim()}
                                className="chat-press"
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: newMessage.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                                    color: newMessage.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                                    border: 'none', cursor: newMessage.trim() && !uploading ? 'pointer' : 'default',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out)', flexShrink: 0,
                                    boxShadow: newMessage.trim() ? '0 0 10px rgba(125,135,210,0.4)' : 'none'
                                }}
                            >
                                {uploading ? <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(30px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes zoomIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
            {/* Header */}
            <div style={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 'env(safe-area-inset-top, 0px)',
                background: 'var(--background)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
                minHeight: 'calc(58px + env(safe-area-inset-top, 0px))',
                height: 'calc(58px + env(safe-area-inset-top, 0px))',
                width: '100%',
                zIndex: 40,
                boxSizing: 'border-box'
            }}>
                {isMultiSelecting ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <button onClick={() => setSelectedMessageIds(new Set())} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6 }}>
                            <X size={20} />
                        </button>
                        <div style={{ flex: 1, fontWeight: 600, color: 'var(--primary)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedMessageIds.size} Selected
                        </div>
                        <button onClick={handleCopyMultiple} className="chat-press" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '5px 12px', transition: 'background 160ms var(--ease-out)', flexShrink: 0 }}>
                            <Copy size={13} color="#fff" /> Copy
                        </button>
                        <button onClick={async () => { 
                            if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; } 
                            setConfirmBulkDelete(false); 
                            const idsToDelete = Array.from(selectedMessageIds);
                            setMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)));
                            setSelectedMessageIds(new Set());
                            await Promise.allSettled(idsToDelete.map(id => fetch(`/api/messages?id=${id}`, { method: 'DELETE' })));
                            window.dispatchEvent(new Event('inbox-refresh'));
                        }} className="chat-press" style={{ display: 'flex', alignItems: 'center', gap: 5, background: confirmBulkDelete ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: confirmBulkDelete ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 20, padding: '5px 12px', transition: 'background 160ms var(--ease-out)', flexShrink: 0 }}>
                            <X size={13} color="#ef4444" /> {confirmBulkDelete ? 'Confirm' : 'Delete'}
                        </button>
                    </div>
                ) : (
                    <>
                        {onBack ? (
                            <button
                                onClick={onBack}
                                className="chat-press"
                                title="Back"
                                style={{
                                    color: 'var(--foreground)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    padding: 0,
                                    marginLeft: -4
                                }}
                            >
                                <ChevronLeft size={24} />
                            </button>
                        ) : (
                            <Link
                                prefetch={true}
                                href={`/athlete/${athleteId}/dashboard`}
                                className="chat-press"
                                title="Back to dashboard"
                                style={{
                                    color: 'var(--foreground)',
                                    background: 'none',
                                    border: 'none',
                                    textDecoration: 'none',
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    padding: 0,
                                    marginLeft: -4
                                }}
                            >
                                <ChevronLeft size={24} />
                            </Link>
                        )}

                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(125,135,210,0.3), rgba(168,85,247,0.3))',
                            border: '1px solid rgba(125,135,210,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            fontSize: 14,
                            flexShrink: 0,
                            boxShadow: '0 2px 10px rgba(125,135,210,0.2)'
                        }}>
                            {otherUserName.charAt(0).toUpperCase()}
                        </div>

                        {isSearchOpen ? (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 20,
                                padding: '6px 12px',
                                border: '1px solid rgba(125,135,210,0.3)',
                                boxShadow: '0 0 0 2px rgba(125,135,210,0.08)',
                                animation: 'fadeIn 150ms var(--ease-out)',
                                minWidth: 0
                            }}>
                                <Search size={14} style={{ color: 'var(--primary)', marginRight: 8, flexShrink: 0 }} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none', flex: 1, minWidth: 0 }}
                                />
                                <button
                                    onClick={() => { setIsSearchOpen(false); setSearchText(''); }}
                                    className="chat-press"
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                        <span style={{
                                            fontWeight: 600,
                                            color: 'var(--foreground)',
                                            fontSize: 15,
                                            letterSpacing: '-0.01em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            lineHeight: 1.25
                                        }}>
                                            {otherUserName}
                                        </span>
                                    </div>
                                    {athletePosition ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, minWidth: 0 }}>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: athletePosition.isFinished ? 'rgba(255,255,255,0.45)' : 'rgba(56,189,248,0.9)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                lineHeight: 1.2
                                            }}>
                                                {athletePosition.blockName}
                                                {athletePosition.isFinished ? ' · Finished' : (
                                                    <>
                                                        {athletePosition.weekNum ? ` · W${athletePosition.weekNum}${athletePosition.totalWeeks ? `/${athletePosition.totalWeeks}` : ''}` : ''}
                                                        {athletePosition.dayNum ? ` D${athletePosition.dayNum}` : ''}
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{
                                            fontSize: 11,
                                            color: 'rgba(255,255,255,0.4)',
                                            marginTop: 1,
                                            lineHeight: 1.2,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {otherUserName.toLowerCase() === 'coach' ? 'Coach' : 'Athlete'}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="chat-press"
                                    title="Search messages"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '50%',
                                        width: 34,
                                        height: 34,
                                        color: 'rgba(255,255,255,0.6)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background 160ms var(--ease-out)'
                                    }}
                                >
                                    <Search size={16} />
                                </button>
                                {headerActions}
                            </>
                        )}
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

            {/* Messages — memoized to isolate keyboard typing from message list re-rendering */}
            <MemoizedMessageList
                scrollContainerRef={scrollContainerRef}
                messagesEndRef={messagesEndRef}
                handleScroll={handleScroll}
                loaded={loaded}
                searchText={searchText}
                filteredMessages={filteredMessages}
                currentUserId={currentUserId}
                otherUserName={otherUserName}
                selectedMessageIds={selectedMessageIds}
                isMultiSelecting={isMultiSelecting}
                toggleSelection={toggleSelection}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                scrollToMessage={scrollToMessage}
                scrollToBottom={scrollToBottom}
                setExpandedMedia={setExpandedMedia}
                uploadProgress={uploadProgress}
                setMessages={setMessages}
                handleToggleReaction={handleToggleReaction}
                emojiPickerMessageId={emojiPickerMessageId}
                setEmojiPickerMessageId={setEmojiPickerMessageId}
                setReplyingTo={setReplyingTo}
                setEditingMessage={setEditingMessage}
                setNewMessage={setNewMessage}
                inputRef={inputRef}
                saveMedia={saveMedia}
                handleDeleteMessage={handleDeleteMessage}
                confirmDeleteId={confirmDeleteId}
            />

            {/* Reply bar */}
            {
                replyingTo && (
                    <div style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid var(--glass-specular)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexShrink: 0,
                        animation: 'popoverIn 200ms var(--ease-out)'
                    }}>
                        <div style={{ flex: 1, paddingLeft: 10, borderLeft: '2px solid var(--primary)', minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Replying to {replyingTo.sender.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {replyingTo.mediaUrl ? (replyingTo.mediaType === 'image/gif' ? 'GIF' : replyingTo.mediaType?.startsWith('image') ? 'Photo' : replyingTo.mediaType?.startsWith('audio') ? 'Voice' : 'Video') : replyingTo.content}
                            </div>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}><X size={16} /></button>
                    </div>
                )
            }

            {/* Editing bar */}
            {
                editingMessage && (
                    <div style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid var(--glass-specular)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexShrink: 0,
                        animation: 'popoverIn 200ms var(--ease-out)'
                    }}>
                        <Pencil size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, paddingLeft: 10, borderLeft: '2px solid var(--primary)', minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Editing message</div>
                            <div style={{ fontSize: 11, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {editingMessage.content}
                            </div>
                        </div>
                        <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}><X size={16} /></button>
                    </div>
                )
            }

            {/* Upload progress — driven by the global manager so it persists
                across this chat unmounting. The hint reassures users that they
                can leave the chat without aborting their uploads. */}
            {
                (() => {
                    const active = conversationJobs.filter(j => j.status !== 'done' && j.status !== 'error');
                    if (active.length === 0) return null;
                    const pct = Math.round(active.reduce((sum, j) => sum + j.progress, 0) / active.length);
                    return (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span>Uploading {active.length} file{active.length === 1 ? '' : 's'}…</span>
                                <span style={{ color: 'var(--secondary-foreground)', fontWeight: 500 }}>You can close this chat — uploads keep going.</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #7d87d2, #a855f7)', transition: 'width 200ms var(--ease-out)', width: `${Math.max(2, pct)}%` }} />
                            </div>
                        </div>
                    );
                })()
            }

            {/* Input */}
            <div style={{
                padding: '12px 16px',
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 4px))',
                background: 'var(--background)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0,
                zIndex: 40,
                position: 'relative',
            }}>
                {/* GIF Picker overlay */}
                {showGifPicker && (
                    <GifPicker
                        onSelect={handleSendGif}
                        onClose={() => setShowGifPicker(false)}
                    />
                )}
                <input ref={fileRef} type="file" multiple accept="video/*,image/*,.mov,.mp4,.webm,.jpg,.jpeg,.png" onChange={handleMedia} style={{ display: 'none' }} />
                {isRecording ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
                        background: 'rgba(255,255,255,0.04)', borderRadius: 24,
                        border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, flex: 1 }}>
                            {formatRecordingTime(recordingTime)}
                        </div>
                        <button onClick={cancelRecording} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', fontSize: 13, cursor: 'pointer', padding: '6px 12px' }}>
                            Cancel
                        </button>
                        <button onClick={stopRecording} className="chat-press" style={{ background: 'var(--primary)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 16px', cursor: 'pointer', boxShadow: '0 0 10px rgba(125,135,210,0.4)' }}>
                            Done
                        </button>
                    </div>
                ) : (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 24,
                        border: inputFocused ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid rgba(255,255,255,0.07)',
                        boxShadow: inputFocused ? '0 0 0 3px rgba(125, 135, 210, 0.08)' : 'none',
                        transition: 'border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out)',
                        padding: '6px 6px 6px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {/* Text input */}
                        <textarea ref={inputRef} value={newMessage} onChange={e => setNewMessage(e.target.value)}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            onPaste={handlePaste}
                            placeholder="Type a message..."
                            rows={editingMessage ? 6 : 1}
                            disabled={uploading}
                            enterKeyHint="send"
                            autoCapitalize="sentences"
                            autoCorrect="on"
                            spellCheck={true}
                            style={{
                                width: '100%', padding: '10px 0 8px', background: 'transparent', border: 'none',
                                color: 'var(--foreground)', fontSize: 16, outline: 'none', opacity: uploading ? 0.5 : 1,
                                resize: editingMessage ? 'vertical' : 'none', lineHeight: '1.4',
                                maxHeight: editingMessage ? 320 : 120, overflowY: 'auto', fontFamily: 'inherit'
                            }}
                        />

                        {/* Bottom row: attachment + gif + mic/send */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                    className="chat-press"
                                    style={{
                                        width: 34, height: 34, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                                        color: 'var(--secondary-foreground)', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        transition: 'background 160ms var(--ease-out)'
                                    }}>
                                    <Paperclip size={16} />
                                </button>
                                <button onClick={() => setShowGifPicker(!showGifPicker)} disabled={uploading}
                                    className="chat-press"
                                    style={{
                                        height: 34, borderRadius: 17, paddingLeft: 10, paddingRight: 10,
                                        background: showGifPicker ? 'rgba(125,135,210,0.2)' : 'rgba(255,255,255,0.06)',
                                        border: showGifPicker ? '1px solid rgba(125,135,210,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                        color: showGifPicker ? 'var(--primary)' : 'var(--secondary-foreground)',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                                        transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out)'
                                    }}>
                                    GIF
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {!newMessage.trim() && stagedFiles.length === 0 ? (
                                    <button onClick={startRecording} disabled={uploading}
                                        className="chat-press"
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, color: 'var(--secondary-foreground)',
                                            transition: 'background 160ms var(--ease-out)'
                                        }}>
                                        <Mic size={18} />
                                    </button>
                                ) : null}
                                <button onClick={() => handleSend()} disabled={uploading || (!newMessage.trim() && stagedFiles.length === 0)}
                                    className="chat-press"
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: (newMessage.trim() || stagedFiles.length > 0) ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                        border: 'none', cursor: (newMessage.trim() || stagedFiles.length > 0) && !uploading ? 'pointer' : 'default',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, opacity: uploading ? 0.3 : 1,
                                        color: (newMessage.trim() || stagedFiles.length > 0) ? '#fff' : 'rgba(255,255,255,0.3)',
                                        boxShadow: (newMessage.trim() || stagedFiles.length > 0) ? '0 0 12px rgba(125,135,210,0.4)' : 'none',
                                        transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
                                    }}>
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Full Screen Media Staging Overlay (WhatsApp-style) */}
            {stagedFiles.length > 0 && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    background: 'var(--background)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    {/* Top Bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                        color: '#fff', background: 'var(--card-bg)'
                    }}>
                        <button onClick={() => clearStagedMedia()} className="chat-press" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                            <X size={26} />
                        </button>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {stagedFiles[stagedPreviewIndex]?.type.startsWith('video/') && (
                                <button
                                    onClick={() => setCropFile(stagedFiles[stagedPreviewIndex])}
                                    className="chat-press"
                                    style={{
                                        background: 'rgba(125,135,210,0.18)', border: '1px solid rgba(125,135,210,0.3)', color: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                                        borderRadius: 20
                                    }}
                                >
                                    <Scissors size={18} color="var(--primary)" />
                                    <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Trim</span>
                                </button>
                            )}
                            <div style={{ border: '1px solid rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>HD</div>
                            <button onClick={() => fileRef.current?.click()} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
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
                                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    <div style={{ background: 'var(--card-bg)', padding: '12px 12px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
                        {/* Mini Thumbnails Row (only show if multiple files) */}
                        {stagedFiles.length > 1 && (
                            <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto', paddingLeft: 4 }}>
                                {stagedFileUrls.map((url, i) => (
                                    <div key={i} onClick={() => setStagedPreviewIndex(i)} style={{
                                        width: 54, height: 54, borderRadius: 8, overflow: 'hidden',
                                        border: i === stagedPreviewIndex ? '2px solid var(--primary)' : '2px solid transparent',
                                        cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'all 0.15s ease'
                                    }}>
                                        {stagedFiles[i]?.type.startsWith('video/') ? (
                                            stagedPosters[i] ? (
                                                <img src={stagedPosters[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                            ) : (
                                                <video src={url} muted playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                            )
                                        ) : stagedFiles[i]?.type.startsWith('audio/') ? (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', opacity: i === stagedPreviewIndex ? 1 : 0.5 }}>
                                                <Mic size={18} color="var(--secondary-foreground)" />
                                            </div>
                                        ) : (
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: i === stagedPreviewIndex ? 1 : 0.5 }} />
                                        )}
                                        {/* Pre-upload progress bar */}
                                        {(() => {
                                            const pre = getPreProgress(i);
                                            if (!pre) return null;
                                            if (pre.status === 'done') {
                                                return (
                                                    <div style={{
                                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                                        height: 3, background: '#22c55e', borderRadius: '0 0 6px 6px',
                                                    }} />
                                                );
                                            }
                                            if (pre.status === 'error') {
                                                return (
                                                    <div style={{
                                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                                        height: 3, background: '#ef4444', borderRadius: '0 0 6px 6px',
                                                    }} />
                                                );
                                            }
                                            return (
                                                <div style={{
                                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                                    height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: '0 0 6px 6px', overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${pre.progress}%`,
                                                        background: 'var(--primary)',
                                                        borderRadius: '0 0 6px 6px',
                                                        transition: 'width 0.3s ease',
                                                    }} />
                                                </div>
                                            );
                                        })()}
                                        <button onClick={(e) => { e.stopPropagation(); clearStagedMedia(i); if (stagedPreviewIndex >= stagedFiles.length - 1) setStagedPreviewIndex(Math.max(0, stagedFiles.length - 2)); }}
                                            className="chat-press"
                                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#fff', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => fileRef.current?.click()} className="chat-press" style={{ width: 54, height: 54, borderRadius: 8, border: '2px dashed rgba(134,150,160,0.4)', background: 'none', color: 'var(--secondary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                    <div style={{ fontSize: 26, fontWeight: 300 }}>+</div>
                                </button>
                            </div>
                        )}

                        {/* Caption Input and Send */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: '4px 16px',
                                display: 'flex', alignItems: 'center', minHeight: 48,
                                border: captionFocused ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid rgba(255,255,255,0.07)',
                                boxShadow: captionFocused ? '0 0 0 3px rgba(125, 135, 210, 0.08)' : 'none',
                                transition: 'border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out)',
                            }}>
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onFocus={() => setCaptionFocused(true)}
                                    onBlur={() => setCaptionFocused(false)}
                                    placeholder="Add a caption..."
                                    rows={1}
                                    enterKeyHint="send"
                                    autoCapitalize="sentences"
                                    autoCorrect="on"
                                    spellCheck={true}
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--foreground)', outline: 'none', fontSize: 16, padding: '8px 0', resize: 'none', lineHeight: '1.4', fontFamily: 'inherit' }}
                                    onPaste={handlePaste}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                />
                            </div>
                            {(() => {
                                // Show the primary file's pre-upload progress on the Send button
                                const pre = getPreProgress(stagedPreviewIndex);
                                const isPreUploading = pre && pre.status === 'uploading';
                                const pct = pre?.progress ?? 0;
                                // SVG circle stroke-dashoffset for progress ring
                                const r = 20, circ = 2 * Math.PI * r;
                                const dash = circ - (pct / 100) * circ;
                                return (
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={uploading}
                                        title={isPreUploading ? `Uploading ${pct}% — tap to send anyway` : 'Send'}
                                        className="chat-press"
                                        style={{
                                            width: 52, height: 52, borderRadius: '50%',
                                            background: isPreUploading ? 'rgba(125,135,210,0.15)' : 'var(--primary)',
                                            border: isPreUploading ? '2px solid var(--primary)' : 'none',
                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', position: 'relative',
                                            boxShadow: '0 0 16px rgba(125,135,210,0.45)', flexShrink: 0,
                                            transition: 'background 160ms var(--ease-out), transform 160ms var(--ease-out)',
                                        }}
                                    >
                                        {isPreUploading ? (
                                            <>
                                                <svg width={52} height={52} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                                                    <circle cx={26} cy={26} r={r} fill="none" stroke="var(--primary)" strokeWidth={3}
                                                        strokeDasharray={circ} strokeDashoffset={dash}
                                                        style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
                                                </svg>
                                                <Send size={20} color="var(--primary)" />
                                            </>
                                        ) : (
                                            <Send size={24} />
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

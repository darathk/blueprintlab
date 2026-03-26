'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Calendar as CalendarIcon, Search, X, MailOpen } from 'lucide-react';
import ChatInterface from './ChatInterface';
import AthleteProgramPane from './AthleteProgramPane';

interface Message {
    id: string; senderId: string; receiverId: string; content: string;
    mediaUrl?: string | null; mediaType?: string | null; createdAt: string; read: boolean;
    replyToId?: string | null;
    replyTo?: { id: string; content: string; mediaUrl?: string | null; mediaType?: string | null; sender: { name: string } } | null;
    sender: { id: string; name: string; email: string }; receiver: { id: string; name: string; email: string };
}

interface ConvSummary { athleteId: string; athleteName: string; lastMessage: string; lastMessageAt: string; unreadCount: number; }

interface Props { coachId: string; coachName: string; initialConvos?: ConvSummary[]; initialAthleteId?: string; }

export default function CoachInbox({ coachId, coachName, initialConvos = [], initialAthleteId }: Props) {
    const [convos, setConvos] = useState<ConvSummary[]>(initialConvos);
    const [selectedId, setSelectedId] = useState<string | null>(initialAthleteId || null);
    const selectedConvo = convos.find(c => c.athleteId === selectedId);
    const [isMobile, setIsMobile] = useState(false);
    const [showProgram, setShowProgram] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Sort conversations: unread first, then by latest message
    const sortedConvos = [...convos].sort((a, b) => {
        const aUnread = a.unreadCount > 0;
        const bUnread = b.unreadCount > 0;
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    // Filtered conversations based on search term
    const filteredConvos = sortedConvos.filter(c =>
        c.athleteName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);

    const markAsUnread = async (athleteId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch('/api/messages/mark-unread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: athleteId, receiverId: coachId })
            });
            // Update local state immediately
            setConvos(prev => prev.map(cv =>
                cv.athleteId === athleteId ? { ...cv, unreadCount: Math.max(cv.unreadCount, 1) } : cv
            ));
            // If this was the selected conversation, deselect so it shows as unread
            if (selectedId === athleteId) {
                setSelectedId(null);
            }
            window.dispatchEvent(new Event('unread-refresh'));
        } catch (err) {
            console.error('Failed to mark as unread:', err);
        }
    };

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Fetch lightweight conversation list
    const fetchConvos = useCallback(async () => {
        const r = await fetch(`/api/messages/inbox?coachId=${coachId}`);
        if (r.ok) setConvos(await r.json());
    }, [coachId]);

    // Debounced fetch — coalesces rapid events (realtime + mark-read + send) into a single API call
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const debouncedFetchConvos = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => fetchConvos(), 500);
    }, [fetchConvos]);

    // Refresh conversation list when messages are marked as read or sent
    useEffect(() => {
        const handleRefresh = () => debouncedFetchConvos();
        window.addEventListener('unread-refresh', handleRefresh);
        window.addEventListener('inbox-refresh', handleRefresh);
        return () => {
            window.removeEventListener('unread-refresh', handleRefresh);
            window.removeEventListener('inbox-refresh', handleRefresh);
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [debouncedFetchConvos]);

    // Realtime: subscribe to new messages so sidebar updates instantly
    useEffect(() => {
        const channel = supabase.channel('coach-inbox')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' },
                (payload: any) => {
                    const msg = payload.new;
                    // Only refresh if this coach is sender or receiver
                    if (msg.senderId === coachId || msg.receiverId === coachId) {
                        debouncedFetchConvos();
                    }
                }
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [coachId, debouncedFetchConvos]);

    // Sidebar Time format
    const fmtTime = (s: string) => {
        const d = new Date(s), n = new Date();
        return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className={isMobile && selectedId ? 'chat-full-screen' : 'glass-panel'} style={{ display: 'flex', height: isMobile && selectedId ? undefined : (isMobile ? 'calc(100dvh - 120px)' : 700), overflow: 'hidden', borderRadius: isMobile && selectedId ? 0 : 12 }}>
            {/* Sidebar */}
            <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', display: isMobile && selectedId ? 'none' : 'flex', flexDirection: 'column', background: 'rgba(18, 18, 18, 0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Messages</span>
                    {totalUnread > 0 && <span style={{ background: 'var(--primary)', boxShadow: '0 0 10px rgba(125,135,210,0.5)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 7px', minWidth: 18, textAlign: 'center' as const }}>{totalUnread}</span>}
                </div>

                {/* Search Bar */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, color: 'rgba(255,255,255,0.3)' }} />
                        <input
                            type="text"
                            placeholder="Search athletes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                padding: '6px 12px 6px 32px',
                                fontSize: 13,
                                color: '#fff',
                                outline: 'none'
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredConvos.length === 0 && <div style={{ textAlign: 'center', padding: 32, fontSize: 12, color: 'var(--secondary-foreground)' }}>{searchTerm ? 'No athletes match your search' : 'No conversations'}</div>}
                    {filteredConvos.map(c => (
                        <button key={c.athleteId} onClick={() => {
                            setSelectedId(c.athleteId);
                            setShowProgram(false);
                            // Immediately clear unread count in sidebar
                            if (c.unreadCount > 0) {
                                setConvos(prev => prev.map(cv => cv.athleteId === c.athleteId ? { ...cv, unreadCount: 0 } : cv));
                            }
                        }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                                background: selectedId === c.athleteId ? 'linear-gradient(90deg, rgba(125,135,210,0.15), transparent)' : 'transparent',
                                borderLeft: selectedId === c.athleteId ? '2px solid var(--primary)' : '2px solid transparent',
                                boxShadow: selectedId === c.athleteId ? 'inset 2px 0 10px -2px rgba(125,135,210,0.3)' : 'none',
                                transition: 'all 0.2s ease',
                            }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7d87d2, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14, boxShadow: '0 2px 8px rgba(125,135,210,0.3)' }}>
                                    {c.athleteName.charAt(0).toUpperCase()}
                                </div>
                                {c.unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px rgba(125,135,210,0.6)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unreadCount}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: c.unreadCount > 0 ? 700 : 400, color: c.unreadCount > 0 ? 'var(--foreground)' : 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.athleteName}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                                        {c.unreadCount === 0 && (
                                            <button
                                                onClick={(e) => markAsUnread(c.athleteId, e)}
                                                title="Mark as unread"
                                                className="mark-unread-btn"
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                                                    color: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center',
                                                    borderRadius: 4, transition: 'color 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.15)')}
                                            >
                                                <MailOpen size={12} />
                                            </button>
                                        )}
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{c.lastMessageAt === '1970-01-01T00:00:00Z' ? '' : fmtTime(c.lastMessageAt)}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: c.unreadCount > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 1 }}>{c.lastMessage || 'No messages yet'}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat */}
            <div style={{ flex: 1, display: isMobile && !selectedId ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                {!selectedId ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--secondary-foreground)' }}>
                        <MessageSquare size={40} style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: 13 }}>Select a conversation</span>
                    </div>
                ) : (
                    <ChatInterface
                        key={selectedId} // Re-mount when athlete changes
                        currentUserId={coachId}
                        otherUserId={selectedId}
                        currentUserName={coachName}
                        otherUserName={selectedConvo?.athleteName || 'Athlete'}
                        athleteId={selectedId}
                        isEmbedded={true}
                        onBack={isMobile ? () => setSelectedId(null) : undefined}
                        headerActions={
                            <button
                                onClick={() => setShowProgram(!showProgram)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    background: showProgram ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: 6, padding: '6px 10px',
                                    color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                    marginRight: 8, transition: 'background 0.2s'
                                }}
                            >
                                <CalendarIcon size={14} />
                                {showProgram ? 'Hide Program' : 'View Program'}
                            </button>
                        }
                    />
                )}
            </div>

            {/* Athlete Program Pane */}
            {showProgram && selectedId && (
                <div style={{
                    position: isMobile ? 'absolute' : 'relative',
                    top: 0, right: 0, bottom: 0, zIndex: 50,
                    width: isMobile ? '100%' : 400,
                    flexShrink: 0,
                    borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'var(--background)'
                }}>
                    <AthleteProgramPane
                        athleteId={selectedId}
                        coachId={coachId}
                        onClose={() => setShowProgram(false)}
                    />
                </div>
            )}
        </div>
    );
}

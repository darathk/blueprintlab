'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Calendar as CalendarIcon, Search, X, MailOpen, LayoutDashboard, Pencil, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from './ChatInterface';
import AthleteProgramPane from './AthleteProgramPane';
import AthleteProgramEditPane from './AthleteProgramEditPane';
import CoachNotesPane from './CoachNotesPane';
import { StickyNote } from 'lucide-react';

interface Message {
    id: string; senderId: string; receiverId: string; content: string;
    mediaUrl?: string | null; mediaType?: string | null; createdAt: string; read: boolean;
    replyToId?: string | null;
    replyTo?: { id: string; content: string; mediaUrl?: string | null; mediaType?: string | null; sender: { name: string } } | null;
    sender: { id: string; name: string; email: string }; receiver: { id: string; name: string; email: string };
}

interface ConvSummary { athleteId: string; athleteName: string; lastMessage: string; lastMessageAt: string; unreadCount: number; }

interface Props { coachId: string; coachName: string; initialConvos?: ConvSummary[]; initialAthleteId?: string; initialMessages?: Message[]; athletePositions?: Record<string, { blockName: string; weekNum: number | null; dayNum: number | null; totalWeeks?: number; isFinished?: boolean; lastLogDate: string }>; }

export default function CoachInbox({ coachId, coachName, initialConvos = [], initialAthleteId, initialMessages = [], athletePositions = {} }: Props) {
    const router = useRouter();
    
    // Aggressively prefetch dashboard so exiting chat is instant
    useEffect(() => {
        router.prefetch('/dashboard');
        if (initialAthleteId) {
            router.prefetch(`/dashboard/athletes/${initialAthleteId}`);
        }
    }, [router, initialAthleteId]);

    const [convos, setConvos] = useState<ConvSummary[]>(initialConvos);
    const [selectedId, setSelectedId] = useState<string | null>(initialAthleteId || null);
    const selectedConvo = convos.find(c => c.athleteId === selectedId);
    const [isMobile, setIsMobile] = useState(false);
    const [activeSidebar, setActiveSidebar] = useState<'view' | 'edit' | 'notes' | null>(null);
    const [builderActive, setBuilderActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'unread'>('all');
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

    // Ensure full-screen builder mode is instantly disabled if we leave the edit sidebar
    useEffect(() => {
        if (activeSidebar !== 'edit') {
            setBuilderActive(false);
        }
    }, [activeSidebar]);

    // Sort conversations: unread first, then by latest message
    const sortedConvos = [...convos].sort((a, b) => {
        const aUnread = a.unreadCount > 0;
        const bUnread = b.unreadCount > 0;
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    // Filtered conversations based on search term and toggle
    const filteredConvos = sortedConvos.filter(c => {
        const matchesSearch = c.athleteName.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (filterType === 'unread') return c.unreadCount > 0;
        return true;
    });

    const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);

    const markAsUnread = async (athleteId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Protect this conversation's unread badge from being wiped by a
        // concurrent inbox refetch (e.g. ChatInterface mount PATCH).
        // Cleared when the user explicitly opens the conversation to read it.
        manuallyUnreadRef.current.add(athleteId);
        try {
            const res = await fetch('/api/messages/mark-unread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: athleteId, receiverId: coachId })
            });
            if (!res.ok) {
                manuallyUnreadRef.current.delete(athleteId);
                return;
            }
            setConvos(prev => prev.map(cv =>
                cv.athleteId === athleteId
                    ? { ...cv, unreadCount: Math.max(cv.unreadCount, 1), lastMessageAt: new Date().toISOString() }
                    : cv
            ));
            if (selectedId === athleteId) {
                setSelectedId(null);
            }
        } catch (err) {
            console.error('Failed to mark as unread:', err);
            manuallyUnreadRef.current.delete(athleteId);
        }
    };

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Conversations the user just manually marked unread — preserve their unread
    // state across refetches in case the inbox query races and returns 0.
    const manuallyUnreadRef = useRef<Set<string>>(new Set());

    // Fetch lightweight conversation list
    const fetchConvos = useCallback(async () => {
        const r = await fetch(`/api/messages/inbox?coachId=${coachId}`);
        if (!r.ok) return;
        const data: ConvSummary[] = await r.json();
        const merged = data.map(c => {
            if (!manuallyUnreadRef.current.has(c.athleteId)) return c;
            // Server caught up — it now reports unread, so drop the override.
            if (c.unreadCount > 0) {
                manuallyUnreadRef.current.delete(c.athleteId);
                return c;
            }
            // Server still reports 0 but user manually marked it unread.
            // Keep the optimistic badge until they open the conversation.
            return { ...c, unreadCount: 1 };
        });
        setConvos(merged);
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
        <div className={isMobile && selectedId ? 'chat-full-screen' : 'glass-panel'} style={{ display: 'flex', height: isMobile && selectedId ? undefined : (isMobile ? 'calc(100dvh - 120px)' : 874), overflow: 'hidden', borderRadius: isMobile && selectedId ? 0 : 12 }}>
            {/* Sidebar */}
            <div style={{
                width: isMobile ? '100%' : 260, flexShrink: 0,
                borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderTop: '1px solid var(--glass-specular)',
                display: isMobile && selectedId ? 'none' : 'flex', flexDirection: 'column',
                background: 'rgba(18, 18, 18, 0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
            }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>Messages</span>
                    {totalUnread > 0 && <span style={{ background: 'var(--primary)', boxShadow: '0 0 10px rgba(125,135,210,0.5)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 7px', minWidth: 18, textAlign: 'center' as const }}>{totalUnread}</span>}
                </div>

                {/* Search Bar */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, color: 'rgba(255,255,255,0.3)' }} />
                        <input
                            type="text"
                            placeholder="Search athletes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                                padding: '6px 12px 6px 32px',
                                fontSize: 13,
                                color: '#fff',
                                outline: 'none',
                                transition: 'border-color 200ms var(--ease-out)'
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="chat-press"
                                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Toggle — Apple-style Segmented Control with Sliding Active Pill */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{
                        display: 'flex', position: 'relative', background: 'rgba(255,255,255,0.04)',
                        borderRadius: 8, padding: 2, border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        {/* Sliding active pill indicator */}
                        <div style={{
                            position: 'absolute', top: 2, bottom: 2,
                            left: filterType === 'all' ? 2 : '50%',
                            width: 'calc(50% - 2px)',
                            background: 'rgba(125,135,210,0.18)',
                            border: '1px solid rgba(125,135,210,0.3)',
                            borderRadius: 6,
                            transition: 'left 250ms var(--ease-out)',
                            pointerEvents: 'none'
                        }} />
                        <button
                            onClick={() => setFilterType('all')}
                            className="chat-press"
                            style={{
                                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                border: 'none', cursor: 'pointer', background: 'transparent',
                                color: filterType === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.4)',
                                transition: 'color 200ms var(--ease-out)', position: 'relative', zIndex: 1
                            }}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('unread')}
                            className="chat-press"
                            style={{
                                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                border: 'none', cursor: 'pointer', background: 'transparent',
                                color: filterType === 'unread' ? 'var(--primary)' : 'rgba(255,255,255,0.4)',
                                transition: 'color 200ms var(--ease-out)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                position: 'relative', zIndex: 1
                            }}
                        >
                            Unread {totalUnread > 0 && <span style={{ background: filterType === 'unread' ? 'var(--primary)' : 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{totalUnread}</span>}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredConvos.length === 0 && <div style={{ textAlign: 'center', padding: 32, fontSize: 12, color: 'var(--secondary-foreground)' }}>{searchTerm ? 'No athletes match your search' : 'No conversations'}</div>}
                    {filteredConvos.map(c => (
                        <div key={c.athleteId} role="button" tabIndex={0} onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.mark-unread-btn')) return;
                            setSelectedId(c.athleteId);
                            setActiveSidebar(null);
                            setBuilderActive(false);
                            // User is actively opening this chat — clear any manual-unread
                            // protection so subsequent inbox refetches reflect true read state.
                            manuallyUnreadRef.current.delete(c.athleteId);
                            if (c.unreadCount > 0) {
                                setConvos(prev => prev.map(cv => cv.athleteId === c.athleteId ? { ...cv, unreadCount: 0 } : cv));
                            }
                        }}
                            className="chat-press"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                                background: selectedId === c.athleteId ? 'linear-gradient(90deg, rgba(125,135,210,0.14), transparent)' : 'transparent',
                                borderLeft: selectedId === c.athleteId ? '2px solid var(--primary)' : '2px solid transparent',
                                boxShadow: selectedId === c.athleteId ? 'inset 2px 0 12px -2px rgba(125,135,210,0.25)' : 'none',
                                transition: 'background 200ms var(--ease-out), border-color 200ms var(--ease-out)',
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
                                                type="button"
                                                onClick={(e) => markAsUnread(c.athleteId, e)}
                                                title="Mark as unread"
                                                className="mark-unread-btn chat-press"
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                                                    color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center',
                                                    borderRadius: 4, transition: 'color 150ms var(--ease-out)',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                            >
                                                <MailOpen size={12} />
                                            </button>
                                        )}
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{c.lastMessageAt === '1970-01-01T00:00:00Z' ? '' : fmtTime(c.lastMessageAt)}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: c.unreadCount > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 1 }}>{c.lastMessage || 'No messages yet'}</div>
                            </div>
                        </div>
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
                        initialMessages={selectedId === initialAthleteId ? initialMessages : undefined}
                        isEmbedded={true}
                        onBack={isMobile ? () => setSelectedId(null) : undefined}
                        athletePosition={athletePositions[selectedId]}
                        headerActions={
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                                    className="chat-press"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, padding: '6px 12px',
                                        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                        transition: 'background 160ms var(--ease-out)', whiteSpace: 'nowrap'
                                    }}
                                >
                                    <Menu size={14} /> Actions
                                </button>

                                {actionsMenuOpen && (
                                    <>
                                        <div onClick={() => setActionsMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                                        <div style={{
                                            position: 'absolute', top: '100%', right: 0, marginTop: 8,
                                            background: 'rgba(20, 20, 30, 0.96)',
                                            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                            border: '1px solid var(--glass-border)',
                                            borderTop: '1px solid var(--glass-specular)',
                                            borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 50,
                                            minWidth: 170, boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08)',
                                            transformOrigin: 'top right',
                                            animation: 'popoverIn 200ms var(--ease-out)'
                                        }}>
                                            <Link
                                                prefetch={true}
                                                href={`/dashboard/athletes/${selectedId}`}
                                                title="Dashboard"
                                                onClick={() => setActionsMenuOpen(false)}
                                                className="chat-press"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: 'transparent',
                                                    border: 'none', borderRadius: 6, padding: '8px 12px',
                                                    color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                    textDecoration: 'none', transition: 'background 160ms var(--ease-out)'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <LayoutDashboard size={14} /> Dashboard
                                            </Link>
                                            <button
                                                onClick={() => { setActiveSidebar(activeSidebar === 'notes' ? null : 'notes'); setActionsMenuOpen(false); }}
                                                className="chat-press"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: activeSidebar === 'notes' ? 'var(--primary)' : 'transparent',
                                                    border: 'none', borderRadius: 6, padding: '8px 12px',
                                                    color: activeSidebar === 'notes' ? '#fff' : '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                    textAlign: 'left', transition: 'background 160ms var(--ease-out)'
                                                }}
                                                onMouseEnter={e => { if (activeSidebar !== 'notes') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                                onMouseLeave={e => { if (activeSidebar !== 'notes') e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <StickyNote size={14} /> {activeSidebar === 'notes' ? 'Close Notes' : 'Notes'}
                                            </button>
                                            <button
                                                onClick={() => { setActiveSidebar(activeSidebar === 'edit' ? null : 'edit'); setActionsMenuOpen(false); }}
                                                className="chat-press"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: activeSidebar === 'edit' ? 'var(--primary)' : 'transparent',
                                                    border: 'none', borderRadius: 6, padding: '8px 12px',
                                                    color: activeSidebar === 'edit' ? '#fff' : '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                    textAlign: 'left', transition: 'background 160ms var(--ease-out)'
                                                }}
                                                onMouseEnter={e => { if (activeSidebar !== 'edit') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                                onMouseLeave={e => { if (activeSidebar !== 'edit') e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <Pencil size={14} /> {activeSidebar === 'edit' ? 'Close Editor' : 'Edit Program'}
                                            </button>
                                            <button
                                                onClick={() => { setActiveSidebar(activeSidebar === 'view' ? null : 'view'); setActionsMenuOpen(false); }}
                                                className="chat-press"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: activeSidebar === 'view' ? 'var(--primary)' : 'transparent',
                                                    border: 'none', borderRadius: 6, padding: '8px 12px',
                                                    color: activeSidebar === 'view' ? '#fff' : '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                                    textAlign: 'left', transition: 'background 160ms var(--ease-out)'
                                                }}
                                                onMouseEnter={e => { if (activeSidebar !== 'view') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                                onMouseLeave={e => { if (activeSidebar !== 'view') e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <CalendarIcon size={14} /> {activeSidebar === 'view' ? 'Hide Program' : 'View Program'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        }
                    />
                )}
            </div>

            {/* Athlete Program Pane (View / Edit) */}
            {activeSidebar && selectedId && (
                <div style={{
                    position: (isMobile || builderActive) ? 'absolute' : 'relative',
                    top: 0, 
                    right: 0, 
                    bottom: 0, 
                    left: builderActive ? 0 : 'auto',
                    zIndex: 50,
                    width: (isMobile || builderActive) ? '100%' : 400,
                    maxWidth: '100%',
                    flexShrink: 0,
                    borderLeft: (isMobile || builderActive) ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'var(--background)',
                    transition: 'all 0.3s ease'
                }}>
                    {activeSidebar === 'view' ? (
                        <AthleteProgramPane
                            athleteId={selectedId}
                            coachId={coachId}
                            onClose={() => setActiveSidebar(null)}
                        />
                    ) : activeSidebar === 'edit' ? (
                        <AthleteProgramEditPane
                            athleteId={selectedId}
                            coachId={coachId}
                            onClose={() => setActiveSidebar(null)}
                            onBuilderActive={setBuilderActive}
                        />
                    ) : activeSidebar === 'notes' ? (
                        <CoachNotesPane
                            athleteId={selectedId}
                            athleteName={selectedConvo?.athleteName}
                            onClose={() => setActiveSidebar(null)}
                        />
                    ) : null}
                </div>
            )}
        </div>
    );
}

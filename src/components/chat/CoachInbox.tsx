'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare } from 'lucide-react';
import ChatInterface from './ChatInterface';

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
    const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);

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

    // Sidebar Time format
    const fmtTime = (s: string) => {
        const d = new Date(s), n = new Date();
        return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className={isMobile && selectedId ? 'chat-full-screen' : 'glass-panel'} style={{ display: 'flex', height: isMobile && selectedId ? undefined : (isMobile ? 'calc(100dvh - 120px)' : 700), overflow: 'hidden', borderRadius: isMobile && selectedId ? 0 : 12 }}>
            {/* Sidebar */}
            <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--card-border)', display: isMobile && selectedId ? 'none' : 'flex', flexDirection: 'column', background: 'rgba(15,23,42,0.3)' }}>
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
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginLeft: 6 }}>{c.lastMessageAt === '1970-01-01T00:00:00Z' ? '' : fmtTime(c.lastMessageAt)}</span>
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
                    />
                )}
            </div>
        </div>
    );
}

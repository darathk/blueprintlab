'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function AnnouncementBanner({ coachId }: { coachId: string }) {
    const [announcement, setAnnouncement] = useState<{ message: string; startDate: string; endDate: string } | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!coachId) return;
        const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
        fetch(`/api/announcements?coachId=${coachId}&date=${localDate}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.announcement) setAnnouncement(data.announcement); })
            .catch(() => {});
    }, [coachId]);

    if (!announcement || dismissed) return null;

    return (
        <div style={{
            margin: '0 0 1rem 0',
            padding: '1.15rem 1.25rem',
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(20,24,36,0.85) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(251,191,36,0.35)',
            boxShadow: '0 10px 30px -6px rgba(0, 0, 0, 0.45), 0 0 20px rgba(251,191,36,0.1), inset 0 1px 0 rgba(255,255,255,0.12)',
            display: 'flex',
            gap: '0.9rem',
            alignItems: 'flex-start',
            animation: 'fadeIn 0.4s ease',
        }}>
            <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(251,191,36,0.18)',
                border: '1px solid rgba(251,191,36,0.4)',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(251,191,36,0.25)',
                fontSize: '1.15rem'
            }}>
                📣
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                    Message from your Coach
                </div>
                <div style={{ fontSize: '0.92rem', color: '#f8fafc', lineHeight: 1.5, fontWeight: 500 }}>
                    {announcement.message}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', marginTop: '0.45rem', opacity: 0.75, fontWeight: 500 }}>
                    {announcement.startDate} – {announcement.endDate}
                </div>
            </div>
            <button
                onClick={() => setDismissed(true)}
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--secondary-foreground)',
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.16s ease',
                }}
                className="chat-press"
                title="Dismiss"
            >
                <X size={15} />
            </button>
        </div>
    );
}

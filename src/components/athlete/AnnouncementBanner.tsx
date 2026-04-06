'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function AnnouncementBanner({ coachId }: { coachId: string }) {
    const [announcement, setAnnouncement] = useState<{ message: string; startDate: string; endDate: string } | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!coachId) return;
        fetch(`/api/announcements?coachId=${coachId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.announcement) setAnnouncement(data.announcement); })
            .catch(() => {});
    }, [coachId]);

    if (!announcement || dismissed) return null;

    return (
        <div style={{
            margin: '0 0 1rem 0',
            padding: '1rem 1.1rem',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.1) 100%)',
            border: '1.5px solid rgba(251,191,36,0.5)',
            boxShadow: '0 4px 24px rgba(251,191,36,0.15)',
            display: 'flex',
            gap: '0.85rem',
            alignItems: 'flex-start',
            animation: 'fadeIn 0.4s ease',
        }}>
            <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>📣</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                    Message from your Coach
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.5, fontWeight: 500 }}>
                    {announcement.message}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: '0.4rem', opacity: 0.7 }}>
                    {announcement.startDate} – {announcement.endDate}
                </div>
            </div>
            <button
                onClick={() => setDismissed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-foreground)', flexShrink: 0, padding: 2, opacity: 0.6 }}
                title="Dismiss"
            >
                <X size={16} />
            </button>
        </div>
    );
}

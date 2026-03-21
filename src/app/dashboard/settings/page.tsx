'use client';

import { useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import NotificationToggle from '@/components/notifications/NotificationToggle';

export default function CoachSettingsPage() {
    const [normalizeStatus, setNormalizeStatus] = useState<string | null>(null);
    const [normalizeLoading, setNormalizeLoading] = useState(false);

    const handleNormalizeEmails = async () => {
        setNormalizeLoading(true);
        setNormalizeStatus(null);
        try {
            const res = await fetch('/api/athletes/normalize-emails', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setNormalizeStatus(data.message);
            } else {
                setNormalizeStatus(data.error || 'Failed to normalize emails');
            }
        } catch {
            setNormalizeStatus('Network error');
        }
        setNormalizeLoading(false);
    };

    return (
        <div style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: '24px 16px 120px',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '32px',
            }}>
                <Link
                    href="/dashboard"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--secondary-foreground)',
                    }}
                >
                    <ArrowLeft size={18} />
                </Link>
                <h1 style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--foreground)',
                    margin: 0,
                }}>
                    Settings
                </h1>
            </div>

            {/* Account Section */}
            <div style={{ marginBottom: '28px' }}>
                <div style={sectionLabelStyle}>Account</div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                    <UserButton
                        afterSignOutUrl="/sign-in"
                        appearance={{
                            elements: {
                                avatarBox: { width: 44, height: 44 },
                            }
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            marginBottom: '2px',
                        }}>
                            Profile & Account
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--secondary-foreground)',
                            opacity: 0.7,
                        }}>
                            Tap your avatar to manage your account
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications Section */}
            <div style={{ marginBottom: '28px' }}>
                <div style={sectionLabelStyle}>Notifications</div>
                <NotificationToggle role="coach" />
            </div>

            {/* Data Cleanup Section */}
            <div style={{ marginBottom: '28px' }}>
                <div style={sectionLabelStyle}>Data Cleanup</div>
                <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                    <div style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        marginBottom: '4px',
                    }}>
                        Fix Duplicate Athletes
                    </div>
                    <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--secondary-foreground)',
                        marginBottom: '12px',
                        lineHeight: 1.4,
                    }}>
                        If the same athlete appears twice due to email casing differences (e.g. &quot;John@Email.com&quot; vs &quot;john@email.com&quot;), this will merge them into one record and transfer all programs and data.
                    </div>
                    <button
                        onClick={handleNormalizeEmails}
                        disabled={normalizeLoading}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--foreground)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: normalizeLoading ? 'wait' : 'pointer',
                            opacity: normalizeLoading ? 0.5 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {normalizeLoading ? 'Fixing...' : 'Fix Email Duplicates'}
                    </button>
                    {normalizeStatus && (
                        <div style={{
                            marginTop: '10px',
                            fontSize: '0.8rem',
                            color: normalizeStatus.startsWith('Failed') || normalizeStatus === 'Network error'
                                ? 'var(--destructive)'
                                : 'var(--primary)',
                            lineHeight: 1.4,
                        }}>
                            {normalizeStatus}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const sectionLabelStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--secondary-foreground)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '10px',
    paddingLeft: '4px',
    opacity: 0.6,
};

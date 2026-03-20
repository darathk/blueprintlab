'use client';

import { useParams } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import NotificationToggle from '@/components/notifications/NotificationToggle';

export default function AthleteSettingsPage() {
    const params = useParams();
    const id = params.id as string;

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
                    href={`/athlete/${id}/dashboard`}
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
                <NotificationToggle />
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

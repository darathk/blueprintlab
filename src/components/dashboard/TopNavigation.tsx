'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useUnreadCount } from '@/components/notifications/UnreadBadge';
import { 
    ChevronDown, 
    Target, 
    ClipboardList, 
    Medal, 
    Sparkles,
    Video 
} from 'lucide-react';

export default function TopNavigation({ 
    unreadCount = 0, 
    userId, 
    isOwner = false 
}: { 
    unreadCount?: number; 
    userId?: string; 
    isOwner?: boolean 
}) {
    const pathname = usePathname();
    const liveUnread = useUnreadCount(userId || '', unreadCount);
    const displayUnread = userId ? liveUnread : unreadCount;

    const [openDropdown, setOpenDropdown] = useState<'meets' | 'community' | null>(null);
    const navRef = useRef<HTMLDivElement>(null);

    // Close dropdown on pathname change
    useEffect(() => {
        setOpenDropdown(null);
    }, [pathname]);

    // Close on click outside or Escape key
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpenDropdown(null);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    const isMeetsActive = pathname.startsWith('/dashboard/meet-day') || pathname.startsWith('/dashboard/meet-data');
    const isCommunityActive = 
        pathname.startsWith('/dashboard/leaderboard') || 
        pathname.startsWith('/dashboard/highlights') ||
        pathname.startsWith('/dashboard/tutorials');

    const primaryLinks = [
        { href: '/dashboard', label: 'Command Center' },
        { href: '/dashboard/messages', label: 'Messages', isMessages: true },
        { href: '/dashboard/revenue', label: 'Revenue' },
    ];

    const meetsItems = [
        {
            href: '/dashboard/meet-day',
            label: 'Meet Day',
            description: 'Live attempt management & platform flow',
            icon: <Target size={16} className="text-cyan-400" />,
            active: pathname.startsWith('/dashboard/meet-day')
        },
        {
            href: '/dashboard/meet-data',
            label: 'Meet Data',
            description: 'OpenPowerlifting database & lifter stats',
            icon: <ClipboardList size={16} className="text-indigo-400" />,
            active: pathname.startsWith('/dashboard/meet-data')
        }
    ];

    const communityItems = [
        {
            href: '/dashboard/leaderboard',
            label: 'Leaderboard',
            description: 'Roster strength PR & DOTS rankings',
            icon: <Medal size={16} className="text-amber-400" />,
            active: pathname.startsWith('/dashboard/leaderboard')
        },
        {
            href: '/dashboard/highlights',
            label: 'Highlights',
            description: 'Athlete milestone celebration cards',
            icon: <Sparkles size={16} className="text-pink-400" />,
            active: pathname.startsWith('/dashboard/highlights')
        },
        {
            href: '/dashboard/tutorials',
            label: 'Tutorials',
            description: 'Video coaching guides & walk-throughs',
            icon: <Video size={16} className="text-purple-400" />,
            active: pathname.startsWith('/dashboard/tutorials')
        }
    ];

    return (
        <nav 
            ref={navRef}
            className="dashboard-nav flex items-center justify-end" 
            style={{ gap: '1rem' }}
        >
            {/* Sleek Floating Glass Capsule Dock */}
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 6px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.035)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}>
                {/* 1. Direct Primary Hubs */}
                {primaryLinks.map((link) => {
                    const active = isActive(link.href);
                    return (
                        <Link
                            key={link.href}
                            prefetch={true}
                            href={link.href}
                            className="chat-press"
                            style={{
                                fontWeight: active ? 600 : 500,
                                fontSize: '0.8125rem',
                                color: active ? '#fff' : 'var(--secondary-foreground)',
                                padding: '6px 14px',
                                borderRadius: 9999,
                                background: active ? 'rgba(125, 135, 210, 0.18)' : 'transparent',
                                border: active ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid transparent',
                                boxShadow: active ? '0 0 14px rgba(125, 135, 210, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                                backdropFilter: active ? 'blur(8px)' : 'none',
                                WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
                                transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                                if (!active) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                    e.currentTarget.style.color = 'var(--foreground)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!active) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--secondary-foreground)';
                                }
                            }}
                        >
                            <span>{link.label}</span>
                            {link.isMessages && displayUnread > 0 && (
                                <span style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    borderRadius: 10,
                                    padding: '1px 5px',
                                    minWidth: 16,
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)'
                                }}>
                                    {displayUnread}
                                </span>
                            )}
                        </Link>
                    );
                })}

                {/* 2. Meets Dropdown Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === 'meets' ? null : 'meets')}
                        className="chat-press"
                        style={{
                            fontWeight: isMeetsActive || openDropdown === 'meets' ? 600 : 500,
                            fontSize: '0.8125rem',
                            color: isMeetsActive || openDropdown === 'meets' ? '#fff' : 'var(--secondary-foreground)',
                            padding: '6px 13px',
                            borderRadius: 9999,
                            background: isMeetsActive 
                                ? 'rgba(125, 135, 210, 0.18)' 
                                : (openDropdown === 'meets' ? 'rgba(255, 255, 255, 0.08)' : 'transparent'),
                            border: isMeetsActive ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid transparent',
                            boxShadow: isMeetsActive ? '0 0 14px rgba(125, 135, 210, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                            transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            cursor: 'pointer',
                            outline: 'none',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            if (!isMeetsActive && openDropdown !== 'meets') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.color = 'var(--foreground)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isMeetsActive && openDropdown !== 'meets') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--secondary-foreground)';
                            }
                        }}
                    >
                        <span>Meets</span>
                        <ChevronDown 
                            size={13} 
                            style={{ 
                                transform: openDropdown === 'meets' ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 180ms ease-out',
                                opacity: 0.75,
                            }} 
                        />
                    </button>

                    {/* Meets Floating Glass Popover */}
                    {openDropdown === 'meets' && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            minWidth: 260,
                            padding: '6px',
                            borderRadius: '16px',
                            background: 'rgba(16, 16, 24, 0.96)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                            zIndex: 250,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transformOrigin: 'top right',
                            animation: 'popoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                        }}>
                            {meetsItems.map((item) => (
                                <Link
                                    key={item.href}
                                    prefetch={true}
                                    href={item.href}
                                    onClick={() => setOpenDropdown(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        background: item.active ? 'rgba(125, 135, 210, 0.15)' : 'transparent',
                                        border: item.active ? '1px solid rgba(125, 135, 210, 0.25)' : '1px solid transparent',
                                        transition: 'background 120ms ease-out',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!item.active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!item.active) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '9px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {item.icon}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                                            {item.label}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', lineHeight: 1.3 }}>
                                            {item.description}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Community / Showcase Dropdown Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === 'community' ? null : 'community')}
                        className="chat-press"
                        style={{
                            fontWeight: isCommunityActive || openDropdown === 'community' ? 600 : 500,
                            fontSize: '0.8125rem',
                            color: isCommunityActive || openDropdown === 'community' ? '#fff' : 'var(--secondary-foreground)',
                            padding: '6px 13px',
                            borderRadius: 9999,
                            background: isCommunityActive 
                                ? 'rgba(125, 135, 210, 0.18)' 
                                : (openDropdown === 'community' ? 'rgba(255, 255, 255, 0.08)' : 'transparent'),
                            border: isCommunityActive ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid transparent',
                            boxShadow: isCommunityActive ? '0 0 14px rgba(125, 135, 210, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                            transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            cursor: 'pointer',
                            outline: 'none',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            if (!isCommunityActive && openDropdown !== 'community') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.color = 'var(--foreground)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isCommunityActive && openDropdown !== 'community') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--secondary-foreground)';
                            }
                        }}
                    >
                        <span>Community</span>
                        <ChevronDown 
                            size={13} 
                            style={{ 
                                transform: openDropdown === 'community' ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 180ms ease-out',
                                opacity: 0.75,
                            }} 
                        />
                    </button>

                    {/* Community Floating Glass Popover */}
                    {openDropdown === 'community' && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            minWidth: 270,
                            padding: '6px',
                            borderRadius: '16px',
                            background: 'rgba(16, 16, 24, 0.96)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                            zIndex: 250,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transformOrigin: 'top right',
                            animation: 'popoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                        }}>
                            {communityItems.map((item) => (
                                <Link
                                    key={item.href}
                                    prefetch={true}
                                    href={item.href}
                                    onClick={() => setOpenDropdown(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        background: item.active ? 'rgba(125, 135, 210, 0.15)' : 'transparent',
                                        border: item.active ? '1px solid rgba(125, 135, 210, 0.25)' : '1px solid transparent',
                                        transition: 'background 120ms ease-out',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!item.active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!item.active) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '9px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {item.icon}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                                            {item.label}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--secondary-foreground)', lineHeight: 1.3 }}>
                                            {item.description}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Avatar Button */}
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <UserButton afterSignOutUrl="/" />
            </div>
        </nav>
    );
}

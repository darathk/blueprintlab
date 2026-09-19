'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { useUnreadCount } from '@/components/notifications/UnreadBadge';
import { Menu, X } from 'lucide-react';

export interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    unreadCount?: number;
}

export default function MobileBottomNav({ items, children, className, userId }: { items: NavItem[], children?: React.ReactNode, className?: string, userId?: string }) {
    const pathname = usePathname();
    const serverUnread = items.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
    const liveUnread = useUnreadCount(userId || '', serverUnread);
    const [isOpen, setIsOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);

    // Close on pathname change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isActive = (href: string) => {
        if (href === '/dashboard' && pathname === '/dashboard') return true;
        if (href !== '/dashboard' && pathname.startsWith(href)) return true;
        if (href.includes('/athlete') && href.endsWith('/dashboard') && pathname === href) return true;
        return false;
    };

    // Inject live unread count into the Messages item
    const enrichedItems = items.map(item => {
        if (item.unreadCount !== undefined && item.label === 'Messages') {
            return { ...item, unreadCount: userId ? liveUnread : item.unreadCount };
        }
        return item;
    });

    const totalUnread = enrichedItems.reduce((sum, item) => sum + (item.unreadCount || 0), 0);

    return (
        <nav
            ref={navRef}
            className={`md:hidden ${className || ''}`}
            style={{
                position: 'fixed',
                bottom: 'env(safe-area-inset-bottom, 20px)',
                left: 0,
                right: 0,
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                pointerEvents: 'none',
                paddingBottom: 24, // Keep it floating nicely above the bottom edge
            }}
        >
            <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'auto',
            }}>
                {/* Expanded Menu - Clean Grouped App Launcher Card */}
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 16px)',
                    width: 'min(calc(100vw - 32px), 324px)',
                    maxHeight: 'calc(100dvh - 130px)',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '14px',
                    borderRadius: 24,
                    background: 'rgba(16, 16, 24, 0.94)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: isOpen ? 'auto' : 'none',
                }}>
                    {/* Top Branding Pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px 4px 4px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                        <div style={{ fontWeight: 800, fontSize: '0.82rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: 'var(--foreground)' }}>Blueprint<span style={{ color: 'var(--primary)' }}>Lab</span></span>
                        </div>
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--secondary-foreground)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}>
                            Navigation
                        </span>
                    </div>

                    {/* 1. Core Primary Hubs (2-column grid) */}
                    {(() => {
                        const isMeets = (l: string) => ['Meet Day', 'Meet Data', 'Meet'].includes(l);
                        const isCommunity = (l: string) => ['Board', 'Leaderboard', 'Highlights', 'Tutorials', 'History'].includes(l);
                        const isSettings = (l: string) => l === 'Settings';

                        const coreItems = enrichedItems.filter(i => !isMeets(i.label) && !isCommunity(i.label) && !isSettings(i.label));
                        const meetsItems = enrichedItems.filter(i => isMeets(i.label));
                        const communityItems = enrichedItems.filter(i => isCommunity(i.label));
                        const settingsItem = enrichedItems.find(i => isSettings(i.label));

                        const renderTile = (item: NavItem, fullWidth = false) => {
                            const active = isActive(item.href);
                            const isWorkout = item.label === 'Workout Log';
                            const isCoach = item.label === 'Coach Mode';
                            const isPlateLoader = item.label === 'Plate Loader';

                            let bg = active ? 'rgba(125, 135, 210, 0.18)' : 'rgba(255, 255, 255, 0.04)';
                            let border = active ? '1px solid rgba(125, 135, 210, 0.38)' : '1px solid rgba(255, 255, 255, 0.07)';
                            let color = active ? '#fff' : 'rgba(255, 255, 255, 0.85)';
                            let glow = active ? '0 0 14px rgba(125, 135, 210, 0.22)' : 'none';

                            if (isWorkout) {
                                bg = 'linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(125, 135, 210, 0.2) 100%)';
                                border = '1px solid rgba(168, 85, 247, 0.42)';
                                color = '#d8b4fe';
                                glow = '0 0 14px rgba(168, 85, 247, 0.22)';
                            } else if (isCoach) {
                                bg = 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%)';
                                border = '1px solid rgba(6, 182, 212, 0.42)';
                                color = '#38bdf8';
                                glow = '0 0 14px rgba(6, 182, 212, 0.22)';
                            } else if (isPlateLoader) {
                                bg = active ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.08)';
                                border = active ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(239, 68, 68, 0.2)';
                                color = '#f87171';
                                glow = active ? '0 0 14px rgba(239, 68, 68, 0.25)' : 'none';
                            }

                            return (
                                <Link
                                    key={item.href}
                                    prefetch={true}
                                    href={item.href}
                                    className="chat-press"
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (active) {
                                            window.dispatchEvent(new CustomEvent('app:nav-reclick', {
                                                detail: { label: item.label, href: item.href }
                                            }));
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '9px',
                                        height: 44,
                                        padding: '0 12px',
                                        borderRadius: '13px',
                                        background: bg,
                                        border: border,
                                        boxShadow: glow,
                                        textDecoration: 'none',
                                        position: 'relative',
                                        transition: 'all 0.16s ease',
                                        flex: fullWidth ? '1 1 100%' : '1 1 calc(50% - 5px)',
                                        minWidth: 0,
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 20,
                                        height: 20,
                                        color: isWorkout ? '#c084fc' : (isCoach ? '#38bdf8' : (isPlateLoader ? '#ef4444' : (active ? 'var(--primary)' : 'rgba(255, 255, 255, 0.65)'))),
                                        flexShrink: 0,
                                    }}>
                                        {React.isValidElement(item.icon) 
                                            ? React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 18 })
                                            : item.icon
                                        }
                                    </div>

                                    <span style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: active || isWorkout || isCoach ? 700 : 500,
                                        color: color,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {item.label}
                                    </span>

                                    {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                        <div style={{
                                            marginLeft: 'auto',
                                            background: '#ef4444',
                                            color: '#fff',
                                            fontSize: '0.625rem',
                                            fontWeight: 800,
                                            borderRadius: 10,
                                            padding: '1px 6px',
                                            minWidth: 16,
                                            textAlign: 'center',
                                            lineHeight: '1.2',
                                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.6)',
                                            flexShrink: 0,
                                        }}>
                                            {item.unreadCount}
                                        </div>
                                    )}
                                </Link>
                            );
                        };

                        return (
                            <>
                                {/* Core Grid */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {coreItems.map(item => renderTile(item))}
                                </div>

                                {/* Meets Section */}
                                {meetsItems.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: 'var(--secondary-foreground)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.07em',
                                            paddingLeft: '4px',
                                            marginTop: '2px',
                                        }}>
                                            Meets
                                        </span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {meetsItems.map(item => renderTile(item))}
                                        </div>
                                    </div>
                                )}

                                {/* Community Section */}
                                {communityItems.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: 'var(--secondary-foreground)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.07em',
                                            paddingLeft: '4px',
                                            marginTop: '2px',
                                        }}>
                                            Community
                                        </span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {communityItems.map((item, idx) => 
                                                renderTile(item, communityItems.length % 2 !== 0 && idx === communityItems.length - 1)
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Settings Footer */}
                                {settingsItem && (
                                    <div style={{
                                        paddingTop: '6px',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                        display: 'flex',
                                    }}>
                                        {renderTile(settingsItem, true)}
                                    </div>
                                )}
                            </>
                        );
                    })()}

                    {/* Profile / Children slot */}
                    {children && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4px' }}>
                            {children}
                        </div>
                    )}
                </div>

                {/* FAB Toggle Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="chat-press"
                    style={{
                        width: 58,
                        height: 58,
                        borderRadius: '50%',
                        background: isOpen ? 'rgba(24, 24, 34, 0.95)' : 'rgba(20, 20, 28, 0.88)',
                        backdropFilter: 'blur(var(--glass-blur-lg))',
                        WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
                        color: isOpen ? 'var(--primary)' : '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55), var(--glass-specular)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.25s var(--ease-out)',
                        position: 'relative',
                    }}
                    aria-label="Toggle Navigation"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                    {!isOpen && totalUnread > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: '#ef4444',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '2px solid rgba(20, 20, 28, 0.9)',
                            boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                        }} />
                    )}
                </button>
            </div>
        </nav>
    );
}

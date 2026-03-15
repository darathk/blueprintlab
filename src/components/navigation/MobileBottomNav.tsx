'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { useUnreadCount } from '@/components/notifications/UnreadBadge';

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
    const [open, setOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === '/dashboard' && pathname === '/dashboard') return true;
        if (href !== '/dashboard' && pathname.startsWith(href)) return true;
        if (href.includes('/athlete') && href.endsWith('/dashboard') && pathname === href) return true;
        return false;
    };

    // Close drawer on route change
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
    }, []);

    useEffect(() => {
        if (open) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [open, handleKeyDown]);

    const totalUnread = userId ? liveUnread : items.reduce((sum, item) => sum + (item.unreadCount || 0), 0);

    return (
        <>
            {/* Floating hamburger trigger button */}
            <button
                className={`md:hidden ${className || ''}`}
                onClick={() => setOpen(prev => !prev)}
                aria-label={open ? 'Close navigation' : 'Open navigation'}
                aria-expanded={open}
                style={{
                    position: 'fixed',
                    bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
                    right: '20px',
                    zIndex: 1001,
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    border: '1px solid rgba(125, 135, 210, 0.3)',
                    background: open
                        ? 'rgba(125, 135, 210, 0.25)'
                        : 'rgba(30, 41, 59, 0.85)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    boxShadow: open
                        ? '0 0 20px rgba(125, 135, 210, 0.4), inset 0 0 20px rgba(125, 135, 210, 0.1)'
                        : '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 10px rgba(125, 135, 210, 0.15)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: 0,
                }}
            >
                {/* Animated hamburger → X icon */}
                <div style={{
                    width: 22,
                    height: 16,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}>
                    <span style={{
                        display: 'block',
                        width: '100%',
                        height: 2,
                        borderRadius: 2,
                        background: open ? 'var(--primary)' : 'var(--foreground)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
                        transformOrigin: 'center',
                    }} />
                    <span style={{
                        display: 'block',
                        width: '100%',
                        height: 2,
                        borderRadius: 2,
                        background: open ? 'var(--primary)' : 'var(--foreground)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: open ? 0 : 1,
                        transform: open ? 'scaleX(0)' : 'scaleX(1)',
                    }} />
                    <span style={{
                        display: 'block',
                        width: '100%',
                        height: 2,
                        borderRadius: 2,
                        background: open ? 'var(--primary)' : 'var(--foreground)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
                        transformOrigin: 'center',
                    }} />
                </div>

                {/* Unread badge on hamburger */}
                {!open && totalUnread > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        borderRadius: 10,
                        padding: '2px 5px',
                        minWidth: 16,
                        textAlign: 'center',
                        lineHeight: 1,
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    }}>
                        {totalUnread}
                    </div>
                )}
            </button>

            {/* Backdrop overlay */}
            <div
                className="md:hidden"
                onClick={() => setOpen(false)}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999,
                    background: 'rgba(2, 6, 23, 0.6)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? 'auto' : 'none',
                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Slide-up navigation drawer */}
            <nav
                className="md:hidden"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    transform: open ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    background: 'rgba(30, 41, 59, 0.92)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderTop: '1px solid rgba(125, 135, 210, 0.2)',
                    borderRadius: '20px 20px 0 0',
                    boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(125, 135, 210, 0.1)',
                }}
            >
                {/* Drawer handle */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '10px 0 6px',
                }}>
                    <div style={{
                        width: 36,
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(148, 163, 184, 0.3)',
                    }} />
                </div>

                {/* Navigation items */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(items.length + 1, 4)}, 1fr)`,
                    gap: '4px',
                    padding: '8px 16px 16px',
                }}>
                    {items.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={(e) => {
                                    if (active) {
                                        window.dispatchEvent(new CustomEvent('app:nav-reclick', {
                                            detail: { label: item.label, href: item.href }
                                        }));
                                    }
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    textDecoration: 'none',
                                    padding: '14px 8px',
                                    borderRadius: 14,
                                    background: active
                                        ? 'rgba(125, 135, 210, 0.15)'
                                        : 'rgba(148, 163, 184, 0.05)',
                                    border: active
                                        ? '1px solid rgba(125, 135, 210, 0.3)'
                                        : '1px solid rgba(148, 163, 184, 0.08)',
                                    color: active ? 'var(--primary)' : 'var(--secondary-foreground)',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    boxShadow: active
                                        ? '0 0 12px rgba(125, 135, 210, 0.2)'
                                        : 'none',
                                }}
                            >
                                <div style={{
                                    fontSize: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    filter: active ? 'drop-shadow(0 0 8px rgba(125, 135, 210, 0.4))' : 'none',
                                    transform: active ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {item.icon}
                                </div>
                                <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    opacity: active ? 1 : 0.7,
                                }}>
                                    {item.label}
                                </span>

                                {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 6,
                                        right: '20%',
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        borderRadius: 10,
                                        padding: '1px 5px',
                                        minWidth: 16,
                                        textAlign: 'center',
                                        lineHeight: 1,
                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
                                    }}>
                                        {item.unreadCount}
                                    </div>
                                )}
                            </Link>
                        );
                    })}

                    {/* Profile slot */}
                    {children && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '14px 8px',
                            borderRadius: 14,
                            background: 'rgba(148, 163, 184, 0.05)',
                            border: '1px solid rgba(148, 163, 184, 0.08)',
                        }}>
                            {children}
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}

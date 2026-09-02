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
                {/* Expanded Menu - Vertical Glass Pill */}
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: 32,
                    background: 'rgba(18, 18, 26, 0.88)',
                    backdropFilter: 'blur(var(--glass-blur-lg))',
                    WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: 'var(--glass-ring), 0 16px 48px rgba(0, 0, 0, 0.6), var(--glass-specular)',
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    pointerEvents: isOpen ? 'auto' : 'none',
                }}>
                    {enrichedItems.map((item) => {
                        const active = isActive(item.href);
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
                                    justifyContent: 'flex-start',
                                    textDecoration: 'none',
                                    position: 'relative',
                                    minWidth: 160,
                                    height: 52,
                                    padding: '0 20px',
                                    borderRadius: 26,
                                    background: active ? 'rgba(125, 135, 210, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                                    border: active ? '1px solid rgba(125, 135, 210, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    boxShadow: active 
                                        ? '0 0 16px rgba(125, 135, 210, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12)' 
                                        : 'var(--glass-specular)',
                                    transition: 'all 0.2s var(--ease-out)',
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    color: active ? 'var(--primary)' : 'rgba(255, 255, 255, 0.55)',
                                    transform: active ? 'scale(1.05)' : 'scale(1)',
                                    transition: 'transform 0.2s ease, color 0.2s ease',
                                }}>
                                    {item.icon}
                                </div>
                                
                                <span style={{
                                    marginLeft: 14,
                                    fontSize: 14,
                                    fontWeight: active ? 600 : 500,
                                    letterSpacing: '0.01em',
                                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                                    transition: 'color 0.2s ease',
                                }}>
                                    {item.label}
                                </span>

                                {/* Unread badge */}
                                {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 10,
                                        right: 12,
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        borderRadius: 12,
                                        padding: '2px 6px',
                                        minWidth: 18,
                                        textAlign: 'center',
                                        lineHeight: '1.2',
                                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                                        border: '1px solid rgba(255,255,255,0.2)'
                                    }}>
                                        {item.unreadCount}
                                    </div>
                                )}
                            </Link>
                        );
                    })}

                    {/* Profile / More slot */}
                    {children && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

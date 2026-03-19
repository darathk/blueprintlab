'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
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

    return (
        <nav
            className={`md:hidden ${className || ''}`}
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                gap: '2px',
                margin: '0 12px 10px',
                padding: '8px 6px',
                borderRadius: 28,
                background: 'rgba(18, 18, 18, 0.9)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 0 0 0.5px rgba(255, 255, 255, 0.06), 0 8px 32px rgba(0, 0, 0, 0.6)',
                width: '100%',
                maxWidth: 440,
                pointerEvents: 'auto',
            }}>
                {enrichedItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => {
                                if (active) {
                                    window.dispatchEvent(new CustomEvent('app:nav-reclick', {
                                        detail: { label: item.label, href: item.href }
                                    }));
                                }
                            }}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                position: 'relative',
                                flex: 1,
                                minWidth: 0,
                                padding: '4px 0 2px',
                            }}
                        >
                            {/* Icon container with circular active highlight */}
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: active
                                    ? 'rgba(125, 135, 210, 0.18)'
                                    : 'transparent',
                                border: active
                                    ? '1px solid rgba(125, 135, 210, 0.3)'
                                    : '1px solid transparent',
                                boxShadow: active
                                    ? '0 0 16px rgba(125, 135, 210, 0.15)'
                                    : 'none',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: active ? 'var(--primary)' : 'var(--secondary-foreground)',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: active ? 'scale(1.1)' : 'scale(1)',
                                    filter: active ? 'drop-shadow(0 0 6px rgba(125, 135, 210, 0.4))' : 'none',
                                }}>
                                    {item.icon}
                                </div>

                                {/* Unread badge */}
                                {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: '50%',
                                        marginRight: -20,
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.55rem',
                                        fontWeight: 700,
                                        borderRadius: 10,
                                        padding: '1px 4px',
                                        minWidth: 15,
                                        textAlign: 'center',
                                        lineHeight: '13px',
                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                                    }}>
                                        {item.unreadCount}
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <span style={{
                                fontSize: '0.6rem',
                                fontWeight: active ? 700 : 500,
                                letterSpacing: '0.01em',
                                color: active ? 'var(--primary)' : 'var(--secondary-foreground)',
                                opacity: active ? 1 : 0.65,
                                transition: 'all 0.25s ease',
                                whiteSpace: 'nowrap',
                            }}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* Profile / More slot */}
                {children && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        flex: 1,
                        minWidth: 0,
                        padding: '4px 0 2px',
                    }}>
                        {children}
                    </div>
                )}
            </div>
        </nav>
    );
}

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
                gap: '0px',
                margin: '0 16px 14px',
                padding: '6px 8px',
                borderRadius: 40,
                background: 'rgba(30, 30, 30, 0.92)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
                width: '100%',
                maxWidth: 380,
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
                                alignItems: 'center',
                                justifyContent: 'center',
                                textDecoration: 'none',
                                position: 'relative',
                                flex: 1,
                                minWidth: 0,
                                padding: '10px 0',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'transform 0.2s ease, opacity 0.2s ease',
                                transform: active ? 'scale(1.15)' : 'scale(1)',
                                color: active ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                filter: active ? 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.2))' : 'none',
                            }}>
                                {item.icon}
                            </div>

                            {/* Unread badge */}
                            {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: '50%',
                                    marginRight: -16,
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
                        </Link>
                    );
                })}

                {/* Profile / More slot */}
                {children && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: 0,
                        padding: '10px 0',
                    }}>
                        {children}
                    </div>
                )}
            </div>
        </nav>
    );
}

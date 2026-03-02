'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    unreadCount?: number;
}

export default function MobileBottomNav({ items, children, className }: { items: NavItem[], children?: React.ReactNode, className?: string }) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/dashboard' && pathname === '/dashboard') return true;
        if (href !== '/dashboard' && pathname.startsWith(href)) return true;
        // Handle athlete dashboard specifically
        if (href.includes('/athlete') && href.endsWith('/dashboard') && pathname === href) return true;
        return false;
    };

    return (
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-[1000] border-t border-[var(--card-border)] rounded-none px-2 pb-safe-offset-2 ${className || ''}`} style={{
            height: 'calc(65px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            background: 'var(--background)'
        }}>
            {items.map((item) => {
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => {
                            if (active) {
                                // If already active, don't trigger normal navigation, just dispatch event
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
                            color: active ? 'var(--primary)' : 'var(--secondary-foreground)',
                            transition: 'all 0.2s ease',
                            flex: 1,
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: active ? 'var(--primary)' : 'var(--secondary-foreground)',
                            filter: active ? 'drop-shadow(0 0 8px rgba(125, 135, 210, 0.4))' : 'none',
                            transition: 'transform 0.2s ease',
                            transform: active ? 'scale(1.1)' : 'scale(1)'
                        }}>
                            {item.icon}
                        </div>
                        <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            opacity: active ? 1 : 0.7
                        }}>
                            {item.label}
                        </span>

                        {item.unreadCount !== undefined && item.unreadCount > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '4px',
                                right: '25%',
                                background: '#ef4444',
                                color: '#fff',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                borderRadius: '10px',
                                padding: '1px 5px',
                                minWidth: '16px',
                                textAlign: 'center',
                                lineHeight: 1,
                                boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
                                zIndex: 1
                            }}>
                                {item.unreadCount}
                            </div>
                        )}
                    </Link>
                );
            })}
            {children}
        </nav>
    );
}

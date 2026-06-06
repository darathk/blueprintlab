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
                {/* Expanded Menu - Vertical Neumorphic Pill */}
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: 36,
                    background: '#151515', // Solid dark grey almost black
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.03), 0 10px 40px rgba(0, 0, 0, 0.8)',
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
                                href={item.href}
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
                                    height: 54,
                                    padding: '0 20px',
                                    borderRadius: 27,
                                    background: active ? '#1a1a1a' : '#1e1e1e', // Darker when active
                                    border: '1px solid rgba(255,255,255,0.02)',
                                    // Neumorphic Shadows mimicking Image 2
                                    boxShadow: active 
                                        ? 'inset 4px 4px 8px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.04)' 
                                        : '3px 3px 8px rgba(0,0,0,0.7), -2px -2px 6px rgba(255,255,255,0.04)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                    transform: active ? 'scale(0.95)' : 'scale(1)',
                                    transition: 'transform 0.2s ease, color 0.2s ease',
                                }}>
                                    {item.icon}
                                </div>
                                
                                <span style={{
                                    marginLeft: 16,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    letterSpacing: '0.02em',
                                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                    transition: 'color 0.2s ease',
                                }}>
                                    {item.label}
                                </span>

                                {/* Unread badge */}
                                {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.6rem',
                                        fontWeight: 800,
                                        borderRadius: 12,
                                        padding: '2px 5px',
                                        minWidth: 18,
                                        textAlign: 'center',
                                        lineHeight: '1',
                                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                                        border: '2px solid #1c1c1c'
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
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: isOpen ? '#151515' : '#1e1e1e',
                        color: isOpen ? 'rgba(255, 255, 255, 0.5)' : '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.03)',
                        boxShadow: isOpen 
                            ? 'inset 4px 4px 8px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.04)' 
                            : '3px 3px 8px rgba(0,0,0,0.7), -2px -2px 6px rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                    }}
                    aria-label="Toggle Navigation"
                >
                    {isOpen ? <X size={26} /> : <Menu size={26} />}
                    {!isOpen && totalUnread > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            background: '#ef4444',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '2px solid #1e1e1e',
                        }} />
                    )}
                </button>
            </div>
        </nav>
    );
}

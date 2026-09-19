'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    icon?: React.ReactNode;
    subtitle?: string;
    badge?: React.ReactNode;
    variant?: 'default' | 'nested';
    className?: string;
    style?: React.CSSProperties;
}

export default function CollapsibleSection({
    title,
    children,
    defaultOpen = true,
    icon,
    subtitle,
    badge,
    variant = 'default',
    className = '',
    style = {},
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [hasBeenOpened, setHasBeenOpened] = useState(defaultOpen);

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next && !hasBeenOpened) setHasBeenOpened(true);
    };

    const isNested = variant === 'nested';

    return (
        <div
            className={`collapsible-glass-card ${className}`}
            style={{
                marginBottom: isNested ? '1.25rem' : '1.75rem',
                borderRadius: isNested ? 14 : 20,
                background: isNested
                    ? 'linear-gradient(180deg, rgba(20, 27, 45, 0.5) 0%, rgba(12, 17, 30, 0.65) 100%)'
                    : 'linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.65) 100%)',
                border: isNested
                    ? '1px solid rgba(255, 255, 255, 0.08)'
                    : '1px solid rgba(255, 255, 255, 0.09)',
                boxShadow: isNested
                    ? 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 16px rgba(0, 0, 0, 0.2)'
                    : 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 10px 30px -8px rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                overflow: 'hidden',
                transition: 'all 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
                ...style,
            }}
        >
            <div
                onClick={toggle}
                className="chat-press"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                    }
                }}
                style={{
                    padding: isNested ? '0.9rem 1.15rem' : '1.15rem 1.4rem',
                    background: isOpen
                        ? (isNested ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.045)')
                        : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: isOpen ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid transparent',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    gap: 12,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    {icon && (
                        <div
                            style={{
                                width: isNested ? 32 : 38,
                                height: isNested ? 32 : 38,
                                borderRadius: isNested ? 9 : 11,
                                background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.18) 0%, rgba(56, 189, 248, 0.12) 100%)',
                                border: '1px solid rgba(125, 135, 210, 0.28)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                            }}
                        >
                            {icon}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h2
                                style={{
                                    fontSize: isNested ? '1.02rem' : '1.18rem',
                                    fontWeight: 700,
                                    margin: 0,
                                    color: 'var(--foreground)',
                                    letterSpacing: '-0.015em',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {title}
                            </h2>
                            {badge}
                        </div>
                        {subtitle && (
                            <p
                                style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--secondary-foreground)',
                                    margin: '2px 0 0',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    opacity: 0.85,
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        width: isNested ? 28 : 32,
                        height: isNested ? 28 : 32,
                        borderRadius: 8,
                        background: isOpen ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: isOpen ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isOpen ? '#38bdf8' : 'var(--secondary-foreground)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    <ChevronDown size={isNested ? 15 : 17} />
                </div>
            </div>

            {hasBeenOpened && (
                <div
                    style={{
                        display: isOpen ? 'block' : 'none',
                        padding: isNested ? '1.1rem' : '1.35rem',
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';

export default function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [hasBeenOpened, setHasBeenOpened] = useState(defaultOpen);

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next && !hasBeenOpened) setHasBeenOpened(true);
    };

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
            <div
                onClick={toggle}
                className="chat-press"
                style={{
                    padding: '1.1rem 1.25rem',
                    background: isOpen ? 'var(--glass-surface-3)' : 'var(--glass-surface-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: isOpen ? '1px solid var(--glass-border)' : 'none',
                    transition: 'background 200ms var(--ease-out)'
                }}
            >
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>{title}</h2>
                <div style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms var(--ease-out)',
                    color: 'var(--secondary-foreground)',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>

            {hasBeenOpened && (
                <div style={{ display: isOpen ? 'block' : 'none', padding: '1.25rem' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

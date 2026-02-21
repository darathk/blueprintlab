'use client';

import { useState } from 'react';

export default function CollapsibleSection({ title, children, defaultOpen = true }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--card-bg)' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '1rem',
                    background: 'var(--muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{title}</h2>
                <div style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    ▼
                </div>
            </div>

            {isOpen && (
                <div style={{ padding: '1rem' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

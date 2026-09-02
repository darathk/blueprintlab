'use client';

import { useState } from 'react';
import { Eye, Info } from 'lucide-react';

interface Props {
    text: string;
    icon?: 'eye' | 'info';
}

export default function InfoTooltip({ text, icon = 'info' }: Props) {
    const [open, setOpen] = useState(false);
    
    const IconComponent = icon === 'eye' ? Eye : Info;
    
    return (
        <div 
            style={{ display: 'inline-flex', position: 'relative', marginLeft: 8 }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
            <div className="chat-press" style={{
                background: 'var(--glass-surface-3)',
                border: '1px solid var(--glass-border)',
                borderRadius: '50%',
                width: 20,
                height: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 160ms var(--ease-out)'
            }}>
                <IconComponent size={12} color="var(--secondary-foreground)" />
            </div>
            {open && (
                <div className="glass-panel-elevated" style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: 8,
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: 'var(--foreground)',
                    width: 'max-content',
                    maxWidth: 250,
                    textAlign: 'center',
                    zIndex: 100,
                    pointerEvents: 'none',
                    lineHeight: 1.4,
                    animation: 'popoverIn 150ms var(--ease-out)'
                }}>
                    {text}
                    {/* Small arrow pointing up */}
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        borderWidth: '5px',
                        borderStyle: 'solid',
                        borderColor: 'transparent transparent rgba(255, 255, 255, 0.1) transparent'
                    }} />
                </div>
            )}
        </div>
    );
}

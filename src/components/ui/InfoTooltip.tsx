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
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconComponent size={12} color="var(--secondary-foreground)" />
            </div>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: 8,
                    background: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid var(--primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                    width: 'max-content',
                    maxWidth: 250,
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    lineHeight: 1.4
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
                        borderColor: 'transparent transparent var(--primary) transparent'
                    }} />
                </div>
            )}
        </div>
    );
}

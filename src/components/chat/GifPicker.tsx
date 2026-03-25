'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface GifResult {
    id: string;
    previewUrl: string;
    url: string;
    width: number;
    height: number;
}

interface GifPickerProps {
    onSelect: (gifUrl: string) => void;
    onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
    const [search, setSearch] = useState('');
    const [gifs, setGifs] = useState<GifResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const pickerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        searchRef.current?.focus();
        // Load trending on mount
        fetchGifs('');
    }, []);

    useEffect(() => {
        const handle = (e: MouseEvent | TouchEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handle);
        document.addEventListener('touchstart', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
            document.removeEventListener('touchstart', handle);
        };
    }, [onClose]);

    const fetchGifs = useCallback(async (query: string) => {
        setLoading(true);
        setError('');
        try {
            const endpoint = query
                ? `/api/gifs?q=${encodeURIComponent(query)}`
                : '/api/gifs?trending=1';
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error('Failed to fetch GIFs');
            const data = await res.json();
            setGifs(data.results || []);
        } catch {
            setError('Could not load GIFs');
            setGifs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchGifs(value), 400);
    };

    return (
        <div
            ref={pickerRef}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                width: '100%',
                maxWidth: 360,
                animation: 'scaleIn 0.15s ease-out',
                overflow: 'hidden',
                marginBottom: 8,
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px 6px',
            }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>GIFs</span>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: '0 8px 8px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                }}>
                    <Search size={14} color="var(--secondary-foreground)" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                        placeholder="Search GIFs..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--foreground)',
                            fontSize: 13,
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            {/* GIF Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 4,
                padding: '0 6px 6px',
                maxHeight: 300,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}>
                {loading && gifs.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: 24 }}>
                        <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                )}
                {error && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'var(--secondary-foreground)', fontSize: 13 }}>
                        {error}
                    </div>
                )}
                {!loading && !error && gifs.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'var(--secondary-foreground)', fontSize: 13 }}>
                        No GIFs found
                    </div>
                )}
                {gifs.map(gif => (
                    <button
                        key={gif.id}
                        onClick={() => onSelect(gif.url)}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: 'none',
                            borderRadius: 8,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            padding: 0,
                            aspectRatio: '1',
                            position: 'relative',
                        }}
                    >
                        <img
                            src={gif.previewUrl}
                            alt="GIF"
                            loading="lazy"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                            }}
                        />
                    </button>
                ))}
            </div>

            {/* Tenor attribution */}
            <div style={{
                padding: '4px 8px 6px',
                textAlign: 'right',
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
            }}>
                Powered by Tenor
            </div>
        </div>
    );
}

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Search, Plus, Film, ExternalLink, Trash2, Edit3, X,
    Play, Tag, Video, Sparkles, Check, AlertCircle, Dumbbell
} from 'lucide-react';

export interface Tutorial {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    platform: string;
    category: string;
    tags: string[] | null;
    coachId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface VideoCatalogProps {
    initialTutorials?: Tutorial[];
    isCoach?: boolean;
    athleteId?: string;
}

const CATEGORIES = [
    { key: 'all', label: 'All Videos' },
    { key: 'squats', label: 'Squats', color: '#EAB308' },
    { key: 'bench', label: 'Bench', color: '#0EA5E9' },
    { key: 'deadlifts', label: 'Deadlifts', color: '#EC4899' },
    { key: 'warmup', label: 'Warm-up Drills', color: '#10B981' },
];

function getCategoryColor(category: string): string {
    const cat = category.toLowerCase();
    if (cat.includes('squat')) return '#EAB308';
    if (cat.includes('bench')) return '#0EA5E9';
    if (cat.includes('deadlift')) return '#EC4899';
    if (cat.includes('warm')) return '#10B981';
    return '#A78BFA';
}

function getPlatformBadge(platform: string) {
    switch (platform.toLowerCase()) {
        case 'instagram':
            return {
                label: 'Instagram',
                gradient: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)',
                color: '#fff',
            };
        case 'tiktok':
            return {
                label: 'TikTok',
                gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                color: '#000',
            };
        case 'youtube':
            return {
                label: 'YouTube',
                gradient: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
                color: '#fff',
            };
        default:
            return {
                label: 'Video',
                gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
            };
    }
}

// Convert social video URLs to embeddable URLs
function getEmbedUrl(url: string, platform: string): string | null {
    if (!url) return null;
    const cleanUrl = url.trim();

    if (platform === 'instagram' || cleanUrl.includes('instagram.com')) {
        // Matches /reel/ID or /p/ID
        const reelMatch = cleanUrl.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
        if (reelMatch && reelMatch[1]) {
            return `https://www.instagram.com/reel/${reelMatch[1]}/embed`;
        }
    }

    if (platform === 'tiktok' || cleanUrl.includes('tiktok.com')) {
        // Matches tiktok video ID /video/1234567890
        const ttMatch = cleanUrl.match(/video\/(\d+)/);
        if (ttMatch && ttMatch[1]) {
            return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
        }
    }

    if (platform === 'youtube' || cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        let videoId = '';
        if (cleanUrl.includes('youtu.be/')) {
            videoId = cleanUrl.split('youtu.be/')[1]?.split('?')[0] || '';
        } else if (cleanUrl.includes('shorts/')) {
            videoId = cleanUrl.split('shorts/')[1]?.split('?')[0] || '';
        } else if (cleanUrl.includes('v=')) {
            videoId = new URL(cleanUrl).searchParams.get('v') || '';
        }
        if (videoId) {
            return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
        }
    }

    return null;
}

export default function VideoCatalog({
    initialTutorials = [],
    isCoach = false,
}: VideoCatalogProps) {
    const [tutorials, setTutorials] = useState<Tutorial[]>(initialTutorials);
    const [loading, setLoading] = useState(initialTutorials.length === 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Active playing video modal
    const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);

    // Coach Add/Edit Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formCategory, setFormCategory] = useState('squats');
    const [formCustomCategory, setFormCustomCategory] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formTags, setFormTags] = useState('');
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const fetchTutorials = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/tutorials');
            if (res.ok) {
                const data = await res.json();
                setTutorials(data.tutorials || []);
            }
        } catch (err) {
            console.error('Failed to load tutorials:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialTutorials.length === 0) {
            fetchTutorials();
        }
    }, [initialTutorials.length, fetchTutorials]);

    // Aggregate all unique categories present in the data
    const dynamicCategories = useMemo(() => {
        const catMap = new Map<string, string>();
        CATEGORIES.forEach(c => {
            if (c.key !== 'all') catMap.set(c.key, c.label);
        });
        tutorials.forEach(t => {
            const key = t.category.toLowerCase();
            if (!catMap.has(key)) {
                catMap.set(key, t.category.charAt(0).toUpperCase() + t.category.slice(1));
            }
        });

        const list = [{ key: 'all', label: 'All Videos' }];
        catMap.forEach((label, key) => {
            list.push({ key, label });
        });
        return list;
    }, [tutorials]);

    // Client-side filtering for fast typing response
    const filteredTutorials = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return tutorials.filter(t => {
            const matchesCat = selectedCategory === 'all' || t.category.toLowerCase() === selectedCategory.toLowerCase();
            if (!matchesCat) return false;

            if (!q) return true;

            const inTitle = t.title.toLowerCase().includes(q);
            const inDesc = (t.description || '').toLowerCase().includes(q);
            const inCat = t.category.toLowerCase().includes(q);
            const inTags = Array.isArray(t.tags) && t.tags.some(tag => String(tag).toLowerCase().includes(q));

            return inTitle || inDesc || inCat || inTags;
        });
    }, [tutorials, selectedCategory, searchQuery]);

    // Modal Form handlers
    const openAddModal = () => {
        setEditingTutorial(null);
        setFormTitle('');
        setFormUrl('');
        setFormCategory('squats');
        setFormCustomCategory('');
        setFormDescription('');
        setFormTags('');
        setFormError('');
        setModalOpen(true);
    };

    const openEditModal = (t: Tutorial) => {
        setEditingTutorial(t);
        setFormTitle(t.title);
        setFormUrl(t.videoUrl);
        const isStandard = ['squats', 'bench', 'deadlifts', 'warmup'].includes(t.category.toLowerCase());
        setFormCategory(isStandard ? t.category.toLowerCase() : 'custom');
        setFormCustomCategory(isStandard ? '' : t.category);
        setFormDescription(t.description || '');
        setFormTags(Array.isArray(t.tags) ? t.tags.join(', ') : '');
        setFormError('');
        setModalOpen(true);
    };

    const handleSaveTutorial = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!formTitle.trim()) {
            setFormError('Please enter a title');
            return;
        }
        if (!formUrl.trim()) {
            setFormError('Please enter a video URL');
            return;
        }

        const effectiveCategory = formCategory === 'custom'
            ? formCustomCategory.trim().toLowerCase()
            : formCategory.trim().toLowerCase();

        if (!effectiveCategory) {
            setFormError('Please specify a category');
            return;
        }

        const tagsArray = formTags
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        setFormSaving(true);

        try {
            const isEditing = !!editingTutorial;
            const endpoint = isEditing ? `/api/tutorials/${editingTutorial.id}` : '/api/tutorials';
            const method = isEditing ? 'PATCH' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formTitle,
                    videoUrl: formUrl,
                    category: effectiveCategory,
                    description: formDescription,
                    tags: tagsArray,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save tutorial');
            }

            if (isEditing) {
                setTutorials(prev => prev.map(item => item.id === editingTutorial.id ? data.tutorial : item));
            } else {
                setTutorials(prev => [data.tutorial, ...prev]);
            }

            setModalOpen(false);
        } catch (err: any) {
            setFormError(err.message || 'Network error');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteTutorial = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

        try {
            const res = await fetch(`/api/tutorials/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTutorials(prev => prev.filter(t => t.id !== id));
                if (activeVideo?.id === id) setActiveVideo(null);
            } else {
                alert('Failed to delete tutorial');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete tutorial');
        }
    };

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '80px' }}>
            {/* Header row */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '24px',
                paddingTop: '8px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{
                            fontSize: '1.875rem',
                            fontWeight: 800,
                            letterSpacing: '-0.025em',
                            margin: 0,
                            color: 'var(--foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <span>Video</span>
                            <span style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(125, 135, 210, 0.4)' }}>
                                Tutorials & Vault
                            </span>
                        </h1>
                        <p style={{
                            fontSize: '0.875rem',
                            color: 'var(--secondary-foreground)',
                            margin: '4px 0 0',
                            opacity: 0.8,
                        }}>
                            Master your squat, bench, deadlift cues, and warm-up drills with coaching breakdowns.
                        </p>
                    </div>

                    {isCoach && (
                        <button
                            onClick={openAddModal}
                            className="glass-button glass-button-primary chat-press"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '14px',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                boxShadow: '0 4px 16px rgba(125, 135, 210, 0.3)',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} />
                            <span>Add Video Tutorial</span>
                        </button>
                    )}
                </div>

                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                        position: 'relative',
                        width: '100%',
                    }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--secondary-foreground)',
                                opacity: 0.6,
                            }}
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search video tutorials by lift, cue, technique (e.g. arch, lat flare, unrack)..."
                            style={{
                                width: '100%',
                                background: 'rgba(15, 15, 24, 0.75)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '14px',
                                padding: '12px 16px 12px 46px',
                                fontSize: '0.9rem',
                                color: 'var(--foreground)',
                                outline: 'none',
                                transition: 'all 0.2s',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--secondary-foreground)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Category Filter Pills */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        scrollbarWidth: 'none',
                    }}>
                        {dynamicCategories.map(cat => {
                            const isSelected = selectedCategory === cat.key;
                            const count = cat.key === 'all'
                                ? tutorials.length
                                : tutorials.filter(t => t.category.toLowerCase() === cat.key.toLowerCase()).length;

                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedCategory(cat.key)}
                                    className="chat-press"
                                    style={{
                                        whiteSpace: 'nowrap',
                                        padding: '7px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.8125rem',
                                        fontWeight: isSelected ? 700 : 500,
                                        background: isSelected
                                            ? 'rgba(125, 135, 210, 0.2)'
                                            : 'rgba(255, 255, 255, 0.03)',
                                        color: isSelected ? '#ffffff' : 'var(--secondary-foreground)',
                                        border: isSelected
                                            ? '1px solid rgba(125, 135, 210, 0.4)'
                                            : '1px solid rgba(255, 255, 255, 0.06)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.18s ease',
                                    }}
                                >
                                    <span>{cat.label}</span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        opacity: isSelected ? 0.9 : 0.6,
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div style={{
                    padding: '80px 20px',
                    textAlign: 'center',
                    color: 'var(--secondary-foreground)',
                }}>
                    <Film size={32} style={{ animation: 'pulse 1.5s infinite', margin: '0 auto 12px', opacity: 0.5 }} />
                    <div>Loading video catalog...</div>
                </div>
            ) : filteredTutorials.length === 0 ? (
                <div className="glass-panel" style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    borderRadius: '20px',
                    border: '1px dashed var(--card-border)',
                }}>
                    <Film size={40} style={{ margin: '0 auto 16px', color: 'var(--muted)', opacity: 0.6 }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '6px' }}>
                        No video tutorials found
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', maxWidth: '400px', margin: '0 auto 20px' }}>
                        {searchQuery || selectedCategory !== 'all'
                            ? 'No videos match your active filter or search keywords. Try clearing the search query.'
                            : 'No video tutorials have been added yet. As tutorials are added, they will appear here.'}
                    </div>
                    {isCoach && (
                        <button
                            onClick={openAddModal}
                            className="glass-button glass-button-primary chat-press"
                            style={{
                                padding: '8px 18px',
                                borderRadius: '12px',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                            }}
                        >
                            + Add First Tutorial
                        </button>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px',
                }}>
                    {filteredTutorials.map(t => {
                        const platformBadge = getPlatformBadge(t.platform);
                        const categoryColor = getCategoryColor(t.category);
                        const embedUrl = getEmbedUrl(t.videoUrl, t.platform);

                        return (
                            <div
                                key={t.id}
                                className="glass-panel"
                                style={{
                                    borderRadius: '16px',
                                    border: '1px solid var(--card-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                                    background: 'rgba(18, 18, 28, 0.7)',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.4)';
                                    e.currentTarget.style.borderColor = 'rgba(125, 135, 210, 0.35)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.borderColor = 'var(--card-border)';
                                }}
                            >
                                {/* Card Header Preview / Poster banner */}
                                <div
                                    onClick={() => setActiveVideo(t)}
                                    style={{
                                        height: '140px',
                                        background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.8) 0%, rgba(15, 15, 25, 0.95) 100%)',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Ambient glow in corner */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, right: 0,
                                        width: '100px', height: '100px',
                                        background: `radial-gradient(circle, ${categoryColor}33 0%, transparent 70%)`,
                                    }} />

                                    {/* Play Button circle */}
                                    <div style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: '50%',
                                        background: 'rgba(125, 135, 210, 0.3)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                                        transition: 'all 0.2s',
                                    }}>
                                        <Play size={24} style={{ marginLeft: 3 }} />
                                    </div>

                                    {/* Badges in header */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 10, left: 10,
                                        display: 'flex',
                                        gap: 6,
                                    }}>
                                        <span style={{
                                            background: platformBadge.gradient,
                                            color: platformBadge.color,
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: '8px',
                                            letterSpacing: '0.02em',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                        }}>
                                            {platformBadge.label}
                                        </span>

                                        <span style={{
                                            background: `${categoryColor}22`,
                                            color: categoryColor,
                                            border: `1px solid ${categoryColor}44`,
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: '8px',
                                            textTransform: 'capitalize',
                                        }}>
                                            {t.category}
                                        </span>
                                    </div>
                                </div>

                                {/* Body */}
                                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        color: 'var(--foreground)',
                                        marginBottom: '6px',
                                        lineHeight: 1.35,
                                    }}>
                                        {t.title}
                                    </div>

                                    {t.description && (
                                        <p style={{
                                            fontSize: '0.8125rem',
                                            color: 'var(--secondary-foreground)',
                                            lineHeight: 1.45,
                                            margin: '0 0 12px 0',
                                            opacity: 0.85,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}>
                                            {t.description}
                                        </p>
                                    )}

                                    {/* Tags */}
                                    {Array.isArray(t.tags) && t.tags.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '5px',
                                            marginTop: 'auto',
                                            marginBottom: '14px',
                                        }}>
                                            {t.tags.map((tag, ti) => (
                                                <span
                                                    key={ti}
                                                    onClick={() => setSearchQuery(String(tag))}
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--secondary-foreground)',
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Footer buttons */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                        paddingTop: '12px',
                                        marginTop: 'auto',
                                        gap: '8px',
                                    }}>
                                        <button
                                            onClick={() => setActiveVideo(t)}
                                            className="glass-button chat-press"
                                            style={{
                                                flex: 1,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                padding: '7px 12px',
                                                borderRadius: '10px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                color: 'var(--primary)',
                                            }}
                                        >
                                            <Play size={13} />
                                            <span>Watch Tutorial</span>
                                        </button>

                                        <a
                                            href={t.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Open direct link"
                                            className="glass-button chat-press"
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '10px',
                                                color: 'var(--secondary-foreground)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <ExternalLink size={14} />
                                        </a>

                                        {isCoach && (
                                            <>
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    title="Edit Tutorial"
                                                    className="glass-button chat-press"
                                                    style={{
                                                        padding: '7px 10px',
                                                        borderRadius: '10px',
                                                        color: 'var(--secondary-foreground)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTutorial(t.id, t.title)}
                                                    title="Delete Tutorial"
                                                    className="glass-button chat-press"
                                                    style={{
                                                        padding: '7px 10px',
                                                        borderRadius: '10px',
                                                        color: '#ef4444',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Video Player Modal */}
            {activeVideo && (
                <div
                    onClick={() => setActiveVideo(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 200,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(16px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: activeVideo.platform === 'youtube' ? '800px' : '460px',
                            width: '100%',
                            background: '#0d0d16',
                            border: '1px solid rgba(125, 135, 210, 0.3)',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '92vh',
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '14px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                                    {activeVideo.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', textTransform: 'capitalize' }}>
                                    {activeVideo.category} • {activeVideo.platform}
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveVideo(null)}
                                className="glass-button chat-press"
                                style={{
                                    width: 32, height: 32,
                                    borderRadius: '50%',
                                    padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--secondary-foreground)',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Player Content Container */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '14px',
                            background: '#000',
                        }}>
                            {(() => {
                                const embed = getEmbedUrl(activeVideo.videoUrl, activeVideo.platform);
                                if (embed) {
                                    return (
                                        <div style={{
                                            width: '100%',
                                            aspectRatio: activeVideo.platform === 'youtube' ? '16/9' : '9/16',
                                            maxHeight: '70vh',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            background: '#000',
                                        }}>
                                            <iframe
                                                src={embed}
                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                                allowFullScreen
                                            />
                                        </div>
                                    );
                                }

                                return (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '40px 20px',
                                        color: 'var(--secondary-foreground)',
                                    }}>
                                        <Film size={36} style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                                            Direct Video Link
                                        </div>
                                        <p style={{ fontSize: '0.825rem', marginBottom: '16px' }}>
                                            This link can be viewed directly on {activeVideo.platform}:
                                        </p>
                                        <a
                                            href={activeVideo.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="glass-button glass-button-primary chat-press"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '10px 20px',
                                                borderRadius: '12px',
                                                textDecoration: 'none',
                                                fontWeight: 700,
                                            }}
                                        >
                                            <span>Open on {activeVideo.platform}</span>
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer / Description */}
                        {activeVideo.description && (
                            <div style={{
                                padding: '14px 18px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                background: '#0d0d16',
                                fontSize: '0.825rem',
                                color: 'var(--secondary-foreground)',
                                lineHeight: 1.5,
                            }}>
                                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Coaching Breakdown:</div>
                                {activeVideo.description}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Coach Add/Edit Modal */}
            {modalOpen && (
                <div
                    onClick={() => setModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 200,
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '520px',
                            width: '100%',
                            background: '#11111d',
                            border: '1px solid rgba(125, 135, 210, 0.3)',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
                        }}
                    >
                        <form onSubmit={handleSaveTutorial}>
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                                    {editingTutorial ? 'Edit Video Tutorial' : 'Add New Video Tutorial'}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="glass-button chat-press"
                                    style={{
                                        width: 32, height: 32,
                                        borderRadius: '50%',
                                        padding: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--secondary-foreground)',
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {formError && (
                                    <div style={{
                                        padding: '10px 14px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '10px',
                                        fontSize: '0.825rem',
                                        color: '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}>
                                        <AlertCircle size={16} />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div>
                                    <label style={labelStyle}>Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formTitle}
                                        onChange={e => setFormTitle(e.target.value)}
                                        placeholder="e.g. Sinking vs Pausing Bench Press Technique"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Video URL (Instagram, TikTok, YouTube) *</label>
                                    <input
                                        type="url"
                                        required
                                        value={formUrl}
                                        onChange={e => setFormUrl(e.target.value)}
                                        placeholder="https://www.instagram.com/reel/... or TikTok link"
                                        style={inputStyle}
                                    />
                                    <div style={{ fontSize: '0.725rem', color: 'var(--secondary-foreground)', opacity: 0.7, marginTop: '4px' }}>
                                        Supports Instagram Reels/Posts, TikTok videos, YouTube Shorts, and direct video links.
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Category *</label>
                                    <select
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="squats">Squats</option>
                                        <option value="bench">Bench</option>
                                        <option value="deadlifts">Deadlifts</option>
                                        <option value="warmup">Warm-up Drills</option>
                                        <option value="custom">Other / Custom Category...</option>
                                    </select>
                                </div>

                                {formCategory === 'custom' && (
                                    <div>
                                        <label style={labelStyle}>Custom Category Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formCustomCategory}
                                            onChange={e => setFormCustomCategory(e.target.value)}
                                            placeholder="e.g. Mobility, Nutrition, Equipment"
                                            style={inputStyle}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label style={labelStyle}>Coaching Notes / Cue Breakdown (Optional)</label>
                                    <textarea
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                        placeholder="Key takeaways, cues to remember (e.g. 'Touch like a butterfly, explode like a rocket')..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Tags (Comma-separated)</label>
                                    <input
                                        type="text"
                                        value={formTags}
                                        onChange={e => setFormTags(e.target.value)}
                                        placeholder="e.g. pause, arch, grip width, wrist wraps"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{
                                padding: '14px 20px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '10px',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="glass-button chat-press"
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSaving}
                                    className="glass-button glass-button-primary chat-press"
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: formSaving ? 'wait' : 'pointer',
                                    }}
                                >
                                    {formSaving ? 'Saving...' : (editingTutorial ? 'Update Tutorial' : 'Save Tutorial')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--secondary-foreground)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid var(--card-border)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '0.875rem',
    color: 'var(--foreground)',
    outline: 'none',
    boxSizing: 'border-box',
};

'use client';

import { useState, useEffect } from 'react';
import { Pin, Trash2, Plus, X, Edit3, Check, AlertTriangle, Lightbulb, Heart, FileText } from 'lucide-react';

interface Note {
    id: string;
    content: string;
    category: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
}

const CATEGORIES = [
    { value: 'general', label: 'General', icon: FileText, color: 'var(--secondary-foreground)' },
    { value: 'injury', label: 'Injury', icon: AlertTriangle, color: '#ef4444' },
    { value: 'cues', label: 'Cues', icon: Lightbulb, color: '#f59e0b' },
    { value: 'preferences', label: 'Preferences', icon: Heart, color: '#a855f7' },
];

export default function CoachNotes({ athleteId }: { athleteId: string }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState('general');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState('general');
    const [saving, setSaving] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/coach-notes?athleteId=${athleteId}`);
                if (res.ok && !cancelled) setNotes(await res.json());
            } catch { /* ignore */ }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [athleteId]);

    const handleAdd = async () => {
        if (!newContent.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/coach-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, content: newContent.trim(), category: newCategory }),
            });
            if (res.ok) {
                const note = await res.json();
                setNotes([note, ...notes]);
                setNewContent('');
                setNewCategory('general');
                setIsAdding(false);
            }
        } catch { alert('Failed to save note'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        try {
            const res = await fetch(`/api/coach-notes?id=${id}`, { method: 'DELETE' });
            if (res.ok) setNotes(notes.filter(n => n.id !== id));
        } catch { /* ignore */ }
    };

    const handleTogglePin = async (note: Note) => {
        try {
            const res = await fetch('/api/coach-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
            });
            if (res.ok) {
                const updated = await res.json();
                setNotes(notes.map(n => n.id === note.id ? { ...n, pinned: updated.pinned } : n)
                    .sort((a, b) => {
                        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                    }));
            }
        } catch { /* ignore */ }
    };

    const handleSaveEdit = async (id: string) => {
        if (!editContent.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/coach-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, content: editContent.trim(), category: editCategory }),
            });
            if (res.ok) {
                const updated = await res.json();
                setNotes(notes.map(n => n.id === id ? { ...n, content: updated.content, category: updated.category, updatedAt: updated.updatedAt } : n));
                setEditingId(null);
            }
        } catch { alert('Failed to update'); }
        setSaving(false);
    };

    const getCategoryInfo = (category: string) => {
        return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const filtered = filterCategory ? notes.filter(n => n.category === filterCategory) : notes;

    if (loading) {
        return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading notes...</div>;
    }

    return (
        <div>
            {/* Category filter + Add button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.035)', padding: 3, borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <button
                        onClick={() => setFilterCategory(null)}
                        className="chat-press"
                        style={{
                            padding: '0.35rem 0.85rem', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600,
                            background: !filterCategory ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                            border: !filterCategory ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                            color: !filterCategory ? '#fff' : 'var(--secondary-foreground)',
                            cursor: 'pointer', transition: 'all 0.16s var(--ease-out)',
                        }}
                    >
                        All ({notes.length})
                    </button>
                    {CATEGORIES.map(cat => {
                        const count = notes.filter(n => n.category === cat.value).length;
                        if (count === 0) return null;
                        const Icon = cat.icon;
                        const isSelected = filterCategory === cat.value;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => setFilterCategory(isSelected ? null : cat.value)}
                                className="chat-press"
                                style={{
                                    padding: '0.35rem 0.85rem', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600,
                                    background: isSelected ? 'rgba(125, 135, 210, 0.22)' : 'transparent',
                                    border: isSelected ? '1px solid rgba(125, 135, 210, 0.4)' : '1px solid transparent',
                                    color: isSelected ? '#fff' : 'var(--secondary-foreground)',
                                    cursor: 'pointer', transition: 'all 0.16s var(--ease-out)',
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}
                            >
                                <Icon size={12} /> {cat.label} ({count})
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="glass-button chat-press"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.9rem'
                    }}
                >
                    {isAdding ? <X size={14} /> : <Plus size={14} />}
                    <span>{isAdding ? 'Cancel' : 'Add Note'}</span>
                </button>
            </div>

            {/* Add note form */}
            {isAdding && (
                <div style={{
                    padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 16,
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.65) 100%)',
                    border: '1px solid rgba(125, 135, 210, 0.35)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    animation: 'popoverIn 160ms var(--ease-out)'
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const isCatActive = newCategory === cat.value;
                            return (
                                <button
                                    key={cat.value}
                                    onClick={() => setNewCategory(cat.value)}
                                    className="chat-press"
                                    style={{
                                        padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                                        background: isCatActive ? 'rgba(125, 135, 210, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                                        border: `1px solid ${isCatActive ? cat.color : 'rgba(255, 255, 255, 0.08)'}`,
                                        color: isCatActive ? cat.color : 'var(--secondary-foreground)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    }}
                                >
                                    <Icon size={12} /> {cat.label}
                                </button>
                            );
                        })}
                    </div>
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Write a private note about this athlete..."
                        rows={3}
                        className="glass-input"
                        style={{
                            width: '100%', padding: '0.75rem', borderRadius: '10px', resize: 'vertical',
                            fontSize: '0.875rem',
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button
                            onClick={handleAdd}
                            disabled={!newContent.trim() || saving}
                            className="glass-button glass-button-primary chat-press"
                            style={{ fontSize: '0.82rem', padding: '0.45rem 1.25rem', fontWeight: 600 }}
                        >
                            {saving ? 'Saving...' : 'Save Note'}
                        </button>
                    </div>
                </div>
            )}

            {/* Notes list */}
            {filtered.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '3rem 1.5rem',
                        borderRadius: 16,
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.25) 0%, rgba(15, 23, 42, 0.45) 100%)',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.15) 0%, rgba(56, 189, 248, 0.12) 100%)',
                            border: '1px solid rgba(125, 135, 210, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <FileText size={22} style={{ color: '#7d87d2' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {notes.length === 0 ? 'No Coach Notes Added' : 'No Notes In This Category'}
                        </div>
                        <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.8rem', margin: '3px 0 0' }}>
                            {notes.length === 0 ? 'Keep private cues, injury logs, and observations about this athlete.' : 'Try switching filters or add a new note.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {filtered.map(note => {
                        const catInfo = getCategoryInfo(note.category);
                        const Icon = catInfo.icon;
                        const isEditing = editingId === note.id;

                        return (
                            <div
                                key={note.id}
                                style={{
                                    padding: '0.95rem 1.15rem',
                                    borderRadius: 14,
                                    background: note.pinned
                                        ? 'linear-gradient(135deg, rgba(125, 135, 210, 0.12) 0%, rgba(56, 189, 248, 0.05) 100%)'
                                        : 'rgba(255, 255, 255, 0.03)',
                                    border: note.pinned
                                        ? '1px solid rgba(125, 135, 210, 0.38)'
                                        : '1px solid rgba(255, 255, 255, 0.07)',
                                    boxShadow: note.pinned ? '0 4px 16px rgba(125, 135, 210, 0.1)' : 'none',
                                    transition: 'all 0.2s var(--ease-out)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                                        <Icon size={14} style={{ color: catInfo.color }} />
                                        <span style={{ fontSize: '0.7rem', color: catInfo.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                            {catInfo.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', opacity: 0.6 }}>
                                            {formatDate(note.updatedAt)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => handleSaveEdit(note.id)} disabled={saving}
                                                    style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 4 }}>
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleTogglePin(note)} title={note.pinned ? 'Unpin' : 'Pin'}
                                                    style={{ background: 'none', border: 'none', color: note.pinned ? 'var(--primary)' : 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Pin size={13} style={{ transform: note.pinned ? 'rotate(-45deg)' : 'none' }} />
                                                </button>
                                                <button onClick={() => { setEditingId(note.id); setEditContent(note.content); setEditCategory(note.category); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Edit3 size={13} />
                                                </button>
                                                <button onClick={() => handleDelete(note.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                            {CATEGORIES.map(cat => {
                                                const CatIcon = cat.icon;
                                                const isEditCatActive = editCategory === cat.value;
                                                return (
                                                    <button
                                                        key={cat.value}
                                                        onClick={() => setEditCategory(cat.value)}
                                                        className="chat-press"
                                                        style={{
                                                            padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600,
                                                            background: isEditCatActive ? 'rgba(125,135,210,0.2)' : 'transparent',
                                                            border: `1px solid ${isEditCatActive ? cat.color : 'var(--glass-border)'}`,
                                                            color: isEditCatActive ? cat.color : 'var(--secondary-foreground)',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem',
                                                        }}
                                                    >
                                                        <CatIcon size={10} /> {cat.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            rows={3}
                                            className="glass-input"
                                            style={{
                                                width: '100%', padding: '0.6rem', borderRadius: '8px', resize: 'vertical',
                                                fontSize: '0.85rem',
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--foreground)' }}>
                                        {note.content}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

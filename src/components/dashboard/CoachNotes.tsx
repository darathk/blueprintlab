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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFilterCategory(null)}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                            background: !filterCategory ? 'rgba(6,182,212,0.15)' : 'transparent',
                            border: `1px solid ${!filterCategory ? 'var(--primary)' : 'var(--card-border)'}`,
                            color: !filterCategory ? 'var(--primary)' : 'var(--secondary-foreground)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        All ({notes.length})
                    </button>
                    {CATEGORIES.map(cat => {
                        const count = notes.filter(n => n.category === cat.value).length;
                        if (count === 0) return null;
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => setFilterCategory(filterCategory === cat.value ? null : cat.value)}
                                style={{
                                    padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                                    background: filterCategory === cat.value ? 'rgba(6,182,212,0.15)' : 'transparent',
                                    border: `1px solid ${filterCategory === cat.value ? 'var(--primary)' : 'var(--card-border)'}`,
                                    color: filterCategory === cat.value ? 'var(--primary)' : 'var(--secondary-foreground)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                }}
                            >
                                <Icon size={12} /> {cat.label} ({count})
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: isAdding ? 'var(--primary)' : 'var(--secondary-foreground)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500,
                    }}
                >
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    {isAdding ? 'Cancel' : 'Add Note'}
                </button>
            </div>

            {/* Add note form */}
            {isAdding && (
                <div style={{
                    padding: '1rem', marginBottom: '1rem', borderRadius: '10px',
                    border: '1px solid var(--primary)', background: 'rgba(0,0,0,0.3)',
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={cat.value}
                                    onClick={() => setNewCategory(cat.value)}
                                    style={{
                                        padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem',
                                        background: newCategory === cat.value ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${newCategory === cat.value ? cat.color : 'var(--card-border)'}`,
                                        color: newCategory === cat.value ? cat.color : 'var(--secondary-foreground)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
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
                        style={{
                            width: '100%', padding: '0.6rem', borderRadius: '8px', resize: 'vertical',
                            border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.03)',
                            color: 'var(--foreground)', fontSize: '0.9rem',
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                            onClick={handleAdd}
                            disabled={!newContent.trim() || saving}
                            className="btn btn-primary"
                            style={{ fontSize: '0.85rem', padding: '0.4rem 1.25rem' }}
                        >
                            {saving ? 'Saving...' : 'Save Note'}
                        </button>
                    </div>
                </div>
            )}

            {/* Notes list */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)', fontSize: '0.9rem' }}>
                    {notes.length === 0 ? 'No notes yet. Add a private note about this athlete.' : 'No notes in this category.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {filtered.map(note => {
                        const catInfo = getCategoryInfo(note.category);
                        const Icon = catInfo.icon;
                        const isEditing = editingId === note.id;

                        return (
                            <div
                                key={note.id}
                                style={{
                                    padding: '0.75rem 1rem', borderRadius: '10px',
                                    background: note.pinned ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${note.pinned ? 'rgba(6,182,212,0.2)' : 'var(--card-border)'}`,
                                    transition: 'all 0.15s',
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
                                    <div style={{ display: 'flex', gap: '0.15rem', flexShrink: 0 }}>
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => handleSaveEdit(note.id)} disabled={saving}
                                                    style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 3 }}>
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 3 }}>
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleTogglePin(note)} title={note.pinned ? 'Unpin' : 'Pin'}
                                                    style={{ background: 'none', border: 'none', color: note.pinned ? 'var(--primary)' : 'var(--secondary-foreground)', cursor: 'pointer', padding: 3 }}>
                                                    <Pin size={13} style={{ transform: note.pinned ? 'rotate(-45deg)' : 'none' }} />
                                                </button>
                                                <button onClick={() => { setEditingId(note.id); setEditContent(note.content); setEditCategory(note.category); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 3 }}>
                                                    <Edit3 size={13} />
                                                </button>
                                                <button onClick={() => handleDelete(note.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 3 }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                            {CATEGORIES.map(cat => {
                                                const CatIcon = cat.icon;
                                                return (
                                                    <button
                                                        key={cat.value}
                                                        onClick={() => setEditCategory(cat.value)}
                                                        style={{
                                                            padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem',
                                                            background: editCategory === cat.value ? 'rgba(6,182,212,0.15)' : 'transparent',
                                                            border: `1px solid ${editCategory === cat.value ? cat.color : 'var(--card-border)'}`,
                                                            color: editCategory === cat.value ? cat.color : 'var(--secondary-foreground)',
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
                                            style={{
                                                width: '100%', padding: '0.5rem', borderRadius: '6px', resize: 'vertical',
                                                border: '1px solid var(--primary)', background: 'rgba(255,255,255,0.03)',
                                                color: 'var(--foreground)', fontSize: '0.85rem',
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

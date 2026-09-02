'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Pin, Trash2 } from 'lucide-react';

interface CoachNotesPaneProps {
    athleteId: string;
    onClose: () => void;
    athleteName?: string;
}

const NOTE_CATEGORIES = [
    { value: 'general', label: 'General', color: 'var(--secondary-foreground)' },
    { value: 'injury', label: 'Injury', color: '#ef4444' },
    { value: 'cues', label: 'Cues', color: '#f59e0b' },
    { value: 'preferences', label: 'Prefs', color: '#a855f7' },
];

export default function CoachNotesPane({ athleteId, onClose, athleteName }: CoachNotesPaneProps) {
    const [coachNotes, setCoachNotes] = useState<any[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const notesFetchedRef = useRef<boolean>(false);
    
    const [newNoteContent, setNewNoteContent] = useState('');
    const [newNoteCategory, setNewNoteCategory] = useState('general');
    const [notesSaving, setNotesSaving] = useState(false);

    const fetchNotes = async () => {
        if (!athleteId) return;
        setNotesLoading(true);
        try {
            const r = await fetch(`/api/coach-notes?athleteId=${athleteId}`);
            if (r.ok) setCoachNotes(await r.json());
        } catch { /* ignore */ }
        notesFetchedRef.current = true;
        setNotesLoading(false);
    };

    useEffect(() => {
        if (athleteId && !notesFetchedRef.current) {
            fetchNotes();
        }
    }, [athleteId]);

    const addNote = async () => {
        if (!newNoteContent.trim() || !athleteId) return;
        setNotesSaving(true);
        try {
            const r = await fetch('/api/coach-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, content: newNoteContent.trim(), category: newNoteCategory }),
            });
            if (r.ok) {
                const note = await r.json();
                setCoachNotes(prev => [note, ...prev]);
                setNewNoteContent('');
            }
        } catch { /* ignore */ }
        setNotesSaving(false);
    };

    const togglePinNote = async (note: any) => {
        try {
            const r = await fetch('/api/coach-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
            });
            if (r.ok) {
                setCoachNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
            }
        } catch { /* ignore */ }
    };

    const deleteNote = async (id: string) => {
        try {
            const r = await fetch(`/api/coach-notes?id=${id}`, { method: 'DELETE' });
            if (r.ok) setCoachNotes(prev => prev.filter(n => n.id !== id));
        } catch { /* ignore */ }
    };

    const fmtNoteDate = (s: string) => {
        const d = new Date(s), n = new Date();
        const diffMs = n.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== n.getFullYear() ? 'numeric' : undefined });
    };

    const sortedNotes = [...coachNotes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return (
        <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Panel header */}
            <div style={{
                padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                background: 'var(--glass-surface-2)'
            }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
                        Coach Notes
                    </div>
                    {athleteName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--secondary-foreground)', marginTop: 2 }}>
                            {athleteName}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    title="Close"
                    className="glass-button chat-press"
                    style={{ width: 28, height: 28, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-foreground)' }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Notes list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
                {notesLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                        Loading...
                    </div>
                ) : sortedNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-foreground)', fontSize: '0.85rem' }}>
                        No notes yet. Add your first note below.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {sortedNotes.map(note => {
                            const cat = NOTE_CATEGORIES.find(c => c.value === note.category) || NOTE_CATEGORIES[0];
                            return (
                                <div key={note.id} className="glass-panel" style={{
                                    borderLeft: `3px solid ${cat.color}`,
                                    borderRadius: 12, padding: '0.75rem',
                                    position: 'relative',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: '0.4rem' }}>
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                            letterSpacing: '0.06em', color: cat.color,
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                        }}>
                                            {note.pinned && <Pin size={10} style={{ fill: 'currentColor' }} />}
                                            {cat.label}
                                        </span>
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button
                                                onClick={() => togglePinNote(note)}
                                                title={note.pinned ? 'Unpin' : 'Pin'}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                                    color: note.pinned ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
                                                    display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                                                }}
                                                onMouseEnter={e => { if (!note.pinned) e.currentTarget.style.color = 'var(--secondary-foreground)'; }}
                                                onMouseLeave={e => { if (!note.pinned) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
                                            >
                                                <Pin size={13} style={note.pinned ? { fill: 'currentColor' } : undefined} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Delete this note?')) deleteNote(note.id); }}
                                                title="Delete"
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                                    color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {note.content}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--secondary-foreground)', marginTop: '0.4rem', opacity: 0.6 }}>
                                        {fmtNoteDate(note.updatedAt)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick-add form */}
            <div style={{
                padding: '1rem', borderTop: '1px solid var(--glass-border)', flexShrink: 0,
                background: 'var(--glass-surface-2)',
            }}>
                <textarea
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                    placeholder="Add a note..."
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                    className="glass-input"
                    style={{
                        width: '100%',
                        borderRadius: 10, fontSize: '0.85rem',
                        padding: '0.6rem 0.75rem', resize: 'none', minHeight: 72,
                        boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <select
                        value={newNoteCategory}
                        onChange={e => setNewNoteCategory(e.target.value)}
                        className="glass-input"
                        style={{
                            flex: 1,
                            borderRadius: 10, fontSize: '0.8rem',
                            padding: '0.4rem 0.6rem',
                        }}
                    >
                        {NOTE_CATEGORIES.map(c => (
                            <option key={c.value} value={c.value} style={{ background: '#181824' }}>{c.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={addNote}
                        disabled={notesSaving || !newNoteContent.trim()}
                        className="glass-button glass-button-primary chat-press"
                        style={{
                            fontSize: '0.8rem', padding: '0.4rem 1.1rem', flexShrink: 0,
                            borderRadius: 10, fontWeight: 700,
                            opacity: notesSaving || !newNoteContent.trim() ? 0.5 : 1,
                            cursor: notesSaving || !newNoteContent.trim() ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {notesSaving ? 'Saving...' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
}

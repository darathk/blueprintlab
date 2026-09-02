'use client';

import { useState, useEffect } from 'react';
import { BookTemplate, Trash2, ChevronDown, ChevronUp, Users, X, Edit3, Check } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    description: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weeks: any[];
    tags: string[] | null;
    createdAt: string;
    updatedAt: string;
}

export default function TemplateLibrary({ athletes }: { athletes: { id: string; name: string }[] }) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/templates');
                if (res.ok && !cancelled) setTemplates(await res.json());
            } catch { /* ignore */ }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
            if (res.ok) setTemplates(templates.filter(t => t.id !== id));
        } catch { alert('Failed to delete template'); }
    };

    const handleApply = async (templateId: string) => {
        if (!selectedAthleteId) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/templates/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, athleteId: selectedAthleteId }),
            });
            if (res.ok) {
                alert('Program created from template! You can now edit it in the athlete\'s page.');
                setApplyingId(null);
                setSelectedAthleteId('');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to apply template');
            }
        } catch { alert('Network error'); }
        setActionLoading(false);
    };

    const handleSaveEdit = async (id: string) => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: editName, description: editDesc || null }),
            });
            if (res.ok) {
                const updated = await res.json();
                setTemplates(templates.map(t => t.id === id ? { ...t, name: updated.name, description: updated.description } : t));
                setEditingId(null);
            }
        } catch { alert('Failed to update'); }
        setActionLoading(false);
    };

    const weekCount = (weeks: any[]) => {
        if (!Array.isArray(weeks)) return 0;
        return weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0).length;
    };

    const sessionCount = (weeks: any[]) => {
        if (!Array.isArray(weeks)) return 0;
        return weeks.reduce((sum, w) => sum + (Array.isArray(w.sessions) ? w.sessions.length : 0), 0);
    };

    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary-foreground)' }} className="pulse">Loading templates...</div>;
    }

    return (
        <div>
            {/* Search */}
            {templates.length > 0 && (
                <div className="glass-panel" style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 1rem', borderRadius: '12px',
                    marginBottom: '1.5rem',
                }}>
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: 'var(--foreground)', fontSize: '0.9rem', outline: 'none',
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="chat-press" style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex' }}>
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-foreground)' }}>
                    <BookTemplate size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                    <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
                    </p>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                        Save a program as a template from any athlete&apos;s Program History section.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {filtered.map(template => {
                        const isExpanded = expandedId === template.id;
                        const isApplying = applyingId === template.id;
                        const isEditing = editingId === template.id;

                        return (
                            <div key={template.id} className="glass-panel chat-press" style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    {isEditing ? (
                                        <div style={{ flex: 1, marginRight: '0.5rem' }}>
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="glass-input"
                                                style={{ width: '100%', fontSize: '1rem', fontWeight: 600, padding: '0.4rem 0.6rem' }}
                                            />
                                            <textarea
                                                value={editDesc}
                                                onChange={e => setEditDesc(e.target.value)}
                                                placeholder="Description (optional)"
                                                rows={2}
                                                className="glass-input"
                                                style={{ width: '100%', marginTop: '0.4rem', fontSize: '0.85rem', resize: 'vertical' }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1.3, color: 'var(--foreground)' }}>{template.name}</h3>
                                            {template.description && (
                                                <p style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                                                    {template.description}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => handleSaveEdit(template.id)} disabled={actionLoading}
                                                    className="chat-press"
                                                    style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 4 }}>
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    className="chat-press"
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => { setEditingId(template.id); setEditName(template.name); setEditDesc(template.description || ''); }}
                                                    className="chat-press"
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(template.id, template.name)}
                                                    className="chat-press"
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)', alignItems: 'center' }}>
                                    <span className="glass-badge" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                                        {weekCount(template.weeks)} Weeks
                                    </span>
                                    <span>{sessionCount(template.weeks)} Sessions</span>
                                </div>

                                {/* Tags */}
                                {template.tags && (template.tags as string[]).length > 0 && (
                                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                        {(template.tags as string[]).map(tag => (
                                            <span key={tag} className="glass-badge" style={{ color: 'var(--primary)', borderColor: 'rgba(125, 135, 210, 0.3)' }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Expand for preview */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                                    className="chat-press"
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--secondary-foreground)',
                                        cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        padding: '0.25rem 0', marginBottom: '0.5rem',
                                    }}
                                >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {isExpanded ? 'Hide preview' : 'Preview structure'}
                                </button>

                                {isExpanded && Array.isArray(template.weeks) && (
                                    <div className="glass-panel" style={{
                                        padding: '0.75rem',
                                        marginBottom: '0.75rem', maxHeight: '200px', overflowY: 'auto',
                                        fontSize: '0.8rem', color: 'var(--secondary-foreground)',
                                    }}>
                                        {template.weeks.filter(w => Array.isArray(w.sessions) && w.sessions.length > 0).map((week, wi) => (
                                            <div key={wi} style={{ marginBottom: '0.5rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
                                                    Week {week.weekNumber || wi + 1}
                                                </div>
                                                {week.sessions.map((session: any, si: number) => (
                                                    <div key={si} style={{ paddingLeft: '1rem', marginBottom: '0.15rem' }}>
                                                        Day {si + 1}: {(session.exercises || []).length} exercises
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Apply to athlete */}
                                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                    {isApplying ? (
                                        <div className="glass-panel-elevated" style={{ padding: '0.85rem', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                Apply to athlete:
                                            </div>
                                            <select
                                                value={selectedAthleteId}
                                                onChange={e => setSelectedAthleteId(e.target.value)}
                                                className="glass-input"
                                                style={{ width: '100%', marginBottom: '0.75rem', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Select athlete...</option>
                                                {athletes.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))}
                                            </select>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleApply(template.id)}
                                                    disabled={!selectedAthleteId || actionLoading}
                                                    className="glass-button glass-button-primary chat-press"
                                                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem' }}
                                                >
                                                    {actionLoading ? 'Creating...' : 'Create Program'}
                                                </button>
                                                <button
                                                    onClick={() => { setApplyingId(null); setSelectedAthleteId(''); }}
                                                    className="glass-button chat-press"
                                                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setApplyingId(template.id)}
                                            className="glass-button glass-button-primary chat-press"
                                            style={{
                                                width: '100%', padding: '0.55rem', fontSize: '0.85rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            }}
                                        >
                                            <Users size={14} /> Apply to Athlete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

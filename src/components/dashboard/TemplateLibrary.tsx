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
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 1rem', borderRadius: '10px',
                    border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.03)',
                    marginBottom: '1.25rem',
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
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', display: 'flex' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                    {filtered.map(template => {
                        const isExpanded = expandedId === template.id;
                        const isApplying = applyingId === template.id;
                        const isEditing = editingId === template.id;

                        return (
                            <div key={template.id} className="card" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    {isEditing ? (
                                        <div style={{ flex: 1, marginRight: '0.5rem' }}>
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.4rem', borderRadius: '6px',
                                                    border: '1px solid var(--primary)', background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--foreground)', fontSize: '1.1rem', fontWeight: 600,
                                                }}
                                            />
                                            <textarea
                                                value={editDesc}
                                                onChange={e => setEditDesc(e.target.value)}
                                                placeholder="Description (optional)"
                                                rows={2}
                                                style={{
                                                    width: '100%', padding: '0.4rem', borderRadius: '6px', marginTop: '0.4rem',
                                                    border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--foreground)', fontSize: '0.85rem', resize: 'vertical',
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{template.name}</h3>
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
                                                    style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 4 }}>
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => { setEditingId(template.id); setEditName(template.name); setEditDesc(template.description || ''); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(template.id, template.name)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--secondary-foreground)', cursor: 'pointer', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--secondary-foreground)' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--accent)', color: 'black', fontWeight: 'bold' }}>
                                        {weekCount(template.weeks)} Weeks
                                    </span>
                                    <span>{sessionCount(template.weeks)} Sessions</span>
                                </div>

                                {/* Tags */}
                                {template.tags && (template.tags as string[]).length > 0 && (
                                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                        {(template.tags as string[]).map(tag => (
                                            <span key={tag} style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px',
                                                background: 'rgba(6,182,212,0.12)', color: 'var(--primary)',
                                                border: '1px solid rgba(6,182,212,0.2)',
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Expand for preview */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
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
                                    <div style={{
                                        padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
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
                                <div style={{ marginTop: 'auto' }}>
                                    {isApplying ? (
                                        <div style={{
                                            padding: '0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px',
                                            border: '1px solid var(--primary)',
                                        }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-foreground)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                Apply to athlete:
                                            </div>
                                            <select
                                                value={selectedAthleteId}
                                                onChange={e => setSelectedAthleteId(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.5rem', borderRadius: '6px',
                                                    border: '1px solid var(--card-border)', background: 'var(--background)',
                                                    color: 'var(--foreground)', fontSize: '0.85rem', marginBottom: '0.5rem',
                                                }}
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
                                                    className="btn btn-primary"
                                                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.45rem' }}
                                                >
                                                    {actionLoading ? 'Creating...' : 'Create Program'}
                                                </button>
                                                <button
                                                    onClick={() => { setApplyingId(null); setSelectedAthleteId(''); }}
                                                    style={{
                                                        padding: '0.45rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem',
                                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)',
                                                        color: 'var(--secondary-foreground)', cursor: 'pointer',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setApplyingId(template.id)}
                                            style={{
                                                width: '100%', padding: '0.5rem', borderRadius: '8px', fontSize: '0.85rem',
                                                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                                                color: 'var(--primary)', cursor: 'pointer', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.1)'; }}
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

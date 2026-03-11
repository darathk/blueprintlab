'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Video, X, Send, CheckCircle } from 'lucide-react';

interface Props {
    athleteId: string;
    coachId: string;
    exerciseName: string;
    weekNum: number;
    dayNum: number;
    blockName: string;
    sets: Array<{
        setNumber: number;
        actual: { weight: string; reps: string; rpe: string };
    }>;
}

export default function ExerciseFeedback({
    athleteId, coachId: coachIdProp, exerciseName, weekNum, dayNum, blockName, sets
}: Props) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [video, setVideo] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [resolvedCoachId, setResolvedCoachId] = useState(coachIdProp || '');
    const fileRef = useRef<HTMLInputElement>(null);

    // If no coachId provided, try to resolve it from the athlete record
    useEffect(() => {
        if (resolvedCoachId) return;
        fetch(`/api/athletes/${athleteId}`)
            .then(r => r.json())
            .then(data => {
                const cid = data?.coachId || data?.athlete?.coachId || '';
                if (cid) setResolvedCoachId(cid);
            })
            .catch(() => { });
    }, [athleteId, resolvedCoachId]);

    const buildAutoMessage = () => {
        const setLines = sets
            .filter(s => s.actual.weight || s.actual.reps || s.actual.rpe)
            .map(s => `  Set ${s.setNumber}: ${s.actual.weight || '—'} lbs × ${s.actual.reps || '—'} reps @ RPE ${s.actual.rpe || '—'}`)
            .join('\n');

        return [
            `Coach Feedback`,
            `Block: ${blockName}`,
            `Week: ${weekNum} | Session: ${dayNum}`,
            `Exercise: ${exerciseName}`,
            setLines ? `\nSets Logged:\n${setLines}` : '',
            `\nNotes: `,
        ].filter(Boolean).join('\n');
    };

    const handleOpen = () => {
        if (!open) setMessage(buildAutoMessage());
        setOpen(o => !o);
        setSent(false);
        setError('');
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setVideo(f);
        setVideoPreview(URL.createObjectURL(f));
    };

    const clearVideo = () => {
        if (videoPreview) URL.revokeObjectURL(videoPreview);
        setVideo(null);
        setVideoPreview(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleSend = async () => {
        if (!message.trim() && !video) return;
        if (!resolvedCoachId) {
            setError('Could not find coach — please contact support.');
            return;
        }

        setSending(true);
        setError('');

        try {
            let mediaUrl: string | null = null;
            let mediaType: string | null = null;

            if (video) {
                const mime = video.type || 'video/mp4';
                const ext = mime.includes('quicktime') ? '.mov' : mime.includes('webm') ? '.webm' : '.mp4';
                const path = `${athleteId}/${Date.now()}-feedback${ext}`;

                const { data, error: upErr } = await supabase.storage
                    .from('lift-videos')
                    .upload(path, video, { cacheControl: '604800', upsert: false, contentType: mime });

                if (upErr) throw upErr;

                const { data: u } = supabase.storage.from('lift-videos').getPublicUrl(data.path);
                mediaUrl = u.publicUrl;
                mediaType = mime;
            }

            const content = message.trim() || (video ? 'Video feedback' : '');

            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: athleteId,
                    receiverId: resolvedCoachId,
                    content,
                    mediaUrl,
                    mediaType,
                }),
            });

            if (!res.ok) throw new Error('Failed to send');

            setSent(true);
            setTimeout(() => {
                setOpen(false);
                setSent(false);
                setMessage('');
                clearVideo();
            }, 1800);
        } catch (e: any) {
            setError('Send failed — please try again.');
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ marginTop: 10 }}>
            {/* Trigger button */}
            <button
                onClick={handleOpen}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    color: '#818cf8', fontSize: 13, fontWeight: 600,
                    transition: 'all 0.15s', width: '100%', justifyContent: 'center',
                }}
            >
                <MessageCircle size={15} />
                {open ? 'Hide Feedback' : 'Send Coach Feedback'}
            </button>

            {/* Expandable panel */}
            {open && (
                <div style={{
                    marginTop: 8, background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
                    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {/* Auto-filled message textarea */}
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={9}
                        style={{
                            width: '100%', background: 'rgba(15,23,42,0.8)',
                            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                            padding: '10px 12px', fontSize: 13, color: '#f1f5f9',
                            resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit',
                            outlineColor: '#6366f1',
                        }}
                    />

                    {/* Video preview */}
                    {videoPreview && (
                        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <video src={videoPreview} controls style={{ width: '100%', maxHeight: 220, background: '#000' }} />
                            <button
                                onClick={clearVideo}
                                style={{
                                    position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)',
                                    border: 'none', borderRadius: '50%', width: 26, height: 26,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#f1f5f9',
                                }}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {/* Actions row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Video upload */}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/*,image/*"
                            onChange={handleVideoSelect}
                            style={{ display: 'none' }}
                            id={`feedback-video-${athleteId}-${exerciseName.replace(/\s/g, '-')}`}
                        />
                        <label
                            htmlFor={`feedback-video-${athleteId}-${exerciseName.replace(/\s/g, '-')}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: video ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${video ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                                color: video ? '#818cf8' : '#94a3b8', fontSize: 13, fontWeight: 600,
                                transition: 'all 0.15s', flexShrink: 0,
                            }}
                        >
                            <Video size={14} />
                            {video ? 'Change video' : 'Attach video'}
                        </label>

                        {/* Send */}
                        <button
                            onClick={handleSend}
                            disabled={sending || sent || (!message.trim() && !video)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: sent ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: sent ? '1px solid rgba(16,185,129,0.4)' : 'none',
                                borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
                                color: sent ? '#34d399' : '#fff', fontSize: 13, fontWeight: 700,
                                opacity: (!message.trim() && !video) ? 0.4 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {sent
                                ? <><CheckCircle size={14} /> Sent!</>
                                : sending
                                    ? 'Sending…'
                                    : <><Send size={13} /> Send to Coach</>
                            }
                        </button>
                    </div>

                    {error && (
                        <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</div>
                    )}
                </div>
            )}
        </div>
    );
}

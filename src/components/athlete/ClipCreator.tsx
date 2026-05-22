'use client';

import { useState } from 'react';
import { Clapperboard } from 'lucide-react';
import VideoOverlayEditor from '@/components/video-overlay/VideoOverlayEditor';
import type { ClipSetData } from '@/components/video-overlay/OverlayCard';

interface ClipCreatorProps {
    exerciseName: string;
    sets: Array<{ weight: string; reps: string; rpe: string }>;
    sessionLabel: string;    // e.g. "Week 3 · Block Name"
    athleteId?: string;      // reserved for future save-to-server feature
}

export default function ClipCreator({ exerciseName, sets, sessionLabel }: ClipCreatorProps) {
    const [editorOpen, setEditorOpen] = useState(false);

    const clipSets: ClipSetData[] = sets.length > 0
        ? sets.map(s => ({ weight: s.weight, reps: s.reps, rpe: s.rpe }))
        : [{ weight: '', reps: '', rpe: '' }];


    return (
        <div style={{ display: 'contents' }}>
                <button
                    onClick={() => setEditorOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '7px 12px',
                        background: 'rgba(6,182,212,0.06)',
                        border: '1px solid rgba(6,182,212,0.18)',
                        borderRadius: 8, cursor: 'pointer',
                        color: 'rgba(6,182,212,0.85)',
                        fontSize: 12, fontWeight: 600, flex: 1,
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-geist-sans, system-ui)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(6,182,212,0.12)';
                        e.currentTarget.style.borderColor = 'rgba(6,182,212,0.35)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(6,182,212,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(6,182,212,0.18)';
                    }}
                >
                    <Clapperboard size={13} />
                    Create Clip
                </button>
            <VideoOverlayEditor
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                exerciseName={exerciseName}
                sessionLabel={sessionLabel}
                sets={clipSets}
            />
        </div>
    );
}

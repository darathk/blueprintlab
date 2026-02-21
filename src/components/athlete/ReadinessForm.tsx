'use client';

import { useState } from 'react';

// Scale: 1 (Bad/Severe) to 5 (Good/None) for consistency in scoring?
// Actually, let's map it visually.
// Image implies: "No soreness" (Green), "Severe" (Red).
// So for Soreness: 5 = No Soreness (Good), 1 = Severe (Bad).
// For Motivation: 5 = High (Good), 1 = Low (Bad).
const QUESTIONNAIRE = [
    {
        id: 'leg_soreness',
        label: 'Leg Soreness',
        description: 'Quadriceps, Hamstrings, Calves, Glutes',
        type: 'soreness'
    },
    {
        id: 'push_soreness',
        label: 'Push Soreness',
        description: 'Chest, Shoulders, Triceps',
        type: 'soreness'
    },
    {
        id: 'pull_soreness',
        label: 'Pull Soreness',
        description: 'Back, Biceps, Forearms',
        type: 'soreness'
    },
    {
        id: 'tiredness',
        label: 'Tiredness',
        description: 'General fatigue levels',
        options: [
            { value: 1, label: 'Always Tired', desc: 'Exhausted', color: '#ef4444' },
            { value: 2, label: 'Very Tired', desc: 'Dragging', color: '#f87171' },
            { value: 3, label: 'Normal', desc: 'Average', color: '#fbbf24' },
            { value: 4, label: 'Fresh', desc: 'Good energy', color: '#34d399' },
            { value: 5, label: 'Very Fresh', desc: 'Peaking', color: '#10b981' }
        ]
    },
    {
        id: 'recovery',
        label: 'Perceived Recovery',
        description: 'How recovered do you feel?',
        options: [
            { value: 1, label: 'Poorly', desc: 'Not recovered', color: '#ef4444' },
            { value: 2, label: 'Below Avg', desc: 'A bit beat up', color: '#f87171' },
            { value: 3, label: 'Average', desc: 'Okay', color: '#fbbf24' },
            { value: 4, label: 'Good', desc: 'Ready', color: '#34d399' },
            { value: 5, label: 'Excellent', desc: '100%', color: '#10b981' }
        ]
    },
    {
        id: 'motivation',
        label: 'Motivation to Train',
        description: 'Desire to get after it today',
        options: [
            { value: 1, label: 'None', desc: 'Dreading it', color: '#ef4444' },
            { value: 2, label: 'Low', desc: 'Dragging', color: '#f87171' },
            { value: 3, label: 'Neutral', desc: 'Discipline', color: '#fbbf24' },
            { value: 4, label: 'High', desc: 'Excited', color: '#34d399' },
            { value: 5, label: 'Very High', desc: 'Hyped', color: '#10b981' }
        ]
    },
    {
        id: 'training_load',
        label: 'Perceived Training Load',
        description: 'Cumulative stress from training',
        options: [
            { value: 1, label: 'Overloaded', desc: 'Too much', color: '#ef4444' },
            { value: 2, label: 'Very High', desc: 'Struggling', color: '#f87171' },
            { value: 3, label: 'High', desc: 'Challenging', color: '#fbbf24' },
            { value: 4, label: 'Moderate', desc: 'Manageable', color: '#34d399' },
            { value: 5, label: 'Low', desc: 'Easy', color: '#10b981' }
        ]
    }
];

// Soreness options are shared
const SORENESS_OPTIONS = [
    { value: 1, label: 'Severe', desc: 'Painful range of motion', color: '#ef4444' }, // Red
    { value: 2, label: 'Significant', desc: 'Clearly noticeable', color: '#f87171' }, // Light Red
    { value: 3, label: 'Moderate', desc: 'Noticeable but okay', color: '#fbbf24' },   // Yellow
    { value: 4, label: 'Light', desc: 'Barely noticeable', color: '#34d399' },        // Light Green
    { value: 5, label: 'None', desc: 'No soreness', color: '#10b981' }                // Green
];

export default function ReadinessForm({ onSubmit, onCancel }) {
    const [scores, setScores] = useState({});

    const handleSelect = (id, value) => {
        setScores(prev => ({ ...prev, [id]: value }));
    };

    const isComplete = QUESTIONNAIRE.every(q => scores[q.id]);

    const handleSubmit = () => {
        if (!isComplete) return;
        onSubmit(scores);
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: '800px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                Daily Readiness Check
            </h2>

            <div style={{ display: 'grid', gap: '2rem' }}>
                {QUESTIONNAIRE.map(q => {
                    const options = q.type === 'soreness' ? SORENESS_OPTIONS : q.options;

                    return (
                        <div key={q.id}>
                            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{q.label}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--secondary-foreground)' }}>{q.description}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                                {options.map(opt => {
                                    const isSelected = scores[q.id] === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleSelect(q.id, opt.value)}
                                            style={{
                                                background: isSelected ? opt.color : 'rgba(255,255,255,0.03)',
                                                border: isSelected ? `1px solid ${opt.color}` : '1px solid var(--card-border)',
                                                borderRadius: '6px',
                                                padding: '0.5rem',
                                                color: isSelected ? 'black' : 'var(--foreground)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textAlign: 'center',
                                                opacity: (scores[q.id] && !isSelected) ? 0.5 : 1
                                            }}
                                            title={opt.desc}
                                        >
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{opt.label}</div>
                                            {isSelected && <div style={{ fontSize: '0.65rem', marginTop: '2px', fontWeight: 500 }}>{opt.desc}</div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                <button
                    onClick={handleSubmit}
                    className="btn btn-primary"
                    disabled={!isComplete}
                    style={{ opacity: isComplete ? 1 : 0.5 }}
                >
                    Submit & Start Workout
                </button>
            </div>
        </div>
    );
}

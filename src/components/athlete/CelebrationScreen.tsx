'use client';

import { useState, useEffect, useCallback } from 'react';

interface CelebrationScreenProps {
    onClose: () => void;
    coachId?: string;
    athleteId: string;
    sessionName?: string;
}

interface RankData {
    rank: number;
    total: number;
    currentStreak: number;
    tier: string;
}

const TIER_COLORS: Record<string, { color: string; label: string }> = {
    champion: { color: '#FFD700', label: 'Champion' },
    gold: { color: '#F59E0B', label: 'Gold' },
    silver: { color: '#94A3B8', label: 'Silver' },
    bronze: { color: '#CD7F32', label: 'Bronze' },
    iron: { color: '#6B7280', label: 'Iron' },
};

export default function CelebrationScreen({ onClose, coachId, athleteId, sessionName }: CelebrationScreenProps) {
    const [rankData, setRankData] = useState<RankData | null>(null);
    const [show, setShow] = useState(false);
    const [showContent, setShowContent] = useState(false);

    const fetchRank = useCallback(async () => {
        if (!coachId) return;
        try {
            const res = await fetch(`/api/leaderboard?coachId=${coachId}`);
            if (res.ok) {
                const entries = await res.json();
                const me = entries.find((e: any) => e.id === athleteId);
                if (me) {
                    setRankData({
                        rank: me.rank,
                        total: entries.length,
                        currentStreak: me.currentStreak,
                        tier: me.tier,
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch rank for celebration:', e);
        }
    }, [coachId, athleteId]);

    useEffect(() => {
        fetchRank();
        // Animate in
        requestAnimationFrame(() => {
            setShow(true);
            setTimeout(() => setShowContent(true), 300);
        });
    }, [fetchRank]);

    const handleClose = () => {
        setShowContent(false);
        setShow(false);
        setTimeout(onClose, 300);
    };

    const tierCfg = TIER_COLORS[rankData?.tier || 'iron'] || TIER_COLORS.iron;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: show ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0)',
                backdropFilter: 'blur(12px)',
                transition: 'background 0.4s ease',
                overflow: 'hidden',
            }}
        >
            {/* ═══ CONFETTI ═══ */}
            <div className="confetti-container" aria-hidden="true">
                {Array.from({ length: 50 }).map((_, i) => (
                    <div
                        key={i}
                        className="confetti-piece"
                        style={{
                            '--x': `${Math.random() * 100}vw`,
                            '--delay': `${Math.random() * 2}s`,
                            '--duration': `${2 + Math.random() * 3}s`,
                            '--rotation': `${Math.random() * 720 - 360}deg`,
                            '--color': ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee'][i % 7],
                            '--size': `${6 + Math.random() * 8}px`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>

            {/* ═══ MAIN CONTENT ═══ */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                padding: '2rem',
                maxWidth: 380,
                width: '100%',
                transform: showContent ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.9)',
                opacity: showContent ? 1 : 0,
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>

                {/* ═══ ANIMATED POWERLIFTER ═══ */}
                <div className="lifter-container">
                    <svg viewBox="0 0 200 290" width="180" height="260" className="lifter-svg">
                        <defs>
                            <linearGradient id="skin-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f8d4b0" />
                                <stop offset="100%" stopColor="#e8b88a" />
                            </linearGradient>
                            <linearGradient id="singlet-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1e293b" />
                                <stop offset="100%" stopColor="#0f172a" />
                            </linearGradient>
                            <linearGradient id="hair-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#5a4030" />
                                <stop offset="100%" stopColor="#3a2518" />
                            </linearGradient>
                            <radialGradient id="blush-grad">
                                <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#fca5a5" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        {/* Shadow */}
                        <g id="shadow">
                            <ellipse cx="100" cy="278" rx="46" ry="7" fill="rgba(0,0,0,0.25)" />
                        </g>

                        {/* ── Left Leg ── */}
                        <g id="left_leg">
                            <g id="left_upper_leg" style={{ transformOrigin: '82px 198px' }}>
                                <rect x="70" y="194" width="24" height="34" rx="11" fill="url(#singlet-grad)" />
                                <rect x="70" y="214" width="24" height="5" rx="2.5" fill="#dc2626" opacity="0.8" />
                            </g>
                            <g id="left_lower_leg" style={{ transformOrigin: '82px 228px' }}>
                                <rect x="72" y="226" width="20" height="36" rx="9" fill="url(#skin-grad)" />
                            </g>
                            <g id="left_foot">
                                <ellipse cx="80" cy="266" rx="17" ry="9" fill="#1e293b" />
                                <ellipse cx="83" cy="264" rx="7" ry="3.5" fill="#334155" />
                                <path d="M65 266 Q63 264 65 262" stroke="#475569" strokeWidth="0.8" fill="none" />
                            </g>
                        </g>

                        {/* ── Right Leg ── */}
                        <g id="right_leg">
                            <g id="right_upper_leg" style={{ transformOrigin: '118px 198px' }}>
                                <rect x="106" y="194" width="24" height="34" rx="11" fill="url(#singlet-grad)" />
                                <rect x="106" y="214" width="24" height="5" rx="2.5" fill="#dc2626" opacity="0.8" />
                            </g>
                            <g id="right_lower_leg" style={{ transformOrigin: '118px 228px' }}>
                                <rect x="108" y="226" width="20" height="36" rx="9" fill="url(#skin-grad)" />
                            </g>
                            <g id="right_foot">
                                <ellipse cx="120" cy="266" rx="17" ry="9" fill="#1e293b" />
                                <ellipse cx="117" cy="264" rx="7" ry="3.5" fill="#334155" />
                                <path d="M135 266 Q137 264 135 262" stroke="#475569" strokeWidth="0.8" fill="none" />
                            </g>
                        </g>

                        {/* ── Torso ── */}
                        <g id="torso">
                            <rect x="62" y="108" width="76" height="90" rx="18" fill="url(#singlet-grad)" />
                            {/* Top trim */}
                            <rect x="62" y="106" width="76" height="5" rx="2.5" fill="#dc2626" />
                            {/* Straps */}
                            <line x1="76" y1="108" x2="82" y2="86" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                            <line x1="124" y1="108" x2="118" y2="86" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                            {/* Belt */}
                            <rect x="66" y="162" width="68" height="8" rx="3" fill="#334155" />
                            <rect x="94" y="160" width="12" height="12" rx="3" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                            {/* Barbell logo */}
                            <circle cx="100" cy="140" r="8" fill="none" stroke="#dc2626" strokeWidth="1.2" />
                            <line x1="90" y1="140" x2="110" y2="140" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
                            <rect x="87" y="137" width="4" height="6" rx="1.5" fill="#64748b" />
                            <rect x="109" y="137" width="4" height="6" rx="1.5" fill="#64748b" />
                        </g>

                        {/* ── Head ── */}
                        <g id="head">
                            {/* Neck */}
                            <rect x="90" y="82" width="20" height="16" rx="8" fill="url(#skin-grad)" />
                            {/* Head shape */}
                            <ellipse cx="100" cy="60" rx="29" ry="30" fill="url(#skin-grad)" />
                            {/* Ears */}
                            <ellipse cx="71" cy="62" rx="5" ry="7" fill="#e8b88a" />
                            <ellipse cx="71" cy="62" rx="3" ry="5" fill="#daa06d" opacity="0.3" />
                            <ellipse cx="129" cy="62" rx="5" ry="7" fill="#e8b88a" />
                            <ellipse cx="129" cy="62" rx="3" ry="5" fill="#daa06d" opacity="0.3" />
                            {/* Hair */}
                            <path d="M71 52 Q74 22 100 25 Q126 22 129 52 Q128 36 100 34 Q72 36 71 52Z" fill="url(#hair-grad)" />
                            <path d="M96 27 Q99 14 106 25" fill="url(#hair-grad)" />
                            <path d="M71 52 Q69 46 72 40" stroke="#3a2518" strokeWidth="3" fill="none" strokeLinecap="round" />
                            <path d="M129 52 Q131 46 128 40" stroke="#3a2518" strokeWidth="3" fill="none" strokeLinecap="round" />

                            {/* Eyes */}
                            <g id="eyes">
                                <ellipse cx="88" cy="60" rx="5" ry="5.5" fill="white" />
                                <circle cx="89" cy="60" r="3.5" fill="#1e293b" />
                                <circle cx="90" cy="58.5" r="1.5" fill="white" />
                                <ellipse cx="112" cy="60" rx="5" ry="5.5" fill="white" />
                                <circle cx="111" cy="60" r="3.5" fill="#1e293b" />
                                <circle cx="112" cy="58.5" r="1.5" fill="white" />
                            </g>

                            {/* Eyebrows */}
                            <path d="M82 49 Q87 45 93 47" stroke="#3a2518" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <path d="M107 47 Q113 45 118 49" stroke="#3a2518" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                            {/* Nose */}
                            <ellipse cx="100" cy="68" rx="2.5" ry="2" fill="#daa06d" opacity="0.6" />

                            {/* Smile */}
                            <path d="M86 74 Q100 90 114 74" fill="white" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
                            <line x1="96" y1="74" x2="96" y2="80" stroke="#e5e7eb" strokeWidth="0.5" />
                            <line x1="100" y1="74" x2="100" y2="82" stroke="#e5e7eb" strokeWidth="0.5" />
                            <line x1="104" y1="74" x2="104" y2="80" stroke="#e5e7eb" strokeWidth="0.5" />
                            <path d="M90 82 Q100 86 110 82" fill="none" stroke="#d4956b" strokeWidth="1" opacity="0.4" />

                            {/* Blush */}
                            <circle cx="78" cy="72" r="7" fill="url(#blush-grad)" />
                            <circle cx="122" cy="72" r="7" fill="url(#blush-grad)" />
                        </g>

                        {/* ── Left Arm ── */}
                        <g id="left_arm" className="lifter-left-arm" style={{ transformOrigin: '62px 110px' }}>
                            <g id="left_upper_arm" style={{ transformOrigin: '62px 110px' }}>
                                <rect x="28" y="72" width="22" height="42" rx="10" fill="url(#skin-grad)" transform="rotate(-30, 58, 108)" />
                            </g>
                            <g id="left_lower_arm" style={{ transformOrigin: '36px 76px' }}>
                                <rect x="20" y="42" width="20" height="38" rx="9" fill="url(#skin-grad)" transform="rotate(10, 33, 62)" />
                                {/* Bicep */}
                                <ellipse cx="38" cy="80" rx="8" ry="7" fill="#daa06d" opacity="0.35" />
                                {/* Fist */}
                                <circle cx="28" cy="44" r="10" fill="url(#skin-grad)" stroke="#daa06d" strokeWidth="0.5" />
                                <ellipse cx="35" cy="48" rx="4" ry="3" fill="url(#skin-grad)" />
                                <path d="M24 41 Q28 39 32 41" stroke="#d4956b" strokeWidth="0.6" fill="none" opacity="0.5" />
                            </g>
                        </g>

                        {/* ── Right Arm ── */}
                        <g id="right_arm" className="lifter-right-arm" style={{ transformOrigin: '138px 110px' }}>
                            <g id="right_upper_arm" style={{ transformOrigin: '138px 110px' }}>
                                <rect x="150" y="72" width="22" height="42" rx="10" fill="url(#skin-grad)" transform="rotate(30, 142, 108)" />
                            </g>
                            <g id="right_lower_arm" style={{ transformOrigin: '164px 76px' }}>
                                <rect x="160" y="42" width="20" height="38" rx="9" fill="url(#skin-grad)" transform="rotate(-10, 167, 62)" />
                                <ellipse cx="162" cy="80" rx="8" ry="7" fill="#daa06d" opacity="0.35" />
                                <circle cx="172" cy="44" r="10" fill="url(#skin-grad)" stroke="#daa06d" strokeWidth="0.5" />
                                <ellipse cx="165" cy="48" rx="4" ry="3" fill="url(#skin-grad)" />
                                <path d="M168 41 Q172 39 176 41" stroke="#d4956b" strokeWidth="0.6" fill="none" opacity="0.5" />
                            </g>
                        </g>

                        {/* ── Sparkles ── */}
                        <g id="sparkles">
                            <g className="sparkle sparkle-1">
                                <polygon points="18,28 21,22 24,28 21,34" fill="#fbbf24" />
                                <polygon points="15,28 27,28" fill="#fbbf24" transform="rotate(45, 21, 28)" />
                            </g>
                            <g className="sparkle sparkle-2">
                                <polygon points="176,22 178,17 180,22 178,27" fill="#38bdf8" />
                                <polygon points="174,22 182,22" fill="#38bdf8" transform="rotate(45, 178, 22)" />
                            </g>
                            <g className="sparkle sparkle-3">
                                <polygon points="46,12 48,7 50,12 48,17" fill="#34d399" />
                                <polygon points="44,12 52,12" fill="#34d399" transform="rotate(45, 48, 12)" />
                            </g>
                            <g className="sparkle sparkle-4">
                                <polygon points="155,8 157,4 159,8 157,12" fill="#a78bfa" />
                                <polygon points="153,8 161,8" fill="#a78bfa" transform="rotate(45, 157, 8)" />
                            </g>
                        </g>
                    </svg>
                </div>

                {/* ═══ CELEBRATION TEXT ═══ */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        fontSize: '1.8rem',
                        fontWeight: 800,
                        margin: 0,
                        background: 'linear-gradient(135deg, #38bdf8, #34d399, #a78bfa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.02em',
                    }}>
                        Session Complete!
                    </h2>
                    <p style={{
                        color: 'var(--secondary-foreground)',
                        fontSize: '0.95rem',
                        margin: '6px 0 0',
                    }}>
                        {sessionName ? `${sessionName} crushed!` : 'Great work today!'}
                    </p>
                </div>

                {/* ═══ STATS CARDS ═══ */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    width: '100%',
                    justifyContent: 'center',
                }}>
                    {/* Leaderboard Rank */}
                    {rankData && (
                        <div style={{
                            flex: 1,
                            maxWidth: 150,
                            padding: '14px 12px',
                            borderRadius: 14,
                            border: `1.5px solid ${tierCfg.color}40`,
                            background: `linear-gradient(135deg, ${tierCfg.color}10, rgba(0,0,0,0.2))`,
                            textAlign: 'center',
                        }}>
                            <div style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: tierCfg.color,
                                marginBottom: 6,
                            }}>
                                Leaderboard
                            </div>
                            <div style={{
                                fontSize: '1.6rem',
                                fontWeight: 800,
                                color: 'var(--foreground)',
                            }}>
                                #{rankData.rank}
                            </div>
                            <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--secondary-foreground)',
                                marginTop: 2,
                            }}>
                                of {rankData.total} athletes
                            </div>
                        </div>
                    )}

                    {/* Streak */}
                    {rankData && (
                        <div style={{
                            flex: 1,
                            maxWidth: 150,
                            padding: '14px 12px',
                            borderRadius: 14,
                            border: '1.5px solid rgba(251, 191, 36, 0.3)',
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(0,0,0,0.2))',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: '#fbbf24',
                                marginBottom: 6,
                            }}>
                                Streak
                            </div>
                            <div style={{
                                fontSize: '1.6rem',
                                fontWeight: 800,
                                color: 'var(--foreground)',
                            }}>
                                {rankData.currentStreak}
                            </div>
                            <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--secondary-foreground)',
                                marginTop: 2,
                            }}>
                                {rankData.currentStreak === 1 ? 'session' : 'sessions'}
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ EXIT BUTTON ═══ */}
                <button
                    onClick={handleClose}
                    style={{
                        width: '100%',
                        maxWidth: 320,
                        padding: '14px 24px',
                        borderRadius: 14,
                        border: 'none',
                        background: 'linear-gradient(135deg, #38bdf8, #7c3aed)',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)',
                        marginTop: 8,
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                    Continue
                </button>
            </div>

            <style jsx>{`
                /* ═══ CONFETTI ═══ */
                .confetti-container {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                }
                .confetti-piece {
                    position: absolute;
                    top: -20px;
                    left: var(--x);
                    width: var(--size);
                    height: var(--size);
                    background: var(--color);
                    border-radius: 2px;
                    animation: confetti-fall var(--duration) var(--delay) ease-in forwards;
                    opacity: 0;
                }
                .confetti-piece:nth-child(odd) {
                    border-radius: 50%;
                }
                .confetti-piece:nth-child(3n) {
                    width: calc(var(--size) * 0.5);
                    height: calc(var(--size) * 1.5);
                }
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(var(--rotation));
                        opacity: 0;
                    }
                }

                /* ═══ POWERLIFTER ANIMATION ═══ */
                .lifter-container {
                    animation: lifter-bounce 1s ease-in-out infinite;
                }
                @keyframes lifter-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
                .lifter-left-arm {
                    animation: flex-left 0.8s ease-in-out infinite alternate;
                }
                .lifter-right-arm {
                    animation: flex-right 0.8s ease-in-out infinite alternate;
                }
                @keyframes flex-left {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(-8deg); }
                }
                @keyframes flex-right {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(8deg); }
                }
                .sparkle {
                    animation: sparkle-pulse 1.2s ease-in-out infinite;
                }
                .sparkle-1 { animation-delay: 0s; }
                .sparkle-2 { animation-delay: 0.4s; }
                .sparkle-3 { animation-delay: 0.8s; }
                .sparkle-4 { animation-delay: 0.6s; }
                @keyframes sparkle-pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
}

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
                    <svg viewBox="0 0 200 280" width="180" height="250" className="lifter-svg">
                        {/* Shadow */}
                        <ellipse cx="100" cy="270" rx="50" ry="8" fill="rgba(0,0,0,0.3)" />

                        {/* Left foot */}
                        <ellipse cx="75" cy="260" rx="16" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                        <ellipse cx="75" cy="258" rx="8" ry="4" fill="#e2e8f0" />
                        {/* Right foot */}
                        <ellipse cx="125" cy="260" rx="16" ry="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                        <ellipse cx="125" cy="258" rx="8" ry="4" fill="#e2e8f0" />

                        {/* Left leg */}
                        <rect x="68" y="210" width="22" height="50" rx="10" fill="#f5c7a1" />
                        {/* Right leg */}
                        <rect x="110" y="210" width="22" height="50" rx="10" fill="#f5c7a1" />

                        {/* Singlet bottom (legs) */}
                        <rect x="65" y="185" width="28" height="40" rx="12" fill="#1e293b" stroke="#dc2626" strokeWidth="1.5" />
                        <rect x="107" y="185" width="28" height="40" rx="12" fill="#1e293b" stroke="#dc2626" strokeWidth="1.5" />

                        {/* Body / singlet */}
                        <rect x="60" y="110" width="80" height="90" rx="20" fill="#1e293b" />
                        {/* Singlet straps */}
                        <line x1="75" y1="110" x2="80" y2="85" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
                        <line x1="125" y1="110" x2="120" y2="85" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
                        {/* Singlet trim */}
                        <rect x="60" y="108" width="80" height="4" rx="2" fill="#dc2626" />
                        {/* Barbell logo on singlet */}
                        <circle cx="100" cy="145" r="10" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                        <line x1="88" y1="145" x2="112" y2="145" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                        <rect x="85" y="141" width="5" height="8" rx="1" fill="#94a3b8" />
                        <rect x="110" y="141" width="5" height="8" rx="1" fill="#94a3b8" />

                        {/* Head */}
                        <circle cx="100" cy="65" r="30" fill="#f5c7a1" />
                        {/* Hair */}
                        <path d="M70 55 Q75 25 100 28 Q125 25 130 55 Q128 40 100 38 Q72 40 70 55Z" fill="#4a3728" />
                        {/* Hair tuft */}
                        <path d="M95 30 Q98 18 105 28" fill="#4a3728" />

                        {/* Eyes */}
                        <circle cx="88" cy="62" r="4" fill="#1e293b" />
                        <circle cx="112" cy="62" r="4" fill="#1e293b" />
                        <circle cx="89.5" cy="60.5" r="1.5" fill="white" />
                        <circle cx="113.5" cy="60.5" r="1.5" fill="white" />

                        {/* Big smile */}
                        <path d="M85 76 Q100 92 115 76" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                        {/* Teeth */}
                        <path d="M90 78 Q100 88 110 78" fill="white" />

                        {/* Blush */}
                        <circle cx="80" cy="74" r="5" fill="#fca5a5" opacity="0.5" />
                        <circle cx="120" cy="74" r="5" fill="#fca5a5" opacity="0.5" />

                        {/* Eyebrows - excited */}
                        <line x1="82" y1="52" x2="92" y2="50" stroke="#4a3728" strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="108" y1="50" x2="118" y2="52" stroke="#4a3728" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Left arm - flexing up */}
                        <g className="lifter-left-arm">
                            {/* Upper arm */}
                            <rect x="30" y="70" width="22" height="40" rx="10" fill="#f5c7a1" transform="rotate(-30, 55, 105)" />
                            {/* Forearm - flexed */}
                            <rect x="22" y="45" width="20" height="35" rx="9" fill="#f5c7a1" transform="rotate(10, 35, 65)" />
                            {/* Bicep bump */}
                            <circle cx="38" cy="78" r="8" fill="#f0b98a" />
                            {/* Fist */}
                            <circle cx="30" cy="48" r="9" fill="#f5c7a1" />
                        </g>

                        {/* Right arm - flexing up */}
                        <g className="lifter-right-arm">
                            <rect x="148" y="70" width="22" height="40" rx="10" fill="#f5c7a1" transform="rotate(30, 145, 105)" />
                            <rect x="158" y="45" width="20" height="35" rx="9" fill="#f5c7a1" transform="rotate(-10, 165, 65)" />
                            <circle cx="162" cy="78" r="8" fill="#f0b98a" />
                            <circle cx="170" cy="48" r="9" fill="#f5c7a1" />
                        </g>

                        {/* Star sparkles */}
                        <g className="sparkle sparkle-1">
                            <polygon points="20,30 23,25 26,30 23,35" fill="#fbbf24" />
                            <polygon points="18,28 28,28" fill="#fbbf24" transform="rotate(45, 23, 28)" />
                        </g>
                        <g className="sparkle sparkle-2">
                            <polygon points="175,25 177,21 179,25 177,29" fill="#38bdf8" />
                            <polygon points="173,23 181,23" fill="#38bdf8" transform="rotate(45, 177, 23)" />
                        </g>
                        <g className="sparkle sparkle-3">
                            <polygon points="45,15 47,11 49,15 47,19" fill="#34d399" />
                            <polygon points="43,13 51,13" fill="#34d399" transform="rotate(45, 47, 13)" />
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
                    transform-origin: 55px 105px;
                    animation: flex-left 0.8s ease-in-out infinite alternate;
                }
                .lifter-right-arm {
                    transform-origin: 145px 105px;
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
                @keyframes sparkle-pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
}

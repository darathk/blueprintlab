export interface LeaderboardEntry {
    id: string;
    name: string;
    totalLogs: number;
    totalSessions: number;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    tier: string;
    tierName?: string;
    tierIcon?: string;
    nextTierName?: string | null;
    nextTierLogs?: number | null;
    progressPercent?: number;
    firstLogDate?: string | null;
    lastLogDate?: string | null;
}

export interface CycleInfo {
    start: string;
    end: string;
    daysRemaining: number;
    monthName?: string;
    monthKey?: string;
}

export interface LeaderboardResponse {
    monthly?: {
        entries: LeaderboardEntry[];
        cycle: CycleInfo;
    };
    allTime?: {
        entries: LeaderboardEntry[];
    };
    entries?: LeaderboardEntry[];
    cycle?: CycleInfo;
}

export const TIER_CONFIG: Record<string, {
    color: string;
    glow: string;
    label: string;
    icon: string;
    badgeBg: string;
    borderColor: string;
    minMonthly: number;
    minAllTime: number;
    description: string;
}> = {
    challenger: {
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.5)',
        label: 'Challenger',
        icon: '👑',
        badgeBg: 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(251, 191, 36, 0.22))',
        borderColor: '#00f0ff',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Rank #1 Peak Athlete of Blueprint Lab',
    },
    grandmaster: {
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.45)',
        label: 'Grandmaster',
        icon: '🔥',
        badgeBg: 'rgba(239, 68, 68, 0.16)',
        borderColor: '#ef4444',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Podium Finishers (#2 & #3 Top Athletes)',
    },
    master: {
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.45)',
        label: 'Master',
        icon: '⚔️',
        badgeBg: 'rgba(168, 85, 247, 0.16)',
        borderColor: '#a855f7',
        minMonthly: 24,
        minAllTime: 170,
        description: 'Near-daily workout completion & exceptional dedication',
    },
    diamond: {
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.4)',
        label: 'Diamond',
        icon: '💎',
        badgeBg: 'rgba(56, 189, 248, 0.16)',
        borderColor: '#38bdf8',
        minMonthly: 20,
        minAllTime: 120,
        description: 'Consistent 5 sessions per week standard',
    },
    platinum: {
        color: '#10b981',
        glow: 'rgba(168, 185, 129, 0.35)',
        label: 'Platinum',
        icon: '🛡️',
        badgeBg: 'rgba(16, 185, 129, 0.16)',
        borderColor: '#10b981',
        minMonthly: 16,
        minAllTime: 80,
        description: 'High standard of training discipline',
    },
    gold: {
        color: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.35)',
        label: 'Gold',
        icon: '🥇',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#f59e0b',
        minMonthly: 12,
        minAllTime: 50,
        description: 'Solid regular routine & habitual consistency',
    },
    silver: {
        color: '#94a3b8',
        glow: 'rgba(148, 163, 184, 0.3)',
        label: 'Silver',
        icon: '🥈',
        badgeBg: 'rgba(148, 163, 184, 0.14)',
        borderColor: '#94a3b8',
        minMonthly: 8,
        minAllTime: 25,
        description: 'Building training volume & momentum',
    },
    bronze: {
        color: '#d97706',
        glow: 'rgba(217, 119, 6, 0.3)',
        label: 'Bronze',
        icon: '🥉',
        badgeBg: 'rgba(217, 119, 6, 0.14)',
        borderColor: '#d97706',
        minMonthly: 4,
        minAllTime: 10,
        description: 'Laying down the foundational habits',
    },
    iron: {
        color: '#64748b',
        glow: 'rgba(100, 116, 139, 0.25)',
        label: 'Iron',
        icon: '⚙️',
        badgeBg: 'rgba(100, 116, 139, 0.12)',
        borderColor: '#64748b',
        minMonthly: 0,
        minAllTime: 0,
        description: 'The starting step of the training journey',
    },
    champion: {
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.5)',
        label: 'Challenger',
        icon: '👑',
        badgeBg: 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(251, 191, 36, 0.22))',
        borderColor: '#00f0ff',
        minMonthly: 10,
        minAllTime: 40,
        description: 'Rank #1 Peak Athlete',
    },
};

export function getStreakEmoji(streak: number): string {
    if (streak >= 20) return '🔥🔥🔥';
    if (streak >= 10) return '🔥🔥';
    if (streak >= 3) return '🔥';
    return '';
}

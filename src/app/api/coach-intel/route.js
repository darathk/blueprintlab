import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { calculateSimpleE1RM } from '@/lib/stress-index';

// Competition lift name matching
const COMP_LIFTS = {
    squat: ['squat', 'competition squat', 'comp squat'],
    bench: ['bench', 'competition bench', 'comp bench', 'bench press', 'competition bench press'],
    deadlift: ['deadlift', 'competition deadlift', 'comp deadlift'],
};

function classifyLift(name) {
    const lower = (name || '').toLowerCase().trim();
    for (const [lift, aliases] of Object.entries(COMP_LIFTS)) {
        if (aliases.includes(lower)) return lift;
    }
    return null;
}

function daysBetween(dateStr, now) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return Infinity;
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(req) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    const coachId = auth.user.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [athletes, programs, logs, readinessData, unreadMessages] = await Promise.all([
        prisma.athlete.findMany({
            where: { coachId, status: 'active' },
            select: { id: true, name: true, email: true }
        }),
        prisma.program.findMany({
            where: { athlete: { coachId }, status: { not: 'draft' } },
            select: { id: true, athleteId: true, name: true, startDate: true, endDate: true, weeks: true, status: true },
        }),
        prisma.log.findMany({
            where: { program: { athlete: { coachId } } },
            include: { program: { select: { athleteId: true } } },
        }),
        prisma.readiness.findMany({
            where: { athlete: { coachId } },
            orderBy: { timestamp: 'desc' },
        }),
        prisma.message.findMany({
            where: {
                receiverId: coachId,
                read: false,
            },
            select: { id: true, senderId: true, content: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
    ]);

    const athleteMap = new Map(athletes.map(a => [a.id, a]));
    const alerts = [];

    // ──────────────────────────────────────────────
    // 1. INACTIVE ATHLETES — no session in 7+ days
    // ──────────────────────────────────────────────
    const lastLogByAthlete = {};
    for (const log of logs) {
        const aid = log.program?.athleteId;
        if (!aid) continue;
        const logDate = log.date;
        if (!lastLogByAthlete[aid] || logDate > lastLogByAthlete[aid]) {
            lastLogByAthlete[aid] = logDate;
        }
    }
    for (const athlete of athletes) {
        const lastLog = lastLogByAthlete[athlete.id];
        const days = daysBetween(lastLog, now);
        if (days >= 7) {
            alerts.push({
                type: 'inactive',
                severity: days >= 14 ? 'critical' : 'warning',
                athleteId: athlete.id,
                athleteName: athlete.name,
                message: lastLog
                    ? `No session logged in ${days} days (last: ${new Date(lastLog).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                    : 'Has never logged a session',
                days,
            });
        }
    }

    // ──────────────────────────────────────────────
    // 2. STALLED PROGRESS — E1RM flat/declining over 4 weeks on SBD
    // ──────────────────────────────────────────────
    const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const eightWeeksAgo = new Date(now); eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    // Build per-athlete, per-lift E1RM timeline
    const e1rmByAthlete = {}; // { athleteId: { squat: [{date, e1rm}], bench: [...], deadlift: [...] } }
    for (const log of logs) {
        const aid = log.program?.athleteId;
        if (!aid) continue;
        const exercises = Array.isArray(log.exercises) ? log.exercises : [];
        for (const ex of exercises) {
            const lift = classifyLift(ex.name);
            if (!lift) continue;
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            let bestE1rm = 0;
            for (const s of sets) {
                const w = parseFloat(s.weight);
                const r = parseFloat(s.reps);
                const rpe = parseFloat(s.rpe) || 10;
                if (w > 0 && r > 0) {
                    const unit = s.unit || 'lbs';
                    const e = calculateSimpleE1RM(w, r, rpe, unit);
                    if (e > bestE1rm) bestE1rm = e;
                }
            }
            if (bestE1rm > 0) {
                if (!e1rmByAthlete[aid]) e1rmByAthlete[aid] = {};
                if (!e1rmByAthlete[aid][lift]) e1rmByAthlete[aid][lift] = [];
                e1rmByAthlete[aid][lift].push({ date: log.date, e1rm: bestE1rm });
            }
        }
    }

    for (const [aid, lifts] of Object.entries(e1rmByAthlete)) {
        const athlete = athleteMap.get(aid);
        if (!athlete) continue;

        for (const [lift, dataPoints] of Object.entries(lifts)) {
            // Recent 4 weeks vs prior 4 weeks
            const recent = dataPoints.filter(d => new Date(d.date) >= fourWeeksAgo);
            const prior = dataPoints.filter(d => {
                const dt = new Date(d.date);
                return dt >= eightWeeksAgo && dt < fourWeeksAgo;
            });

            if (recent.length === 0 || prior.length === 0) continue;

            const recentBest = Math.max(...recent.map(d => d.e1rm));
            const priorBest = Math.max(...prior.map(d => d.e1rm));

            if (recentBest <= priorBest) {
                const diff = priorBest - recentBest;
                const liftName = lift.charAt(0).toUpperCase() + lift.slice(1);
                alerts.push({
                    type: 'stalled',
                    severity: diff > 10 ? 'critical' : 'warning',
                    athleteId: aid,
                    athleteName: athlete.name,
                    message: diff > 0
                        ? `${liftName} E1RM dropped ${Math.round(diff)} lbs over last 4 weeks (${Math.round(priorBest)} → ${Math.round(recentBest)})`
                        : `${liftName} E1RM has plateaued at ~${Math.round(recentBest)} lbs for 4+ weeks`,
                    lift,
                    recentBest,
                    priorBest,
                });
            }
        }
    }

    // ──────────────────────────────────────────────
    // 3. DECLINING READINESS — trend worsening
    // ──────────────────────────────────────────────
    const readinessByAthlete = {};
    for (const r of readinessData) {
        if (!readinessByAthlete[r.athleteId]) readinessByAthlete[r.athleteId] = [];
        readinessByAthlete[r.athleteId].push(r);
    }

    for (const [aid, entries] of Object.entries(readinessByAthlete)) {
        const athlete = athleteMap.get(aid);
        if (!athlete) continue;

        // Need at least 6 entries to compare trends
        const sorted = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (sorted.length < 6) continue;

        const recent5 = sorted.slice(0, 5);
        const prior5 = sorted.slice(5, 10);
        if (prior5.length < 3) continue;

        // Average all scores (1=best, 5=worst)
        const avgScore = (entries) => {
            let total = 0, count = 0;
            for (const e of entries) {
                const scores = e.scores || {};
                for (const [key, val] of Object.entries(scores)) {
                    if (key.startsWith('_')) continue; // skip _sessionKey
                    const n = parseFloat(val);
                    if (!isNaN(n)) { total += n; count++; }
                }
            }
            return count > 0 ? total / count : 0;
        };

        const recentAvg = avgScore(recent5);
        const priorAvg = avgScore(prior5);

        // Higher = worse. Flag if readiness degraded by 0.5+ points
        if (recentAvg - priorAvg >= 0.5) {
            alerts.push({
                type: 'readiness',
                severity: recentAvg >= 3.5 ? 'critical' : 'warning',
                athleteId: aid,
                athleteName: athlete.name,
                message: `Readiness declining (avg ${priorAvg.toFixed(1)} → ${recentAvg.toFixed(1)}) — possible overtraining or fatigue`,
                recentAvg,
                priorAvg,
            });
        }
    }

    // ──────────────────────────────────────────────
    // 4. HIGH RPE PATTERNS — avg RPE ≥ 9.0 in last 3 sessions
    // ──────────────────────────────────────────────
    const logsByAthlete = {};
    for (const log of logs) {
        const aid = log.program?.athleteId;
        if (!aid) continue;
        if (!logsByAthlete[aid]) logsByAthlete[aid] = [];
        logsByAthlete[aid].push(log);
    }

    for (const [aid, athleteLogs] of Object.entries(logsByAthlete)) {
        const athlete = athleteMap.get(aid);
        if (!athlete) continue;

        const sorted = athleteLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const last3 = sorted.slice(0, 3);
        if (last3.length < 2) continue;

        let totalRpe = 0, rpeCount = 0;
        for (const log of last3) {
            const exercises = Array.isArray(log.exercises) ? log.exercises : [];
            for (const ex of exercises) {
                const sets = Array.isArray(ex.sets) ? ex.sets : [];
                for (const s of sets) {
                    const rpe = parseFloat(s.rpe);
                    if (!isNaN(rpe) && rpe > 0) { totalRpe += rpe; rpeCount++; }
                }
            }
        }

        const avgRpe = rpeCount > 0 ? totalRpe / rpeCount : 0;
        if (avgRpe >= 9.0 && rpeCount >= 3) {
            alerts.push({
                type: 'high_rpe',
                severity: avgRpe >= 9.5 ? 'critical' : 'warning',
                athleteId: aid,
                athleteName: athlete.name,
                message: `Average RPE ${avgRpe.toFixed(1)} across last ${last3.length} sessions — overreaching risk`,
                avgRpe,
            });
        }
    }

    // ──────────────────────────────────────────────
    // 5. UNANSWERED MESSAGES — unread for 5+ days
    // ──────────────────────────────────────────────
    for (const msg of unreadMessages) {
        const days = daysBetween(msg.createdAt, now);
        if (days >= 5) {
            const athlete = athleteMap.get(msg.senderId);
            if (!athlete) continue;
            alerts.push({
                type: 'unread_message',
                severity: days >= 10 ? 'critical' : 'warning',
                athleteId: msg.senderId,
                athleteName: athlete.name,
                message: `Unread message from ${days} days ago`,
                days,
                messagePreview: (msg.content || '').slice(0, 80),
            });
        }
    }

    // ──────────────────────────────────────────────
    // 6. LOW COMPLIANCE — <70% session completion in current program
    // ──────────────────────────────────────────────
    for (const athlete of athletes) {
        const athletePrograms = programs.filter(p => p.athleteId === athlete.id && p.status === 'active');
        if (athletePrograms.length === 0) continue;

        const program = athletePrograms[0]; // most recent active
        const weeks = typeof program.weeks === 'string' ? JSON.parse(program.weeks) : (program.weeks || []);

        let totalSessions = 0;
        for (const w of weeks) {
            totalSessions += (w.sessions?.length || 0);
        }
        if (totalSessions === 0) continue;

        const programLogs = logs.filter(l => l.programId === program.id);
        const uniqueSessions = new Set(programLogs.map(l => l.sessionId));
        const completionRate = uniqueSessions.size / totalSessions;

        // Only flag if they've had enough time to complete some sessions (program started 2+ weeks ago)
        const programStart = new Date(program.startDate);
        const weeksSinceStart = daysBetween(program.startDate, now) / 7;
        if (weeksSinceStart < 2) continue;

        // Expected sessions by now (proportional to time elapsed)
        const programEnd = program.endDate ? new Date(program.endDate) : new Date(programStart.getTime() + weeks.length * 7 * 24 * 60 * 60 * 1000);
        const totalProgramDays = Math.max(1, (programEnd.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.min(totalProgramDays, daysBetween(program.startDate, now));
        const expectedSessions = Math.floor(totalSessions * (elapsedDays / totalProgramDays));

        if (expectedSessions < 3) continue; // Not enough data yet

        const complianceRate = expectedSessions > 0 ? uniqueSessions.size / expectedSessions : 1;

        if (complianceRate < 0.70) {
            alerts.push({
                type: 'low_compliance',
                severity: complianceRate < 0.50 ? 'critical' : 'warning',
                athleteId: athlete.id,
                athleteName: athlete.name,
                message: `${Math.round(complianceRate * 100)}% session compliance on "${program.name}" (${uniqueSessions.size}/${expectedSessions} expected sessions)`,
                complianceRate,
                programName: program.name,
            });
        }
    }

    // Sort: critical first, then by type priority
    const typePriority = { inactive: 0, stalled: 1, readiness: 2, high_rpe: 3, low_compliance: 4, unread_message: 5 };
    alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (b.severity === 'critical' && a.severity !== 'critical') return 1;
        return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
    });

    // Deduplicate: keep only one alert per athlete per type (except stalled which is per-lift)
    const seen = new Set();
    const deduped = alerts.filter(a => {
        const key = a.type === 'stalled' ? `${a.type}-${a.athleteId}-${a.lift}` : `${a.type}-${a.athleteId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return NextResponse.json({ alerts: deduped });
}

import { getAthleteById } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import WorkoutLogger from './workout-logger';

function parseLocalDate(dateStr: any): Date {
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
}

export default async function WorkoutPage({ params }) {
    const { id: athleteId, sessionId } = await params;

    // Parse sessionId: programId_wX_dY
    const parts = sessionId.split('_');
    if (parts.length !== 3) return <div>Invalid Session ID</div>;

    const programId = parts[0];
    const weekNum = parseInt(parts[1].substring(1));
    const dayNum = parseInt(parts[2].substring(1));

    const [program, athlete] = await Promise.all([
        prisma.program.findUnique({ where: { id: programId } }),
        getAthleteById(athleteId),
    ]);

    if (!program) return <div>Program not found</div>;

    // Resolve coachId: prefer athlete.coachId, fall back to admin email lookup
    let coachId = athlete?.coachId || '';
    if (!coachId) {
        const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase();
        if (adminEmail) {
            const coach = await prisma.athlete.findFirst({
                where: { email: { equals: adminEmail, mode: 'insensitive' } },
                select: { id: true },
            });
            coachId = coach?.id || '';
        }
    }

    const weeks = (program.weeks as any[]) || [];
    const week = weeks.find(w => w.weekNumber === weekNum);
    const session = week?.sessions?.find((s: any) => s.day === dayNum);

    if (!session) return <div>Session not found</div>;

    // Fetch existing log for this specific session directly, preferring modern session.id over legacy key
    const sessionLogs = await prisma.log.findMany({
        where: {
            programId,
            sessionId: session.id ? { in: [session.id, sessionId] } : sessionId,
        },
        orderBy: { date: 'desc' },
    });
    const existingLog = (session.id ? sessionLogs.find(l => l.sessionId === session.id) : null) || sessionLogs[0] || null;

    // Pass all sessions in this week for the week overview drawer
    const weekSessions = (week?.sessions || []).filter((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0);

    // Compute sequential session number (1-based position among sessions sorted by day)
    const sortedSessions = [...weekSessions].sort((a: any, b: any) => (a?.day || 1) - (b?.day || 1));
    const sessionNum = sortedSessions.findIndex((s: any) => (s?.day || 1) === dayNum) + 1;

    // Compute sequential week display number (only counting weeks with sessions that have exercises)
    const weeksWithSessions = [...(program.weeks as any[])].filter((w: any) => Array.isArray(w?.sessions) && w.sessions.some((s: any) => Array.isArray(s.exercises) && s.exercises.length > 0)).sort((a: any, b: any) => (a?.weekNumber || 1) - (b?.weekNumber || 1));
    const weekDisplayNum = weeksWithSessions.findIndex((w: any) => (w?.weekNumber || 1) === weekNum) + 1;

    // Determine the week start date for display and scheduled session date
    const programStart = program.startDate ? parseLocalDate(program.startDate) : null;
    let weekStartDate = '';
    let scheduledDate = '';
    if (programStart) {
        const start = new Date(programStart);
        start.setDate(start.getDate() + (weekNum - 1) * 7);
        weekStartDate = start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

        const sessionDate = new Date(programStart);
        sessionDate.setDate(sessionDate.getDate() + (weekNum - 1) * 7 + (dayNum - 1));
        scheduledDate = sessionDate.toISOString();
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{session.name}</h1>
            <p style={{ color: 'var(--secondary-foreground)', marginBottom: '2rem' }}>
                Week {weekDisplayNum} • Session {sessionNum}
            </p>

            <WorkoutLogger
                athleteId={athleteId}
                coachId={coachId}
                programId={programId}
                sessionId={session.id || sessionId}
                weekNum={weekDisplayNum}
                dayNum={sessionNum}
                blockName={program.name}
                exercises={session.exercises}
                sessionWarmupDrills={session.warmupDrills || ''}
                initialLog={existingLog}
                weekSessions={weekSessions}
                weekStartDate={weekStartDate}
                scheduledDate={scheduledDate}
                programName={program.name}
            />
        </div>
    );
}

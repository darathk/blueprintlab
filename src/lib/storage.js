import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import { EXERCISE_DB } from '@/lib/exercise-db';

export const getAthletes = cache(async (coachId) => {
    if (!coachId) {
        return [];
    }

    const athletes = await prisma.athlete.findMany({
        where: { coachId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            coachId: true,
            nextMeetName: true,
            nextMeetDate: true,
            programs: {
                where: { status: 'active' },
                select: { id: true, name: true, status: true, startDate: true, endDate: true }
            }
        }
    });

    return athletes.map(a => {
        const { programs, ...rest } = a;
        return {
            ...rest,
            currentProgramId: programs.length > 0 ? programs[0].id : null
        };
    });
});

export async function saveAthlete(athlete) {
    const { id, name, email, nextMeetName, nextMeetDate, periodization, currentProgramId } = athlete;

    await prisma.athlete.upsert({
        where: { id: id || '' },
        update: { name, email, nextMeetName, nextMeetDate, periodization },
        create: {
            id: id || Math.random().toString(36).substring(7),
            name: name || 'Unknown',
            email: email || `${id || Math.random()}@example.com`,
            nextMeetName,
            nextMeetDate,
            periodization
        }
    });

    if (currentProgramId) {
        await prisma.program.updateMany({
            where: { athleteId: id, id: { not: currentProgramId }, status: 'active' },
            data: { status: 'completed' }
        });
        await prisma.program.update({
            where: { id: currentProgramId },
            data: { status: 'active', athleteId: id }
        });
    }
}

export const getPrograms = cache(async (coachId) => {
    if (!coachId) return [];
    return prisma.program.findMany({
        where: { athlete: { coachId } }
    });
});

export async function updateProgram(program) {
    const { id, athleteId, name, startDate, endDate, weeks, status } = program;
    await prisma.program.upsert({
        where: { id: id || '' },
        update: { athleteId, name, startDate, endDate, weeks, status },
        create: {
            id: id || Math.random().toString(36).substring(7),
            athleteId, name, startDate, endDate, weeks, status: status || 'active'
        }
    });
}

export async function deleteProgram(id) {
    await prisma.log.deleteMany({ where: { programId: id } });
    await prisma.readiness.deleteMany({ where: { programId: id } });
    await prisma.program.delete({ where: { id } });
    return true;
}

export const getLogs = cache(async (coachId) => {
    if (!coachId) return [];
    const logs = await prisma.log.findMany({
        where: { program: { athlete: { coachId } } },
        include: { program: { select: { athleteId: true } } }
    });
    return logs.map(l => {
        const { program, ...rest } = l;
        return {
            ...rest,
            athleteId: program ? program.athleteId : null
        };
    });
});

export async function saveLog(logEntry) {
    const existing = await prisma.log.findFirst({
        where: { sessionId: logEntry.sessionId, programId: logEntry.programId }
    });

    if (existing) {
        await prisma.log.update({
            where: { id: existing.id },
            data: { exercises: logEntry.exercises, date: logEntry.date }
        });
    } else {
        await prisma.log.create({
            data: {
                id: logEntry.id || Math.random().toString(36).substring(7),
                programId: logEntry.programId,
                sessionId: logEntry.sessionId,
                date: logEntry.date || new Date().toISOString(),
                exercises: logEntry.exercises
            }
        });
    }
}

export const getReadiness = cache(async (coachId) => {
    if (!coachId) return [];
    return prisma.readiness.findMany({
        where: { athlete: { coachId } }
    });
});

export async function saveReadiness(log) {
    const newLog = await prisma.readiness.create({
        data: {
            id: Math.random().toString(36).substring(7),
            athleteId: log.athleteId,
            programId: log.programId || null,
            date: log.date || new Date().toISOString().split('T')[0],
            scores: log.scores
        }
    });
    return newLog;
}


export const getAthleteById = cache(async (id) => {
    const athlete = await prisma.athlete.findUnique({
        where: { id },
        include: { programs: { where: { status: 'active' } } }
    });
    if (!athlete) return null;
    const { programs, ...rest } = athlete;
    return {
        ...rest,
        currentProgramId: programs.length > 0 ? programs[0].id : null
    };
});

export const getProgramsByAthlete = cache(async (athleteId) => {
    return prisma.program.findMany({
        where: { athleteId }
    });
});

export const getLogsByAthlete = cache(async (athleteId) => {
    const logs = await prisma.log.findMany({
        where: { program: { athleteId } },
        include: { program: { select: { athleteId: true } } }
    });
    return logs.map(l => {
        const { program, ...rest } = l;
        return {
            ...rest,
            athleteId: program ? program.athleteId : null
        };
    });
});

export const getReadinessByAthlete = cache(async (athleteId) => {
    return prisma.readiness.findMany({
        where: { athleteId }
    });
});

// Lightweight aggregate: returns [{programId, athleteId, sessionId}] with NO exercise payloads
export const getLogSummariesForDashboard = cache(async (coachId) => {
    if (!coachId) return [];
    return prisma.log.findMany({
        where: { program: { athlete: { coachId } } },
        select: {
            sessionId: true,
            programId: true,
            program: {
                select: { athleteId: true }
            }
        }
    });
});

export const getMessagesByAthlete = cache(async (athleteId) => {
    return prisma.message.findMany({
        where: {
            OR: [
                { senderId: athleteId },
                { receiverId: athleteId }
            ]
        },
        orderBy: { createdAt: 'asc' },
        include: {
            sender: { select: { id: true, name: true, email: true } },
            receiver: { select: { id: true, name: true, email: true } },
            replyTo: {
                select: {
                    id: true,
                    content: true,
                    mediaUrl: true,
                    mediaType: true,
                    sender: { select: { name: true } }
                }
            }
        }
    });
});

export const getExerciseLibrary = cache(async () => {
    const customExercisesRaw = await prisma.customExercise.findMany();
    const combined = {};
    Object.entries(EXERCISE_DB).forEach(([name, details]) => {
        combined[name] = { name, ...details };
    });
    customExercisesRaw.forEach(ex => {
        combined[ex.name] = ex;
    });
    return combined;
});

export const getCoachInbox = cache(async (coachId) => {
    if (!coachId) return [];
    const sql = `
        SELECT 
            a.id AS "athleteId",
            a.name AS "athleteName",
            latest_msg.content AS "lastMessage",
            COALESCE(latest_msg."createdAt", '1970-01-01T00:00:00Z') AS "lastMessageAt",
            COALESCE(unread_count.count, 0)::int AS "unreadCount"
        FROM "Athlete" a
        LEFT JOIN (
            SELECT DISTINCT ON (partner_id)
                partner_id,
                content,
                "createdAt"
            FROM (
                SELECT 
                    "senderId", "receiverId", content, "createdAt",
                    CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS partner_id
                FROM "Message"
                WHERE "senderId" = $1 OR "receiverId" = $1
            ) m
            ORDER BY partner_id, "createdAt" DESC
        ) latest_msg ON latest_msg.partner_id = a.id
        LEFT JOIN (
            SELECT "senderId", COUNT(*) as count
            FROM "Message"
            WHERE "receiverId" = $1 AND read = false
            GROUP BY "senderId"
        ) unread_count ON unread_count."senderId" = a.id
        WHERE a.id != $1 AND a."coachId" = $1
        ORDER BY "lastMessageAt" DESC;
    `;
    return prisma.$queryRawUnsafe(sql, coachId);
});

// Dummy functions to prevent older unused routes from crashing during import tree parsing
export async function readData() { return []; }
export async function writeData() { }

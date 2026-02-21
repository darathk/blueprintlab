import { prisma } from '@/lib/prisma';

export async function getAthletes() {
    const athletes = await prisma.athlete.findMany({
        include: { programs: { where: { status: 'active' } } }
    });
    return athletes.map(a => {
        const { programs, ...rest } = a;
        return {
            ...rest,
            currentProgramId: programs.length > 0 ? programs[0].id : null
        };
    });
}

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

export async function getPrograms() {
    return prisma.program.findMany();
}

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

export async function getLogs() {
    const logs = await prisma.log.findMany({
        include: { program: { select: { athleteId: true } } }
    });
    return logs.map(l => {
        const { program, ...rest } = l;
        return {
            ...rest,
            athleteId: program ? program.athleteId : null
        };
    });
}

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

export async function getReadiness() {
    return prisma.readiness.findMany();
}

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

// Dummy functions to prevent older unused routes from crashing during import tree parsing
export async function readData() { return []; }
export async function writeData() { }

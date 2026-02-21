const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
    console.log('Seeding athletes...');
    const athletesData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'athletes.json'), 'utf8'));
    for (const a of athletesData) {
        if (!a.email) a.email = `${a.id}@example.com`; // Fallback email

        // Check if exists because email must be unique, and we want to preserve IDs
        const existing = await prisma.athlete.findUnique({ where: { id: a.id } });
        if (!existing) {
            await prisma.athlete.create({
                data: {
                    id: a.id,
                    name: a.name,
                    email: a.email,
                    nextMeetName: a.nextMeetName || null,
                    nextMeetDate: a.nextMeetDate || null,
                    periodization: a.periodization || null
                }
            });
        }
    }

    console.log('Seeding programs...');
    const programsData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'programs.json'), 'utf8'));
    for (const p of programsData) {
        const existing = await prisma.program.findUnique({ where: { id: p.id } });
        if (!existing) {
            await prisma.program.create({
                data: {
                    id: p.id,
                    athleteId: p.athleteId,
                    name: p.name,
                    startDate: p.startDate || new Date().toISOString(),
                    endDate: p.endDate || null,
                    weeks: p.weeks || [],
                    status: p.status || 'active'
                }
            });
        }
    }

    console.log('Seeding logs...');
    try {
        const logsData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'logs.json'), 'utf8'));
        for (const l of logsData) {
            // Find existing to avoid duplicates by trying to look up id
            const idToCheck = l.id || Math.random().toString(36).substring(7);
            const existing = await prisma.log.findUnique({ where: { id: idToCheck } });

            if (!existing) {
                // Validate programId exists before inserting log
                if (!l.programId || typeof l.programId !== 'string') {
                    console.log(`Skipped log ${idToCheck} - missing or invalid programId`);
                    continue;
                }
                const parentProgram = await prisma.program.findUnique({ where: { id: l.programId } });

                // Only migrate logs for programs that actually exist in the DB
                if (parentProgram) {
                    await prisma.log.create({
                        data: {
                            id: idToCheck,
                            programId: l.programId,
                            sessionId: l.sessionId || 'missing',
                            date: l.date || new Date().toISOString(),
                            exercises: l.exercises || []
                        }
                    });
                } else {
                    console.log(`Skipped log ${idToCheck} - orphaned (no linked program found)`);
                }
            }
        }
    } catch (e) {
        console.log('No logs found or error reading logs:', e.message);
    }

    console.log('Seeding complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching all programs...");
    const programs = await prisma.program.findMany();
    let updatedCount = 0;

    for (const program of programs) {
        if (!program.weeks) continue;
        
        let weeks: any[] = [];
        try {
            weeks = typeof program.weeks === 'string' ? JSON.parse(program.weeks) : program.weeks;
        } catch (e) {
            continue;
        }
        
        if (!Array.isArray(weeks)) continue;

        // Build mapping from legacy key to session.id
        const mapping: Record<string, string> = {};
        for (const week of weeks) {
            const wn = week.weekNumber || 1;
            const sessions = Array.isArray(week.sessions) ? week.sessions : [];
            for (const session of sessions) {
                const day = session.day || 1;
                const legacyKey = `${program.id}_w${wn}_d${day}`;
                if (session.id) {
                    mapping[legacyKey] = session.id;
                }
            }
        }

        // Fetch logs for this program
        const logs = await prisma.log.findMany({
            where: { programId: program.id }
        });

        for (const log of logs) {
            // Check if log.sessionId is a legacy key that exists in mapping
            if (mapping[log.sessionId] && mapping[log.sessionId] !== log.sessionId) {
                const newSessionId = mapping[log.sessionId];
                console.log(`Migrating log ${log.id} from ${log.sessionId} to ${newSessionId}`);
                
                // Since we are changing the unique constraint [programId, sessionId],
                // we need to be careful of collisions.
                try {
                    await prisma.log.update({
                        where: { id: log.id },
                        data: { sessionId: newSessionId }
                    });
                    updatedCount++;
                } catch (e) {
                    console.error(`Failed to migrate log ${log.id}:`, e);
                }
            }
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} logs.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

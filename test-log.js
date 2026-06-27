const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const logs = await prisma.log.findMany({ orderBy: { date: 'desc' }, take: 3 });
    for (const l of logs) {
        console.log("Log Session ID:", l.sessionId);
        const p = await prisma.program.findUnique({ where: { id: l.programId } });
        if (p) {
            let found = false;
            for (const w of p.weeks) {
                if (!w.sessions) continue;
                for (const s of w.sessions) {
                    if (s.id === l.sessionId) found = true;
                }
            }
            console.log("Found in Program?", found);
        }
    }
    prisma.$disconnect();
}
run();

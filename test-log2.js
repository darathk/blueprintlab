const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const logs = await prisma.log.findMany({ orderBy: { date: 'desc' }, take: 10 });
    for (const l of logs) {
        const p = await prisma.program.findUnique({ where: { id: l.programId } });
        if (p) {
            let weekNum = null, dayNum = null;
            for (const w of p.weeks) {
                if (!w.sessions) continue;
                for (const s of w.sessions) {
                    if (s.id === l.sessionId) {
                        weekNum = w.weekNumber;
                        dayNum = s.day;
                    }
                }
            }
            console.log("Session:", l.sessionId, "W:", weekNum, "D:", dayNum);
        }
    }
    prisma.$disconnect();
}
run();

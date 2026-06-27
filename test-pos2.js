const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const coachId = 'user_2kH3rZIf0v55WLYL01z22V9q09k'; // From typical Clerk ID or I will just get the first coach
    const coach = await prisma.athlete.findFirst({ where: { role: 'coach' } });
    if (!coach) return;
    
    const rows = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT ON (p."athleteId")
            p."athleteId",
            p.name AS "blockName",
            p.weeks AS "weeks",
            l."sessionId",
            l.date AS "lastLogDate",
            a.name AS "athleteName"
        FROM "Log" l
        JOIN "Program" p ON p.id = l."programId"
        JOIN "Athlete" a ON a.id = p."athleteId"
        WHERE a."coachId" = $1
          AND p.status != 'draft'
        ORDER BY p."athleteId", l.date DESC, l."sessionId" DESC
    `, coach.id);
    
    for (const row of rows) {
        let weekNum = null, dayNum = null;
        if (row.weeks && Array.isArray(row.weeks)) {
            for (const week of row.weeks) {
                if (week.sessions && Array.isArray(week.sessions)) {
                    const session = week.sessions.find(s => s.id === row.sessionId);
                    if (session) {
                        weekNum = week.weekNumber;
                        dayNum = session.day;
                        break;
                    }
                }
            }
        }
        if (!weekNum || !dayNum) {
            const parts = (row.sessionId || '').split('_');
            for (const p of parts) {
                if (p.startsWith('w')) weekNum = parseInt(p.slice(1), 10);
                if (p.startsWith('d')) dayNum = parseInt(p.slice(1), 10);
            }
        }
        console.log(`Athlete: ${row.athleteName}, Block: ${row.blockName}, W: ${weekNum}, D: ${dayNum}`);
    }
    prisma.$disconnect();
}
run();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const athletes = ['Alvin Kim', 'Junho Yoon', 'Ben Buchheim-Jurisson'];
    for (const name of athletes) {
        const d = await prisma.athlete.findFirst({ where: { name: { contains: name } } });
        if (!d) continue;
        const p = await prisma.program.findFirst({ where: { athleteId: d.id, status: 'active' } });
        if (!p) continue;
        console.log(`Athlete: ${name}, Program: ${p.name}, StartDate: ${p.startDate}`);
        console.log(`Weeks length: ${p.weeks.length}`);
        for (const w of p.weeks) {
            if (w.sessions && w.sessions.length > 0) {
                console.log(`  Week ${w.weekNumber} has sessions`);
            }
        }
    }
}
run();

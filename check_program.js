const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const athlete = await prisma.athlete.findFirst({
        where: { name: { contains: 'Ben Buchheim-Jurisson' } },
        include: { programs: { orderBy: { createdAt: 'desc' }, take: 2 } }
    });
    if (!athlete) return console.log('Athlete not found');
    console.log('Programs for Ben:');
    for (const p of athlete.programs) {
        console.log(`Program: ${p.name} (id: ${p.id}), start: ${p.startDate}`);
        p.weeks.forEach(w => {
            if (w.sessions) {
                console.log(`  Week ${w.weekNumber}:`);
                w.sessions.forEach(s => {
                    console.log(`    Session day: ${s.day}, notes: ${s.notes?.substring(0,20)}...`);
                });
            }
        });
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());

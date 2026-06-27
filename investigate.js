import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const d = await prisma.athlete.findFirst({ where: { name: { contains: 'Daniel Huang' } } });
    if (!d) return console.log("No Daniel");
    const programs = await prisma.program.findMany({ where: { athleteId: d.id, status: 'active' } });
    console.log("Programs:", programs.map(p => ({ id: p.id, name: p.name, start: p.startDate })));
    for (const p of programs) {
        const logs = await prisma.log.findMany({ where: { programId: p.id }, orderBy: { date: 'desc' }, take: 3 });
        console.log(`Logs for ${p.name}:`, logs.map(l => ({ id: l.sessionId, date: l.date })));
        
        // Find session in weeks
        for (const l of logs) {
            let found = false;
            for (const w of p.weeks) {
                const s = w.sessions.find(s => s.id === l.sessionId);
                if (s) {
                    console.log(`  Log ${l.sessionId} is W${w.weekNumber} D${s.day}`);
                    found = true;
                }
            }
            if (!found) console.log(`  Log ${l.sessionId} not found in weeks array!`);
        }
    }
}
run();

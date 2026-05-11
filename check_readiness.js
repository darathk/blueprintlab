const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const readiness = await prisma.readiness.findMany();
    const map = {};
    for (const r of readiness) {
        if (!r.scores) continue;
        const key = r.scores._sessionKey;
        if (!key) continue;
        if (!map[key]) map[key] = [];
        map[key].push(r);
    }
    
    for (const [key, records] of Object.entries(map)) {
        if (records.length > 1) {
            console.log(`Duplicate sessionKey found: ${key} (count: ${records.length})`);
            console.log(records.map(r => ({id: r.id, date: r.date, ath: r.athleteId})));
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());

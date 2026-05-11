const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const athlete = await prisma.athlete.findFirst({
        where: { name: { contains: 'Ben Buchheim-Jurisson' } }
    });
    const logs = await prisma.log.findMany({
        where: { program: { athleteId: athlete.id } }
    });
    console.log('Logs for Ben:');
    logs.forEach(l => console.log(`${l.date} - ${l.sessionId}`));
    
    const readiness = await prisma.readiness.findMany({
        where: { athleteId: athlete.id }
    });
    console.log('\nReadiness for Ben:');
    readiness.forEach(r => console.log(`${r.date} - sessionKey: ${r.scores?._sessionKey}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());

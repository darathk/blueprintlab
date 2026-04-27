const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const athletes = await prisma.athlete.findMany({
        where: { role: 'coach' },
        select: { id: true, name: true, pastMeets: true }
    });
    console.log(JSON.stringify(athletes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

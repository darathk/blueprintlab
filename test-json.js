const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const rows = await prisma.$queryRawUnsafe(`SELECT weeks FROM "Program" LIMIT 1`);
    console.log(typeof rows[0].weeks, Array.isArray(rows[0].weeks));
    prisma.$disconnect();
}
run();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const d = await prisma.athlete.findFirst({ where: { name: { contains: 'Morris Lee' } } });
    if (!d) return console.log("No Morris");
    const programs = await prisma.program.findMany({ where: { athleteId: d.id } });
    console.log("All Programs:");
    for (const p of programs) {
        console.log(`- ${p.name}, status: ${p.status}, start: ${p.startDate}, created: ${p.createdAt}`);
    }
}
run();

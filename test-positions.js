const { getAthletePositions } = require('./src/lib/storage.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const coach = await prisma.athlete.findFirst({ where: { role: 'coach' } });
    if (coach) {
        const positions = await getAthletePositions(coach.id);
        console.log(positions);
    }
    prisma.$disconnect();
}
run();

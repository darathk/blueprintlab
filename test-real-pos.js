import { getAthletePositions } from './src/lib/storage.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const coach = await prisma.athlete.findFirst({ where: { role: 'coach' } });
    if (!coach) return;
    const map = await getAthletePositions(coach.id);
    const athletes = await prisma.athlete.findMany({ where: { coachId: coach.id } });
    for (const a of athletes) {
        if (map[a.id]) {
            console.log(`${a.name}: ${map[a.id].blockName} W${map[a.id].weekNum} D${map[a.id].dayNum}`);
        }
    }
}
run();

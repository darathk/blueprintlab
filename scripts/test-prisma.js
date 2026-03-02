const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config({ path: '.env.local' });

async function testInsert() {
    try {
        const id = "test-12345";
        await prisma.athlete.upsert({
            where: { id: id },
            update: {},
            create: {
                id: id,
                name: 'Test Athlete',
                email: `${id}@example.com`,
                role: 'athlete',
                coachId: 'darath-test-id' // dummy
            }
        });
        console.log("Success");
    } catch (e) {
        console.error("Prisma Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
testInsert();

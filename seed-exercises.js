const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
    console.log('Seeding custom exercises...');
    try {
        const customData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'custom-exercises.json'), 'utf8'));
        let count = 0;
        for (const e of customData) {
            const existing = await prisma.customExercise.findUnique({ where: { name: e.name } });
            if (!existing) {
                await prisma.customExercise.create({
                    data: {
                        name: e.name,
                        category: e.category,
                        parent: e.parent || e.name,
                        isCustom: true
                    }
                });
                count++;
            }
        }
        console.log(`Successfully seeded ${count} custom exercises.`);
    } catch (e) {
        console.log('No custom exercises found or error reading:', e.message);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });

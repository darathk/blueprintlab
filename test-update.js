const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const coach = await prisma.athlete.findFirst({
        where: { role: 'coach' }
    });
    console.log("Coach ID:", coach.id);
    
    // Simulate updating coach
    try {
        const existingById = await prisma.athlete.findUnique({
            where: { id: coach.id },
            select: { id: true, coachId: true }
        });
        
        console.log("Found:", existingById);
        
        if (existingById && (existingById.coachId === coach.id || existingById.id === coach.id)) {
            console.log("Update allowed!");
            const updated = await prisma.athlete.update({
                where: { id: coach.id },
                data: {
                    pastMeets: [{ _meetDataEntry: { athleteId: 'manual_123', athleteName: 'Test' } }]
                }
            });
            console.log("Updated successfully!");
        } else {
            console.log("Update rejected!");
        }
    } catch(e) {
        console.error("Error:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

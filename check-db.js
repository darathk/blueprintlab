const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- SUPABASE DATABASE INTEGRITY CHECK ---");

    const athleteCount = await prisma.athlete.count();
    console.log(`Athletes: ${athleteCount}`);

    const programCount = await prisma.program.count();
    console.log(`Programs: ${programCount}`);

    const logCount = await prisma.log.count();
    console.log(`Logs: ${logCount}`);

    const readinessCount = await prisma.readiness.count();
    console.log(`Readiness: ${readinessCount}`);

    const reportCount = await prisma.report.count();
    console.log(`Reports: ${reportCount}`);

    const customCount = await prisma.customExercise.count();
    console.log(`Custom Exercises: ${customCount}`);

    console.log("\n--- Sample Athlete Data ---");
    if (athleteCount > 0) {
        const sampleAthlete = await prisma.athlete.findFirst({
            include: { programs: true }
        });
        console.log(JSON.stringify(sampleAthlete, null, 2));
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });

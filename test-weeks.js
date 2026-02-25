const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const programs = await prisma.program.findMany({ select: { id: true, name: true, weeks: true }});
    programs.forEach(p => {
        console.log(`Program: ${p.name}, Total Weeks Raw: ${p.weeks.length}`);
        p.weeks.forEach((w, i) => console.log(`  Week ${i+1} sessions: ${w.sessions ? w.sessions.length : 'none'}`));
    });
    
    await prisma.$disconnect();
}
main();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const athletes = await prisma.athlete.findMany({ include: { programs: true } });
    const sebastian = athletes.find(a => a.name && a.name.toLowerCase().includes('sebastian'));
    if (!sebastian) return console.log('not found');
    
    console.log("Athlete ID:", sebastian.id);
    const programs = sebastian.programs;
    
    console.log("--- PROGRAMS ---");
    programs.forEach(p => {
        let ts = 0;
        let wks = null;
        if (typeof p.weeks === 'string') wks = JSON.parse(p.weeks);
        else wks = p.weeks;
        (wks || []).forEach(w => ts += (w.sessions?.length || 0));
        console.log(`ID: ${p.id.slice(0, 8)} | Name: ${p.name} | Status: ${p.status} | StartDate: ${p.startDate} | CreatedAt: ${p.createdAt} | TotalSessions: ${ts}`);
    });
}
run().finally(() => prisma.$disconnect());

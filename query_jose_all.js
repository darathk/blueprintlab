const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const jose = await prisma.athlete.findFirst({
    where: { name: { contains: 'Jose Vargas' } }
  });
  if (!jose) return console.log("Not found");
  
  const programs = await prisma.program.findMany({
    where: { athleteId: jose.id }
  });
  console.log(JSON.stringify(programs.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status,
    startDate: p.startDate,
    totalWeeks: p.weeks.length,
    activeWeeks: p.weeks.filter(w => w.sessions && w.sessions.length > 0).length,
    weekNumbers: p.weeks.filter(w => w.sessions && w.sessions.length > 0).map(w => w.weekNumber)
  })), null, 2));
}
run();

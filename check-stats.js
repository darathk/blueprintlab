const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const blockName = "26'USAPL Raw Nationals Prep";
  const programs = await prisma.program.findMany({
    where: { name: blockName }
  });
  if (programs.length === 0) return console.log("No program found");
  
  const programIds = programs.map(p => p.id);
  const logs = await prisma.log.findMany({
    where: { programId: { in: programIds } },
    orderBy: { date: 'asc' }
  });

  const getSessionOrder = (sessionId) => {
    if (!sessionId) return { week: 99, day: 99 };
    const match = sessionId.match(/_w(\d+)_d(\d+)/);
    if (match) {
        return { week: parseInt(match[1]), day: parseInt(match[2]) };
    }
    return { week: 99, day: 99 };
  };

  const calculateSimpleE1RM = (weight, reps, rpe) => {
    // simplified from stress-index.js
    if (!weight) return 0;
    const r = parseFloat(reps) || 1;
    const rp = parseFloat(rpe) || 10;
    if (r === 1 && rp === 10) return weight;
    const e1rm = weight * (1 + 0.0333 * r);
    return Math.round(e1rm);
  };

  const sortedLogs = [...logs].sort((a, b) => {
    const orderA = getSessionOrder(a.sessionId);
    const orderB = getSessionOrder(b.sessionId);

    if (orderA.week !== orderB.week) return orderA.week - orderB.week;
    if (orderA.day !== orderB.day) return orderA.day - orderB.day;

    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const liftName = "Bench"; // "26'USAPL Raw Nationals Prep" has start 268, peak 280, end 251.
  
  console.log("Single Block Logic (by sessionId):");
  sortedLogs.forEach(log => {
      let dailyMax = 0;
      log.exercises.forEach(ex => {
          if (ex.name === `Competition ${liftName}`) {
              ex.sets.forEach(set => {
                  const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe);
                  if (e1rm > dailyMax) dailyMax = e1rm;
              });
          }
      });
      if (dailyMax > 0) {
          console.log(`Session ${log.sessionId} (${log.date}): Daily Max ${dailyMax}`);
      }
  });

  console.log("\nMeta Block Logic (by date):");
  const dateLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  dateLogs.forEach(log => {
      let dailyMax = 0;
      log.exercises.forEach(ex => {
          if (ex.name === `Competition ${liftName}`) {
              ex.sets.forEach(set => {
                  const e1rm = calculateSimpleE1RM(set.weight, set.reps, set.rpe);
                  if (e1rm > dailyMax) dailyMax = e1rm;
              });
          }
      });
      if (dailyMax > 0) {
          console.log(`Session ${log.sessionId} (${log.date}): Daily Max ${dailyMax}`);
      }
  });

}
run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

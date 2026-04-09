const programs = [
  { id: '1', name: 'Pivot 4', startDate: '2026-03-30', status: 'active', weeks: [{sessions: [1,2,3,4]}] },
  { id: '2', name: 'OS Block 4: Singles', startDate: '2026-04-06', status: 'active', weeks: [{sessions: [1,2,3,4]}] }
];

const athleteLogSummaries = [
  { programId: '1', sessionId: '1_w1_d1' },
  { programId: '1', sessionId: '1_w1_d2' },
  { programId: '1', sessionId: '1_w1_d3' },
];

let activeProgId = '1';

const activeSorted = [...programs].sort((a, b) => {
    const aStart = new Date(a.startDate || 0).getTime();
    const bStart = new Date(b.startDate || 0).getTime();
    return aStart - bStart;
});

console.log("Sorted:", activeSorted.map(p => p.name));

for (let i = 0; i < activeSorted.length; i++) {
    const prog = activeSorted[i];
    let totalSessions = 4;
    
    // Simulate uniqueSessions
    let uniqueSessions = new Set();
    if (prog.id === '1') uniqueSessions = new Set([1, 2, 3]); // size 3
    if (prog.id === '2') uniqueSessions = new Set(); // size 0
    
    activeProgId = prog.id; 
    
    let nextProgramHasStarted = false;
    const nextProg = activeSorted[i + 1];
    if (nextProg) {
        const nextStartStr = nextProg.startDate;
        if (nextStartStr) {
            const nextStart = new Date(nextStartStr);
            nextStart.setHours(0, 0, 0, 0);
            const now = new Date('2026-04-09T18:00:00Z');
            now.setHours(0, 0, 0, 0);
            
            console.log(`Checking ${nextProg.name}: nextStart = ${nextStart.toISOString()}, now = ${now.toISOString()}`);
            if (now >= nextStart) {
                nextProgramHasStarted = true;
            }
        }
    }
    
    console.log(`i=${i}, activeProgId=${activeProgId}, nextProgramHasStarted=${nextProgramHasStarted}`);
    
    if ((totalSessions === 0 || uniqueSessions.size < totalSessions) && !nextProgramHasStarted) {
        console.log("BREAKING at", activeProgId);
        break;
    }
}
console.log("Final activeProgId:", activeProgId);

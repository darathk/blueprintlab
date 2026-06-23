const generateId = () => Math.random().toString(36).substr(2, 9);
const snapToSunday = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - date.getDay());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getShiftedWeeks = (newStartDateStr, startDate, currentWeeks) => {
    const [oldY, oldM, oldD] = startDate.split('-').map(Number);
    const oldStart = new Date(oldY, oldM - 1, oldD);
    oldStart.setHours(0, 0, 0, 0);

    const snappedNewStart = snapToSunday(newStartDateStr);
    const [newY, newM, newD] = snappedNewStart.split('-').map(Number);
    const newStart = new Date(newY, newM - 1, newD);
    newStart.setHours(0, 0, 0, 0);

    const allSessions = [];
    currentWeeks.forEach(w => {
        w.sessions.forEach(s => {
            const actualDate = new Date(oldStart);
            actualDate.setDate(actualDate.getDate() + (Number(w.weekNumber) - 1) * 7 + (Number(s.day) - 1));

            const diffTime = actualDate.getTime() - newStart.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0) {
                const newWeekNum = Math.floor(diffDays / 7) + 1;
                const newDayNum = (diffDays % 7) + 1;

                allSessions.push({
                    ...s,
                    day: newDayNum,
                    _tempWeekNum: newWeekNum
                });
            }
        });
    });

    const reorganizedWeeks = [];
    allSessions.forEach(s => {
        const wn = s._tempWeekNum;
        if (!reorganizedWeeks[wn]) reorganizedWeeks[wn] = [];
        const { _tempWeekNum, ...cleanSession } = s;
        reorganizedWeeks[wn].push(cleanSession);
    });

    const finalWeeks = [];
    const maxWeek = allSessions.reduce((max, s) => s._tempWeekNum > max ? s._tempWeekNum : max, 0);

    for (let i = 1; i <= maxWeek; i++) {
        finalWeeks.push({
            id: generateId(),
            weekNumber: i,
            sessions: reorganizedWeeks[i] || []
        });
    }

    if (finalWeeks.length === 0) {
        finalWeeks.push({ id: generateId(), weekNumber: 1, sessions: [] });
    }

    return finalWeeks;
};

const handleSessionMove = (fromW, fromD, toW, toD, toDateStr, weeks, startDate) => {
    let currentWeeks = weeks;
    let targetD = toD;
    let targetW = toW;

    const originalSourceWeek = weeks.find(w => w.weekNumber === fromW);
    const originalSession = originalSourceWeek?.sessions.find(s => s.day === fromD);

    if (!originalSession) {
        console.error("Could not find session to move at source", fromW, fromD);
        return;
    }

    let pendingStartDate = null;

    if (toDateStr && new Date(toDateStr) < new Date(startDate)) {
        const snapped = snapToSunday(toDateStr);
        currentWeeks = getShiftedWeeks(toDateStr, startDate, weeks);
        pendingStartDate = snapped;

        const [oY, oM, oD] = startDate.split('-').map(Number);
        const oldStart = new Date(oY, oM - 1, oD);
        oldStart.setHours(0, 0, 0, 0);
        const [nY, nM, nD] = snapped.split('-').map(Number);
        const newStart = new Date(nY, nM - 1, nD);
        newStart.setHours(0, 0, 0, 0);

        const sourceDate = new Date(oldStart);
        sourceDate.setDate(sourceDate.getDate() + (fromW - 1) * 7 + (fromD - 1));

        const diffFromNew = Math.round((sourceDate.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));
        const newFromW = Math.floor(diffFromNew / 7) + 1;
        const newFromD = (diffFromNew % 7) + 1;

        fromD = newFromD;
        fromW = newFromW;

        const [tY, tM, tD] = toDateStr.split('-').map(Number);
        const targetDate = new Date(tY, tM - 1, tD);
        const targetDiff = Math.round((targetDate.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));
        targetW = Math.floor(targetDiff / 7) + 1;
        targetD = (targetDiff % 7) + 1;
    }

    if (fromW === targetW && fromD === targetD) {
        return;
    }

    let newWeeks = currentWeeks.map(w => ({ ...w, sessions: [...w.sessions] }));

    let targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetW);
    if (targetWeekIndex === -1) {
        const max = newWeeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
        for (let i = max + 1; i <= targetW; i++) {
            if (!newWeeks.find(w => w.weekNumber === i)) {
                newWeeks.push({ id: generateId(), weekNumber: i, sessions: [] });
            }
        }
        newWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
        targetWeekIndex = newWeeks.findIndex(w => w.weekNumber === targetW);
    }

    const sourceWeekIndex = newWeeks.findIndex(w => w.weekNumber === fromW);
    if (sourceWeekIndex === -1) {
        console.error("Source week not found", fromW, newWeeks);
        return;
    }

    const sourceSessionIndex = newWeeks[sourceWeekIndex].sessions.findIndex(s => s.day === fromD);
    if (sourceSessionIndex === -1) {
        console.error("Source session not found", fromD, newWeeks[sourceWeekIndex]);
        return;
    }

    const [sessionToMove] = newWeeks[sourceWeekIndex].sessions.splice(sourceSessionIndex, 1);
    const targetSessionIndex = newWeeks[targetWeekIndex].sessions.findIndex(s => s.day === targetD);

    if (targetSessionIndex !== -1) {
        const [targetSession] = newWeeks[targetWeekIndex].sessions.splice(targetSessionIndex, 1);
        targetSession.day = fromD;
        targetSession.scheduledDate = '';
        newWeeks[sourceWeekIndex].sessions.push(targetSession);
    }

    sessionToMove.day = targetD;
    sessionToMove.scheduledDate = '';
    newWeeks[targetWeekIndex].sessions.push(sessionToMove);

    return { newWeeks, pendingStartDate };
};

const startDate = "2026-07-12";
const weeks = [
    { weekNumber: 1, sessions: [{ day: 5, id: 's3', name: 'Session 3' }] },
    { weekNumber: 2, sessions: [{ day: 2, id: 's1', name: 'Session 1' }] }
];

console.log("Result:", JSON.stringify(handleSessionMove(1, 5, 0, 1, "2026-07-05", weeks, startDate), null, 2));

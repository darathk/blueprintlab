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
            actualDate.setDate(actualDate.getDate() + (w.weekNumber - 1) * 7 + (s.day - 1));

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
            id: 'id-' + i,
            weekNumber: i,
            sessions: reorganizedWeeks[i] || []
        });
    }

    if (finalWeeks.length === 0) {
        finalWeeks.push({ id: 'id-1', weekNumber: 1, sessions: [] });
    }

    return finalWeeks;
};

const startDate = "2026-07-12";
const weeks = [
    { weekNumber: 1, sessions: [ { id: 's1', day: 2, name: 'Session 1' } ] }
];

const newWeeks = getShiftedWeeks("2026-07-05", startDate, weeks);
console.log(JSON.stringify(newWeeks, null, 2));


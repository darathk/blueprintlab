import { calculateDots } from '@/lib/calculators';

/**
 * Shared date utilities.
 */

/**
 * Parse a date string (ISO or YYYY-MM-DD) into a local midnight Date.
 * Returns null if the input is falsy or unparseable.
 */
export function parseLocalDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Check if a meet date has concluded and been over for more than 1 full day (24+ hours past meet day end).
 * e.g., if meet was on Oct 10 (ended 23:59:59 Oct 10), then 1 day after it's over is 23:59:59 Oct 11.
 * On Oct 12 00:00:00 onwards, this returns true.
 */
export function isMeetOverByOneDay(dateStr: any): boolean {
    if (!dateStr) return false;
    const meetDate = parseLocalDate(dateStr);
    if (!meetDate) return false;

    // Meet ends at 23:59:59.999 on the scheduled meet date
    const meetEnd = new Date(meetDate);
    meetEnd.setHours(23, 59, 59, 999);

    // 1 full day (24 hours) after the meet has concluded
    const cutoff = meetEnd.getTime() + 24 * 60 * 60 * 1000;

    return Date.now() > cutoff;
}

export interface CleanedMeetResult {
    nextMeetDate: null;
    nextMeetName: null;
    meetAttempts: any;
    pastMeets: any[];
    originalMeetDate: string;
    originalMeetName: string;
    wasArchived: boolean;
}

/**
 * Cleans up expired meet data for an athlete if their meet date has been over for > 1 day.
 * If actual attempts were logged, it archives the meet into pastMeets before clearing nextMeetDate and nextMeetName.
 * Returns null if the meet is not expired.
 */
export function cleanupExpiredMeetData(athlete: {
    id: string;
    name?: string;
    nextMeetDate?: string | null;
    nextMeetName?: string | null;
    meetAttempts?: any;
    pastMeets?: any;
    weightClass?: number | null;
    gender?: string | null;
}): CleanedMeetResult | null {
    const rawMeetDate = athlete.nextMeetDate || athlete.meetAttempts?.meetDay?.meetDate;
    if (!rawMeetDate || !isMeetOverByOneDay(rawMeetDate)) {
        return null;
    }

    const meetAttempts = athlete.meetAttempts || {};
    const meetMeta = meetAttempts.meetDay || {};
    const meetName = athlete.nextMeetName || meetMeta.meetName || 'Completed Meet';
    const meetDate = String(rawMeetDate).split('T')[0];

    const squat = meetAttempts.squat;
    const bench = meetAttempts.bench;
    const deadlift = meetAttempts.deadlift;

    const hasAttemptData = [squat, bench, deadlift].some((lift: any) => {
        if (!lift) return false;
        return ['attempt1', 'attempt2', 'attempt3'].some((attKey) => {
            const att = lift[attKey];
            if (!att) return false;
            return (
                (att.actualKg && parseFloat(att.actualKg) > 0) ||
                (att.planned?.kg && parseFloat(att.planned.kg) > 0) ||
                (att.result && att.result !== 'pending')
            );
        });
    });

    let updatedPastMeets = Array.isArray(athlete.pastMeets) ? [...athlete.pastMeets] : [];
    let wasArchived = false;

    if (hasAttemptData) {
        const isAlreadyArchived = updatedPastMeets.some((m: any) =>
            (m.date === meetDate && (m.meetName === meetName || !m.meetName)) ||
            m.id === `meet_${meetDate}`
        );

        if (!isAlreadyArchived) {
            const bwKg = parseFloat(meetMeta.bodyweight) || athlete.weightClass || 0;
            const isMale = athlete.gender !== 'female';

            const getBestGood = (lift: any): number => {
                if (!lift) return 0;
                let best = 0;
                for (const k of ['attempt1', 'attempt2', 'attempt3']) {
                    const a = lift[k];
                    if (a && a.result === 'good') {
                        const val = parseFloat(a.actualKg || a.planned?.kg || '0') || 0;
                        if (val > best) best = val;
                    }
                }
                return best;
            };

            const sq = getBestGood(squat);
            const bp = getBestGood(bench);
            const dl = getBestGood(deadlift);
            const total = (sq > 0 && bp > 0 && dl > 0) ? sq + bp + dl : 0;
            const dots = total > 0 && bwKg > 0 ? calculateDots(total, bwKg, isMale) : 0;

            const getWeight = (lift: any, key: string) => {
                const a = lift?.[key];
                return parseFloat(a?.actualKg || a?.planned?.kg || '0') || 0;
            };
            const getResult = (lift: any, key: string) => lift?.[key]?.result === 'good';

            const meetDataEntry = {
                id: `meet_${Date.now()}`,
                athleteId: athlete.id,
                athleteName: athlete.name || '',
                category: '',
                weightClass: athlete.weightClass || 0,
                bodyweight: bwKg,
                meetDate,
                meetName,
                gender: athlete.gender || 'male',
                squat: [getWeight(squat, 'attempt1'), getWeight(squat, 'attempt2'), getWeight(squat, 'attempt3')] as [number, number, number],
                squatResults: [getResult(squat, 'attempt1'), getResult(squat, 'attempt2'), getResult(squat, 'attempt3')] as [boolean, boolean, boolean],
                bench: [getWeight(bench, 'attempt1'), getWeight(bench, 'attempt2'), getWeight(bench, 'attempt3')] as [number, number, number],
                benchResults: [getResult(bench, 'attempt1'), getResult(bench, 'attempt2'), getResult(bench, 'attempt3')] as [boolean, boolean, boolean],
                deadlift: [getWeight(deadlift, 'attempt1'), getWeight(deadlift, 'attempt2'), getWeight(deadlift, 'attempt3')] as [number, number, number],
                deadliftResults: [getResult(deadlift, 'attempt1'), getResult(deadlift, 'attempt2'), getResult(deadlift, 'attempt3')] as [boolean, boolean, boolean],
            };

            const newMeetRecord = {
                id: meetDataEntry.id,
                date: meetDate,
                meetName,
                bodyweight: bwKg,
                squat: sq,
                bench: bp,
                deadlift: dl,
                total,
                dots: Math.round(dots * 100) / 100,
                _meetDataEntry: meetDataEntry,
            };

            updatedPastMeets.push(newMeetRecord);
            wasArchived = true;
        }
    }

    const updatedMeetAttempts = {
        ...meetAttempts,
        meetDay: {
            ...meetMeta,
            meetDate: '',
            meetName: '',
        }
    };

    return {
        nextMeetDate: null,
        nextMeetName: null,
        meetAttempts: updatedMeetAttempts,
        pastMeets: updatedPastMeets,
        originalMeetDate: meetDate,
        originalMeetName: meetName,
        wasArchived,
    };
}

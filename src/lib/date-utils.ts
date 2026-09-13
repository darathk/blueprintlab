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

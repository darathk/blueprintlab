/**
 * Extract the Supabase Storage path from a public URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
export function extractStoragePath(publicUrl: string): string | null {
    if (!publicUrl) return null;
    const marker = '/storage/v1/object/public/lift-videos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    // Strip media fragment URI (#t=...) if present
    return publicUrl.substring(idx + marker.length).split('#')[0];
}

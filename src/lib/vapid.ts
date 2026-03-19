/**
 * Convert a base64url-encoded VAPID public key to a Uint8Array
 * for use with pushManager.subscribe({ applicationServerKey }).
 *
 * iOS Safari is strict about this conversion — the padding and
 * alphabet replacement must be exact.
 */
export function urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

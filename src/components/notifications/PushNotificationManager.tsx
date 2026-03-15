'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

function urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default function PushNotificationManager() {
    const { user, isLoaded } = useUser();
    const hasSubscribed = useRef(false);

    const subscribeAndSync = useCallback(async () => {
        try {
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) {
                console.error('[Push] VAPID public key not set');
                return;
            }

            // Wait for any SW to be ready
            const registration = await navigator.serviceWorker.ready;

            // Get existing subscription
            let subscription = await registration.pushManager.getSubscription();

            // If subscription exists, test if it's still valid
            if (subscription) {
                const currentKey = subscription.options.applicationServerKey;
                const expectedKey = urlBase64ToUint8Array(publicVapidKey);

                // Compare keys to detect rotation
                let mismatch = false;
                if (currentKey) {
                    const currentArray = new Uint8Array(currentKey);
                    const expectedArray = new Uint8Array(expectedKey as ArrayBuffer);
                    if (currentArray.length !== expectedArray.length || !currentArray.every((v, i) => v === expectedArray[i])) {
                        mismatch = true;
                    }
                }

                if (mismatch) {
                    console.log('[Push] VAPID key mismatch detected, re-subscribing...');
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }

            if (!subscription) {
                console.log('[Push] Creating new subscription...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
            }

            // Always sync with server
            const subJSON = subscription.toJSON();
            console.log('[Push] Syncing subscription with server:', subJSON.endpoint.slice(-20));

            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: {
                        endpoint: subJSON.endpoint,
                        keys: {
                            p256dh: subJSON.keys?.p256dh,
                            auth: subJSON.keys?.auth
                        }
                    }
                })
            });

            if (res.ok) {
                console.log('[Push] Subscription synced with server');
            } else {
                const err = await res.text();
                console.error('[Push] Server sync failed:', res.status, err);

                // If server says 404 (user not found), the subscription may be for a different account
                // Unsubscribe and re-subscribe
                if (res.status === 404) {
                    console.log('[Push] Unsubscribing stale subscription...');
                    await subscription.unsubscribe();
                    const newSub = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                    });
                    const newSubJSON = newSub.toJSON();
                    await fetch('/api/notifications/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            subscription: {
                                endpoint: newSubJSON.endpoint,
                                keys: { p256dh: newSubJSON.keys?.p256dh, auth: newSubJSON.keys?.auth }
                            }
                        })
                    });
                }
            }

            hasSubscribed.current = true;
        } catch (error) {
            console.error('[Push] Subscribe error:', error);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded || !user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // Register or update the service worker
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async (reg) => {
            // Force check for updates
            reg.update().catch(() => { });

            // Wait for the SW to be active if it's installing
            const sw = reg.installing || reg.waiting || reg.active;
            if (sw && sw.state !== 'activated') {
                await new Promise<void>((resolve) => {
                    sw.addEventListener('statechange', function handler() {
                        if (sw.state === 'activated') {
                            sw.removeEventListener('statechange', handler);
                            resolve();
                        }
                    });
                    // Safety timeout
                    setTimeout(resolve, 5000);
                });
            }

            // Auto-subscribe if permission already granted
            if (Notification.permission === 'granted') {
                await subscribeAndSync();
            }
        }).catch(err => {
            console.error('[Push] SW registration failed:', err);
        });

        // Manual trigger from NotificationPermissionButton
        const handleManualTrigger = async () => {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    await subscribeAndSync();
                }
            } catch (err) {
                console.error('[Push] Permission request failed:', err);
            }
        };
        window.addEventListener('app:request-push', handleManualTrigger);

        // Clear native app badge on focus
        const clearBadge = () => {
            if ('clearAppBadge' in navigator) {
                (navigator as any).clearAppBadge().catch(() => { });
            }
        };
        clearBadge();
        window.addEventListener('focus', clearBadge);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') clearBadge();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('app:request-push', handleManualTrigger);
            window.removeEventListener('focus', clearBadge);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [user, isLoaded, subscribeAndSync]);

    return null;
}

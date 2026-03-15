'use client';

import { useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

export default function PushNotificationManager() {
    const { user, isLoaded } = useUser();

    const subscribeAndSync = useCallback(async () => {
        try {
            // Wait for SW to be ready
            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!publicVapidKey) {
                    console.error('[Push] VAPID public key not set');
                    return;
                }

                // Convert VAPID key
                const padding = '='.repeat((4 - (publicVapidKey.length % 4)) % 4);
                const base64 = (publicVapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const applicationServerKey = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                    applicationServerKey[i] = rawData.charCodeAt(i);
                }

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
            }

            // Serialize the subscription properly
            const subJSON = subscription.toJSON();

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

            if (!res.ok) {
                const err = await res.text();
                console.error('[Push] Server sync failed:', res.status, err);
            }
        } catch (error) {
            console.error('[Push] Subscribe error:', error);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded || !user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // Register SW first, then subscribe
        navigator.serviceWorker.register('/sw.js').then(async (reg) => {
            // Wait for the SW to be active
            if (reg.installing) {
                await new Promise<void>((resolve) => {
                    reg.installing!.addEventListener('statechange', function handler() {
                        if (this.state === 'activated') {
                            this.removeEventListener('statechange', handler);
                            resolve();
                        }
                    });
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

        // Clear badge on focus
        const clearBadge = () => {
            if ('clearAppBadge' in navigator) {
                (navigator as any).clearAppBadge();
            }
        };
        clearBadge();
        window.addEventListener('focus', clearBadge);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') clearBadge();
        };
        window.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('app:request-push', handleManualTrigger);
            window.removeEventListener('focus', clearBadge);
            window.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [user, isLoaded, subscribeAndSync]);

    return null;
}

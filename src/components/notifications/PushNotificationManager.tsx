'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export default function PushNotificationManager() {
    const { user, isLoaded } = useUser();

    useEffect(() => {
        if (!isLoaded || !user) return;

        // Check for Service Worker and Push API support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push] Browser does not support push notifications');
            return;
        }

        // Register service worker immediately
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('[Push] Service worker registered, scope:', reg.scope);
        }).catch(err => {
            console.error('[Push] SW registration failed:', err);
        });

        // If permission already granted, subscribe and sync every page load
        // This ensures the subscription stays fresh and re-registers if it expired
        if (Notification.permission === 'granted') {
            subscribeAndSync();
        }

        // Listen for manual trigger from NotificationPermissionButton (user gesture)
        const handleManualTrigger = async () => {
            try {
                const permission = await Notification.requestPermission();
                console.log('[Push] Permission result:', permission);
                if (permission === 'granted') {
                    await subscribeAndSync();
                }
            } catch (err) {
                console.error('[Push] Permission request failed:', err);
            }
        };
        window.addEventListener('app:request-push', handleManualTrigger);

        // Clear badge on focus/visibility
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
    }, [user, isLoaded]);

    const subscribeAndSync = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            console.log('[Push] SW ready, checking subscription...');

            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!publicVapidKey) {
                    console.error('[Push] VAPID public key not found in env');
                    return;
                }

                console.log('[Push] No existing subscription, creating new one...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
                console.log('[Push] New subscription created');
            } else {
                console.log('[Push] Existing subscription found, syncing...');
            }

            // Always sync subscription to server (handles re-registration, new devices, etc.)
            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
            });

            if (res.ok) {
                console.log('[Push] Subscription synced to server successfully');
            } else {
                const err = await res.text();
                console.error('[Push] Server sync failed:', res.status, err);
            }
        } catch (error) {
            console.error('[Push] Subscription failed:', error);
        }
    };

    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    return null;
}

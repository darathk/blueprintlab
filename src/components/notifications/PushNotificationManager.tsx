'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function PushNotificationManager() {
    const { user, isLoaded } = useUser();

    useEffect(() => {
        if (!isLoaded || !user) return;

        // Check for Service Worker and Push API support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // Register service worker immediately (this doesn't need permission)
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.error('SW registration failed:', err);
        });

        // If permission already granted, subscribe silently (no prompt needed)
        if (Notification.permission === 'granted') {
            subscribeAndSync();
        }

        // Listen for manual trigger from NotificationPermissionButton (user gesture)
        const handleManualTrigger = async () => {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    await subscribeAndSync();
                }
            } catch (err) {
                console.error('Permission request failed:', err);
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

            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!publicVapidKey) {
                    console.error('VAPID public key not found');
                    return;
                }

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
            }

            // Send subscription to server
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
            });
        } catch (error) {
            console.error('Push subscription failed:', error);
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

'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function PushNotificationManager() {
    const { user, isLoaded } = useUser();
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if (!isLoaded || !user) return;

        // Check for Service Worker and Push API support
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);

            // Try to auto-register (will work for SW, but permission might be blocked on iOS if not a click)
            registerAndSubscribe(false);

            // Listen for manual trigger
            const handleManualTrigger = () => registerAndSubscribe(true);
            window.addEventListener('app:request-push', handleManualTrigger);

            // Clear badge on init/focus
            const clearBadge = () => {
                if ('clearAppBadge' in navigator) {
                    (navigator as any).clearAppBadge();
                }
            };

            clearBadge();
            window.addEventListener('focus', clearBadge);
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') clearBadge();
            });

            return () => {
                window.removeEventListener('app:request-push', handleManualTrigger);
                window.removeEventListener('focus', clearBadge);
            };
        }
    }, [user, isLoaded]);

    const registerAndSubscribe = async (isManual: boolean) => {
        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');

            // If manual or default, try to request
            if (Notification.permission === 'default' || (isManual && Notification.permission !== 'granted')) {
                // IMPORTANT: Notification.requestPermission() MUST be called in response to user interaction
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;
            }

            // Get existing subscription
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Subscribe if not subscribed
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
            console.error('Failed to register/subscribe for push notifications:', error);
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

    // This component doesn't render anything visible
    return null;
}

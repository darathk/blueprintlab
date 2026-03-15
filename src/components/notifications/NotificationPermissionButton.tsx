'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

export default function NotificationPermissionButton() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    useEffect(() => {
        if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    const handleRequest = async () => {
        setSubscribing(true);

        try {
            // Request permission (must be from user gesture)
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm === 'granted') {
                // Also dispatch event so PushNotificationManager picks it up
                window.dispatchEvent(new CustomEvent('app:request-push'));

                // Direct fallback: subscribe here too in case the event listener hasn't set up
                try {
                    const registration = await navigator.serviceWorker.ready;
                    let subscription = await registration.pushManager.getSubscription();

                    if (!subscription) {
                        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                        if (publicVapidKey) {
                            const padding = '='.repeat((4 - (publicVapidKey.length % 4)) % 4);
                            const base64 = (publicVapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                            const rawData = window.atob(base64);
                            const key = new Uint8Array(rawData.length);
                            for (let i = 0; i < rawData.length; ++i) key[i] = rawData.charCodeAt(i);

                            subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: key
                            });
                        }
                    }

                    if (subscription) {
                        const subJSON = subscription.toJSON();
                        await fetch('/api/notifications/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                subscription: {
                                    endpoint: subJSON.endpoint,
                                    keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth }
                                }
                            })
                        });
                    }
                } catch (subErr) {
                    console.error('[Push] Button subscribe error:', subErr);
                }
            }
        } catch (err) {
            console.error('[Push] Permission request failed:', err);
        }

        setSubscribing(false);
    };

    // Hide when not supported or already granted
    if (!isSupported || permission === 'granted') return null;

    if (permission === 'denied') {
        return (
            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.6rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                <BellOff size={10} />
                Blocked in Settings
            </div>
        );
    }

    return (
        <button
            onClick={handleRequest}
            disabled={subscribing}
            style={{
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                color: '#06b6d4',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.6rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: subscribing ? 'wait' : 'pointer',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: subscribing ? 0.6 : 1
            }}
        >
            <Bell size={10} />
            {subscribing ? 'Enabling...' : 'Enable Notifications'}
        </button>
    );
}

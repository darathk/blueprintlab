'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';

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
        window.dispatchEvent(new CustomEvent('app:request-push'));

        // Poll for permission change
        const interval = setInterval(() => {
            const current = Notification.permission;
            if (current !== permission) {
                setPermission(current);
                clearInterval(interval);
                setSubscribing(false);
            }
        }, 500);
        setTimeout(() => { clearInterval(interval); setSubscribing(false); }, 10000);
    };

    if (!isSupported) return null;

    if (permission === 'granted') {
        return (
            <div
                style={{
                    background: 'rgba(0, 168, 132, 0.15)',
                    border: '1px solid rgba(0, 168, 132, 0.3)',
                    color: '#00a884',
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
                }}
            >
                <Check size={10} />
                Notifications On
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div
                style={{
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
                }}
            >
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

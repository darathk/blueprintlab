'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

export default function NotificationPermissionButton() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    const handleRequest = () => {
        window.dispatchEvent(new CustomEvent('app:request-push'));
        // Poll for change
        const interval = setInterval(() => {
            if (Notification.permission !== permission) {
                setPermission(Notification.permission);
                clearInterval(interval);
            }
        }, 500);
        setTimeout(() => clearInterval(interval), 10000);
    };

    if (!isSupported || permission === 'granted') return null;

    return (
        <button
            onClick={handleRequest}
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
                cursor: 'pointer',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}
        >
            <Bell size={10} />
            Enable Notifications
        </button>
    );
}

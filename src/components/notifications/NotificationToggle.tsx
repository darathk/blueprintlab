'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { urlBase64ToUint8Array } from '@/lib/vapid';

type Status = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'disabled';

export default function NotificationToggle({ role = 'athlete' }: { role?: 'coach' | 'athlete' }) {
    const [status, setStatus] = useState<Status>('loading');
    const [busy, setBusy] = useState(false);

    const checkStatus = useCallback(async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }

        if (Notification.permission === 'denied') {
            setStatus('denied');
            return;
        }

        if (Notification.permission === 'granted') {
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                setStatus(sub ? 'enabled' : 'disabled');
            } catch {
                setStatus('disabled');
            }
            return;
        }

        // permission === 'default' — not yet asked
        setStatus('disabled');
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const ensureServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
        // Register if not already registered
        let reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        }
        // Wait for it to be active
        if (reg.installing || reg.waiting) {
            const sw = reg.installing || reg.waiting;
            await new Promise<void>((resolve) => {
                if (sw!.state === 'activated') { resolve(); return; }
                sw!.addEventListener('statechange', function handler() {
                    if (sw!.state === 'activated') {
                        sw!.removeEventListener('statechange', handler);
                        resolve();
                    }
                });
                setTimeout(resolve, 5000);
            });
        }
        return navigator.serviceWorker.ready;
    };

    const enable = async () => {
        setBusy(true);
        try {
            const perm = await Notification.requestPermission();
            console.log('[Push] Permission result:', perm);
            if (perm === 'denied') {
                setStatus('denied');
                setBusy(false);
                return;
            }
            if (perm !== 'granted') {
                setBusy(false);
                return;
            }

            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) {
                console.error('[Push] VAPID public key not set');
                setBusy(false);
                return;
            }

            const reg = await ensureServiceWorker();
            let subscription = await reg.pushManager.getSubscription();
            console.log('[Push] Existing subscription:', !!subscription);

            if (!subscription) {
                subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
                });
                console.log('[Push] New subscription created');
            }

            const subJSON = subscription.toJSON();
            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: {
                        endpoint: subJSON.endpoint,
                        keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
                    },
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('[Push] Subscribe API failed:', res.status, errText);
            } else {
                console.log('[Push] Subscription saved to server');
            }

            setStatus('enabled');
        } catch (err) {
            console.error('[Push] Enable error:', err);
        }
        setBusy(false);
    };

    const disable = async () => {
        setBusy(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();

            if (subscription) {
                // Remove from server first
                await fetch('/api/notifications/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });

                // Then unsubscribe locally
                await subscription.unsubscribe();
            }

            setStatus('disabled');
        } catch (err) {
            console.error('[Push] Disable error:', err);
        }
        setBusy(false);
    };

    if (status === 'loading') {
        return (
            <div style={rowStyle}>
                <div style={iconBoxStyle}>
                    <Bell size={20} style={{ color: 'var(--secondary-foreground)', opacity: 0.5 }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Push Notifications</div>
                    <div style={descStyle}>Checking...</div>
                </div>
            </div>
        );
    }

    if (status === 'unsupported') {
        return (
            <div style={rowStyle}>
                <div style={iconBoxStyle}>
                    <BellOff size={20} style={{ color: 'var(--secondary-foreground)', opacity: 0.5 }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Push Notifications</div>
                    <div style={descStyle}>
                        Not supported on this browser. On iOS, add this app to your Home Screen first.
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'denied') {
        return (
            <div style={rowStyle}>
                <div style={iconBoxStyle}>
                    <BellOff size={20} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Push Notifications</div>
                    <div style={{ ...descStyle, color: '#ef4444' }}>
                        Blocked — go to your browser/device settings to re-enable.
                    </div>
                </div>
            </div>
        );
    }

    const isEnabled = status === 'enabled';

    return (
        <div style={rowStyle}>
            <div style={{
                ...iconBoxStyle,
                background: isEnabled ? 'rgba(125, 135, 210, 0.15)' : undefined,
            }}>
                {isEnabled
                    ? <BellRing size={20} style={{ color: 'var(--primary)' }} />
                    : <Bell size={20} style={{ color: 'var(--secondary-foreground)' }} />
                }
            </div>
            <div style={{ flex: 1 }}>
                <div style={labelStyle}>Push Notifications</div>
                <div style={descStyle}>
                    {isEnabled
                        ? 'You will receive alerts for new messages.'
                        : role === 'coach'
                            ? 'Get notified when an athlete sends a message.'
                            : 'Get notified when your coach sends a message.'}
                </div>
            </div>
            <button
                onClick={isEnabled ? disable : enable}
                disabled={busy}
                style={{
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    border: 'none',
                    cursor: busy ? 'wait' : 'pointer',
                    background: isEnabled
                        ? 'var(--primary, #7d87d2)'
                        : 'rgba(255, 255, 255, 0.12)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    opacity: busy ? 0.5 : 1,
                }}
                aria-label={isEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
                <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: isEnabled ? 25 : 3,
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
            </button>
        </div>
    );
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
};

const iconBoxStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--foreground)',
    marginBottom: '2px',
};

const descStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--secondary-foreground)',
    opacity: 0.7,
    lineHeight: 1.4,
};

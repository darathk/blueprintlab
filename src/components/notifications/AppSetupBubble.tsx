'use client';

import { useState, useEffect } from 'react';
import { Bell, Share, X, Plus, MoreVertical, ArrowUp } from 'lucide-react';

const DISMISSED_KEY = 'app-setup-bubble-dismissed';

export default function AppSetupBubble() {
    const [visible, setVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [notifGranted, setNotifGranted] = useState(false);
    const [notifDenied, setNotifDenied] = useState(false);
    const [notifSupported, setNotifSupported] = useState(false);
    const [step, setStep] = useState<'main' | 'notif-instructions' | 'bookmark-instructions'>('main');

    useEffect(() => {
        // Already dismissed forever
        if (localStorage.getItem(DISMISSED_KEY)) return;

        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const android = /Android/.test(navigator.userAgent);
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as any).standalone === true;
        const hasNotif = 'Notification' in window;
        const notifOk = hasNotif && Notification.permission === 'granted';
        const notifBlocked = hasNotif && Notification.permission === 'denied';

        setIsIOS(ios);
        setIsAndroid(android);
        setIsStandalone(standalone);
        setNotifGranted(notifOk);
        setNotifDenied(notifBlocked);
        setNotifSupported(hasNotif && 'serviceWorker' in navigator);

        // If both are already done, never show
        if (standalone && notifOk) return;

        // Small delay so it doesn't flash immediately on load
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        setVisible(false);
        localStorage.setItem(DISMISSED_KEY, 'true');
    };

    const handleEnableNotifications = async () => {
        if (!notifSupported) {
            setStep('notif-instructions');
            return;
        }

        // If already denied by browser, show instructions to fix
        if (notifDenied) {
            setStep('notif-instructions');
            return;
        }

        // Request permission via PushNotificationManager
        window.dispatchEvent(new Event('app:request-push'));

        // Wait a moment then check result
        setTimeout(() => {
            const granted = 'Notification' in window && Notification.permission === 'granted';
            if (granted) {
                setNotifGranted(true);
                setNotifDenied(false);
                if (isStandalone) dismiss();
                else setStep('main');
            } else {
                if ('Notification' in window && Notification.permission === 'denied') {
                    setNotifDenied(true);
                }
                setStep('notif-instructions');
            }
        }, 1000);
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 24px)',
            maxWidth: 420,
            zIndex: 9999,
            animation: 'slideUpBubble 0.4s ease-out',
        }}>
            <div style={{
                background: 'rgba(20, 20, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 16,
                border: '1px solid rgba(125, 135, 210, 0.25)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(125, 135, 210, 0.15)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                        Get the best experience
                    </span>
                    <button onClick={dismiss} style={{
                        background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
                        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                    }}>
                        <X size={14} />
                    </button>
                </div>

                {step === 'main' && (
                    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Notifications */}
                        {!notifGranted && (
                            <button onClick={handleEnableNotifications} style={{
                                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                                background: 'rgba(125, 135, 210, 0.12)', border: '1px solid rgba(125, 135, 210, 0.2)',
                                borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'linear-gradient(135deg, #7d87d2, #a855f7)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Bell size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>Turn on notifications</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                        Get notified when your coach messages you
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* Bookmark / Install */}
                        {!isStandalone && (
                            <button onClick={() => setStep('bookmark-instructions')} style={{
                                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                                background: 'rgba(125, 135, 210, 0.12)', border: '1px solid rgba(125, 135, 210, 0.2)',
                                borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Plus size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>Add to home screen</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                        Open BlueprintLab like a real app
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* If one is already done, show a checkmark */}
                        {notifGranted && !isStandalone && (
                            <div style={{ fontSize: 11, color: 'rgba(125, 135, 210, 0.7)', textAlign: 'center', padding: '2px 0' }}>
                                Notifications enabled ✓
                            </div>
                        )}
                        {isStandalone && !notifGranted && (
                            <div style={{ fontSize: 11, color: 'rgba(125, 135, 210, 0.7)', textAlign: 'center', padding: '2px 0' }}>
                                App installed ✓
                            </div>
                        )}
                    </div>
                )}

                {step === 'notif-instructions' && (
                    <div style={{ padding: '12px 16px 16px' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 12px', lineHeight: 1.5 }}>
                            {notifDenied
                                ? 'Notifications were blocked. To fix this:'
                                : 'To enable notifications:'}
                        </p>
                        {isIOS ? (
                            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                                <li>First <strong>add to home screen</strong> (see other step)</li>
                                <li>Open the app from your home screen</li>
                                <li>The notification prompt will appear automatically</li>
                                {notifDenied && (
                                    <li>If blocked: <strong>Settings → BlueprintLab → Notifications → Allow</strong></li>
                                )}
                            </ol>
                        ) : (
                            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                                {notifDenied ? (
                                    <>
                                        <li>Tap the <strong>lock icon</strong> in the address bar</li>
                                        <li>Tap <strong>Site settings</strong> (or Permissions)</li>
                                        <li>Set <strong>Notifications</strong> to <strong>Allow</strong></li>
                                        <li>Refresh the page</li>
                                    </>
                                ) : (
                                    <>
                                        <li>When prompted, tap <strong>Allow</strong></li>
                                        <li>If no prompt appears, check your browser settings</li>
                                    </>
                                )}
                            </ol>
                        )}
                        <button onClick={() => setStep('main')} style={{
                            marginTop: 12, width: '100%', padding: '10px',
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        }}>
                            Back
                        </button>
                    </div>
                )}

                {step === 'bookmark-instructions' && (
                    <div style={{ padding: '12px 16px 16px' }}>
                        {isIOS ? (
                            <>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px', lineHeight: 1.5 }}>
                                    In Safari:
                                </p>
                                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                                    <li>Tap the <strong>Share</strong> button <Share size={12} style={{ verticalAlign: 'middle' }} /> at the bottom</li>
                                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                                    <li>Tap <strong>Add</strong> in the top right</li>
                                </ol>
                                <div style={{
                                    marginTop: 12, padding: '10px 12px', borderRadius: 10,
                                    background: 'rgba(125, 135, 210, 0.1)', border: '1px solid rgba(125, 135, 210, 0.15)',
                                    fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
                                }}>
                                    Must use <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Safari</strong> — other browsers don't support Add to Home Screen on iOS.
                                </div>
                            </>
                        ) : isAndroid ? (
                            <>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px', lineHeight: 1.5 }}>
                                    In Chrome:
                                </p>
                                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                                    <li>Tap the <strong>three dots</strong> <MoreVertical size={12} style={{ verticalAlign: 'middle' }} /> menu in the top right</li>
                                    <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                                    <li>Tap <strong>Install</strong></li>
                                </ol>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px', lineHeight: 1.5 }}>
                                    In your browser:
                                </p>
                                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                                    <li>Look for an <strong>install icon</strong> <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> in the address bar</li>
                                    <li>Or open browser menu and select <strong>"Install BlueprintLab"</strong></li>
                                </ol>
                            </>
                        )}
                        <button onClick={() => setStep('main')} style={{
                            marginTop: 12, width: '100%', padding: '10px',
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        }}>
                            Back
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideUpBubble {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}

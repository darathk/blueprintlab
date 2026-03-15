self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'New message',
            icon: '/icon-192x192.png',
            badge: '/splash.png',
            vibrate: [100, 50, 100],
            tag: 'blueprint-message',
            renotify: true,
            data: {
                url: data.url || '/'
            }
        };

        // Set the app badge
        if (navigator.setAppBadge) {
            navigator.setAppBadge(1);
        }

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Clear badge when user clicks notification
    if (navigator.clearAppBadge) {
        navigator.clearAppBadge();
    }

    const targetUrl = event.notification.data.url;

    // For PWA: try to focus an existing window instead of opening a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Try to find an existing window and focus it
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if ('focus' in client) {
                    return client.focus().then(function (focusedClient) {
                        if (focusedClient && 'navigate' in focusedClient) {
                            return focusedClient.navigate(targetUrl);
                        }
                    });
                }
            }
            // No existing window — open a new one
            return clients.openWindow(targetUrl);
        })
    );
});

// Activate new service worker immediately (skip waiting)
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

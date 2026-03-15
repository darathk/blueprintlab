// BlueprintLab Service Worker — Push Notifications

self.addEventListener('push', function (event) {
    let data = { title: 'BlueprintLab', body: 'New message', url: '/' };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        // If JSON parse fails, use the text as body
        if (event.data) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || 'New message',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'blueprint-msg-' + Date.now(), // Unique tag so each notification shows separately
        renotify: true,
        requireInteraction: true, // Keep notification visible until user interacts
        silent: false,
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    // Set app badge
    if (self.navigator && self.navigator.setAppBadge) {
        self.navigator.setAppBadge(1).catch(function () { });
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'BlueprintLab', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Clear badge
    if (self.navigator && self.navigator.clearAppBadge) {
        self.navigator.clearAppBadge().catch(function () { });
    }

    var targetUrl = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : '/';

    // Handle action buttons
    if (event.action === 'dismiss') {
        return; // Just close the notification
    }

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Try to find and focus an existing window
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

// Activate new service worker immediately
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

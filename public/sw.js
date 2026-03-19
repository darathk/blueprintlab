// BlueprintLab Service Worker — Push Notifications
// iOS 16.4+ compatible (avoids unsupported options like vibrate, actions, silent)

self.addEventListener('push', function (event) {
    var data = { title: 'BlueprintLab', body: 'New message', url: '/' };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        if (event.data) {
            data.body = event.data.text();
        }
    }

    var options = {
        body: data.body || 'New message',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'blueprint-msg-' + Date.now(),
        renotify: true,
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        }
    };

    if (self.navigator && self.navigator.setAppBadge) {
        self.navigator.setAppBadge(1).catch(function () { });
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'BlueprintLab', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (self.navigator && self.navigator.clearAppBadge) {
        self.navigator.clearAppBadge().catch(function () { });
    }

    var targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : '/';

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
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
            return clients.openWindow(targetUrl);
        })
    );
});

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

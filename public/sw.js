self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/splash.png', // Small monochrome image ideally, but splash works as fallback
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        };

        // Set the app badge (red dot with number)
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

    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

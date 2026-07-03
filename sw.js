// Service Worker for Saturday Schedule Reminder
// Handles background periodic notifications

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes('scheduling') && 'focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('./');
        })
    );
});

// Listen for messages to schedule a notification check
self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SCHEDULE_REMINDER') {
        // Store reminder preference
        self.reminderTime = e.data.time || '10:00';
    }
});

// Custom Service Worker for Push Notifications + Cache Management
const SW_VERSION = 'v7-product-price-cache-bust';

// Activate new SW immediately without waiting
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Clear ALL caches on activate to prevent stale chunk issues after deploy
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation AND JS/CSS assets
// Passthrough for images and other static resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Navigation requests — always network-first for fresh index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/CSS assets — network-first to prevent stale chunk errors
  if (url.pathname.match(/\.(js|css)$/) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache error responses
          if (!response || !response.ok) return response;
          return response;
        })
        .catch(() => {
          // Network failed — if we somehow have a cached version, try it
          return caches.match(event.request);
        })
    );
    return;
  }

  // All other requests — let browser handle normally
});

// Handle push subscription expiry/change — auto re-subscribe
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed, re-subscribing...');
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((newSub) => {
        const subJson = newSub.toJSON();
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: subJson,
            });
          });
        });
      })
      .catch((err) => console.error('[SW] Re-subscribe failed:', err))
  );
});

self.addEventListener('push', function(event) {
  let data = { title: '🎉 নতুন অর্ডার!', body: 'নতুন অর্ডার এসেছে!', url: '/admin/orders' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Push data parse error:', e);
  }

  const options = {
    body: data.body || 'নতুন অর্ডার এসেছে!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'order-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/admin/orders',
    },
    actions: [
      { action: 'view', title: 'দেখুন' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🎉 নতুন অর্ডার!', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data?.url || '/admin/orders';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

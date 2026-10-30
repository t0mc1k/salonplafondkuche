/* Salonplafond KÜCHE – Service Worker (Version 1.2.01)
   Zweck: App installierbar machen und die App-Dateien offline bereithalten.
   Strategie: Netzwerk zuerst (immer die neueste Version), Cache nur als Notlösung.
   Daten aus Supabase und Fremd-Server (CDN) werden nie zwischengespeichert. */
const CACHE = 'kueche-1.2.01';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/auth.js', 'js/ui.js', 'js/settings.js', 'js/dishes.js', 'js/dish-admin.js',
  'js/seasons.js', 'js/shopping.js', 'js/handovers.js', 'js/tray.js', 'js/print-a3.js',
  'js/import-export.js', 'js/schedule.js', 'js/profile.js', 'js/staff-admin.js', 'js/chat.js',
  'js/tickets.js', 'js/changelog.js', 'js/pwa.js', 'js/push.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // Supabase, CDN usw. nicht anfassen

  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((hit) =>
        hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())
      )
    )
  );
});

// ---------- Web-Push: Mitteilung anzeigen (auch wenn die App geschlossen ist) ----------
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Salonplafond KÜCHE', {
      body: d.body || '',
      tag: d.tag || 'kueche',
      renotify: true,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [120, 60, 120],
      data: { url: d.url || './?view=handover' }
    })
  );
});

// Tippen auf die Mitteilung: App öffnen bzw. nach vorne holen und die Übergabe zeigen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './?view=handover', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.postMessage({ type: 'open', view: new URL(target).searchParams.get('view') || 'handover' }); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

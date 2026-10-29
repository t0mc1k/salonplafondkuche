/* Salonplafond KÜCHE – Service Worker (Version 1.1.02)
   Zweck: App installierbar machen und die App-Dateien offline bereithalten.
   Strategie: Netzwerk zuerst (immer die neueste Version), Cache nur als Notlösung.
   Daten aus Supabase und Fremd-Server (CDN) werden nie zwischengespeichert. */
const CACHE = 'kueche-1.1.02';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/auth.js', 'js/ui.js', 'js/settings.js', 'js/dishes.js', 'js/dish-admin.js',
  'js/seasons.js', 'js/shopping.js', 'js/handovers.js', 'js/tray.js', 'js/print-a3.js',
  'js/import-export.js', 'js/schedule.js', 'js/profile.js', 'js/staff-admin.js', 'js/chat.js',
  'js/tickets.js', 'js/changelog.js', 'js/pwa.js', 'js/app.js',
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

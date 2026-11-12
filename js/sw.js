/* ============================================================
   sw.js  –  Service Worker (macht die App installierbar und schneller)
   Die Versionsnummer kommt aus dem Aufruf sw.js?v=... (siehe js/pwa.js),
   so wird bei jeder neuen App-Version automatisch ein frischer Cache angelegt.

   - Eigene Dateien: erst Netzwerk (immer aktuell), bei Funkloch aus dem Cache.
   - Fremde Skripte (Tailwind, Supabase-Bibliothek, Excel): Cache + im Hintergrund aktualisieren.
   - Datenbank-Anfragen (Supabase) und alles außer GET werden NIE angefasst.
   ============================================================ */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'salon-' + VERSION;
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('salon-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isApi(url) {
  return /supabase\.co$/.test(url.hostname) || url.pathname.indexOf('/rest/v1/') !== -1 ||
         url.pathname.indexOf('/storage/v1/') !== -1 || url.pathname.indexOf('/realtime/') !== -1;
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
    ]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: false }) || await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (isNavigation) {
      const shell = await cache.match('index.html') || await cache.match('./');
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await update) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isApi(url)) return;

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, request.mode === 'navigate'));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ============================================================
   Web Push (v4.1.00): Benachrichtigungen auch bei geschlossener App
   Der Server (Edge Function send-push) schickt JSON: { title, body, tag, url, groupTitle, groupBody }
   - Gleiche Meldungsart (tag) wird zusammengefasst, z. B. „3 neue Nachrichten“.
   - Tippen auf die Meldung öffnet die App und das passende Fenster (url = chat, swaps, myplan, faults, tickets, news).
   Wichtig für iPhone: Jede Push-Nachricht MUSS eine sichtbare Meldung zeigen, sonst entzieht iOS die Erlaubnis.
   ============================================================ */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Salonplafond BAR', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    const tag = d.tag || 'general';
    let title = d.title || 'Salonplafond BAR';
    let body = d.body || '';
    let count = 1;
    if (d.groupBody) {
      const existing = await self.registration.getNotifications({ tag });
      if (existing.length) {
        count = ((existing[0].data && existing[0].data.count) || 1) + 1;
        title = d.groupTitle || title;
        body = String(d.groupBody).replace('{n}', String(count));
      }
    }
    await self.registration.showNotification(title, {
      body, tag, renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      data: { url: d.url || '', count }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'open', target }); return; }
    }
    await self.clients.openWindow(self.registration.scope + (target ? '?open=' + encodeURIComponent(target) : ''));
  })());
});

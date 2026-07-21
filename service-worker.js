/* Network-first fuer Navigationen; cacht nur die Offline-URL. Muster: crm-spa. */
const CACHE = 'bbz-kw-dev';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/bbz_Kurswerkstatt/')));
});

const CACHE_NAME = 'setlist-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell (HTML/CSS/JS/icons).
// Everything else (Apps Script calls, jsPDF CDN, fonts) goes straight to the network —
// the setlist data itself must never be served stale.
self.addEventListener('fetch', event => {
  const req = event.request;
  const isShellRequest = APP_SHELL.some(path => req.url.endsWith(path.replace('./', '')));

  if (req.method === 'GET' && isShellRequest) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
});

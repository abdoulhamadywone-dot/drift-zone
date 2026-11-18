// Drift Zone — cache hors-ligne + mises à jour
const VERSION = '2.1.0';
const CACHE = 'driftzone-' + VERSION;
// fichiers indispensables (le modèle Audi haute qualité est mis en cache à la première utilisation)
const CORE = [
  './', './index.html', './game.js', './manifest.webmanifest',
  './lib/three.min.js', './lib/GLTFLoader.js',
  './assets/audi_lo.glb', './assets/audi_xlo.glb', './assets/city.glb', './assets/fans_lo.glb',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('driftzone-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/api/')) return; // toujours en direct
  // réseau d'abord (tu reçois toujours la dernière version), cache si hors-ligne
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
});

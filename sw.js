// Drift Zone — cache hors-ligne + mises à jour
const VERSION = '3.1.0';
const CACHE = 'driftzone-' + VERSION;
const MUSIC = 'dzmusic-1'; // musique : gardée d'une version à l'autre (chaque morceau écouté reste disponible sans Internet)
// fichiers indispensables (le modèle Audi haute qualité est mis en cache à la première utilisation)
const CORE = [
  './', './index.html', './game.js', './taxi.js', './data/geo.js', './data/circuit_nkc.js', './data/nkc_real.js', './manifest.webmanifest',
  './lib/three.min.js', './lib/GLTFLoader.js', './music/playlist.json',
  './engine-dsp.js', './assets/audi_lo.glb', './assets/audi_xlo.glb', './assets/city.glb', './assets/mrt.glb', './assets/lm.glb', './assets/fans_lo.glb', './assets/ferrari_lo.glb',
  './assets/s15_lo.glb', './assets/hellcat_lo.glb', './assets/viper_lo.glb', './assets/specter_lo.glb',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('driftzone-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// morceau de musique : servi depuis le cache s'il y est (avec les « plages » demandées par le lecteur audio),
// sinon téléchargé en entier, joué pendant le téléchargement, puis rangé dans le cache
async function musicResponse(req) {
  const u = new URL(req.url); u.search = ''; const key = u.href;
  const cache = await caches.open(MUSIC);
  const hit = await cache.match(key);
  const range = req.headers.get('range');
  if (hit) {
    if (!range) return hit;
    const buf = await hit.arrayBuffer(), size = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(range) || [];
    let a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    if (!m[1] && m[2]) { a = Math.max(0, size - +m[2]); b = size - 1; }
    b = Math.min(b, size - 1);
    if (a >= size || a > b) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes' } });
  }
  const start = range ? +((/bytes=(\d*)-/.exec(range) || [])[1] || 0) : 0;
  if (start > 0) return fetch(req); // le lecteur saute plus loin dans un morceau pas encore gardé : on passe directement par le réseau
  try {
    const r = await fetch(key);
    if (r.ok && r.status === 200) cache.put(key, r.clone()).catch(() => {});
    return r;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'hors ligne' });
  }
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/music/') && url.pathname.endsWith('.mp3')) { e.respondWith(musicResponse(e.request)); return; }
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/api/')) return; // toujours en direct
  // réseau d'abord (tu reçois toujours la dernière version), cache si hors-ligne
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
});

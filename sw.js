// Soukbunar PWA – service worker
const VERSION = 'soukbunar-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];
const TILES = 'soukbunar-tiles';
const MAX_TILES = 1500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = /arcgisonline\.com|basemaps\.cartocdn\.com/.test(url.hostname);
  if (isTile) {
    // karte: iz keša ako postoji, inače mreža (i spremi)
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimTiles(); }
        return res;
      } catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  // aplikacija: mreža prvo (svježi podaci), keš kad nema interneta
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});

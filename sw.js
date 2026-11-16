'use strict';
// Service worker: makes the app installable and usable offline.
// Strategy: network-first (always revalidated, so a new deployment shows up immediately), falling back to
// the cached copy when offline. version.json is never cached: the in-page update check must see the server.

// yymmddhhmm (UTC) of the commit; stamped by tools/stamp-version.sh together with index.html. Do not edit by hand.
const VERSION = '2611160954';
const CACHE = 'omi-shell-' + VERSION;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const NETWORK_WAIT_MS = 6000;   // if the network hangs, use the cached copy rather than waiting forever

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('omi-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = () => cache.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
  const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  try {
    const hit = await cached();
    // With a cached copy available, don't let a stalled connection block the page.
    return hit ? await Promise.race([net, new Promise((_, rej) => setTimeout(rej, NETWORK_WAIT_MS))]) : await net;
  } catch {
    net.catch(() => {});
    const hit = await cached();
    if (hit) return hit;
    return new Response('Offline and not cached yet.', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

/**
 * Mind Canvas Service Worker — E3 PWA support.
 * Strategy:
 *   • Navigation requests  → network-first, fallback to cached /index.html
 *   • Static assets (/assets/, fonts, icons) → cache-first, refresh in background
 *   • Everything else → network-only
 */

const CACHE = 'mind-canvas-v1';
const PRECACHE = ['/', '/index.html'];

// ─── Install ─────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => { /* silently fail in dev */ })
  );
  self.skipWaiting();
});

// ─── Activate — evict old caches ─────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation → network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then(r => r ?? new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // Static assets → cache-first with background refresh
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fresh = fetch(event.request).then(res => {
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          }
          return res;
        });
        return cached ?? fresh;
      })
    );
  }
});

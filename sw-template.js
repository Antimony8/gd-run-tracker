// Service worker for offline use. Built by the serviceWorker() plugin in vite.config.ts,
// which fills in the cache name and the list of files to precache.
const CACHE = '__CACHE_NAME__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gd-run-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only handle our own files. Level lookups, YouTube and so on go straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Pages: try the network for the newest version, fall back to the cached app shell offline.
    event.respondWith(fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true })))
    return
  }

  // Built assets have hashed names, so a cached copy is always correct.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        }),
    ),
  )
})

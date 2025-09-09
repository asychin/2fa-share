const CACHE_NAME = 'totp-cache-v1'
const APP_SHELL = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Serve manifest with dynamic "name" based on localStorage mirrored via postMessage (best-effort fallback to default)
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match('/manifest.webmanifest')
        const text = cached ? await cached.text() : null
        let manifest
        if (text) {
          manifest = JSON.parse(text)
        } else {
          manifest = {
            name: 'TOTP Generator',
            short_name: 'TOTP',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            theme_color: '#0f172a',
            background_color: '#0b1220',
            icons: [ { src: '/vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' } ],
          }
        }
        // Attempt to read dynamic name from IndexedDB (mirrored by the app via MessageChannel)
        const clientList = await self.clients.matchAll({ type: 'window' })
        let dynamicName = null
        let dynamicShortName = null
        let dynamicTheme = null
        let dynamicBg = null
        for (const client of clientList) {
          try {
            const msgChan = new MessageChannel()
            const ask = new Promise((resolve) => {
              msgChan.port1.onmessage = (event) => resolve(event.data)
            })
            client.postMessage({ type: 'GET_PWA_METADATA' }, [msgChan.port2])
            const data = await Promise.race([ask, new Promise((r) => setTimeout(() => r(null), 50))])
            if (data && data.name) dynamicName = data.name
            if (data && data.shortName) dynamicShortName = data.shortName
            if (data && data.startUrl) manifest.start_url = data.startUrl
            if (data && data.themeColor) dynamicTheme = data.themeColor
            if (data && data.backgroundColor) dynamicBg = data.backgroundColor
          } catch {}
        }
        if (dynamicName) manifest.name = dynamicName
        if (dynamicShortName || dynamicName) manifest.short_name = dynamicShortName || dynamicName
        if (dynamicTheme) manifest.theme_color = dynamicTheme
        if (dynamicBg) manifest.background_color = dynamicBg
        const body = JSON.stringify(manifest)
        return new Response(body, { headers: { 'Content-Type': 'application/manifest+json' } })
      } catch {
        return fetch(request)
      }
    })())
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
      return response
    }).catch(() => cached))
  )
})

const CACHE_NAME = 'totp-cache-v1'
const APP_SHELL = ['/', '/index.html']
const LAUNCH_URL_KEY = '/__pwa_launch_url__'

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

// Receive launch URL from the app and persist it
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SET_PWA_LAUNCH_URL' && typeof data.url === 'string') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(LAUNCH_URL_KEY, new Response(data.url, { headers: { 'Content-Type': 'text/plain' } }))
      } catch {}
    })())
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Serve manifest dynamically (name, colors, start_url)
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      try {
        // Always fetch the base manifest from public
        let manifest
        try {
          const res = await fetch('/manifest.webmanifest', { cache: 'no-cache' })
          manifest = await res.json()
        } catch {
          manifest = { display: 'standalone', scope: '/', start_url: '/' }
        }
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

  // On initial navigation to scope root, redirect to saved launch URL if present
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        const saved = await cache.match(LAUNCH_URL_KEY)
        if (saved) {
          const launchUrl = await saved.text()
          if (launchUrl && url.href !== launchUrl) {
            return Response.redirect(launchUrl, 302)
          }
        }
      } catch {}
      try {
        return await fetch(request)
      } catch {
        return caches.match('/index.html')
      }
    })())
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

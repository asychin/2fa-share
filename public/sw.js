const CACHE_NAME = 'totp-cache-v3'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/logo.png', '/icons/favicon.ico']
const LAUNCH_URL_KEY = '/__pwa_launch_url__'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL)
      // Fetch current index.html and precache referenced JS/CSS assets
      const res = await fetch('/index.html', { cache: 'no-cache' })
      if (res.ok) {
        const html = await res.text()
        const assetUrls = new Set()
        const scriptRegex = /<script[^>]+src=\"([^\"]+)\"/g
        const linkRegex = /<link[^>]+href=\"([^\"]+)\"/g
        let m
        while ((m = scriptRegex.exec(html)) !== null) {
          const url = m[1]
          if (url.startsWith('/assets/')) assetUrls.add(url)
        }
        while ((m = linkRegex.exec(html)) !== null) {
          const url = m[1]
          if (url.startsWith('/assets/')) assetUrls.add(url)
        }
        if (assetUrls.size) {
          await cache.addAll(Array.from(assetUrls))
        }
      }
    } catch {}
    await self.skipWaiting()
  })())
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
  if (data.type === 'CLEAR_PWA_LAUNCH_URL') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.delete(LAUNCH_URL_KEY)
      } catch {}
    })())
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Serve the stored launch URL for the app to read at boot
  if (url.pathname === LAUNCH_URL_KEY) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        const res = await cache.match(LAUNCH_URL_KEY)
        if (res) return res
      } catch {}
      return new Response('', { status: 204 })
    })())
    return
  }

  // On navigation, serve network first with fallback to cache. Do NOT redirect.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request)
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  // Cache-first for static assets; otherwise network with runtime cache
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => (await caches.match(request)) || fetch(request))())
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

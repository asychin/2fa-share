const CACHE_NAME = 'totp-cache-v3'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/logo.png', '/icons/favicon.ico']
const LAUNCH_URL_KEY = '/__pwa_launch_url__'
const BASE_MANIFEST_KEY = '/__base_manifest__'
const NAME_KEY = '/__pwa_name__'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL)
      // Precache assets listed in index.html
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
      // Cache base manifest for later dynamic serving (avoid recursive fetch during intercept)
      try {
        const mres = await fetch('/manifest.webmanifest', { cache: 'no-cache' })
        if (mres.ok) {
          const text = await mres.text()
          await cache.put(BASE_MANIFEST_KEY, new Response(text, { headers: { 'Content-Type': 'application/manifest+json' } }))
        }
      } catch {}
    } catch {}
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

// Receive launch URL and app name from the app and persist it
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
  if (data.type === 'SET_PWA_NAME' && typeof data.name === 'string') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(NAME_KEY, new Response(data.name, { headers: { 'Content-Type': 'text/plain' } }))
      } catch {}
    })())
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Dynamic manifest: override start_url and name using stored values
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        const baseRes = await cache.match(BASE_MANIFEST_KEY)
        let manifest = {}
        if (baseRes) {
          try { manifest = await baseRes.json() } catch { manifest = {} }
        }
        // Read stored launch URL and name
        const launchRes = await cache.match(LAUNCH_URL_KEY)
        const nameRes = await cache.match(NAME_KEY)
        const startUrl = launchRes ? (await launchRes.text()).trim() : ''
        const name = nameRes ? (await nameRes.text()).trim() : ''
        if (startUrl) manifest.start_url = startUrl
        if (name) {
          manifest.name = name
          manifest.short_name = name
        }
        const body = JSON.stringify(manifest)
        return new Response(body, { headers: { 'Content-Type': 'application/manifest+json' } })
      } catch {
        // Fallback to network
        try { return await fetch(request) } catch { return new Response('{}', { headers: { 'Content-Type': 'application/manifest+json' } }) }
      }
    })())
    return
  }

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

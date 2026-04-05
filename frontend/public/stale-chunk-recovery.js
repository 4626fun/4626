;(() => {
  // Keep stale-chunk cache-busting internal and remove internal-only params from the visible URL.
  try {
    const INTERNAL_QUERY_KEYS = new Set(['_r'])
    const INTERNAL_QUERY_PREFIXES = ['_cv_', '__cv_']
    const cleanUrl = new URL(window.location.href)
    let changed = false
    for (const key of [...cleanUrl.searchParams.keys()]) {
      const isInternal =
        INTERNAL_QUERY_KEYS.has(key) || INTERNAL_QUERY_PREFIXES.some((prefix) => key.startsWith(prefix))
      if (!isInternal) continue
      cleanUrl.searchParams.delete(key)
      changed = true
    }
    if (changed) {
      const nextPath = `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`
      window.history.replaceState(window.history.state, '', nextPath)
    }
  } catch {
    // ignore
  }

  // Stale-chunk recovery:
  // When a user has an old cached HTML that references old hashed assets, module imports can fail with
  // "Expected a JavaScript module but got text/html" (because the SPA fallback serves index.html).
  // Reload once with a cache-buster so the browser fetches the latest HTML + asset graph.
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return

  const KEY = 'cv:reload-on-chunk-fail:v1'
  function reloadOnce() {
    try {
      if (sessionStorage.getItem(KEY)) return
      sessionStorage.setItem(KEY, '1')
    } catch {
      // ignore
    }

    try {
      const url = new URL(window.location.href)
      url.searchParams.set('_r', Date.now().toString(36))
      window.location.replace(url.toString())
    } catch {
      window.location.reload()
    }
  }

  // Vite dispatches this event when modulepreload fails.
  window.addEventListener('vite:preloadError', () => reloadOnce())

  // Generic safety net for browsers that don't emit the preload event.
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String((event && event.reason && (event.reason.message || event.reason)) || '')
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Expected a JavaScript-or-Wasm module script')
    ) {
      reloadOnce()
    }
  })
})()

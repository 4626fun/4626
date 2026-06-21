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

  function isLikelyStaleStylesheetLink(link) {
    if (!link || typeof link !== 'object') return false
    const rel = String(link.rel || '').toLowerCase()
    if (rel !== 'stylesheet') return false
    const href = String(link.href || '').toLowerCase()
    if (!href) return false
    return href.includes('/assets/') && href.endsWith('.css')
  }

  function maybeRecoverFromStylesheetFailure(target) {
    const link = target instanceof HTMLLinkElement ? target : null
    if (!link || !isLikelyStaleStylesheetLink(link)) return false
    reloadOnce()
    return true
  }

  function verifyStylesheetLoadState() {
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    for (const link of links) {
      if (!(link instanceof HTMLLinkElement)) continue
      if (!isLikelyStaleStylesheetLink(link)) continue
      // If the browser could not parse the stylesheet (e.g. stale hashed css
      // path served index.html as text/html), sheet stays null.
      if (!link.sheet) {
        reloadOnce()
        return
      }
    }
  }

  // Vite dispatches this event when modulepreload fails.
  window.addEventListener('vite:preloadError', () => reloadOnce())

  // Handle stale hashed CSS URLs that return HTML and trigger MIME errors.
  window.addEventListener(
    'error',
    (event) => {
      if (maybeRecoverFromStylesheetFailure(event.target)) return
      const msg = String(event?.message || '')
      if (msg.includes('Refused to apply style') && msg.includes("MIME type ('text/html')")) {
        reloadOnce()
      }
    },
    true,
  )

  window.addEventListener('load', () => {
    // Run after initial load so link.sheet has settled.
    setTimeout(verifyStylesheetLoadState, 0)
  })

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

/**
 * Absolute earliest bootstrap for the Hermit Railway service.
 *
 * This file exists ONLY to start a minimal HTTP listener BEFORE any other
 * modules are evaluated. The real application (index.ts) is loaded via
 * dynamic import AFTER the listener is bound.
 *
 * This guarantees that Railway always sees a response on /healthz even if
 * later static imports (chatBridge, privyTokenRefresher, command surface,
 * room1659Market, getDb, alfaclub stores, etc.) throw synchronously during
 * module evaluation.
 */

import http from 'node:http'

import { registerEarlyHealthServer } from './healthHandoff.js'

// Emit as early as possible after the http import (imports are hoisted, so this is one of the first executable lines).
console.error('[hermit-bootstrap] bootstrap.ts module evaluation started');
console.error(`[hermit-bootstrap] PORT from env: ${process.env.PORT || 'undefined (will default to 8080)'}`);
console.error(`[hermit-bootstrap] Node version: ${process.version}`);

const PORT = Number(process.env.PORT ?? '8080') || 8080

const server = http.createServer((req, res) => {
  const method = String(req.method ?? 'GET').toUpperCase()
  const url = (req.url ?? '/').split('?')[0]

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  if (url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('User-agent: *\nDisallow: /\n')
    return
  }

  if (url !== '/healthz' && url !== '/readyz') {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found')
    return
  }

  // /healthz is liveness — Railway treats non-2xx as "service unavailable".
  // /readyz stays 503 until index.ts replaces this listener after module load.
  const ready = url === '/readyz'
  res.writeHead(ready ? 503 : 200, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
  })

  res.end(
    JSON.stringify({
      ok: !ready,
      service: 'hermit-alfaclub',
      probe: url,
      status: ready ? 'early-bootstrap-not-ready' : 'early-bootstrap',
      message: ready
        ? 'Main Hermit module is still evaluating.'
        : 'Process is alive; main Hermit module is still evaluating.',
      tip: 'Run pnpm agent:railway-hermit-doctor locally with the same env.',
    }),
  )
})

registerEarlyHealthServer(server)

server.listen(PORT, '0.0.0.0', () => {
  // Use console.error so it appears even if stdout is buffered differently.
  console.error(`[hermit-bootstrap] minimal listener active on port ${PORT}`)
})

// Now load the real application. All heavy imports happen after the listener is bound.
import('./index.ts').catch((err) => {
  console.error('[hermit-bootstrap] FATAL: failed to load main index.ts after listener was bound')
  console.error(err)
  // We keep the server running so Railway can still hit /healthz and see the error.
  // The process will likely be restarted by Railway anyway.
})
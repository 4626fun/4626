/**
 * Absolute earliest bootstrap for the Railway XMTP Keepr (Eliza) service.
 *
 * Starts a minimal HTTP listener BEFORE any other modules are evaluated.
 * The real application (index.ts) loads via dynamic import after the listener binds.
 *
 * Static imports in index.ts (plugins, _lib, @4626/server-core) can throw during
 * module evaluation; without this bootstrap Railway sees "service unavailable" on
 * /healthz for the entire healthcheck window.
 */

import http from 'node:http'

import { registerEarlyHealthServer } from '../hermit/healthHandoff.js'

console.error('[eliza-bootstrap] bootstrap.ts module evaluation started')
console.error(`[eliza-bootstrap] PORT from env: ${process.env.PORT || 'undefined (will default to 8080)'}`)
console.error(`[eliza-bootstrap] Node version: ${process.version}`)

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
    res.end('User-agent: *\nDisallow: /\nAllow: /healthz\nAllow: /readyz\n')
    return
  }

  if (url !== '/healthz' && url !== '/readyz' && url !== '/health' && url !== '/') {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found')
    return
  }

  const ready = url === '/readyz'
  res.writeHead(ready ? 503 : 200, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
  })

  res.end(
    JSON.stringify({
      ok: !ready,
      service: '4626-keepr-agent',
      probe: url,
      status: ready ? 'early-bootstrap-not-ready' : 'early-bootstrap',
      message: ready
        ? 'Main Eliza module is still evaluating.'
        : 'Process is alive; main Eliza module is still evaluating.',
      tip: 'Run pnpm agent:railway-keepr-doctor locally with the same env.',
    }),
  )
})

registerEarlyHealthServer(server)

server.listen(PORT, '0.0.0.0', () => {
  console.error(`[eliza-bootstrap] minimal listener active on port ${PORT}`)
})

import('./index.ts').catch((err) => {
  console.error('[eliza-bootstrap] FATAL: failed to load main index.ts after listener was bound')
  console.error(err)
})

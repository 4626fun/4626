#!/usr/bin/env node
/**
 * Minimal Railway health listener for Shovel worker.
 * GET /health → 200 when shovel-main is running, 503 otherwise.
 */
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'

const port = Number(process.env.PORT ?? '8080')

function shovelRunning() {
  const result = spawnSync('pgrep', ['-f', 'shovel-main -config'], { encoding: 'utf8' })
  return result.status === 0
}

const server = createServer((req, res) => {
  if (req.url !== '/health' && req.url !== '/healthz') {
    res.writeHead(404)
    res.end('not found')
    return
  }
  if (shovelRunning()) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(503, { 'Content-Type': 'text/plain' })
  res.end('shovel not running')
})

server.listen(port, '0.0.0.0', () => {
  console.error(`[shovel-health] listening on :${port}`)
})

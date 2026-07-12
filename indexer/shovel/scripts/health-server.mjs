#!/usr/bin/env node
/**
 * Railway health + continuous-readiness listener for Shovel worker.
 *
 * GET /health|/healthz → deploy readiness (process up). Railway only probes this
 * at deploy time and does NOT continuously restart on later 503s.
 *
 * GET /ready → lag-aware continuous monitoring (process + slowest live cursor vs
 * chain tip). Use this with an external uptime check / private networking.
 *
 * Cursor tip uses MIN(MAX(src_num) per enabled integration) — shovel.task_updates
 * is append-only history, so bare MIN(src_num) is wrong.
 */
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSlowestCursorTipSql,
  interpretSlowestCursorTip,
} from './shovel-cursor-tip.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const port = Number(process.env.PORT ?? '8080')
const maxLagBlocks = Number(process.env.SHOVEL_HEALTH_MAX_LAG_BLOCKS ?? '256')
const warmupMs = Number(process.env.SHOVEL_HEALTH_WARMUP_MS ?? String(3 * 60 * 1000))
const statusLogMs = Number(process.env.SHOVEL_STATUS_LOG_MS ?? String(60_000))
const startedAt = Date.now()

/** @type {string[] | null} */
let cachedEnabledIntegrations = null

function shovelRunning() {
  const result = spawnSync('pgrep', ['-f', 'shovel-main -config'], { encoding: 'utf8' })
  return result.status === 0
}

function loadEnabledIntegrations() {
  if (cachedEnabledIntegrations) return cachedEnabledIntegrations
  const configPath = join(ROOT, 'config.generated.json')
  if (!existsSync(configPath)) {
    cachedEnabledIntegrations = []
    return cachedEnabledIntegrations
  }
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    const integrations = Array.isArray(config.integrations) ? config.integrations : []
    cachedEnabledIntegrations = integrations
      .filter((ig) => ig && ig.enabled !== false && typeof ig.name === 'string')
      .map((ig) => ig.name)
  } catch {
    cachedEnabledIntegrations = []
  }
  return cachedEnabledIntegrations
}

function rpcUrl() {
  return (process.env.BASE_LOGS_RPC_URL || process.env.BASE_RPC_URL || '').trim()
}

function pgUrl() {
  return (process.env.SHOVEL_PG_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim()
}

/**
 * @returns {Promise<number | null>}
 */
async function fetchChainTip() {
  const url = rpcUrl()
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const body = await res.json()
    const hex = body?.result
    if (typeof hex !== 'string' || !hex.startsWith('0x')) return null
    return Number.parseInt(hex, 16)
  } catch {
    return null
  }
}

/**
 * @param {string[]} igNames
 * @returns {{ ok: boolean, tip: number | null, missing: string[], detail: string }}
 */
function queryIndexTip(igNames) {
  const url = pgUrl()
  if (!url || igNames.length === 0) {
    return { ok: true, tip: null, missing: [], detail: 'lag check skipped (no pg or no enabled integrations)' }
  }
  if (!commandExists('psql')) {
    return { ok: true, tip: null, missing: [], detail: 'lag check skipped (psql unavailable)' }
  }

  let sql
  try {
    sql = buildSlowestCursorTipSql(igNames)
  } catch (err) {
    return {
      ok: false,
      tip: null,
      missing: igNames,
      detail: `invalid integration names: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-tAc', sql], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  if (result.status !== 0) {
    return {
      ok: false,
      tip: null,
      missing: igNames,
      detail: `psql failed: ${(result.stderr || result.stdout || '').trim().slice(0, 200)}`,
    }
  }

  const line = (result.stdout || '').trim().split('\n').filter(Boolean).pop() || ''
  // tip|present|missing
  const [tipRaw, presentRaw = '0', missingRaw = ''] = line.split('|')
  return interpretSlowestCursorTip({ tipRaw, presentRaw, missingRaw }, igNames.length)
}

function commandExists(bin) {
  const result = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' })
  return result.status === 0
}

/**
 * Deploy readiness only — Railway healthchecks stop after traffic switch.
 * @returns {{ healthy: boolean, body: string }}
 */
function evaluateDeployHealth() {
  if (!shovelRunning()) {
    return { healthy: false, body: 'shovel not running' }
  }
  return { healthy: true, body: 'ok' }
}

/**
 * Continuous readiness — lag-aware; for external monitors / operators.
 * @returns {Promise<{ healthy: boolean, body: string }>}
 */
async function evaluateReady() {
  if (!shovelRunning()) {
    return { healthy: false, body: 'shovel not running' }
  }

  const inWarmup = Date.now() - startedAt < warmupMs
  const enabled = loadEnabledIntegrations()
  const index = queryIndexTip(enabled)

  if (!index.ok) {
    if (inWarmup) {
      return {
        healthy: true,
        body: `ok (warmup; ${index.detail})`,
      }
    }
    return { healthy: false, body: index.detail }
  }

  if (index.tip == null) {
    return { healthy: true, body: `ok (${index.detail})` }
  }

  const chainTip = await fetchChainTip()
  if (chainTip == null) {
    // Process up + index tip present; RPC tip optional so a transient RPC blip
    // does not flap continuous monitors during probe outages.
    return { healthy: true, body: `ok (${index.detail}; chain tip unavailable)` }
  }

  const lag = chainTip - index.tip
  if (lag > maxLagBlocks) {
    if (inWarmup) {
      return {
        healthy: true,
        body: `ok (warmup; lag=${lag} tip=${index.tip} chain=${chainTip})`,
      }
    }
    return {
      healthy: false,
      body: `index lag ${lag} blocks exceeds max ${maxLagBlocks} (tip=${index.tip} chain=${chainTip})`,
    }
  }

  return {
    healthy: true,
    body: `ok tip=${index.tip} chain=${chainTip} lag=${lag}`,
  }
}

async function logStatusTick() {
  try {
    const ready = await evaluateReady()
    console.error(`[shovel-status] ${ready.healthy ? 'ready' : 'not-ready'} ${ready.body}`)
  } catch (err) {
    console.error(
      `[shovel-status] error ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

const server = createServer((req, res) => {
  const path = (req.url || '').split('?')[0]

  if (path === '/health' || path === '/healthz') {
    const { healthy, body } = evaluateDeployHealth()
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'text/plain' })
    res.end(body)
    return
  }

  if (path === '/ready') {
    evaluateReady()
      .then(({ healthy, body }) => {
        res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'text/plain' })
        res.end(body)
      })
      .catch((err) => {
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.end(`ready error: ${err instanceof Error ? err.message : String(err)}`)
      })
    return
  }

  res.writeHead(404)
  res.end('not found')
})

server.listen(port, '0.0.0.0', () => {
  console.error(
    `[shovel-health] listening on :${port} maxLag=${maxLagBlocks} warmupMs=${warmupMs} statusLogMs=${statusLogMs}`,
  )
  console.error(
    '[shovel-health] /health = deploy readiness (process); /ready = continuous lag monitor',
  )
  if (Number.isFinite(statusLogMs) && statusLogMs > 0) {
    void logStatusTick()
    setInterval(() => {
      void logStatusTick()
    }, statusLogMs)
  }
})

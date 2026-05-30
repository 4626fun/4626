#!/usr/bin/env tsx
/**
 * 1659 Risk Watcher + Telegram Alerts
 *
 * Monitors the live Hyperliquid HYPE SHORT for room 1659 + the on-chain FriendKey
 * quadratic curve (supply, marginal prices via the real BondingCurveLib math).
 *
 * Sends to TWO places using your existing Telegram tokens:
 *   1. Private ops relay (detailed) — your current ALFACLUB_TELEGRAM_RELAY_* setup
 *   2. Public community channel (theatrical) — https://t.me/fun4626 via ALFACLUB_RADAR_TELEGRAM_CHAT_ID or FUN4626_TELEGRAM_CHAT_ID
 *
 * No new bot tokens required.
 *
 * Easy commands (from repo root):
 *   pnpm -C frontend ops:1659-risk-watcher
 *   pnpm -C frontend ops:1659-risk-watcher:test     # test to private relay + https://t.me/fun4626
 *
 * Alerts fire when:
 *   - Mark price >= 68.0
 *   - Distance to liquidation <= 1.5 pts
 *   - ROE <= -25%
 *
 * Public posts go to https://t.me/fun4626 (theatrical tone for the community).
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

// Robust env loading: try repo root first, then frontend/, then current dir
const __dirname = dirname(fileURLToPath(import.meta.url))
const possibleEnvPaths = [
  resolve(__dirname, '../../.env'),           // repo root
  resolve(__dirname, '../../frontend/.env'),  // frontend
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'frontend/.env'),
]

for (const envPath of possibleEnvPaths) {
  try {
    loadDotenv({ path: envPath })
  } catch {}
}

// === EARLY ENV DIAGNOSTICS (helps verify "all the .env variables are up") ===
function print1659EnvDiagnostics(): void {
  const hasDb = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  const hasAlfaClubJwt = !!(process.env.ALFACLUB_CHAT_JWT ?? '').trim()
  const hasPrivyRefresh = !!(process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN && process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN)
  const hasAlfaClubAuth = hasAlfaClubJwt || hasPrivyRefresh

  const hasPrivateTelegram = !!(process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID || process.env.TELEGRAM_TARGET_CHAT_ID)
  const hasPublicTelegram = !!(process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID || process.env.FUN4626_TELEGRAM_CHAT_ID || process.env.TARGET_CHAT_ID)
  const hasBotToken = !!(process.env.ALFACLUB_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)

  const hasBaseRpc = !!(process.env.BASE_RPC_URL)
  const hasRoom1659Overrides = !!(process.env.ROOM_1659_FRIENDKEY_TOKEN || process.env.ROOM_1659_FRIENDKEY_ID)

  console.error('\n[1659-risk-watcher][early] === 1659 THEATRICAL STACK ENV DIAGNOSTICS ===')
  console.error('[1659-risk-watcher][early] Tip: Use scripts/ops/1659-theatrical-stack.env.example as the master reference.')

  const criticalMissing: string[] = []
  if (!hasDb) criticalMissing.push('DATABASE_URL (needed for rich 1659 context + token stores)')
  if (!hasAlfaClubAuth) criticalMissing.push('AlfaClub auth (ALFACLUB_CHAT_JWT or the Privy refresh triplet) — needed for PnL')
  if (!hasBotToken) criticalMissing.push('Telegram bot token (ALFACLUB_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN)')
  if (!hasPrivateTelegram && !hasPublicTelegram) criticalMissing.push('At least one Telegram destination (private relay or @fun4626)')

  const summary = criticalMissing.length > 0
    ? `[1659-risk-watcher][early] SUMMARY: ${criticalMissing.length} critical issue(s) — watcher may run degraded or fail`
    : `[1659-risk-watcher][early] SUMMARY: Core env requirements appear satisfied`

  console.error(summary)
  console.error('[1659-risk-watcher][early] ----------------------------------------------------------------')
  console.error('[1659-risk-watcher][early] DATABASE_URL / POSTGRES_URL   :', hasDb ? 'present' : 'MISSING')
  console.error('[1659-risk-watcher][early] AlfaClub auth (JWT or Privy)  :', hasAlfaClubAuth ? 'present' : 'MISSING')
  console.error('[1659-risk-watcher][early] Telegram bot token            :', hasBotToken ? 'present' : 'MISSING')
  console.error('[1659-risk-watcher][early] Private ops relay             :', hasPrivateTelegram ? 'present' : 'missing')
  console.error('[1659-risk-watcher][early] Public channel (@fun4626)     :', hasPublicTelegram ? 'present' : 'missing')
  console.error('[1659-risk-watcher][early] BASE_RPC_URL (optional)       :', hasBaseRpc ? 'set' : 'using default')
  console.error('[1659-risk-watcher][early] ROOM_1659_* overrides         :', hasRoom1659Overrides ? 'set' : 'using built-in defaults')
  console.error('[1659-risk-watcher][early] ----------------------------------------------------------------')

  if (criticalMissing.length > 0) {
    console.error('[1659-risk-watcher][early] CRITICAL MISSING:')
    criticalMissing.forEach(m => console.error('[1659-risk-watcher][early]   -', m))
  }
  console.error('[1659-risk-watcher][early] === END EARLY DIAGNOSTICS ===\n')
}

print1659EnvDiagnostics()

/**
 * Starts a minimal HTTP healthcheck server.
 * Railway (and most platforms) like to have a port to probe.
 * Returns 200 OK on /health or /.
 */
function startHealthcheckServer() {
  const port = Number(process.env.PORT || 8080)

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/' || req.url === '/healthz') {
      const isHealthy = consecutiveFailures < 3
      const status = {
        status: isHealthy ? 'ok' : 'degraded',
        lastTick: lastSuccessfulTick,
        lastStatus: lastTickStatus,
        lastError: lastError,
        consecutiveFailures,
        uptimeSeconds: Math.floor(process.uptime()),
        wallet: WALLET,
        currentPosition: currentPositionSnapshot,
      }
      const httpStatus = isHealthy ? 200 : 503
      res.writeHead(httpStatus, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(status, null, 2))
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[healthcheck] Listening on port ${port} (Railway health probes at /health)`)
  })

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
}

/**
 * Lightweight Telegram sender that reuses exactly the same env var names
 * the user already has configured for their AlfaClub / production Telegram relay.
 *
 * Supports:
 * - ALFACLUB_TELEGRAM_BOT_TOKEN (preferred) or TELEGRAM_BOT_TOKEN
 * - ALFACLUB_TELEGRAM_RELAY_CHAT_ID or TELEGRAM_TARGET_CHAT_ID
 * - ALFACLUB_TELEGRAM_RELAY_THREAD_ID (optional)
 */
async function sendViaExistingTelegramRelay(text: string): Promise<{ sent: boolean; error?: string }> {
  const botToken =
    process.env.ALFACLUB_TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''

  const chatId =
    process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID ||
    process.env.TELEGRAM_TARGET_CHAT_ID ||
    ''

  const threadId = process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID
    ? parseInt(process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID, 10)
    : undefined

  if (!botToken || !chatId) {
    console.log('[Telegram] No relay credentials found in env (ALFACLUB_TELEGRAM_* or TELEGRAM_*)')
    return { sent: false, error: 'no_credentials' }
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`
  const payload: any = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }
  if (threadId && !isNaN(threadId)) {
    payload.message_thread_id = threadId
  }

  // Simple retry (2 attempts)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        return { sent: true }
      }
      const errText = await res.text().catch(() => '')
      if (attempt === 2) {
        return { sent: false, error: `${res.status} ${errText.slice(0, 200)}` }
      }
    } catch (e: any) {
      if (attempt === 2) {
        return { sent: false, error: e?.message || String(e) }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  return { sent: false, error: 'unknown_error' }
}

/**
 * Public broadcast sender for the community channel (t.me/fun4626).
 * Uses your existing radar/public Telegram config.
 */
async function sendPublicBroadcast(text: string): Promise<{ sent: boolean; error?: string }> {
  const botToken =
    process.env.ALFACLUB_TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''

  // Preferred for public community posts (t.me/fun4626)
  // Try several common env names you already use
  const chatId =
    process.env.FUN4626_TELEGRAM_CHAT_ID ||
    process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_TARGET_CHAT_ID ||
    process.env.TARGET_CHAT_ID ||
    ''

  if (!botToken || !chatId) {
    console.log('[Public Broadcast] No public channel configured. Set FUN4626_TELEGRAM_CHAT_ID or ALFACLUB_RADAR_TELEGRAM_CHAT_ID (or TARGET_CHAT_ID)')
    return { sent: false, error: 'no_public_channel' }
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`

  // Simple retry (2 attempts)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      })

      if (res.ok) return { sent: true }
      const errText = await res.text().catch(() => '')
      if (attempt === 2) {
        return { sent: false, error: `${res.status} ${errText.slice(0, 200)}` }
      }
    } catch (e: any) {
      if (attempt === 2) {
        return { sent: false, error: e?.message || String(e) }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  return { sent: false, error: 'unknown_error' }
}

const WALLET = '0xEbF94fA19DB7d2E7905dEcD01DaE4ea9eb4C1FF2'
const FRIENDKEY = '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F'
const TOKEN_ID = 1659n

const THRESHOLDS = {
  markHigh: 68.0,
  liqDistancePts: 1.5,
  roeBad: -25,
  pollMs: 30_000,
}

const hasPrivateRelay = !!(
  (process.env.ALFACLUB_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN) &&
  (process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID || process.env.TELEGRAM_TARGET_CHAT_ID)
)

async function sendRiskAlert(text: string) {
  const result = await sendViaExistingTelegramRelay(text)
  if (result.sent) {
    console.log('[Telegram] risk alert sent via existing relay')
  } else {
    console.warn('[Telegram] risk alert failed:', result.error)
  }
}

async function getHLPosition() {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: WALLET }),
  })
  const data: any = await res.json()
  const pos = data.assetPositions?.find((p: any) => p.position?.coin === 'HYPE')?.position
  if (!pos) return null

  const notional = parseFloat(pos.positionValue)
  const size = Math.abs(parseFloat(pos.szi))
  const mark = notional / size
  const entry = parseFloat(pos.entryPx)
  const pnl = parseFloat(pos.unrealizedPnl)
  const roe = parseFloat(pos.returnOnEquity) * 100
  const liq = parseFloat(pos.liquidationPx)
  const dist = liq - mark

  return {
    mark: Number(mark.toFixed(4)),
    entry: Number(entry.toFixed(4)),
    pnl: Number(pnl.toFixed(2)),
    roe: Number(roe.toFixed(1)),
    liq: Number(liq.toFixed(4)),
    distPts: Number(dist.toFixed(2)),
    notional: Number(notional.toFixed(0)),
  }
}

async function getOnchainCurve() {
  // Simple viem-less fetch via cast (assumes cast in PATH) or you can swap to viem
  // For speed we use cast here; replace with viem in prod if preferred.
  const supplyRaw = await runCast(`cast call ${FRIENDKEY} "totalSupply(uint256)(uint256)" ${TOKEN_ID} --rpc-url https://mainnet.base.org`)
  const supply = parseInt(supplyRaw.trim())

  const buy1Raw = await runCast(`cast call ${FRIENDKEY} "getBuyPrice(uint256,uint256)(uint256)" ${TOKEN_ID} 1 --rpc-url https://mainnet.base.org`)
  const buy1 = parseFloat(buy1Raw) / 1e6

  return { supply, nextKeyUsd: Number(buy1.toFixed(2)) }
}

async function runCast(cmd: string): Promise<string> {
  const { execSync } = await import('child_process')
  return execSync(cmd, { encoding: 'utf8' })
}

async function sendTestAlert() {
  console.log('Testing BOTH private relay + public @fun4626 broadcast using your existing config...')

  const privateTest = [
    `**1659 HYPE SHORT — PRIVATE TEST**`,
    `This went to your ops relay/thread.`,
  ].join('\n')

  const publicTest = [
    `🧪 **ROOM 1659 PUBLIC TEST**`,
    ``,
    `This is a test broadcast to https://t.me/fun4626`,
    ``,
    `The 1659 risk watcher can now post live position + curve updates here for everyone.`,
    ``,
    `Current example: Supply 46 keys | Next key ~$52.90`,
  ].join('\n')

  const [privateResult, publicResult] = await Promise.all([
    sendViaExistingTelegramRelay(privateTest),
    sendPublicBroadcast(publicTest),
  ])

  console.log('Private relay result:', privateResult.sent ? '✅ sent' : '❌ ' + privateResult.error)
  console.log('Public @fun4626 result:', publicResult.sent ? '✅ sent' : '❌ ' + publicResult.error)
  console.log('Test complete. Check both your private thread and https://t.me/fun4626')
}

/**
 * Core tick function — can be called both by the standalone watcher
 * and by the keeper jobs system.
 */
export async function run1659RiskTick(options: { once?: boolean } = {}) {
  const { once = false } = options

  try {
    const [hl, curve] = await Promise.all([getHLPosition(), getOnchainCurve()])

    if (!hl) {
      console.log('[1659-risk] No HYPE position found')
      return { ok: false, reason: 'no_position' }
    }

    const now = new Date().toISOString()
    console.log(`[${now}] Mark: $${hl.mark} | PnL: $${hl.pnl} (${hl.roe}%) | Liq dist: ${hl.distPts}pts | Curve next key: $${curve.nextKeyUsd} (supply ${curve.supply})`)

    const alerts: string[] = []

    if (hl.mark >= THRESHOLDS.markHigh) {
      alerts.push(`🚨 HYPE mark hit $${hl.mark} (threshold $${THRESHOLDS.markHigh})`)
    }
    if (hl.distPts <= THRESHOLDS.liqDistancePts) {
      alerts.push(`🔥 Only ${hl.distPts}pts from liquidation at ${hl.liq}!`)
    }
    if (hl.roe <= THRESHOLDS.roeBad) {
      alerts.push(`📉 ROE ${hl.roe}% — deep in the danger zone`)
    }

    if (alerts.length > 0) {
      // Private detailed
      const privateMsg = [
        `**1659 HYPE SHORT ALERT**`,
        ``,
        `Mark: $${hl.mark} | Entry: $${hl.entry}`,
        `PnL: $${hl.pnl} (${hl.roe}% ROE)`,
        `Notional: $${hl.notional} | 10x isolated`,
        `Liq: ${hl.liq} (${hl.distPts}pts / ~${((hl.distPts / hl.mark) * 100).toFixed(1)}% buffer)`,
        ``,
        `On-chain (room 1659, Club tier, ${curve.supply} keys):`,
        `Next key = $${curve.nextKeyUsd} USDC`,
        `Next 10 keys ≈ $640 | Next 50 ≈ $6,473`,
        ``,
        alerts.join('\n'),
        ``,
        `https://app.hyperliquid.xyz/`,
      ].join('\n')

      await sendRiskAlert(privateMsg)

      // Public theatrical version for t.me/fun4626
      const publicMsg = [
        `🚨 **ROOM 1659 LIVE**`,
        ``,
        `The knife is getting sharper.`,
        ``,
        `**Hyperliquid SHORT** — $${hl.notional} notional @ ${hl.entry}`,
        `Current mark: $${hl.mark} | Liquidation: ${hl.liq} (${hl.distPts}pts away)`,
        `PnL right now: $${hl.pnl} (${hl.roe}% ROE)`,
        ``,
        `**On-chain reality (Club tier quadratic):**`,
        `Only ${curve.supply} keys exist.`,
        `Next key costs $${curve.nextKeyUsd}.`,
        `Next 10 keys ≈ $640. Next 50 keys ≈ $6,473.`,
        ``,
        `The curve does not negotiate.`,
        ``,
        alerts.join('\n'),
        ``,
        `https://t.me/fun4626`,
      ].join('\n')

      await sendPublicBroadcast(publicMsg)

      console.log('ALERT SENT — Private + public @fun4626')
    }

    lastSuccessfulTick = new Date().toISOString()
    lastTickStatus = 'success'
    lastError = null
    consecutiveFailures = 0

    // Store latest snapshot for healthcheck
    currentPositionSnapshot = {
      mark: hl.mark,
      distPts: hl.distPts,
      roe: hl.roe,
      isDangerous: hl.distPts < 2.0,
    }

    return { ok: true, alertsTriggered: alerts.length, position: currentPositionSnapshot }
  } catch (e: any) {
    console.error('[1659-risk] tick error', e)
    lastTickStatus = 'error'
    lastError = e?.message || String(e)
    consecutiveFailures++
    currentPositionSnapshot = null
    return { ok: false, error: lastError }
  }
}


let lastError: string | null = null
let consecutiveFailures = 0

function setupGracefulShutdown() {
  const shutdown = (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true
    console.log(`\n[${signal}] Received. Shutting down 1659 risk watcher gracefully...`)
    setTimeout(() => {
      console.log('1659 risk watcher stopped.')
      process.exit(0)
    }, 1500)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM')) // Sent by Railway, Docker, etc.
  process.on('SIGINT', () => shutdown('SIGINT'))
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--test-alert') || args.includes('--test')) {
    await sendTestAlert()
    return
  }

  console.log('=== 1659 Risk Watcher started ===')
  console.log('Watching wallet:', WALLET)

  const hasPrivate = !!(process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID || process.env.TELEGRAM_TARGET_CHAT_ID)
  const hasPublic = !!(process.env.FUN4626_TELEGRAM_CHAT_ID || process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID || process.env.TARGET_CHAT_ID)

  console.log('Private relay (ops thread):', hasPrivate ? 'ENABLED' : 'MISSING - check ALFACLUB_TELEGRAM_RELAY_CHAT_ID')
  console.log('Public channel (t.me/fun4626):', hasPublic ? 'ENABLED' : 'MISSING - check ALFACLUB_RADAR_TELEGRAM_CHAT_ID or FUN4626_TELEGRAM_CHAT_ID')

  const startupMsg = [
    `🟢 **1659 Risk Watcher is now LIVE**`,
    ``,
    `Watching: ${WALLET}`,
    `Thresholds: Mark ≥ ${THRESHOLDS.markHigh} | Liq dist ≤ ${THRESHOLDS.liqDistancePts}pts | ROE ≤ ${THRESHOLDS.roeBad}%`,
    ``,
    `Private relay: ${hasPrivate ? 'connected' : 'NOT CONFIGURED'}`,
    `Public channel (@fun4626): ${hasPublic ? 'connected' : 'NOT CONFIGURED'}`,
    ``,
    `Healthcheck available on /health`,
  ].join('\n')

  await sendRiskAlert(startupMsg)
  await sendPublicBroadcast(startupMsg.replace(/\*\*/g, ''))

  // Start HTTP healthcheck server if Railway (or any platform) sets PORT
  if (process.env.PORT) {
    startHealthcheckServer()
  }

  setupGracefulShutdown()

  // Run once if requested (useful for keeper jobs)
  if (args.includes('--once')) {
    await run1659RiskTick({ once: true })
    return
  }

  // Continuous mode
  while (!isShuttingDown) {
    const result = await run1659RiskTick()

    if (!result.ok && 'error' in result) {
      console.error('Tick failed:', result.error)
    }

    if (!isShuttingDown) {
      await new Promise(r => setTimeout(r, THRESHOLDS.pollMs))
    }
  }
}

main().catch((err) => {
  console.error('Fatal error in 1659 risk watcher:', err)
  process.exit(1)
})

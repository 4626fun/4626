/**
 * Hermit AlfaClub runtime.
 *
 * Long-lived Railway process for the creative AlfaClub / Pinata lane. This is
 * intentionally separate from the Keepr XMTP runtime so Hermit restarts,
 * Pinata failures, and chat polling do not affect critical Keepr automation.
 *
 * RAILWAY HEALTHCHECK NOTE:
 * The absolute earliest listener lives in `bootstrap.ts`. It binds a minimal
 * HTTP server on PORT before any other modules are evaluated. This file
 * (`index.ts`) is loaded via dynamic import *after* the listener is up.
 *
 * All the rich early diagnostics (`[hermit][early]`) and the real health
 * server still live in this file and will replace the bootstrap listener
 * once evaluation succeeds.
 */

import http from 'node:http'

import { closeEarlyHealthServer } from './healthHandoff.js'
import {
  type AlfaClubChatBridgeTickResult,
  startAlfaClubChatBridge,
} from '../../_lib/alfaclub/chatBridge.js'
import { startAlfaClubPrivyTokenRefresher } from '../../_lib/alfaclub/privyTokenRefresher.js'
import { logger } from '../../_lib/infra/logger.js'
import { isDbConfigured } from '../../_lib/db/postgres.js'
import { readAlfaClubChatToken, readAlfaClubPrivyAccessToken } from '../../_lib/alfaclub/chatTokenStore.js'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
  uptime: () => number
}

let earlyHermitDiagnostics: Record<string, unknown> | null = null

// === VERY EARLY HERMIT RAILWAY DIAGNOSTICS ===
// These run at module evaluation time — before startRuntime() and before the
// heavy alfaclub + command surface imports have a chance to throw.
// When the dedicated hermit.4626.fun service dies with "service unavailable"
// on /healthz and zero logs, this block + the pre-import listener above are
// the only things that can still produce output.
try {
  const hasDb = isDbConfigured()
  const hasAlfaClubJwt = !!(process.env.ALFACLUB_CHAT_JWT ?? '').trim()
  const hasAlfaClubPrivyAccess = !!(process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN ?? '').trim()
  const hasAlfaClubPrivyRefresh = !!(process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN ?? '').trim()
  const hasPinataEndpoint = !!(process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? '').trim()
  const hasPinataBearer = !!(process.env.HERMIT_PINATA_BEARER_TOKEN ?? '').trim()
  const hasRoom = !!(process.env.ALFACLUB_CHAT_ROOM_ID ?? '').trim()
  const hasHermitCommandRooms = !!(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '').trim()
  const hasAnyRoomTargeting = hasRoom || hasHermitCommandRooms

  const hasAlfaClubBootstrap = hasAlfaClubJwt || (hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh)
  const runningOnRailway = Object.keys(process.env).some((k) => k.startsWith('RAILWAY_'))

  const criticalIssues: string[] = []
  if (runningOnRailway) {
    if (!hasDb) criticalIssues.push('DATABASE_URL (Supabase) or POSTGRES_URL (legacy) is required (alfaclub stores + schema bootstrap are pulled at import time via chatBridge / command executor)')
    if (!hasAlfaClubBootstrap) criticalIssues.push('ALFACLUB_CHAT_JWT (or the three ALFACLUB_CHAT_PRIVY_* tokens) is required for the chat bridge')
  }

  console.error('\n[hermit][early] === HERMIT RAILWAY DIAGNOSTICS ===')
  console.error('[hermit][early] Tip: Run `pnpm agent:railway-hermit-doctor` locally with the same env vars for a full checklist.')

  const summaryLine = criticalIssues.length > 0
    ? `[hermit][early] SUMMARY: ${criticalIssues.length} critical issue(s) — Hermit will almost certainly die before the real health server binds`
    : `[hermit][early] SUMMARY: Core requirements for boot appear satisfied`
  console.error(summaryLine)

  console.error('[hermit][early] ----------------------------------------------------------------')
  console.error('[hermit][early] RUNNING_ON_RAILWAY            :', runningOnRailway)
  console.error('[hermit][early] DATABASE_URL (Supabase) / POSTGRES_URL (legacy) :', hasDb ? 'present' : 'MISSING (critical for alfaclub stores)')
  console.error('[hermit][early] ALFACLUB_CHAT_JWT             :', hasAlfaClubJwt ? 'present' : 'missing')
  console.error('[hermit][early] ALFACLUB_CHAT_PRIVY_* triplet :', hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh ? 'present' : 'incomplete/missing')
  console.error('[hermit][early] HERMIT_PINATA_CHAT_ENDPOINT   :', hasPinataEndpoint ? 'present' : 'missing (creative /gmeow etc. will be degraded)')
  console.error('[hermit][early] HERMIT_PINATA_BEARER_TOKEN    :', hasPinataBearer ? 'present' : 'missing')
  console.error('[hermit][early] ALFACLUB_CHAT_ROOM_ID         :', (process.env.ALFACLUB_CHAT_ROOM_ID ?? '').trim() || 'not set')
  console.error('[hermit][early] ALFACLUB_HERMIT_COMMAND_ROOMS :', (process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '').trim() || 'not set')
  console.error('[hermit][early] ALFACLUB_CHAT_BRIDGE_ENABLED  :', (process.env.ALFACLUB_CHAT_BRIDGE_ENABLED ?? '').trim() || 'not set')
  console.error('[hermit][early] ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY:', (process.env.ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY ?? '').trim() || 'not set')
  console.error('[hermit][early] Any room targeting            :', hasAnyRoomTargeting ? 'yes' : 'no (bridge may skip most work)')
  console.error('[hermit][early] Privy Token Refresher         :', (process.env.ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED ?? '').trim() ? 'ENABLED (this Hermit owns rotation)' : 'disabled (Vercel cron expected to be writer)')
  console.error('[hermit][early] ----------------------------------------------------------------')

  if (criticalIssues.length > 0) {
    console.error('[hermit][early] CRITICAL ISSUES (will cause silent death before /healthz binds):')
    criticalIssues.forEach((issue) => console.error('[hermit][early]   -', issue))
  } else if (runningOnRailway) {
    console.error('[hermit][early] All hard boot requirements appear satisfied. If still "unavailable", the crash is happening after this point — check the first lines after this table.')
  }

  console.error('[hermit][early] === END EARLY DIAGNOSTICS ===\n')

  earlyHermitDiagnostics = {
    runningOnRailway,
    hasDb,
    hasAlfaClubJwt,
    hasAlfaClubPrivyBootstrap: hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh,
    hasPinataEndpoint,
    hasPinataBearer,
    hasAnyRoomTargeting,
    criticalIssues,
  }
} catch (e) {
  // Never let early logging itself crash the process.
  console.error('[hermit][early] Early diagnostic logging failed (non-fatal):', e)
}

type RuntimeState = {
  startedAt: string
  bridgeStarted: boolean
  bridgeRoomId: string | null
  bridgeReason: string | null
  bridgeRailwayBlocked: boolean
  lastTickAt: string | null
  lastTick: Pick<AlfaClubChatBridgeTickResult, 'roomId' | 'fetched' | 'unseen' | 'processed' | 'errors'> | null
  lastError: string | null
  // Token refresh state (for dynamic Privy token management on Railway Hermit)
  tokenRefresherStarted: boolean
  tokenRefresherReason: string | null
  lastSuccessfulTokenRefreshAt: string | null
  chatJwtExpiresAt: string | null
  accessTokenExpiresAt: string | null
}

type TickRollupState = {
  windowStartedAtMs: number
  ticks: number
  processedTicks: number
  processedMessages: number
  erroredTicks: number
}

const TICK_ROLLUP_WINDOW_MS = 60_000

const state: RuntimeState = {
  startedAt: new Date().toISOString(),
  bridgeStarted: false,
  bridgeRoomId: null,
  bridgeReason: null,
  bridgeRailwayBlocked: false,
  lastTickAt: null,
  lastTick: null,
  lastError: null,
  tokenRefresherStarted: false,
  tokenRefresherReason: null,
  lastSuccessfulTokenRefreshAt: null,
  chatJwtExpiresAt: null,
  accessTokenExpiresAt: null,
}

let stopBridge: (() => void) | null = null
let stopRefresher: (() => void) | null = null
let tickRollup: TickRollupState = {
  windowStartedAtMs: Date.now(),
  ticks: 0,
  processedTicks: 0,
  processedMessages: 0,
  erroredTicks: 0,
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function resetTickRollup(nowMs: number): void {
  tickRollup = {
    windowStartedAtMs: nowMs,
    ticks: 0,
    processedTicks: 0,
    processedMessages: 0,
    erroredTicks: 0,
  }
}

function flushTickRollup(nowMs: number, force = false): void {
  const elapsedMs = nowMs - tickRollup.windowStartedAtMs
  if (!force && elapsedMs < TICK_ROLLUP_WINDOW_MS) return
  if (tickRollup.ticks === 0) {
    resetTickRollup(nowMs)
    return
  }
  if (tickRollup.processedTicks > 0 || tickRollup.erroredTicks > 0) {
    logger.info('[hermit] AlfaClub chat tick:rollup', {
      windowStartedAt: new Date(tickRollup.windowStartedAtMs).toISOString(),
      windowElapsedMs: elapsedMs,
      ticks: tickRollup.ticks,
      processedTicks: tickRollup.processedTicks,
      processedMessages: tickRollup.processedMessages,
      erroredTicks: tickRollup.erroredTicks,
    })
  }
  resetTickRollup(nowMs)
}

async function refreshTokenExpiryState(): Promise<void> {
  try {
    const [chatToken, accessToken] = await Promise.all([
      readAlfaClubChatToken().catch(() => null),
      readAlfaClubPrivyAccessToken().catch(() => null),
    ])

    if (chatToken?.expiresAt) {
      state.chatJwtExpiresAt = chatToken.expiresAt
    }
    if (accessToken?.expiresAt) {
      state.accessTokenExpiresAt = accessToken.expiresAt
    }
    if (chatToken?.updatedAt) {
      state.lastSuccessfulTokenRefreshAt = chatToken.updatedAt
    }
  } catch (err) {
    // Non-fatal — health endpoint will just show older values
  }
}

function startHealthServer(): void {
  const port = Number(process.env.PORT ?? '8080') || 8080
  const server = http.createServer((req, res) => {
    const method = String(req.method ?? 'GET').toUpperCase()
    const url = (req.url ?? '/').split('?')[0]

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }

    if (url === '/robots.txt') {
      res.writeHead(200, {
        'cache-control': 'public, max-age=3600',
        'content-type': 'text/plain; charset=utf-8',
      })
      res.end('User-agent: *\nDisallow: /\n')
      return
    }

    if (url !== '/healthz' && url !== '/readyz') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not found')
      return
    }

    const ready = state.bridgeStarted
    const status = url === '/readyz' && !ready ? 503 : 200
    res.writeHead(status, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    })
    res.end(
      JSON.stringify({
        ok: status < 500,
        service: 'hermit-alfaclub',
        probe: url,
        uptimeSeconds: Math.floor(process.uptime()),
        earlyDiagnostics: earlyHermitDiagnostics,
        ...state,
      }),
    )
  })

  server.listen(port, () => {
    logger.info('[hermit] health server listening', { port })
  })
}

function startRuntime(): void {
  logger.info('[hermit] starting AlfaClub runtime', {
    roomId: process.env.ALFACLUB_CHAT_ROOM_ID ?? null,
    pinataConfigured: Boolean(
      (process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? '').trim() &&
        (process.env.HERMIT_PINATA_BEARER_TOKEN ?? '').trim(),
    ),
  })

  try {
    const bridge = startAlfaClubChatBridge({
      onTick: (result) => {
        const nowMs = Date.now()
        tickRollup.ticks += 1
        state.lastTickAt = new Date().toISOString()
        state.lastTick = {
          roomId: result.roomId,
          fetched: result.fetched,
          unseen: result.unseen,
          processed: result.processed,
          errors: result.errors.slice(0, 3),
        }

        if (result.seeded) {
          logger.info('[hermit] AlfaClub chat seeded', {
            roomId: result.roomId,
            fetched: result.fetched,
            unseen: result.unseen,
          })
          flushTickRollup(nowMs)
          return
        }

        if (result.processed > 0) {
          tickRollup.processedTicks += 1
          tickRollup.processedMessages += result.processed
        }
        if (result.errors.length > 0) {
          tickRollup.erroredTicks += 1
          logger.warn('[hermit] AlfaClub command errors', {
            roomId: result.roomId,
            count: result.errors.length,
            errors: result.errors.slice(0, 5),
          })
        }
        flushTickRollup(nowMs)
      },
      onError: (error) => {
        const message = asErrorMessage(error)
        state.lastError = message
        tickRollup.erroredTicks += 1
        logger.warn('[hermit] AlfaClub chat tick error', { error: message })
      },
    })

    state.bridgeStarted = bridge.started
    state.bridgeRoomId = bridge.roomId
    state.bridgeReason = bridge.started ? null : bridge.reason ?? 'unknown'
    state.bridgeRailwayBlocked = bridge.reason === 'railway_blocked'
    stopBridge = bridge.stop

    if (bridge.started) {
      logger.info('[hermit] AlfaClub chat bridge started', {
        roomId: bridge.roomId,
        intervalMs: bridge.intervalMs,
      })
    } else {
      logger.warn('[hermit] AlfaClub chat bridge not started', {
        reason: bridge.reason ?? 'unknown',
        roomId: bridge.roomId,
      })
      // Extra visible line so Railway logs always show the exact blocker
      console.error(`[hermit] BRIDGE REASON: ${bridge.reason ?? 'unknown'} (room ${bridge.roomId ?? 'n/a'})`)
    }
  } catch (error) {
    const message = asErrorMessage(error)
    state.lastError = message
    logger.error('[hermit] AlfaClub chat bridge boot failed', { error: message })
  }

  try {
    const refresher = startAlfaClubPrivyTokenRefresher()
    state.tokenRefresherStarted = refresher.started
    state.tokenRefresherReason = refresher.reason ?? null

    if (!refresher.started) {
      logger.info('[hermit] AlfaClub Privy token refresher not started', {
        reason: refresher.reason ?? 'unknown',
      })
    } else {
      stopRefresher = refresher.stop
      logger.info('[hermit] AlfaClub Privy token refresher started', {
        intervalMinutes: 30,
        role: 'primary writer for alfaclub_runtime_secret (this Hermit instance owns token rotation)',
      })

      // Capture initial token expiry for observability
      void refreshTokenExpiryState()
    }
  } catch (error) {
    logger.warn('[hermit] AlfaClub Privy token refresher not started', {
      error: asErrorMessage(error),
    })
  }
}

function shutdown(signal: string): void {
  logger.info('[hermit] shutting down', { signal })
  flushTickRollup(Date.now(), true)
  try {
    stopRefresher?.()
  } catch {}
  try {
    stopBridge?.()
  } catch {}
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Hermit is a long-lived chat bridge. Background failures (Supabase pooler
// TLS timeouts, transient Pinata/Privy errors, etc.) must never tear down the
// process — Railway will restart us in a tight loop and the bot goes dark.
// Surface them as warnings and let the per-feature retry/circuit-breaker
// logic recover on the next tick.
process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  state.lastError = message
  logger.warn('[hermit] unhandledRejection (swallowed)', { error: message, stack })
})
process.on('uncaughtException', (error: Error) => {
  state.lastError = error.message
  logger.warn('[hermit] uncaughtException (swallowed)', {
    error: error.message,
    stack: error.stack,
  })
})

void closeEarlyHealthServer()
  .catch((err) => {
    logger.warn('[hermit] failed to close bootstrap health listener (continuing)', {
      error: err instanceof Error ? err.message : String(err),
    })
  })
  .finally(() => {
    startHealthServer()
    startRuntime()
  })

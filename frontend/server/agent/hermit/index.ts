/**
 * Hermit AlfaClub runtime.
 *
 * Long-lived Railway process for the creative AlfaClub / Pinata lane. This is
 * intentionally separate from the Keepr XMTP runtime so Hermit restarts,
 * Pinata failures, and chat polling do not affect critical Keepr automation.
 */

import http from 'node:http'

import {
  type AlfaClubChatBridgeTickResult,
  startAlfaClubChatBridge,
} from '../../_lib/alfaclub/chatBridge.js'
import { startAlfaClubPrivyTokenRefresher } from '../../_lib/alfaclub/privyTokenRefresher.js'
import { logger } from '../../_lib/infra/logger.js'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
  uptime: () => number
}

type RuntimeState = {
  startedAt: string
  bridgeStarted: boolean
  bridgeRoomId: string | null
  bridgeReason: string | null
  lastTickAt: string | null
  lastTick: Pick<AlfaClubChatBridgeTickResult, 'roomId' | 'fetched' | 'unseen' | 'processed' | 'errors'> | null
  lastError: string | null
}

const state: RuntimeState = {
  startedAt: new Date().toISOString(),
  bridgeStarted: false,
  bridgeRoomId: null,
  bridgeReason: null,
  lastTickAt: null,
  lastTick: null,
  lastError: null,
}

let stopBridge: (() => void) | null = null
let stopRefresher: (() => void) | null = null

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
          return
        }

        if (result.processed === 0 && result.errors.length === 0) return
        logger.info('[hermit] AlfaClub chat tick', state.lastTick)
      },
      onError: (error) => {
        const message = asErrorMessage(error)
        state.lastError = message
        logger.warn('[hermit] AlfaClub chat tick error', { error: message })
      },
    })

    state.bridgeStarted = bridge.started
    state.bridgeRoomId = bridge.roomId
    state.bridgeReason = bridge.started ? null : bridge.reason ?? 'unknown'
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
    }
  } catch (error) {
    const message = asErrorMessage(error)
    state.lastError = message
    logger.error('[hermit] AlfaClub chat bridge boot failed', { error: message })
  }

  try {
    const refresher = startAlfaClubPrivyTokenRefresher()
    if (!refresher.started) {
      logger.info('[hermit] AlfaClub Privy token refresher not started', {
        reason: refresher.reason ?? 'unknown',
      })
    } else {
      stopRefresher = refresher.stop
      logger.info('[hermit] AlfaClub Privy token refresher started', {
        intervalMinutes: 30,
      })
    }
  } catch (error) {
    logger.warn('[hermit] AlfaClub Privy token refresher not started', {
      error: asErrorMessage(error),
    })
  }
}

function shutdown(signal: string): void {
  logger.info('[hermit] shutting down', { signal })
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

startHealthServer()
startRuntime()

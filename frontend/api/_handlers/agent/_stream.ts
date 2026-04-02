import type { VercelRequest, VercelResponse } from '@vercel/node'

import { creatorVaultCharacter } from '../../../server/agent/eliza/character.js'
import { getElizaLlmService } from '../../../server/agent/eliza/llm.js'
import {
  createCorrelationId,
  logger,
  handleOptions,
  readSessionFromRequest,
  setCors,
  setNoStore,
  getClientIp,
  checkRateLimit,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'




const STREAM_MESSAGE_MAX_CHARS = 4_000
const STREAM_CONTEXT_MAX_CHARS = 4_000
const STREAM_RATE_LIMIT = { windowMs: 60_000, maxRequests: 24 } as const
const STREAM_IP_RATE_LIMIT = { windowMs: 60_000, maxRequests: 36 } as const

function firstQueryValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return String(value[0] ?? '')
  return ''
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = String(session?.address ?? '').trim().toLowerCase()
  if (!isAddressLike(sessionAddress)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const clientIp = getClientIp(req)
  const principalRate = checkRateLimit(
    rateLimitKey('agent-stream-principal', sessionAddress),
    STREAM_RATE_LIMIT,
  )
  const ipRate = checkRateLimit(rateLimitKey('agent-stream-ip', clientIp), STREAM_IP_RATE_LIMIT)
  const rateRemaining = Math.min(principalRate.remaining, ipRate.remaining)
  const rateResetAt = Math.min(principalRate.resetAt, ipRate.resetAt)
  res.setHeader('X-RateLimit-Limit', String(STREAM_RATE_LIMIT.maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateRemaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rateResetAt / 1000)))
  if (!principalRate.allowed || !ipRate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rateResetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const queryMessage = firstQueryValue(req.query.message as any).trim()
  const bodyMessage =
    req.body && typeof req.body === 'object' && typeof (req.body as any).message === 'string'
      ? String((req.body as any).message).trim()
      : ''
  const message = bodyMessage || queryMessage
  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' })
  }
  if (message.length > STREAM_MESSAGE_MAX_CHARS) {
    return res.status(400).json({ success: false, error: 'message is too long' })
  }

  const queryContext = firstQueryValue(req.query.context as any).trim()
  const bodyContext =
    req.body && typeof req.body === 'object' && typeof (req.body as any).context === 'string'
      ? String((req.body as any).context).trim()
      : ''
  const vaultContextRaw = bodyContext || queryContext
  if (vaultContextRaw.length > STREAM_CONTEXT_MAX_CHARS) {
    return res.status(400).json({ success: false, error: 'context is too long' })
  }
  const vaultContext = vaultContextRaw

  const correlationId = createCorrelationId('sse')
  const llm = getElizaLlmService()

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let clientClosed = false
  const streamAbort = new AbortController()
  if (typeof (req as any).on === 'function') {
    ;(req as any).on('close', () => {
      clientClosed = true
      streamAbort.abort()
    })
  }

  const heartbeat = setInterval(() => {
    if (clientClosed) return
    try {
      res.write(': ping\n\n')
    } catch {
      // Client disconnected.
    }
  }, 15_000)

  const writeEvent = (event: string, data: unknown) => {
    if (clientClosed) return
    try {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Client disconnected.
    }
  }

  writeEvent('open', { correlationId })
  try {
    for await (const event of llm.streamResponse({
      agentKey: 'api-stream',
      userMessage: message,
      systemPrompt: creatorVaultCharacter.system,
      vaultContext,
      correlationId,
      preferredModel: String(creatorVaultCharacter.settings?.model ?? '').trim() || undefined,
      abortSignal: streamAbort.signal,
    })) {
      if (clientClosed) break
      writeEvent(event.type, event.data)
    }
    writeEvent('close', { ok: true })
  } catch (error) {
    if (clientClosed || streamAbort.signal.aborted) return
    logger.warn('[api/agent/stream] streaming error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    })
    writeEvent('error', { message: 'stream_failed' })
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
}


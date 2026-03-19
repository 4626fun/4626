import type { VercelRequest, VercelResponse } from '@vercel/node'

import { creatorVaultCharacter } from '../../../server/agent/eliza/character.js'
import { getElizaLlmService } from '../../../server/agent/eliza/llm.js'
import { createCorrelationId, logger } from '../../../server/_lib/logger.js'
import { handleOptions, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, rateLimitKey } from '../../../server/_lib/rateLimit.js'

const STREAM_MESSAGE_MAX_CHARS = 4_000
const STREAM_CONTEXT_MAX_CHARS = 8_000

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
  const rate = checkRateLimit(rateLimitKey('agent-stream', sessionAddress), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
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
  const vaultContext = vaultContextRaw.slice(0, STREAM_CONTEXT_MAX_CHARS)

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


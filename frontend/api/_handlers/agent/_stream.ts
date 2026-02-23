import type { VercelRequest, VercelResponse } from '@vercel/node'

import { creatorVaultCharacter } from '../../../server/agent/eliza/character.js'
import { getElizaLlmService } from '../../../server/agent/eliza/llm.js'
import { createCorrelationId, logger } from '../../../server/_lib/logger.js'
import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'

function firstQueryValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return String(value[0] ?? '')
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
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

  const queryContext = firstQueryValue(req.query.context as any).trim()
  const bodyContext =
    req.body && typeof req.body === 'object' && typeof (req.body as any).context === 'string'
      ? String((req.body as any).context).trim()
      : ''
  const vaultContext = bodyContext || queryContext

  const correlationId = createCorrelationId('sse')
  const llm = getElizaLlmService()

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let clientClosed = false
  if (typeof (req as any).on === 'function') {
    ;(req as any).on('close', () => {
      clientClosed = true
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
    })) {
      if (clientClosed) break
      writeEvent(event.type, event.data)
    }
    writeEvent('close', { ok: true })
  } catch (error) {
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


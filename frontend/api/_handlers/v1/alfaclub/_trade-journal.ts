import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  getSessionAddress,
  isAdminAddress,
  rateLimitKey,
  readBoundedJsonObjectBody,
} from '@4626/server-core'

import {
  regenerateInverseAkitaTradeJournal,
  resolveInverseAkitaTradeJournalSendUnknown,
} from '../../../../server/_lib/alfaclub/inverseAkitaTradeJournal.js'
import {
  resolveTerminalReplyDeliverySendUnknown,
} from '../../../../server/_lib/alfaclub/inverseOpinionTradeStore.js'

declare const process: { env: Record<string, string | undefined> }

function machineSecret(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return String(header[0] ?? '').trim()
  return typeof header === 'string' ? header.trim() : ''
}

function boundedWindow(body: Record<string, unknown>): { start: string; end: string } | null {
  const startMs = Date.parse(String(body.windowStart ?? ''))
  const endMs = Date.parse(String(body.windowEnd ?? ''))
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  if (endMs - startMs !== 24 * 60 * 60_000) return null
  if (endMs > Date.now() + 5 * 60_000 || endMs < Date.now() - 31 * 24 * 60 * 60_000) return null
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const operatorAddress = getSessionAddress(req)
  if (!operatorAddress) return res.status(401).json({ success: false, error: 'Sign in required' })
  if (!isAdminAddress(operatorAddress)) {
    return res.status(403).json({ success: false, error: 'Admin only' })
  }
  const configuredSecret = String(process.env.CRON_SECRET ?? '').trim()
  if (!configuredSecret || machineSecret(req) !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Machine authorization required' })
  }
  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-trade-journal', operatorAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }
  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 2_048 })) as Record<string, unknown>
  const action = String(body.action ?? 'regenerate')
  const expectedConfirmation =
    action === 'resolve_terminal_reply_send_unknown'
      ? 'RESOLVE_TERMINAL_REPLY_SEND_UNKNOWN'
      : action === 'resolve_send_unknown'
        ? 'RESOLVE_SEND_UNKNOWN'
        : 'REGENERATE'
  if (body.confirm !== expectedConfirmation) {
    return res.status(400).json({ success: false, error: 'Explicit confirmation required' })
  }
  try {
    if (action === 'resolve_terminal_reply_send_unknown') {
      const decisionId = String(body.decisionId ?? '').trim()
      const deliveryKind = String(body.deliveryKind ?? '')
      const resolution = String(body.resolution ?? '')
      const knownMessageId = String(body.knownMessageId ?? '').trim() || null
      const note = String(body.note ?? '').trim()
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          decisionId,
        )
        || !['result', 'receipt'].includes(deliveryKind)
        || !['mark_sent', 'mark_failed'].includes(resolution)
        || note.length < 8
        || note.length > 500
        || (knownMessageId?.length ?? 0) > 256
        || (resolution === 'mark_sent' && !knownMessageId)
        || (resolution === 'mark_failed' && knownMessageId != null)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid terminal reply resolution',
        })
      }
      const result = await resolveTerminalReplyDeliverySendUnknown({
        operatorAddress,
        decisionId,
        deliveryKind: deliveryKind as 'result' | 'receipt',
        resolution: resolution as 'mark_sent' | 'mark_failed',
        knownMessageId,
        note,
      })
      return res.status(200).json({ success: true, data: result })
    }
    const window = boundedWindow(body)
    if (!window) return res.status(400).json({ success: false, error: 'Invalid reporting window' })
    if (action === 'resolve_send_unknown') {
      const target = String(body.target ?? 'delivery')
      const resolution = String(body.resolution ?? '')
      const deliveryKind = String(body.deliveryKind ?? '')
      const deliveryOrdinal = Number(body.deliveryOrdinal)
      const revision = Number(body.revision)
      const knownMessageId = String(body.knownMessageId ?? '').trim() || null
      const knownContentHash = String(body.knownContentHash ?? '').trim() || null
      const note = String(body.note ?? '').trim()
      if (
        !['delivery', 'revision'].includes(target)
        || !['mark_sent', 'mark_failed'].includes(resolution)
        || note.length < 8
        || note.length > 500
        || (resolution === 'mark_sent' && !knownMessageId)
        || (resolution === 'mark_failed' && (knownMessageId != null || knownContentHash != null))
        || (knownMessageId?.length ?? 0) > 256
        || (
          target === 'delivery'
          && (
            !['parent', 'reply'].includes(deliveryKind)
            || !Number.isInteger(deliveryOrdinal)
            || deliveryOrdinal < 0
            || (deliveryKind === 'parent' && deliveryOrdinal !== 0)
            || knownContentHash != null
          )
        )
        || (
          target === 'revision'
          && (
            !Number.isInteger(revision)
            || revision <= 0
            || (
              resolution === 'mark_sent'
              && !/^[a-f0-9]{64}$/.test(knownContentHash ?? '')
            )
          )
        )
      ) {
        return res.status(400).json({ success: false, error: 'Invalid unknown-send resolution' })
      }
      const result = await resolveInverseAkitaTradeJournalSendUnknown({
        operatorAddress,
        window,
        target: target as 'delivery' | 'revision',
        resolution: resolution as 'mark_sent' | 'mark_failed',
        ...(target === 'delivery'
          ? {
              deliveryKind: deliveryKind as 'parent' | 'reply',
              deliveryOrdinal,
            }
          : { revision }),
        knownMessageId,
        knownContentHash,
        note,
      })
      return res.status(200).json({ success: true, data: result })
    }
    if (action !== 'regenerate') {
      return res.status(400).json({ success: false, error: 'Unsupported action' })
    }
    const result = await regenerateInverseAkitaTradeJournal({
      operatorAddress,
      window,
    })
    return res.status(200).json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'journal_regeneration_failed'
    return res.status(
      message === 'journal_parent_missing' || message === 'send_unknown_resolution_conflict'
        || message === 'terminal_reply_send_unknown_resolution_conflict'
        ? 409
        : 500,
    ).json({
      success: false,
      error: message.slice(0, 128),
    })
  }
}

/**
 * Automatic Hermit meme arsenal intake.
 *
 * When the AlfaClub bridge ingests a new GIF/photo in a Hermit command room,
 * pin it to Pinata and store it in `hermit_memes` (same path as `/keep`).
 * Fire-and-forget from the bridge so ingest ticks stay fast.
 */

import { logger } from '../infra/logger.js'
import {
  isKeepableMediaAttachment,
  keepHermitMemeFromMedia,
  type KeepMediaCandidate,
} from './keepMeme.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_MAX_PER_TICK = 3
const recentSourceUrls = new Set<string>()
const RECENT_URL_CAP = 500

export type AutoKeepSourceMessage = {
  roomId: string
  messageId: string
  senderAddress: string
  text?: string | null
  isBot?: boolean | null
  username?: string | null
  attachmentsJson?: unknown
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isHexAddress(value: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(value)
}

export function readHermitAutoKeepEnabled(): boolean {
  const raw = asTrimmed(process.env.HERMIT_AUTO_KEEP_ENABLED).toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no')
}

export function readHermitAutoKeepMaxPerTick(): number {
  const n = Number(process.env.HERMIT_AUTO_KEEP_MAX_PER_TICK ?? DEFAULT_MAX_PER_TICK)
  if (!Number.isFinite(n)) return DEFAULT_MAX_PER_TICK
  return Math.max(1, Math.min(10, Math.floor(n)))
}

export function readHermitAutoKeepRoomIds(fallbackRoomIds: readonly string[]): Set<string> {
  const raw = asTrimmed(process.env.HERMIT_AUTO_KEEP_ROOM_IDS)
  if (!raw) {
    return new Set(fallbackRoomIds.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
  }
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter((id) => /^\d+$/.test(id)),
  )
}

function rememberSourceUrl(url: string): void {
  recentSourceUrls.add(url)
  if (recentSourceUrls.size > RECENT_URL_CAP) {
    const first = recentSourceUrls.values().next().value
    if (typeof first === 'string') recentSourceUrls.delete(first)
  }
}

export function _resetHermitAutoKeepRecentForTests(): void {
  recentSourceUrls.clear()
}

function parseAttachmentList(value: unknown): KeepMediaCandidate[] {
  if (!Array.isArray(value)) return []
  const out: KeepMediaCandidate[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    const url = asTrimmed(row.url)
    if (!url) continue
    out.push({
      url,
      type: asTrimmed(row.type) || undefined,
      filename: asTrimmed(row.filename) || undefined,
      mime_type: asTrimmed(row.mime_type) || asTrimmed(row.mimeType) || undefined,
    })
  }
  return out
}

function shouldSkipAutoKeepSender(params: {
  senderAddress: string
  isBot?: boolean | null
  username?: string | null
}): boolean {
  const sender = asTrimmed(params.senderAddress).toLowerCase()
  if (!isHexAddress(sender)) return true
  if (params.isBot === true) return true
  if (sender === 'trade-completed') return true
  const username = asTrimmed(params.username).toLowerCase()
  if (username === 'chip' || username === 'trade-completed') return true
  return false
}

export function collectAutoKeepCandidates(params: {
  messages: readonly AutoKeepSourceMessage[]
  allowedRoomIds: ReadonlySet<string>
  maxPerTick: number
}): Array<{
  roomId: string
  messageId: string
  senderAddress: string
  media: KeepMediaCandidate
  caption: string
}> {
  const out: Array<{
    roomId: string
    messageId: string
    senderAddress: string
    media: KeepMediaCandidate
    caption: string
  }> = []
  const seenUrls = new Set<string>()

  for (const message of params.messages) {
    if (out.length >= params.maxPerTick) break
    const roomId = asTrimmed(message.roomId)
    if (!params.allowedRoomIds.has(roomId)) continue
    if (
      shouldSkipAutoKeepSender({
        senderAddress: message.senderAddress,
        isBot: message.isBot,
        username: message.username,
      })
    ) {
      continue
    }

    const attachments = parseAttachmentList(message.attachmentsJson)
    const media = attachments.find((entry) => isKeepableMediaAttachment(entry))
    if (!media) continue
    const url = media.url
    if (seenUrls.has(url) || recentSourceUrls.has(url)) continue
    seenUrls.add(url)

    const caption =
      asTrimmed(message.text).slice(0, 120)
      || `Auto-kept from room ${roomId}`
    out.push({
      roomId,
      messageId: asTrimmed(message.messageId),
      senderAddress: asTrimmed(message.senderAddress).toLowerCase(),
      media,
      caption,
    })
  }
  return out
}

export async function autoKeepHermitMediaFromIngest(params: {
  messages: readonly AutoKeepSourceMessage[]
  fallbackRoomIds: readonly string[]
}): Promise<{ attempted: number; saved: number; reused: number; skipped: number }> {
  if (!readHermitAutoKeepEnabled()) {
    return { attempted: 0, saved: 0, reused: 0, skipped: 0 }
  }
  const allowedRoomIds = readHermitAutoKeepRoomIds(params.fallbackRoomIds)
  if (allowedRoomIds.size === 0) {
    return { attempted: 0, saved: 0, reused: 0, skipped: 0 }
  }

  const candidates = collectAutoKeepCandidates({
    messages: params.messages,
    allowedRoomIds,
    maxPerTick: readHermitAutoKeepMaxPerTick(),
  })
  if (candidates.length === 0) {
    return { attempted: 0, saved: 0, reused: 0, skipped: 0 }
  }

  let saved = 0
  let reused = 0
  let skipped = 0
  for (const candidate of candidates) {
    rememberSourceUrl(candidate.media.url)
    try {
      const result = await keepHermitMemeFromMedia({
        ownerAddress: candidate.senderAddress,
        roomId: candidate.roomId,
        media: candidate.media,
        caption: candidate.caption,
        extraTags: ['auto', `msg:${candidate.messageId.slice(0, 8)}`],
      })
      if (!result.ok) {
        skipped += 1
        logger.warn('[hermit] auto_keep_failed', {
          roomId: candidate.roomId,
          messageId: candidate.messageId,
          error: result.error,
        })
        continue
      }
      if (result.reused) reused += 1
      else saved += 1
      logger.info('[hermit] auto_keep_ok', {
        roomId: candidate.roomId,
        messageId: candidate.messageId,
        memeId: result.meme.id,
        reused: result.reused,
        cid: result.meme.cid,
      })
    } catch (error) {
      skipped += 1
      logger.warn('[hermit] auto_keep_error', {
        roomId: candidate.roomId,
        messageId: candidate.messageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { attempted: candidates.length, saved, reused, skipped }
}

/** Non-blocking wrapper for bridge ingest paths. */
export function scheduleHermitAutoKeepFromIngest(params: {
  messages: readonly AutoKeepSourceMessage[]
  fallbackRoomIds: readonly string[]
}): void {
  if (!readHermitAutoKeepEnabled()) return
  void autoKeepHermitMediaFromIngest(params).catch((error) => {
    logger.warn('[hermit] auto_keep_schedule_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  })
}

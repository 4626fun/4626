/**
 * Curated Hermit meme keep — pin replied room media to Pinata and store in hermit_memes.
 */

import { logger } from '../infra/logger.js'
import { pinRemoteMediaToPinata } from './pinataPin.js'
import {
  createHermitMeme,
  findHermitMemeByUrlOrCid,
  type HermitMemeRecord,
} from './repository.js'
import type { HermitMediaAttachment } from './types.js'

const MAX_CAPTION = 280

export type KeepMediaCandidate = {
  url: string
  type?: string
  filename?: string
  mime_type?: string
}

export type KeepMemeResult =
  | { ok: true; meme: HermitMemeRecord; reused: boolean; pinnedUrl: string }
  | { ok: false; error: string }

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isKeepableMediaAttachment(attachment: KeepMediaCandidate): boolean {
  const url = asTrimmed(attachment.url)
  if (!url || !/^https:\/\//i.test(url)) return false
  const type = asTrimmed(attachment.type).toLowerCase()
  const mime = asTrimmed(attachment.mime_type).toLowerCase()
  const filename = asTrimmed(attachment.filename).toLowerCase()
  if (type === 'gif' || type === 'photo' || type === 'image' || type === 'tenor-gif') return true
  if (mime.startsWith('image/')) return true
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.toLowerCase()
    if (/\.(gif|jpe?g|png|webp)$/.test(path)) return true
    const qName = asTrimmed(parsed.searchParams.get('filename')).toLowerCase()
    if (/\.(gif|jpe?g|png|webp)$/.test(qName)) return true
  } catch {
    // ignore
  }
  return /\.(gif|jpe?g|png|webp)$/.test(filename)
}

export function pickKeepableMediaUrl(
  attachments: readonly KeepMediaCandidate[] | null | undefined,
): KeepMediaCandidate | null {
  if (!attachments?.length) return null
  for (const entry of attachments) {
    if (isKeepableMediaAttachment(entry)) return entry
  }
  return null
}

function normalizeTags(values: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const tag = asTrimmed(value).toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 12) break
  }
  return out
}

export async function keepHermitMemeFromMedia(params: {
  ownerAddress: `0x${string}` | string
  roomId: string
  media: KeepMediaCandidate
  caption?: string | null
  extraTags?: readonly string[]
}): Promise<KeepMemeResult> {
  const roomId = asTrimmed(params.roomId)
  const ownerAddress = asTrimmed(params.ownerAddress).toLowerCase()
  const sourceUrl = asTrimmed(params.media.url)
  if (!roomId || !/^\d+$/.test(roomId)) {
    return { ok: false, error: 'invalid_room_id' }
  }
  if (!/^0x[a-f0-9]{40}$/.test(ownerAddress)) {
    return { ok: false, error: 'invalid_owner' }
  }
  if (!sourceUrl) return { ok: false, error: 'missing_media_url' }

  const existing = await findHermitMemeByUrlOrCid({ url: sourceUrl, cid: null })
  if (existing) {
    return { ok: true, meme: existing, reused: true, pinnedUrl: existing.url }
  }

  const pinned = await pinRemoteMediaToPinata({
    sourceUrl,
    filenameHint: params.media.filename ?? null,
  })
  if (!pinned.ok) {
    logger.warn('[hermit] keep_pin_failed', {
      roomId,
      error: pinned.error,
      sourceHost: (() => {
        try {
          return new URL(sourceUrl).host
        } catch {
          return null
        }
      })(),
    })
    return { ok: false, error: pinned.error }
  }

  const byCid = await findHermitMemeByUrlOrCid({ url: pinned.url, cid: pinned.cid })
  if (byCid) {
    return { ok: true, meme: byCid, reused: true, pinnedUrl: byCid.url }
  }

  const caption =
    asTrimmed(params.caption).slice(0, MAX_CAPTION)
    || `Kept from room ${roomId}`
  const tags = normalizeTags([
    'kept',
    params.media.type ?? '',
    `room:${roomId}`,
    ...(params.extraTags ?? []),
  ])

  const saved = await createHermitMeme({
    ownerAddress,
    roomId,
    cid: pinned.cid,
    url: pinned.url,
    caption,
    tags,
    createdBy: ownerAddress,
  })
  if (!saved) return { ok: false, error: 'meme_store_unavailable' }

  logger.info('[hermit] keep_meme_saved', {
    roomId,
    memeId: saved.id,
    cid: pinned.cid,
    bytes: pinned.bytes,
  })
  return { ok: true, meme: saved, reused: false, pinnedUrl: pinned.url }
}

export function toKeepMediaCandidates(
  attachments: readonly HermitMediaAttachment[] | null | undefined,
): KeepMediaCandidate[] {
  if (!attachments?.length) return []
  return attachments.map((entry) => ({
    url: entry.url,
    type: entry.type,
    filename: entry.filename,
    mime_type: entry.mime_type,
  }))
}

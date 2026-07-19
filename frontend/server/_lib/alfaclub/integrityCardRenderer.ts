import { fetchImageAsPngDataUrl, twitterAvatarUrl } from './integrityCardAssets.js'
import { renderHermitAvatarDataUrl } from './hermitAvatar.js'
import type { IntegrityCardRoomMetrics } from './integrityCardPolicy.js'
import {
  buildIntegrityCardTree,
  INTEGRITY_CARD_CANVAS,
  type IntegrityCardVisuals,
} from './integrityCardTemplate.js'
import { renderSatoriPng } from './satoriRenderer.js'
import type { Scorecard } from './scorecard.js'

const HERMIT_MARK_SIZE = 128

async function safeHermitMarkDataUrl(): Promise<string | null> {
  try {
    return await renderHermitAvatarDataUrl({ size: HERMIT_MARK_SIZE })
  } catch {
    return null
  }
}

export type RenderIntegrityCardInput = {
  scorecard: Scorecard
  visuals: {
    displayName?: string | null
    handle?: string | null
    roomName?: string | null
    roomImageUrl?: string | null
    pfpUrl?: string | null
    scorecardUri?: string | null
    /** Live room-directory ingestedAt when chip metrics are not from the scorecard. */
    roomMetricsAsOf?: string | null
  }
  roomMetrics?: IntegrityCardRoomMetrics | null
}

export type RenderIntegrityCardResult = {
  bytes: Uint8Array
  width: number
  height: number
  visuals: IntegrityCardVisuals
  roomMetrics: IntegrityCardRoomMetrics | null
}

async function resolvePfpUrl(visuals: RenderIntegrityCardInput['visuals']): Promise<string | null> {
  const direct = String(visuals.pfpUrl ?? '').trim()
  if (direct) return direct
  const handle = String(visuals.handle ?? '').trim()
  if (!handle) return null
  return twitterAvatarUrl(handle)
}

/**
 * Render a daily Integrity Card PNG from a scorecard + optional visual URLs.
 * Missing remote images fall back to the template's gradient / empty marks.
 */
export async function renderIntegrityCardPng(
  input: RenderIntegrityCardInput,
): Promise<RenderIntegrityCardResult> {
  const handle = String(input.visuals.handle ?? '').trim().replace(/^@/, '') || null
  const roomName = String(input.visuals.roomName ?? '').trim() || null
  const displayName =
    String(input.visuals.displayName ?? '').trim()
    || (handle ? `@${handle}` : null)
    || roomName
    || `Room #${input.scorecard.creator.tokenId}`

  const pfpUrl = await resolvePfpUrl(input.visuals)
  const [roomImage, pfp, hermitMarkDataUrl] = await Promise.all([
    input.visuals.roomImageUrl
      ? fetchImageAsPngDataUrl(input.visuals.roomImageUrl, { maxEdge: 1600 })
      : Promise.resolve(null),
    pfpUrl ? fetchImageAsPngDataUrl(pfpUrl, { maxEdge: 320 }) : Promise.resolve(null),
    safeHermitMarkDataUrl(),
  ])

  const visuals: IntegrityCardVisuals = {
    roomImageDataUrl: roomImage?.dataUrl ?? null,
    pfpDataUrl: pfp?.dataUrl ?? null,
    hermitMarkDataUrl,
    displayName,
    handle,
    roomName,
    scorecardUri: input.visuals.scorecardUri ?? null,
    roomMetricsAsOf: input.visuals.roomMetricsAsOf ?? null,
  }

  const roomMetrics = input.roomMetrics ?? null
  const tree = buildIntegrityCardTree({
    scorecard: input.scorecard,
    visuals,
    roomMetrics,
  })
  const bytes = await renderSatoriPng(tree, {
    width: INTEGRITY_CARD_CANVAS.width,
    height: INTEGRITY_CARD_CANVAS.height,
    pixelRatio: 2,
  })

  return {
    bytes,
    width: INTEGRITY_CARD_CANVAS.width * 2,
    height: INTEGRITY_CARD_CANVAS.height * 2,
    visuals,
    roomMetrics,
  }
}

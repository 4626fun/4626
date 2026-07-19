#!/usr/bin/env tsx
/**
 * Render an Integrity Card from an immutable Grove scorecard + live room snapshot.
 *
 * Rank / Hyperliquid 30d come from the scorecard. Fund / holders / room PnL come
 * from the current `alfaclub_rooms_snapshot` upsert — when that ingestedAt day
 * differs from scorecard.snapshotTs, the card labels `room YYYY-MM-DD` separately.
 *
 * No synthetic metrics. If the subject fails the bullish post gate, exits without
 * writing a PNG unless `--force` (still real numbers).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/render-integrity-card-sample.ts
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/render-integrity-card-sample.ts --force
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/render-integrity-card-sample.ts \
 *     --grove=https://api.grove.storage/<hash>
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  evaluateIntegrityCardPostability,
  pickMostPostableIntegrityCardSubject,
  roomMetricsFromDirectoryItem,
} from '../../server/_lib/alfaclub/integrityCardPolicy.js'
import { renderIntegrityCardPng } from '../../server/_lib/alfaclub/integrityCardRenderer.js'
import type { Scorecard } from '../../server/_lib/alfaclub/scorecard.js'
import { getAlfaClubRoomDirectoryItem } from '../../server/_lib/alfaclub/tradingRoomsDirectory.js'
import { lensUriFromGroveUrl } from '../../server/_lib/lens/lensGrove.js'

const DEFAULT_SCORECARD_URI =
  'lens://46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76'
const DEFAULT_GROVE_URL =
  'https://api.grove.storage/46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76'
const DEFAULT_OUT = resolve(
  process.cwd(),
  'tmp/integrity-cards/integrity-card-live.png',
)

function argValue(flag: string): string | null {
  const prefix = `${flag}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() || null : null
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function resolveScorecardUri(params: {
  groveUrl: string
  groveOverride: string | null
  scorecardUriOverride: string | null
}): string {
  const { groveUrl, groveOverride, scorecardUriOverride } = params
  if (scorecardUriOverride) return scorecardUriOverride
  const derived = lensUriFromGroveUrl(groveUrl)
  if (derived) return derived
  if (groveOverride) {
    throw new Error(
      'scorecard_uri_required: pass --scorecard-uri=lens://… with a non-Grove --grove URL',
    )
  }
  return DEFAULT_SCORECARD_URI
}

function snapshotDay(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return iso.slice(0, 10)
  return new Date(ts).toISOString().slice(0, 10)
}

async function loadScorecard(url: string): Promise<Scorecard> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`scorecard_fetch_failed:${res.status}`)
  const json = (await res.json()) as Scorecard
  if (json?.schema !== '4626.alfaclub.scorecard.v1') {
    throw new Error('scorecard_schema_mismatch')
  }
  return json
}

async function main(): Promise<void> {
  const groveOverride = argValue('--grove')
  const groveUrl = groveOverride ?? DEFAULT_GROVE_URL
  const scorecardUri = resolveScorecardUri({
    groveUrl,
    groveOverride,
    scorecardUriOverride: argValue('--scorecard-uri'),
  })
  const force = hasFlag('--force')
  const outPath = resolve(argValue('--out') ?? DEFAULT_OUT)
  const scorecard = await loadScorecard(groveUrl)

  const room = await getAlfaClubRoomDirectoryItem(scorecard.creator.tokenId)
  if (!room) {
    throw new Error(`room_snapshot_unavailable:${scorecard.creator.tokenId}`)
  }

  const roomMetrics = roomMetricsFromDirectoryItem(room, {
    pnl30dUsd: scorecard.metrics.hyperliquid?.pnl30dUsd ?? null,
  })
  const scorecardDay = snapshotDay(scorecard.snapshotTs)
  const roomDay = snapshotDay(room.ingestedAt)
  const mixedAsOf = roomDay !== scorecardDay

  const postability = evaluateIntegrityCardPostability(roomMetrics)
  const picked = pickMostPostableIntegrityCardSubject([
    {
      id: scorecard.creator.address,
      rank: scorecard.scores.rank,
      metrics: roomMetrics,
    },
  ])

  if (!postability.ok && !force) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          skipped: true,
          reason: 'below_bullish_thresholds',
          postability,
          picked,
          roomMetrics,
          roomId: room.roomId,
          scorecardSnapshotTs: scorecard.snapshotTs,
          roomIngestedAt: room.ingestedAt,
          mixedAsOf,
          scorecardUri,
          hint: 'Live numbers are below the public post gate. Pass --force to render them anyway.',
        },
        null,
        2,
      ),
    )
    process.exitCode = 2
    return
  }

  const handle = room.creatorHandle?.replace(/^@/, '') || null
  const rendered = await renderIntegrityCardPng({
    scorecard,
    visuals: {
      displayName: room.displayLabel || room.roomName || handle || `Room #${room.roomId}`,
      handle,
      roomName: room.roomName,
      roomImageUrl: argValue('--room-image') ?? room.imageUrl,
      scorecardUri,
      roomMetricsAsOf: room.ingestedAt,
    },
    roomMetrics,
  })

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, rendered.bytes)

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: force && !postability.ok ? 'forced_live' : 'live',
        outPath,
        width: rendered.width,
        height: rendered.height,
        rank: scorecard.scores.rank,
        creator: scorecard.creator.address,
        roomId: room.roomId,
        scorecardUri,
        scorecardSnapshotTs: scorecard.snapshotTs,
        roomIngestedAt: room.ingestedAt,
        mixedAsOf,
        postability,
        picked,
        roomMetrics,
        hasRoomImage: Boolean(rendered.visuals.roomImageDataUrl),
        hasPfp: Boolean(rendered.visuals.pfpDataUrl),
        hasHermitMark: Boolean(rendered.visuals.hermitMarkDataUrl),
      },
      null,
      2,
    ),
  )
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entry === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

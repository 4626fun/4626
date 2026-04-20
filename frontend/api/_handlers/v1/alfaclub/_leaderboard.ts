/**
 * GET /api/v1/alfaclub/leaderboard
 *
 * Returns the most-recent AlfaClub Integrity Leaderboard snapshot — the
 * ranked creator list Keepr derived from FriendKey supply + FriendStake
 * stake + Hyperliquid 30d PnL. Public, cached, read-only.
 *
 * Returns an empty payload (with `ok: false, reason: 'read_disabled'`) when
 * the pipeline is turned off via `ALFACLUB_VIGILANTE_READ_ENABLED=0`.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

import {
  getLatestSnapshotTs,
  getSnapshotAt,
  listRecentPublications,
  type MetricsSnapshotRow,
  type PublicationRecord,
} from '../../../../server/_lib/alfaclub/publicationLedger.js'
import {
  readVigilanteFlags,
} from '../../../../server/_lib/alfaclub/vigilante.js'
import { SCORECARD_DISCLAIMER } from '../../../../server/_lib/alfaclub/scorecard.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number) {
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
  )
}

type LeaderboardRowOut = {
  rank: number
  creatorAddress: string
  tokenId: string
  totalSupply: string
  stakedSupply: string
  pnl30dUsd: number | null
  hlAccountValueUsd: number | null
  score: number
  latestPublications: Array<{
    kind: string
    scorecardUri: string | null
    scorecardCid: string | null
    lensPostId: string | null
    erc8004TxHash: string | null
    createdAt: string
  }>
}

function serializeRow(
  row: MetricsSnapshotRow,
  pubsByAddress: Map<string, PublicationRecord[]>,
): LeaderboardRowOut {
  const pubs = pubsByAddress.get(row.creatorAddress.toLowerCase()) ?? []
  return {
    rank: row.rank,
    creatorAddress: row.creatorAddress,
    tokenId: row.tokenId.toString(),
    totalSupply: row.totalSupply.toString(),
    stakedSupply: row.stakedSupply.toString(),
    pnl30dUsd: row.pnl30dUsd,
    hlAccountValueUsd: row.hlAccountValueUsd,
    score: row.score,
    latestPublications: pubs.slice(0, 3).map((p) => ({
      kind: p.kind,
      scorecardUri: p.scorecardUri,
      scorecardCid: p.scorecardCid,
      lensPostId: p.lensPostId,
      erc8004TxHash: p.erc8004TxHash,
      createdAt: p.createdAt,
    })),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-leaderboard', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const flags = readVigilanteFlags()

  if (flags.killSwitch) {
    setCache(res, 60)
    return res.status(503).json({
      success: false,
      error: 'alfaclub_vigilante_kill_switch',
      disclaimer: SCORECARD_DISCLAIMER,
    })
  }

  if (!flags.readEnabled) {
    setCache(res, 60)
    return res.status(200).json({
      success: false,
      reason: 'read_disabled',
      disclaimer: SCORECARD_DISCLAIMER,
      data: { snapshotTs: null, rows: [], topN: flags.topN },
    })
  }

  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    setCache(res, 30)
    return res.status(200).json({
      success: true,
      disclaimer: SCORECARD_DISCLAIMER,
      data: {
        snapshotTs: null,
        rows: [],
        topN: flags.topN,
        reason: 'no_snapshot_yet',
      },
    })
  }

  const rows = await getSnapshotAt(snapshotTs)
  const recentPubs = await listRecentPublications(null, 200)
  const pubsByAddress = new Map<string, PublicationRecord[]>()
  for (const p of recentPubs) {
    const key = p.creatorAddress.toLowerCase()
    const list = pubsByAddress.get(key) ?? []
    list.push(p)
    pubsByAddress.set(key, list)
  }

  const topRows = rows.slice(0, flags.topN)
  const serialized = topRows.map((row) => serializeRow(row, pubsByAddress))

  setCache(res, 300)
  return res.status(200).json({
    success: true,
    disclaimer: SCORECARD_DISCLAIMER,
    data: {
      snapshotTs,
      topN: flags.topN,
      totalRanked: rows.length,
      rows: serialized,
    },
  })
}

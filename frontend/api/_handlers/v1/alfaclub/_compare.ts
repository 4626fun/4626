/**
 * POST /api/v1/alfaclub/compare
 *
 * Admin-only. Accepts a caller-supplied AlfaClub Privy bearer JWT in the
 * request body and performs a single read against their public leaderboard
 * endpoint (whichever the client points us at), producing a one-off diff
 * between their rank and the Keepr onchain-derived rank.
 *
 * Design constraints:
 *   - The JWT is NEVER persisted. We use it for one outbound request and
 *     drop it.
 *   - This is strictly user-mediated: the admin pasted their own token;
 *     the server never authenticates as itself to AlfaClub.
 *   - AlfaClub's ToS forbids third-party API access; this route exists
 *     only so an admin can manually verify our onchain ranking against
 *     what they already see in their own logged-in session. It does not
 *     fire in the cron.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  handleOptions,
  getSessionAddress,
  isAdminAddress,
} from '@4626/server-core'

import {
  getLatestSnapshotTs,
  getSnapshotAt,
  type MetricsSnapshotRow,
} from '../../../../server/_lib/alfaclub/publicationLedger.js'
import { SCORECARD_DISCLAIMER } from '../../../../server/_lib/alfaclub/scorecard.js'

declare const process: { env: Record<string, string | undefined> }

type CompareRequest = {
  /** Raw Privy JWT captured from the admin's own logged-in AlfaClub session. */
  alfaclubJwt?: string
  /**
   * Optional override URL. Defaults to the alfaclub.app origin.
   * We never call a different host — if the admin wants to test against
   * a different env they pass the full URL explicitly.
   */
  alfaclubUrl?: string
}

/** Mask the JWT for logs — never return or store the full token. */
function jwtFingerprint(token: string): string {
  const head = token.slice(0, 8)
  const tail = token.slice(-6)
  return `${head}…${tail}`
}

function isPlausibleJwt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

function normalizeAlfaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (!/^https?:$/.test(parsed.protocol)) return null
    const host = parsed.hostname.toLowerCase()
    // Only allow the alfaclub.app origin family; no arbitrary redirection.
    if (host !== 'api.alfaclub.app' && host !== 'alfaclub.app' && !host.endsWith('.alfaclub.app')) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

async function fetchAlfaClubSnapshot(
  url: string,
  jwt: string,
  timeoutMs = 8_000,
): Promise<
  | { ok: true; status: number; bodyExcerpt: string }
  | { ok: false; error: string }
> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${jwt}`,
      },
    })
    const raw = await res.text()
    const excerpt = raw.length > 2_000 ? `${raw.slice(0, 2_000)}…(truncated)` : raw
    return { ok: true, status: res.status, bodyExcerpt: excerpt }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { ok: false, error: name === 'AbortError' ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timer)
  }
}

type OnchainLite = {
  snapshotTs: string | null
  rows: Array<Pick<MetricsSnapshotRow, 'rank' | 'creatorAddress' | 'tokenId' | 'score'>>
}

async function readOnchainSnapshotLite(topN: number): Promise<OnchainLite> {
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) return { snapshotTs: null, rows: [] }
  const rows = await getSnapshotAt(snapshotTs)
  return {
    snapshotTs,
    rows: rows.slice(0, topN).map((r) => ({
      rank: r.rank,
      creatorAddress: r.creatorAddress,
      tokenId: r.tokenId,
      score: r.score,
    })),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-compare', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as CompareRequest
  const alfaclubJwt = typeof body?.alfaclubJwt === 'string' ? body.alfaclubJwt.trim() : ''
  const alfaclubUrl = normalizeAlfaUrl(body?.alfaclubUrl)

  if (!isPlausibleJwt(alfaclubJwt)) {
    return res.status(400).json({
      success: false,
      error: 'alfaclubJwt is required and must be a Privy JWT (three dot-separated segments).',
    })
  }
  if (!alfaclubUrl) {
    return res.status(400).json({
      success: false,
      error: 'alfaclubUrl must be an https URL on the alfaclub.app domain family.',
    })
  }

  const onchain = await readOnchainSnapshotLite(200)
  const remote = await fetchAlfaClubSnapshot(alfaclubUrl, alfaclubJwt)

  return res.status(200).json({
    success: true,
    disclaimer: SCORECARD_DISCLAIMER,
    data: {
      onchain: {
        snapshotTs: onchain.snapshotTs,
        rows: onchain.rows.map((r) => ({
          rank: r.rank,
          creatorAddress: r.creatorAddress,
          tokenId: r.tokenId.toString(),
          score: r.score,
        })),
      },
      remote: remote.ok
        ? {
            status: remote.status,
            bodyExcerpt: remote.bodyExcerpt,
          }
        : { error: remote.error },
      jwtFingerprint: jwtFingerprint(alfaclubJwt),
      note:
        'The JWT was used for a single outbound request and was not persisted. ' +
        'Cross-reference manually — automated parsing of AlfaClub\'s private API shape is intentionally not performed.',
    },
  })
}

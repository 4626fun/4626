import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress } from 'viem'

import {
  type ApiEnvelope,
  checkDurableRateLimit,
  getClientIp,
  getDb,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setNoStore,
} from '@4626/server-core'
import { issueCswEntryChallenge } from '../../../server/_lib/zora/cswGateVerification.js'

// FIX: M-01 — /api/zora/csw-entry/challenge
//
// Issues a single-use, CSW-scoped challenge nonce. The client must sign the
// returned `message` with the CSW (EOA via personal_sign, or ERC-4337 smart
// wallet via EIP-1271) and POST the nonce + signature back to
// /api/zora/csw-entry. Without a valid signed challenge, the entry endpoint
// now refuses to issue a Telegram verification token.
//
// Separating challenge issuance from entry submission keeps the signable
// payload small and auditable, and lets us rate-limit the two surfaces
// independently. Challenges are single-use and expire in 10 minutes by default.

type ChallengeRequestBody = {
  cswAddress?: string
}

type ChallengeResponse = {
  cswAddress: `0x${string}`
  nonce: string
  message: string
  expiresAt: string
}

const CHALLENGE_BODY_MAX_BYTES = 4_096

function setEntryCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  setEntryCors(res)
  res.status(200).end()
  return true
}

function asObjectBody(input: unknown): ChallengeRequestBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as ChallengeRequestBody
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed).toLowerCase() as `0x${string}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setEntryCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Reuse the existing CSW-link rate limit bucket. Issuing a challenge is
  // cheap on the server but we don't want address-enumeration fishing.
  const limiter = await checkDurableRateLimit(rateLimitKey('zora-csw-entry-challenge', getClientIp(req)), RATE_LIMITS.cswLink, { failClosed: true })
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CHALLENGE_BODY_MAX_BYTES }))
  const cswAddress = normalizeAddress(body.cswAddress)
  if (!cswAddress) {
    return res.status(400).json({ success: false, error: 'Invalid cswAddress' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: 'Database unavailable for challenge issuance' } satisfies ApiEnvelope<never>)
  }

  const challenge = await issueCswEntryChallenge({ db: db as any, cswAddress })

  const data: ChallengeResponse = {
    cswAddress,
    nonce: challenge.nonce,
    message: challenge.message,
    expiresAt: challenge.expiresAt,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ChallengeResponse>)
}

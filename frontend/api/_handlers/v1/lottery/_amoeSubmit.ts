import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getApiContracts,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'



import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  AMOE_MIN_POINTS_PER_SUBMISSION,
  AMOE_MAX_POINTS_PER_SUBMISSION,
  buildProcessAmoeEntryCall,
  consumeAmoeCreditsForEntry,
  getAmoeCreditSnapshot,
  verifyAmoeEntryProof,
} from '../../../../server/_lib/lottery/lotteryAmoe.js'
import {
  AmoeAuthorityError,
  classifyAmoeError,
} from '../../../../server/_lib/lottery/lotteryAmoeErrors.js'
import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { resolveAmoeCreatorTarget } from '../../../../server/_lib/lottery/amoeCreatorTarget.js'
import { createAmoeRelay } from '../../../../server/_lib/lottery/amoeRelay.js'

type SubmitBody = {
  creatorCoin?: string
  message?: string
  signature?: string
  pointsBurned?: number | string
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parsePointsBurned(value: unknown): number | null {
  // Accept number or numeric string (JSON.stringify of bigint isn't valid JSON,
  // and the slider/input may serialize either form). Reject anything else so
  // `pointsToUsd1e6` only ever sees a clean integer it can validate.
  let n: number
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string' && value.trim().length > 0) {
    n = Number(value.trim())
  } else {
    return null
  }
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

async function relayAmoeEntryTransaction(params: {
  to: `0x${string}`
  callData: `0x${string}`
}): Promise<`0x${string}`> {
  const relay = createAmoeRelay()
  if (!relay) throw new Error('amoe_relay_unavailable')
  return relay(params)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/submit', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-submit', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const creatorCoinRaw = typeof body.creatorCoin === 'string' ? body.creatorCoin.trim() : ''
  const creatorTarget = resolveAmoeCreatorTarget(creatorCoinRaw)
  const message = typeof body.message === 'string' ? body.message : ''
  const signatureRaw = typeof body.signature === 'string' ? body.signature.trim() : ''
  const pointsBurned = parsePointsBurned((body as SubmitBody).pointsBurned)

  if (!creatorTarget.ok) {
    const status = creatorTarget.error === 'invalid_creator_coin' ? 400 : 503
    return res.status(status).json({
      success: false,
      error: creatorTarget.error === 'invalid_creator_coin' ? 'invalid_creatorCoin' : creatorTarget.error,
    })
  }
  const creatorCoin = creatorTarget.creatorCoin

  if (!message || !signatureRaw.startsWith('0x')) {
    return res.status(400).json({ success: false, error: 'Missing or invalid message/signature' })
  }

  // PR 2 — variable points amount. Enforce range here so we can return a clean
  // 400 before doing any DB or signature work. `pointsToUsd1e6` re-validates
  // defensively at the conversion site.
  if (
    pointsBurned === null ||
    pointsBurned < AMOE_MIN_POINTS_PER_SUBMISSION ||
    pointsBurned > AMOE_MAX_POINTS_PER_SUBMISSION
  ) {
    return res.status(400).json({
      success: false,
      error: `pointsBurned must be an integer in [${AMOE_MIN_POINTS_PER_SUBMISSION}, ${AMOE_MAX_POINTS_PER_SUBMISSION}]`,
    })
  }

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!isAddressLike(String(lotteryManager ?? ''))) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'submit', ip, creatorCoin), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const proof = await verifyAmoeEntryProof({
      creatorCoin,
      message,
      signature: signatureRaw as `0x${string}`,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    // Re-verify wallet authority against the auth context.
    //
    // The signature inside `verifyAmoeEntryProof` cryptographically binds
    // the proof to a wallet, but for EIP-1271 / smart-wallet signatures
    // the wallet's owner set can change between sessions: a wallet whose
    // owner key was rotated yesterday still produces a valid `isValidSignature`
    // today. The nonce / credits handlers always re-resolve through
    // `resolveAmoeWallet` so the auth identity must currently authorise the
    // wallet; previously, submit skipped that check and trusted the on-chain
    // signature alone. We now mirror nonce / credits / twitter-checkin
    // semantics so a stale auth session cannot piggy-back a freshly
    // re-owned wallet.
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: proof.wallet,
      authAddress: g.auth?.address ?? null,
    })
    if (!walletAuthority.ok) {
      throw new AmoeAuthorityError(walletAuthority.error)
    }

    // PR 2 follow-up — pre-flight balance check (P1 review fix).
    // Nonces are issued without a balance gate, so without this check a
    // client could request `pointsBurned: 1_000_000` while holding only
    // 100 credits, get a 4%-pre-boost entry mined on-chain, and only
    // then fail the debit with a 402 — effectively bypassing the AMOE
    // credit economy. We snapshot the live balance and reject BEFORE
    // doing any on-chain work so under-collateralized entries never
    // reach the chain.
    //
    // The atomic debit further down still runs after relay (preserves
    // the audit fix that prevents credit-burn on contract reverts like
    // `DeadlineTooSoon`). The debit's own balance check is the
    // source-of-truth race-safe gate — this pre-flight is the cheap
    // anti-inflation gate that prevents the on-chain side-effect first.
    const snapshot = await getAmoeCreditSnapshot({ wallet: proof.wallet })
    if (snapshot.credits < pointsBurned) {
      // Match the existing AMOE error vocabulary so `classifyAmoeError`
      // returns 402.
      throw new Error('insufficient_amoe_credits')
    }

    // PR 2 — Option B2 server-relay-only path. The previous flow built an
    // ECDSA-signed attestation for `LotteryAmoeRouter.submitAmoeEntry`; the
    // new path targets PR 1's `CreatorLotteryManager.processAmoeEntry`,
    // which is gated to a single-address relayer allowlist on-chain. The
    // user's signed message remains the off-chain auth + anti-replay
    // artifact (verified above) but is NOT included in the on-chain call.
    // See docs/security/amoe-pr2-handoff.md for the full trust model.
    const call = await buildProcessAmoeEntryCall({
      wallet: proof.wallet,
      creatorCoin: proof.creatorCoin,
      pointsBurned,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    // Lottery entries intentionally do NOT award waitlist points — users
    // grow their waitlist score via the daily social share (check-in),
    // which is the base action that later unlocks lottery entries. The
    // credit-ledger writes below stay the source of truth for entry
    // economics; waitlist score is decoupled.

    // Relay first, debit second. Previously credits were consumed BEFORE
    // the on-chain submission, which meant any contract-side revert
    // (e.g. the new `DeadlineTooSoon` floor from audit §4.2) silently
    // burned user credits. Issuer mirrors the 60s floor so we shouldn't
    // hit that revert in practice, but ordering is the durable fix.
    const txHash = await relayAmoeEntryTransaction({
      to: call.to,
      callData: call.callData,
    })
    const creditSpend = await consumeAmoeCreditsForEntry({
      wallet: proof.wallet,
      requiredCredits: pointsBurned,
      refId: `${proof.creatorCoin}:${proof.nonce}`,
    })

    return res.status(200).json({
      success: true,
      data: {
        txHash,
        relayMode: 'server',
        pointsBurned: call.pointsBurned,
        pointsBurnedAsUSD: call.pointsBurnedAsUSD,
        estimatedWinChancePPM: call.estimatedWinChancePPM,
        creditsConsumed: creditSpend.consumed,
        creditsRemaining: creditSpend.creditsRemaining,
        creditsPerEntry: creditSpend.creditsPerEntry,
        entriesAvailable: creditSpend.entriesAvailable,
      },
    })
  } catch (error: unknown) {
    // Pivots on `instanceof Amoe*Error` first; falls back to legacy substring
    // classification for any not-yet-migrated thrower. See
    // `frontend/server/_lib/lottery/lotteryAmoeErrors.ts`.
    const { status, message } = classifyAmoeError(error)
    return res.status(status).json({
      success: false,
      error: message,
    })
  }
}

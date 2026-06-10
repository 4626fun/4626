// SPDX-License-Identifier: MIT
//
// AMOE points-burn handler — `POST /api/v1/lottery/amoe/burn-credits`.
//
// Phase A of the burn-then-submit split (see
// `docs/security/amoe-burn-then-submit-design.md`).
//
// Today, `_amoeSubmitZk.ts` debits credits AFTER `orchestrate()`, which
// makes the production `AmoeLedgerSnapshotPgReader` path impossible
// (the L1 row for `(signup_id, spend_ref_id)` doesn't exist when the
// reader looks for it; PR #451 hot-fix gated the reader off until this
// PR ships). This handler is the production half of the fix: it
// validates + atomically debits credits, writing the L1 burn row.
//
// Phase B (PR 6b) will modify `_amoeSubmitZk.ts` to remove its trailing
// `consumeAmoeCreditsForEntry` call and instead pre-flight the reader.
// Until 6b lands, this endpoint is effectively dormant — the legacy
// flow still works end-to-end, this endpoint is just available for the
// frontend to integrate against.
//
// FEATURE FLAG
// ============
// Hidden behind `AMOE_BURN_CREDITS_ENABLED=1`. Default OFF. Returns
// 503 `burn_credits_disabled` when the flag is unset, matching the
// fail-closed convention of `_amoeSubmitZk.ts`.
//
// CONTRACT
// ========
// Body matches the existing `_amoeSubmitZk.ts` body (creatorCoin,
// message, signature, pointsBurned, nonce, twitterHandle, spendRefId).
// We deliberately mirror the field set so the frontend can build one
// envelope and POST it to phase A first, then phase B.
//
// IDEMPOTENCY
// ===========
// Idempotency key is `spendRefId`. The underlying
// `consumeAmoeCreditsForEntry` writes the burn via `INSERT INTO points`
// with `source='amoe_entry_spend'` + `source_id=spendRefId`, dedup'd
// by the partial unique index `(signup_id, source, source_id)`. So a
// retried call with the same `spendRefId` returns the same balances
// without double-debiting.
//
// CREATOR LOCK
// ============
// `creatorCoin` is bound into the EIP-191 message and is therefore
// effectively locked at burn time. A user who calls phase A then
// changes their mind about which creator to enter must mint a new
// `spendRefId` (and either accept the old burn as wasted credits or
// wait for the auto-refund cron in PR 6c).

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
} from '@4626/server-core'

import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  AMOE_MIN_POINTS_PER_SUBMISSION,
  AMOE_MAX_POINTS_PER_SUBMISSION,
  consumeAmoeCreditsForEntry,
  getAmoeCreditSnapshot,
  parseAmoeEntryMessage,
  verifyAmoeWalletSignature,
} from '../../../../server/_lib/lottery/lotteryAmoe.js'
import {
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeInsufficientCreditsError,
  classifyAmoeError,
} from '../../../../server/_lib/lottery/lotteryAmoeErrors.js'
import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { resolveAmoeCreatorTarget } from '../../../../server/_lib/lottery/amoeCreatorTarget.js'
import {
  AMOE_EPOCH_GENESIS_UNIX_SEC,
  AMOE_EPOCH_SECONDS,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'

declare const process: { env: Record<string, string | undefined> }

type BurnCreditsBody = {
  creatorCoin?: string
  message?: string
  signature?: string
  pointsBurned?: number | string
  nonce?: string
  twitterHandle?: string
  spendRefId?: string
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

function isBytes32Like(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function parsePointsBurned(value: unknown): number | null {
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

/**
 * Feature flag — fail closed by default. Burn-then-submit is rolled
 * out by environment via this flag; the legacy `_amoeSubmitZk.ts`
 * path keeps working unchanged when the flag is off.
 */
function isAmoeBurnCreditsEnabled(): boolean {
  return process.env.AMOE_BURN_CREDITS_ENABLED === '1'
}

/**
 * Compute the unix timestamp at which a burn that landed in `epoch`
 * becomes eligible for phase B submission. Equals the start of
 * `epoch + 1`, which is when the publisher cron can confirm the
 * snapshot containing this burn.
 *
 * Mirrors the inverse of `computeAmoeEpoch`:
 *   epoch = (now - genesis) / length
 *   eligible = genesis + (epoch + 1) * length
 *
 * Caller adds an additional ~15 min buffer for the publisher tick;
 * we do NOT bake that buffer into this function so the contract
 * stays mathematically pure.
 */
export function computeEligibleSubmitAfterUnixSec(burnEpoch: bigint): bigint {
  return AMOE_EPOCH_GENESIS_UNIX_SEC + (burnEpoch + 1n) * AMOE_EPOCH_SECONDS
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Feature flag — fail closed.
  if (!isAmoeBurnCreditsEnabled()) {
    return res.status(503).json({ success: false, error: 'burn_credits_disabled' })
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/lottery/amoe/burn-credits',
    kind: 'read',
  })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey(
      'v1-lottery-amoe-burn-credits',
      g.auth?.address?.toLowerCase() ?? 'anon',
      getClientIp(req),
    ),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const b = body as BurnCreditsBody
  const creatorCoinRaw = typeof b.creatorCoin === 'string' ? b.creatorCoin.trim() : ''
  const creatorTarget = resolveAmoeCreatorTarget(creatorCoinRaw)
  const message = typeof b.message === 'string' ? b.message : ''
  const signatureRaw = typeof b.signature === 'string' ? b.signature.trim() : ''
  const nonceRaw = typeof b.nonce === 'string' ? b.nonce.trim() : ''
  const twitterHandle = typeof b.twitterHandle === 'string' ? b.twitterHandle.trim() : ''
  const spendRefId = typeof b.spendRefId === 'string' ? b.spendRefId.trim() : ''
  const pointsBurned = parsePointsBurned(b.pointsBurned)

  if (!creatorTarget.ok) {
    const status = creatorTarget.error === 'invalid_creator_coin' ? 400 : 503
    return res.status(status).json({
      success: false,
      error: creatorTarget.error === 'invalid_creator_coin' ? 'invalid_creatorCoin' : creatorTarget.error,
    })
  }
  const creatorCoin = creatorTarget.creatorCoin

  if (!message || !signatureRaw.startsWith('0x') || !isBytes32Like(nonceRaw)) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid message/signature/nonce' })
  }
  if (twitterHandle.length === 0 || spendRefId.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid twitterHandle/spendRefId' })
  }

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

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(
    rateLimitKey('amoe', 'burn-credits', ip, creatorCoin),
    {
      windowMs: 60_000,
      maxRequests: 6,
    },
  )
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    // ----------------------------------------------------------------
    // 1. Wallet authority — resolve canonical wallet + profileId.
    //    Same logic as `_amoeSubmitZk.ts` step 1; deliberately
    //    duplicated because (a) the legacy module is on its own
    //    deprecation timeline and (b) sharing handler-local helpers
    //    has historically produced subtle env-fallback regressions.
    // ----------------------------------------------------------------
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: null,
      authAddress: g.auth?.address ?? null,
    })
    if (!walletAuthority.ok) {
      throw new AmoeAuthorityError(walletAuthority.error)
    }
    const wallet = walletAuthority.value.wallet
    const profileId = walletAuthority.value.profileId
    if (
      typeof profileId !== 'number' ||
      !Number.isFinite(profileId) ||
      !Number.isSafeInteger(profileId) ||
      profileId <= 0
    ) {
      throw new AmoeAuthorityError('amoe_profile_unresolved')
    }

    // ----------------------------------------------------------------
    // 2. Parse + bind the canonical EIP-191 message BEFORE verifying
    //    the signature. Mirrors `_amoeSubmitZk.ts` step 2 exactly.
    //    Phase A locks (creatorCoin, nonce, chainId, lotteryManager,
    //    expiresAt) at burn time; phase B re-verifies the same
    //    bindings against the same `spendRefId`, so a swap between
    //    phase A and phase B is impossible without minting a new
    //    `spendRefId` (which gets a fresh burn).
    // ----------------------------------------------------------------
    const parsedMessage = parseAmoeEntryMessage(message)
    if (!parsedMessage) {
      throw new AmoeBadRequestError('invalid_message')
    }
    if (parsedMessage.wallet !== wallet.toLowerCase()) {
      throw new AmoeBadRequestError('wallet_mismatch')
    }
    if (parsedMessage.creatorCoin !== creatorCoin) {
      throw new AmoeBadRequestError('creator_mismatch')
    }
    if (parsedMessage.nonce !== nonceRaw.toLowerCase()) {
      throw new AmoeBadRequestError('nonce_mismatch')
    }
    if (parsedMessage.chainId !== 8453) {
      throw new AmoeBadRequestError('invalid_chain')
    }
    const messageLotteryManager = String(getApiContracts().lotteryManager ?? '').toLowerCase()
    if (
      !isAddressLike(messageLotteryManager) ||
      parsedMessage.lotteryManager !== messageLotteryManager
    ) {
      throw new AmoeBadRequestError('lottery_manager_mismatch')
    }
    // `Date.parse` returns NaN for malformed ISO strings, and
    // `NaN <= Date.now()` is always false — which would let any
    // non-parseable `expiresAt` slip past the expiry guard. Reject
    // non-finite values explicitly so the replay-window contract
    // holds for every signed payload, not just well-formed ones.
    const parsedExpiryMs = Date.parse(parsedMessage.expiresAt)
    if (!Number.isFinite(parsedExpiryMs) || parsedExpiryMs <= Date.now()) {
      throw new AmoeBadRequestError('message_expired')
    }

    // ----------------------------------------------------------------
    // 3. Verify wallet signature. Phase A does NOT consume the nonce
    //    — phase B does, because nonce-consumption gates the on-chain
    //    submission, not the off-chain debit. A user who burns then
    //    fails phase B should still see the nonce reusable in a
    //    retry (with the same spendRefId, which dedupes the burn).
    // ----------------------------------------------------------------
    const sigOk = await verifyAmoeWalletSignature({
      wallet,
      message,
      signature: signatureRaw as `0x${string}`,
    })
    if (!sigOk) {
      throw new AmoeBadRequestError('signature_invalid')
    }

    // ----------------------------------------------------------------
    // 4. Pre-flight balance gate. Same as the legacy handler — reject
    //    under-collateralized requests cheaply, before touching the
    //    write path.
    // ----------------------------------------------------------------
    const snapshot = await getAmoeCreditSnapshot({ wallet })
    if (snapshot.credits < pointsBurned) {
      throw new AmoeInsufficientCreditsError()
    }

    // ----------------------------------------------------------------
    // 5. Burn. `consumeAmoeCreditsForEntry` is atomic + idempotent on
    //    `(signup_id, source='amoe_entry_spend', source_id=spendRefId)`,
    //    so a retried call with the same `spendRefId` is a no-op.
    // ----------------------------------------------------------------
    const debitResult = await consumeAmoeCreditsForEntry({
      wallet,
      requiredCredits: pointsBurned,
      refId: spendRefId,
    })

    // ----------------------------------------------------------------
    // 5b. Phase-A intent marker. Written ATOMICALLY inside
    //     `consumeAmoeCreditsForEntry`'s debit CTE — do NOT add a
    //     follow-up INSERT here. Codex flagged the original layout
    //     (post-debit handler-side INSERT) as P1: a transient failure
    //     after the debit committed would leave an unmarked burn
    //     that the refund cron would skip permanently. The marker is
    //     now part of the same single-statement transaction as the
    //     debit (Postgres CTE atomicity), so either both rows commit
    //     or neither does. See lotteryAmoe.ts `consumeAmoeCreditsForEntry`
    //     and docs/security/amoe-burn-then-submit-design.md §5.1.1.
    // ----------------------------------------------------------------

    // ----------------------------------------------------------------
    // 6. Compute eligibleSubmitAfter from the PERSISTED burn time
    //    (not `Date.now()` at response time). `consumeAmoeCreditsForEntry`
    //    sources `burnedAt` / `burnEpoch` from the actual `points` row
    //    — in both the new-insert path and the idempotent-retry path
    //    — so a retry returns the same epoch the original burn landed
    //    in. Without this, a retry that crosses an epoch boundary
    //    would tell the client "wait one more epoch" even though the
    //    burn is already eligible.
    //
    //    Note: `eligibleSubmitAfter` is the START of the next epoch
    //    (when the publisher CAN confirm). The frontend should add
    //    a 15min buffer for the publisher's `*/15 * * * *` tick.
    // ----------------------------------------------------------------
    const burnEpochBig = BigInt(debitResult.burnEpoch)
    const eligibleSubmitAfterUnixSec = computeEligibleSubmitAfterUnixSec(burnEpochBig)

    return res.status(200).json({
      success: true,
      data: {
        spendRefId,
        burnedAt: debitResult.burnedAt,
        burnEpoch: debitResult.burnEpoch,
        eligibleSubmitAfterUnixSec: Number(eligibleSubmitAfterUnixSec),
        consumed: debitResult.consumed,
        creditsRemaining: debitResult.creditsRemaining,
        creditsPerEntry: debitResult.creditsPerEntry,
        entriesAvailable: debitResult.entriesAvailable,
      },
    })
  } catch (err) {
    const { status, message: msg } = classifyAmoeError(err)
    return res.status(status).json({ success: false, error: msg })
  }
}

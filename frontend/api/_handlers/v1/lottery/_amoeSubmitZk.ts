// SPDX-License-Identifier: MIT
//
// AMOE ZK submit handler — `POST /api/v1/lottery/amoe/submit-zk`.
//
// Replaces the off-chain ECDSA-attestation eligibility artifact (see
// `_amoeSubmit.ts`) with a server-built PLONK proof. The wallet
// signature on the canonical EIP-191 message is still required as the
// off-chain auth + replay artifact (verified via
// `verifyAmoeWalletSignature`); the on-chain artifact is the proof
// + 8 public inputs consumed by `LotteryAmoeRouter.submitAmoeEntryZK`.
//
// Behind a feature flag (`AMOE_ZK_SUBMIT_ENABLED=1`) until PR 5 lands
// the publisher and we cut over.
//
// Trust model + flow chart:
//   docs/security/amoe-pr3-handler-swap-plan.md §4

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
  getDb,
} from '@4626/server-core'

import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  AMOE_MIN_POINTS_PER_SUBMISSION,
  AMOE_MAX_POINTS_PER_SUBMISSION,
  AMOE_PLONK_PUB_INPUT_SLOT,
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
import { consumeAmoeNonceForSubmit } from '../../../../server/_lib/lottery/amoeNonceStore.js'
import {
  computeAmoeEpoch,
  defaultAmoeZkAssetPaths,
  isAmoeZkSubmitEnabled,
  orchestrateAmoeSubmitZk,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'
import {
  findActiveByNonceCommit,
  insertPending,
  markBroadcasting,
  markManagerDeclined,
  markProveFailed,
  markProven,
  markRejectedChain,
  markSettled,
  type AmoeReplayProofBlob,
} from '../../../../server/_lib/lottery/amoeReplayStore.js'
import {
  AmoeBurnRowMissingError,
  AmoeLedgerSnapshotPgReader,
  AmoeSnapshotNotYetConfirmedError,
  type AmoeLedgerSnapshotReader,
} from '../../../../server/_lib/lottery/amoeLedgerSnapshotReader.js'
import {
  AMOE_EPOCH_GENESIS_SECONDS,
  AMOE_EPOCH_LENGTH_SECONDS,
} from '../../../../server/_lib/lottery/amoeWitness.js'
import {
  createAmoeRelay,
  type AmoeRelayFn,
} from '../../../../server/_lib/lottery/amoeRelay.js'

declare const process: { env: Record<string, string | undefined> }

type SubmitZkBody = {
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
 * Convert a bigint pubInputs scalar to canonical 32-byte hex form, the
 * shape stored in the replay-store nullifier columns. Pads with leading
 * zeros so two distinct scalars never collide on truncation.
 */
function bigintToBytes32Hex(value: bigint): `0x${string}` {
  const hex = value.toString(16)
  return `0x${hex.padStart(64, '0')}` as `0x${string}`
}

/**
 * Best-effort detector for `LotteryAmoeRouter.ManagerDeclinedEntry`
 * reverts.
 *
 * The router emits this revert (lines 392-403) when
 * `manager.processAmoeEntry` returns 0, and intentionally rolls back
 * the nullifier writes so the proof is reusable. The relayer surfaces
 * this through different shapes depending on the transport (raw EOA tx
 * → `ContractFunctionExecutionError`; user-op → bundler error string),
 * so we sniff the shapes we know about and let the rest fall through
 * to the generic `markRejectedChain` path.
 *
 * Returns `null` if the error doesn't look like ManagerDeclinedEntry.
 */
function decodeManagerDeclinedRevert(
  err: unknown,
): { reason: string; txHash: `0x${string}` | null } | null {
  if (!err || typeof err !== 'object') return null
  const e = err as {
    name?: string
    message?: string
    cause?: { name?: string; message?: string }
    shortMessage?: string
    metaMessages?: string[]
    transactionHash?: string
  }
  const haystack = [
    e.name,
    e.message,
    e.shortMessage,
    e.cause?.name,
    e.cause?.message,
    ...(Array.isArray(e.metaMessages) ? e.metaMessages : []),
  ]
    .filter((s): s is string => typeof s === 'string')
    .join(' | ')
  if (!haystack) return null
  // Match the custom error name verbatim. The selector form
  // (`0x12345678`) would be more robust but viem typically surfaces the
  // decoded name when the ABI is in scope (which it is here, via
  // `buildAmoeEntryZKCall`). Fallback string match keeps us correct
  // when the bundler returns a stringified error.
  if (!/ManagerDeclinedEntry/.test(haystack)) return null
  const txHash =
    typeof e.transactionHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(e.transactionHash)
      ? (e.transactionHash.toLowerCase() as `0x${string}`)
      : null
  return {
    reason: 'ManagerDeclinedEntry',
    txHash,
  }
}

/**
 * Send the relayer transaction to `LotteryAmoeRouter.submitAmoeEntryZK`.
 *
 * Same dual-mode design as the legacy handler: prefer ERC-4337 user-op
 * via Coinbase Smart Wallet when configured; otherwise fall back to a
 * raw EOA signed tx. Lifted in-place rather than extracted to a shared
 * helper because (a) it's identical code-shape but different `to` and
 * (b) the legacy module is on its own deprecation timeline; sharing
 * would couple them.
 */
async function relayAmoeEntryZkTransaction(params: {
  to: `0x${string}`
  callData: `0x${string}`
}): Promise<`0x${string}`> {
  const relay = createAmoeRelay()
  if (!relay) throw new Error('amoe_relay_unavailable')
  return relay(params)
}

/**
 * Test seam — handler accepts an injectable orchestration + relay so
 * vitest can run the full pipeline without real snarkjs / RPC.
 *
 * Production callers leave this empty; the handler resolves the
 * defaults. Exported for use by the integration test harness.
 */
export interface AmoeSubmitZkHandlerHooks {
  orchestrate?: typeof orchestrateAmoeSubmitZk
  relay?: AmoeRelayFn
  /**
   * Test seam for the burn-then-submit reader pre-flight (PR 6b).
   * When `AMOE_BURN_THEN_SUBMIT_REQUIRED=1`, the handler calls
   * `reader.readSnapshotForBurn` BEFORE `insertPending`. Tests
   * inject a stub here so they don't need a live `db.sql` shape.
   *
   * When omitted in production, the handler builds a real
   * `AmoeLedgerSnapshotPgReader` against the configured Postgres pool.
   */
  ledgerSnapshotReader?: AmoeLedgerSnapshotReader
}

/**
 * Compute the unix timestamp at which a burn that landed in `epoch`
 * becomes eligible for phase B submission. Equals the START of
 * `epoch + 1`. Used to populate the `Retry-After` header on a 425
 * response so clients can back off until the publisher's next tick
 * has a chance to confirm the snapshot.
 *
 * Mirrors the helper in `_amoeBurnCredits.ts` — inlined to avoid a
 * cross-handler import (the burn-credits handler should not be a
 * dependency of submit-zk).
 */
function computeEligibleSubmitAfterUnixSec(burnEpoch: bigint): bigint {
  return AMOE_EPOCH_GENESIS_SECONDS + (burnEpoch + 1n) * AMOE_EPOCH_LENGTH_SECONDS
}

/**
 * Feature flag — fail closed by default. When `=1`, the handler
 * REQUIRES that phase A (`/api/v1/lottery/amoe/burn-credits`) ran
 * first: it pre-flights `readSnapshotForBurn`, skips the
 * `getAmoeCreditSnapshot` pre-flight, passes the reader to
 * orchestrate unconditionally (ignoring the legacy
 * `AMOE_ZK_SNAPSHOT_READER_ENABLED` dial), and skips the trailing
 * `consumeAmoeCreditsForEntry` debit (already done in phase A).
 *
 * When unset, behavior is byte-for-byte identical to the legacy
 * single-call flow — the trailing debit, the credit pre-flight, and
 * the `AMOE_ZK_SNAPSHOT_READER_ENABLED` reader dial all stay live.
 * This lets ops flip the flag staged across environments without a
 * code rollback.
 */
function isBurnThenSubmitRequired(): boolean {
  return process.env.AMOE_BURN_THEN_SUBMIT_REQUIRED === '1'
}

let __testHooks: AmoeSubmitZkHandlerHooks = {}

/**
 * Override the handler's orchestrate / relay impls. Vitest only — call
 * `__resetAmoeSubmitZkHandlerHooks()` between tests.
 */
export function __setAmoeSubmitZkHandlerHooksForTest(hooks: AmoeSubmitZkHandlerHooks): void {
  __testHooks = { ...hooks }
}

export function __resetAmoeSubmitZkHandlerHooksForTest(): void {
  __testHooks = {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Feature flag — fail closed. Returns 503 (not 404) so deployment
  // automation can detect "endpoint exists but disabled".
  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ success: false, error: 'zk_path_disabled' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/submit-zk', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-submit-zk', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const b = body as SubmitZkBody
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

  const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
  if (!lotteryAmoeRouter) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'submit-zk', ip, creatorCoin), {
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
    // ----------------------------------------------------------------
    // 1. Wallet authority — resolve canonical wallet + profileId.
    // ----------------------------------------------------------------
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: null, // ZK path takes wallet from auth context, not body
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
      // No profile resolvable for this auth → can't bind signupIdHash.
      // 403 is more honest than 401: the auth was valid, the profile
      // wasn't.
      //
      // Safe-integer guard: `profiles.id` is a Postgres bigint, but the
      // resolver currently round-trips through JS `number` (see
      // `canonicalWalletResolver.readProfileWalletAuthorityRow` —
      // `Number(row.id)`). For values above 2^53-1 that conversion
      // silently aliases distinct profile rows to the same JS number,
      // which would alias their `signupIdHash` and corrupt nullifier /
      // replay identity. Until the resolver is migrated to bigint /
      // string end-to-end (tracked alongside PR 5's `ApiContracts`
      // hardening), reject unsafe values explicitly here rather than
      // hashing them.
      throw new AmoeAuthorityError('amoe_profile_unresolved')
    }

    // ----------------------------------------------------------------
    // 2. Parse + bind the canonical EIP-191 message BEFORE verifying
    //    the signature.
    //
    //    Codex review (#439) flagged the original "opaque message"
    //    behavior: a leaked/old wallet signature over any string from
    //    the same wallet could be replayed with fresh nonces because
    //    the signature layer didn't bind to (creatorCoin, nonce,
    //    chain, expiry, lotteryManager). We mirror the legacy
    //    `verifyAmoeEntryProof` checks here so the ZK path enforces
    //    the same per-request replay + expiry guarantees as the
    //    ECDSA-attestation path.
    //
    //    The message is bound to the `CreatorLotteryManager` contract
    //    address (NOT `LotteryAmoeRouter`) because clients receive the
    //    message from `_amoeNonce.ts`, which uses
    //    `getApiContracts().lotteryManager`. Cutover to a router-bound
    //    message lives in PR 5 (`ApiContracts` consolidation).
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
    const messageLotteryManager = String(
      getApiContracts().lotteryManager ?? '',
    ).toLowerCase()
    if (
      !isAddressLike(messageLotteryManager) ||
      parsedMessage.lotteryManager !== messageLotteryManager
    ) {
      throw new AmoeBadRequestError('lottery_manager_mismatch')
    }
    // `Date.parse` returns NaN for malformed ISO strings, and
    // `NaN <= Date.now()` is always false — so any non-parseable
    // `expiresAt` would slip past the expiry guard, weakening the
    // replay-window contract for signed payloads. Reject non-finite
    // values explicitly. (Same fix lives in `_amoeBurnCredits.ts`;
    // the bug is identical because that handler was extracted from
    // here.)
    const parsedExpiryMs = Date.parse(parsedMessage.expiresAt)
    if (!Number.isFinite(parsedExpiryMs) || parsedExpiryMs <= Date.now()) {
      throw new AmoeBadRequestError('message_expired')
    }

    // ----------------------------------------------------------------
    // 3. Verify wallet signature over the canonical EIP-191 message.
    //    Now safe — the message is fully bound above.
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
    // 4. Consume the nonce atomically. After this point, the same
    //    (wallet, creatorCoin, nonce) tuple cannot reach the witness
    //    layer twice.
    // ----------------------------------------------------------------
    await consumeAmoeNonceForSubmit({
      wallet,
      creatorCoin,
      nonce: nonceRaw as `0x${string}`,
    })

    // ----------------------------------------------------------------
    // 5. Pre-flight balance gate (legacy single-call flow only).
    //
    //    When `AMOE_BURN_THEN_SUBMIT_REQUIRED=1`, the burn already
    //    happened in phase A (`/api/v1/lottery/amoe/burn-credits`) —
    //    the credit balance check there is the authoritative gate,
    //    and the burn row is now persisted in `points`. Re-checking
    //    here would either be redundant (correct) or, worse, race
    //    against an unrelated AMOE spend that landed between phase A
    //    and phase B and report a stale `insufficient_amoe_credits`
    //    even though the phase A spend is already locked in.
    //
    //    The reader pre-flight below catches the only failure mode
    //    that matters here: "phase A never ran for this spendRefId"
    //    (→ 409 amoe_burn_not_found).
    // ----------------------------------------------------------------
    if (!isBurnThenSubmitRequired()) {
      const snapshot = await getAmoeCreditSnapshot({ wallet })
      if (snapshot.credits < pointsBurned) {
        throw new AmoeInsufficientCreditsError()
      }
    }

    // ----------------------------------------------------------------
    // 5b. Burn-then-submit reader pre-flight (PR 6b).
    //
    //    When `AMOE_BURN_THEN_SUBMIT_REQUIRED=1`, the L1 burn row for
    //    `(signupId, spendRefId)` was written by phase A and the
    //    publisher cron has either (a) already confirmed the snapshot
    //    that contains it (state 3 in `amoe_points_burn_ledger_snapshots`)
    //    or (b) not yet caught up. Pre-flighting the reader here —
    //    BEFORE `insertPending` — lets us short-circuit the latter
    //    case with a typed 425 instead of inserting a `pending` row,
    //    proving (which the orchestrator would then refuse against
    //    the dev/staging stub when the reader misses), and writing a
    //    `prove_failed` audit entry for what is really just a "come
    //    back after the next epoch boundary" condition.
    //
    //    Three outcomes:
    //      • OK — store the reader on a local var; passed unchanged
    //        into `orchestrate()` below. The orchestrator's internal
    //        `readSnapshotForBurn` call hits the same row a second
    //        time — acceptable cost (one indexed lookup) for keeping
    //        the witness-build path the canonical path.
    //      • `AmoeBurnRowMissingError` → 409 `amoe_burn_not_found`
    //        with a `hint` to call phase A first.
    //      • `AmoeSnapshotNotYetConfirmedError` → 425 `Too Early`
    //        with `Retry-After` set from the burn epoch boundary +
    //        one publisher tick (~15 min, per the `*/15 * * * *`
    //        cron schedule in `vercel.json`).
    //
    //    The reader is injectable via `__testHooks.ledgerSnapshotReader`
    //    so handler tests can stub the three outcomes without a live
    //    `db.sql` shape.
    // ----------------------------------------------------------------
    let burnThenSubmitReader: AmoeLedgerSnapshotReader | undefined
    if (isBurnThenSubmitRequired()) {
      const injected = __testHooks.ledgerSnapshotReader
      if (injected) {
        burnThenSubmitReader = injected
      } else {
        const db = await getDb()
        if (!db) {
          // No DB → reader can't function. Behaves like "snapshot not
          // confirmed" from the client's perspective, which is the
          // safest interpretation: fail closed, retry later. Should
          // only happen in misconfigured environments.
          return res.status(503).json({
            success: false,
            error: 'amoe_ledger_snapshot_unavailable',
          })
        }
        burnThenSubmitReader = new AmoeLedgerSnapshotPgReader(db)
      }
      try {
        await burnThenSubmitReader.readSnapshotForBurn({
          signupId: BigInt(profileId),
          spendRefId,
        })
      } catch (e) {
        if (e instanceof AmoeBurnRowMissingError) {
          return res.status(409).json({
            success: false,
            error: 'amoe_burn_not_found',
            hint: 'call POST /api/v1/lottery/amoe/burn-credits first to debit credits and create the burn row, then retry submit-zk after the next epoch boundary',
          })
        }
        if (e instanceof AmoeSnapshotNotYetConfirmedError) {
          // Compute when the publisher could plausibly have caught up.
          // Use `currentEpoch` rather than `epoch` (computed below from
          // `Date.now()`) since they're equivalent at this point in the
          // handler — we haven't called `insertPending` yet.
          const nowSec = BigInt(Math.floor(Date.now() / 1000))
          const currentEpoch = computeAmoeEpoch(nowSec)
          const eligibleAtUnixSec = computeEligibleSubmitAfterUnixSec(currentEpoch)
          // The publisher cron is `*/15 * * * *`, so add a 15-min
          // buffer past the boundary; clients should poll on this
          // cadence rather than spinning faster.
          const retryAfterSeconds = Math.max(
            60,
            Number(eligibleAtUnixSec - nowSec) + 15 * 60,
          )
          res.setHeader('Retry-After', String(retryAfterSeconds))
          return res.status(425).json({
            success: false,
            error: 'amoe_snapshot_not_yet_confirmed',
            hint: 'phase A burn not yet confirmed at the L2 publisher; retry after the next epoch boundary plus one publisher tick (~15min)',
            eligibleSubmitAfterUnixSec: Number(eligibleAtUnixSec),
          })
        }
        throw e
      }
    }

    // ----------------------------------------------------------------
    // 6. Replay store — insert `pending` row before any heavy work.
    //    The store gives us:
    //      * audit trail (one table joins user-submit, prove, on-chain,
    //        credit-debit for every AMOE attempt)
    //      * in-flight dedupe (the unique constraint on `nonce_commit_hex`
    //        wins races deterministically at `markProven` time)
    //      * `ManagerDeclinedEntry` retry pipeline (router-revert keeps the
    //        proof reusable; the store remembers it)
    //
    //    Compute pre-derived epoch here so we can also bind the row to
    //    the same epoch the orchestrator will use, which lets the cron
    //    detect epoch-rolled rows and abandon them cleanly.
    // ----------------------------------------------------------------
    const epoch = computeAmoeEpoch(BigInt(Math.floor(Date.now() / 1000)))
    const submissionId = await insertPending({
      signupId: BigInt(profileId),
      wallet,
      creatorCoin,
      epoch,
      spendRefId,
      pointsBurned,
    })

    // ----------------------------------------------------------------
    // 7. Orchestration — derive nullifiers, build witness, prove,
    //    build calldata. On any failure, mark the row `prove_failed`
    //    so future retries / audits see why we never reached chain.
    // ----------------------------------------------------------------
    const orchestrate = __testHooks.orchestrate ?? orchestrateAmoeSubmitZk
    const relay = __testHooks.relay ?? relayAmoeEntryZkTransaction

    const { wasmPath, zkeyPath } = defaultAmoeZkAssetPaths()

    // Resolve the points-burn ledger reader for `orchestrate()`.
    //
    // Two paths:
    //
    //   • Burn-then-submit (`AMOE_BURN_THEN_SUBMIT_REQUIRED=1`):
    //     the reader was already constructed and exercised by the
    //     pre-flight in step 5b above. Re-use it so we don't pay
    //     for two pool checkouts. Skipped when `__testHooks.orchestrate`
    //     is set (the orchestrate stub doesn't touch the reader).
    //
    //   • Legacy single-call flow (flag unset):
    //     keep the PR 5b dial — the reader is only wired in when
    //     `AMOE_ZK_SNAPSHOT_READER_ENABLED=1`. In this mode, the L1
    //     burn row only gets written at the END of this handler
    //     (step 9 below), so the reader will throw
    //     `amoe_ledger_snapshot_unavailable` for fresh submissions.
    //     The dial exists so the reader can be exercised against
    //     replayed/idempotent submissions on staging without breaking
    //     fresh ones. Default OFF.
    //
    // Test hooks override `orchestrate`, so they bypass this entirely.
    let ledgerSnapshotReader: AmoeLedgerSnapshotReader | undefined
    if (burnThenSubmitReader) {
      ledgerSnapshotReader = burnThenSubmitReader
    } else if (
      !__testHooks.orchestrate &&
      !isBurnThenSubmitRequired() &&
      process.env.AMOE_ZK_SNAPSHOT_READER_ENABLED === '1'
    ) {
      const db = await getDb()
      ledgerSnapshotReader = db ? new AmoeLedgerSnapshotPgReader(db) : undefined
    }

    let result
    try {
      result = await orchestrate(
        {
          wallet,
          creatorCoin,
          pointsBurned,
          nonce: nonceRaw as `0x${string}`,
          twitterHandle,
          spendRefId,
          profileId: BigInt(profileId),
          lotteryAmoeRouter,
        },
        { wasmPath, zkeyPath, ledgerSnapshotReader },
      )
    } catch (proveErr) {
      // Best-effort: don't mask the original error if the row update
      // itself fails. Log and rethrow.
      try {
        await markProveFailed(
          submissionId,
          proveErr instanceof Error
            ? `${proveErr.name}:${proveErr.message}`
            : 'prove_threw_non_error',
        )
      } catch (markErr) {
        console.warn('[amoe-submit-zk] markProveFailed failed', markErr)
      }
      throw proveErr
    }

    // ----------------------------------------------------------------
    // 8. Mark `proven` — writes nullifier commitments + proof blob.
    //    The unique constraint on `nonce_commit_hex` makes this the
    //    moment in-flight dedupe takes effect. A racing submitter with
    //    the same nonce loses here with `submission_in_flight` (400).
    // ----------------------------------------------------------------
    const proofBlob: AmoeReplayProofBlob = {
      proof: result.proof.proof.map((b) => b.toString()),
      pubInputs: result.proof.pubInputs.map((b) => b.toString()),
    }
    const nonceCommitHex = bigintToBytes32Hex(
      result.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.nonceCommit],
    )
    const walletCommitHex = bigintToBytes32Hex(
      result.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.walletAddrCommit],
    )
    const pointsBurnNullifierHex = bigintToBytes32Hex(
      result.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnNullifier],
    )
    // PR 5b: persist the twitter-credit nullifier so the publisher cron
    // can recover it when projecting this burn into L1. The orchestrator
    // derived it from the user's twitter handle (which we never persist).
    const twitterCreditNullifierHex = bigintToBytes32Hex(
      result.twitterCreditNullifier,
    )
    await markProven(submissionId, {
      nonceCommitHex,
      walletCommitHex,
      pointsBurnNullifierHex,
      twitterCreditNullifierHex,
      proofBlob,
    })

    // ----------------------------------------------------------------
    // 9. Defense-in-depth: re-check there is no terminal `settled` row
    //    for the same `nonce_commit_hex`. The unique constraint above
    //    already prevents two `proven` rows; this catches the case
    //    where a prior session's `settled` row was deleted but its
    //    on-chain entry is still recorded (rare, ops-only failure mode).
    // ----------------------------------------------------------------
    const conflicting = await findActiveByNonceCommit(nonceCommitHex)
    if (conflicting && conflicting.id !== submissionId && conflicting.state === 'settled') {
      // Mark our row rejected so the audit trail is consistent.
      try {
        await markRejectedChain(submissionId, { reason: 'submission_already_settled' })
      } catch (e) {
        console.warn('[amoe-submit-zk] markRejectedChain (already_settled) failed', e)
      }
      throw new AmoeBadRequestError('submission_already_settled')
    }

    // ----------------------------------------------------------------
    // 10. Mark `broadcast` then relay. We track `broadcast` BEFORE the
    //     relay returns so a relay-side timeout that lands on-chain
    //     later doesn't leave the row stuck in `proven` forever.
    // ----------------------------------------------------------------
    await markBroadcasting(submissionId, {})

    let txHash: `0x${string}`
    try {
      txHash = await relay({
        to: result.call.to,
        callData: result.call.callData,
      })
    } catch (relayErr) {
      // Classify the failure: ManagerDeclinedEntry → retryable, else terminal.
      const declined = decodeManagerDeclinedRevert(relayErr)
      if (declined) {
        await markManagerDeclined(submissionId, {
          txHash: declined.txHash ?? ('0x' as `0x${string}`),
          reason: declined.reason,
        })
        // 202 — accepted, retry pending. Caller polls or hits retry-zk.
        return res.status(202).json({
          success: false,
          error: 'submission_manager_declined',
          data: {
            submissionId,
            reason: declined.reason,
          },
        })
      }
      // Generic chain rejection — abandon this submission.
      const reason =
        relayErr instanceof Error ? relayErr.message.slice(0, 256) : 'relay_failed'
      await markRejectedChain(submissionId, { reason })
      throw relayErr
    }

    // ----------------------------------------------------------------
    // 11. Mark `settled` and debit credits (same ordering invariant as
    //     legacy handler — relay first, debit second).
    // ----------------------------------------------------------------
    await markSettled(submissionId, {
      txHash: txHash as `0x${string}`,
      // We don't have block_number / managerEntryId from the synchronous
      // relay path yet. PR 5's publisher will fill these in via a
      // post-confirmation update. For now record the tx hash; ops can
      // backfill from chain.
      blockNumber: 0n,
      managerEntryId: null,
    })

    // refId binds the credit debit to the replay-store row so the
    // publisher's projector can join `points.source_id` against
    // `amoe_zk_submissions.spend_ref_id` and resolve burn context.
    //
    // PR 5b correctness: this MUST equal the `spendRefId` stored on
    // the submission row above, otherwise `defaultLookupBurnContext`
    // returns no row, the projector skips the burn, and the published
    // root is computed from a partial L1 (corrupting epoch completeness).
    //
    // Idempotency for double-submit retries is preserved by the
    // `points (signup_id, source, source_id)` partial unique index plus
    // `consumeAmoeCreditsForEntry`'s ON CONFLICT DO NOTHING — a retry
    // with the same client-supplied `spendRefId` still dedupes.
    const refId = spendRefId

    // -------------------------------------------------------------------
    // Trailing credit debit.
    //
    // Legacy mode (flag off): submit-zk owns the burn — call
    // `consumeAmoeCreditsForEntry` here and surface the resulting
    // balance fields in the response, byte-identical to pre-PR-6b.
    //
    // Flag-on mode (`AMOE_BURN_THEN_SUBMIT_REQUIRED=1`): phase A
    // (`/amoe/burn-credits`) already wrote the L1 burn row. Doing it
    // again here would either be a no-op (idempotent ON CONFLICT) or
    // — worse — write a fresh row under a different `spendRefId` and
    // double-debit. Skip the call entirely and re-read the current
    // balance via `getAmoeCreditSnapshot` so the response shape stays
    // stable for the frontend (`creditsConsumed: 0` because THIS
    // handler did not consume — phase A already returned the
    // consumption count to the client).
    // -------------------------------------------------------------------
    let creditsConsumed: number
    let creditsRemaining: number
    let creditsPerEntry: number
    let entriesAvailable: number
    if (!isBurnThenSubmitRequired()) {
      const creditSpend = await consumeAmoeCreditsForEntry({
        wallet,
        requiredCredits: pointsBurned,
        refId,
      })
      creditsConsumed = creditSpend.consumed
      creditsRemaining = creditSpend.creditsRemaining
      creditsPerEntry = creditSpend.creditsPerEntry
      entriesAvailable = creditSpend.entriesAvailable
    } else {
      const balance = await getAmoeCreditSnapshot({ wallet })
      creditsConsumed = 0
      creditsRemaining = balance.credits
      creditsPerEntry = balance.creditsPerEntry
      entriesAvailable = balance.entriesAvailable
    }

    return res.status(200).json({
      success: true,
      data: {
        submissionId,
        txHash,
        relayMode: 'server',
        pointsBurned,
        pointsBurnedAsUSD: result.pointsBurnedAsUSD.toString(),
        estimatedWinChancePPM: result.call.estimatedWinChancePPM,
        creditsConsumed,
        creditsRemaining,
        creditsPerEntry,
        entriesAvailable,
        proofMode: 'plonk',
        epoch: result.epoch.toString(),
      },
    })
  } catch (error: unknown) {
    const { status, message: errMessage } = classifyAmoeError(error)
    // `AmoeProofGenerationError` isn't in the existing classifier — it
    // throws with `code: 'plonk_witness_input_invalid'` /
    // `'plonk_proof_generation_failed'` etc. Map them to 422 here.
    if (
      error instanceof Error &&
      error.name === 'AmoeProofGenerationError' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      return res.status(422).json({
        success: false,
        error: (error as { code: string }).code,
      })
    }
    return res.status(status).json({
      success: false,
      error: errMessage,
    })
  }
}

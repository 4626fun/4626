import { createHash, randomBytes } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import { ensureWaitlistSchema } from '../onboarding/waitlistSchema.js'
import { awardAmoeCheckinPoints } from './amoeWaitlistPoints.js'
import {
  AmoeBadRequestError,
  AmoeInsufficientCreditsError,
  AmoeServerError,
} from './lotteryAmoeErrors.js'
import {
  AMOE_EPOCH_GENESIS_SECONDS,
  AMOE_EPOCH_LENGTH_SECONDS,
} from './amoeWitness.js'

/**
 * Local copy of `computeAmoeEpoch` from `amoeSubmitZk.ts` — inlined
 * here to avoid a circular import (amoeSubmitZk imports from
 * lotteryAmoe). Kept byte-for-byte identical to the canonical version;
 * a static test in `amoePointsEligibility.test.ts` (or future test)
 * can pin this if drift is ever a concern. Both versions read from
 * the same `AMOE_EPOCH_GENESIS_SECONDS` / `AMOE_EPOCH_LENGTH_SECONDS`
 * constants in `amoeWitness.ts`, so the spec-anchor cannot drift.
 */
function computeAmoeEpochLocal(nowSec: bigint): bigint {
  if (nowSec <= AMOE_EPOCH_GENESIS_SECONDS) return 0n
  return (nowSec - AMOE_EPOCH_GENESIS_SECONDS) / AMOE_EPOCH_LENGTH_SECONDS
}

declare const process: { env: Record<string, string | undefined> }

const AMOE_NONCE_TTL_SECONDS = 10 * 60 // 10m
const AMOE_MESSAGE_TITLE = '4626 Lottery AMOE Entry' as const
export const AMOE_CREDITS_PER_ENTRY = 100
export const AMOE_DAILY_TWITTER_CREDIT = 1

// PR 2 — AMOE Linear Parity (variable points amount).
//
// Locked spec: min 100 points / max 1_000_000 points per submission.
// Conversion: 100 points = $1 USD-equivalent (1 point = $0.01 = 1 cent).
// On-chain `processAmoeEntry` expects USD in 1e6 (USDC) units, so:
//   pointsBurnedAsUSD = points * 10_000
//   100 points    → 1_000_000        ($1, base floor)
//   10_000 points → 100_000_000      ($100)
//   1_000_000 pts → 10_000_000_000   ($10K, saturates baseCeilingPPM at 4%)
export const AMOE_MIN_POINTS_PER_SUBMISSION = 100
export const AMOE_MAX_POINTS_PER_SUBMISSION = 1_000_000
export const AMOE_POINTS_TO_USD1E6_FACTOR = 10_000

// PR 4 — PLONK ZK path: public-input slot layout.
//
// Locked by IAmoePlonkVerifier and verified bit-for-bit in the patch guard
// (tools/ci/check_amoe_plonk_patch.sh + the on-chain verifier's own
// checkField loop). Any change here MUST also be reflected in:
//   * contracts/utilities/lottery/zk/IAmoePlonkVerifier.sol
//   * contracts/utilities/lottery/zk/AmoePlonkVerifier.sol (banner)
//   * the circuit (circuits/amoe/amoe_eligibility.circom)
// otherwise valid proofs will silently fail to verify on-chain.
export const AMOE_PLONK_PROOF_LEN = 24 as const
export const AMOE_PLONK_PUB_INPUTS_LEN = 8 as const
export const AMOE_PLONK_PUB_INPUT_SLOT = {
  walletAddrCommit: 0,
  creatorCoinAddr: 1,
  nonceCommit: 2,
  epoch: 3,
  allowlistRoot: 4,
  pointsBurnedAsUSD: 5,
  pointsLedgerRoot: 6,
  pointsBurnNullifier: 7,
} as const

// BN254 scalar field modulus. Public-input values must be in [0, Q).
// The router-side AmoePlonkVerifier enforces this with checkField, but we
// also enforce it here so the relayer fails fast on malformed inputs
// instead of paying gas for a guaranteed-revert tx.
export const AMOE_BN254_SCALAR_FIELD_Q =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

// Defense-in-depth ceiling on `pointsBurnedAsUSD`. Mirrors
// LotteryAmoeRouter.MAX_POINTS_AS_USD = 10_000 * 1e6 (= $10,000 in USDC
// units). The router reverts `PointsValueOutOfRange` if pubInputs[5] is
// 0 or > this; we mirror it here so the relayer fails fast instead of
// burning gas on a guaranteed-revert tx. ANY change to the on-chain
// constant must be reflected here.
export const AMOE_MAX_POINTS_AS_USD = 10_000n * 1_000_000n

/**
 * Convert a points-burned count to the 1e6 (USDC) USD value expected by
 * `CreatorLotteryManager.processAmoeEntry`. Throws if `points` is not a
 * positive integer in the [MIN, MAX] range — callers MUST validate before
 * consuming credits.
 */
export function pointsToUsd1e6(points: number): bigint {
  if (!Number.isInteger(points)) {
    throw new AmoeBadRequestError('points_burned_not_integer')
  }
  if (points < AMOE_MIN_POINTS_PER_SUBMISSION) {
    throw new AmoeBadRequestError('points_burned_below_min')
  }
  if (points > AMOE_MAX_POINTS_PER_SUBMISSION) {
    throw new AmoeBadRequestError('points_burned_above_max')
  }
  return BigInt(points) * BigInt(AMOE_POINTS_TO_USD1E6_FACTOR)
}

/**
 * Estimate the pre-boost win chance (PPM) for a given USD value. Mirrors
 * `CreatorLotteryManager.calculateWinChance` exactly so the UI can preview
 * what the user is buying. The actual on-chain value is authoritative — this
 * is for display only.
 *
 * Formula (PR 1):  winChancePPM = swapValueUSD / 250_000, capped at
 * `baseCeilingPPM` (40_000 PPM = 4%). Sub-floor returns 0.
 */
export function estimateWinChancePPM(usd1e6: bigint): number {
  const minSwapAmount = 1_000_000n // $1 in 1e6 units (matches lotteryConfig.minSwapAmount)
  const baseCeilingPPM = 40_000n
  if (usd1e6 < minSwapAmount) return 0
  const raw = usd1e6 / 250_000n
  return Number(raw > baseCeilingPPM ? baseCeilingPPM : raw)
}

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type AmoeNonceRecord = {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  issuedAt: string
  expiresAt: string
  consumed: boolean
}

const memNonces = new Map<string, AmoeNonceRecord>()
const memCredits = new Map<string, number>()
const memDailyTwitterCheckins = new Set<string>()
let amoeSchemaEnsured = false

const eip1271Abi = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

const EIP1271_MAGICVALUE = '0x1626ba7e'

const coinbaseSmartWalletOwnersAbi = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const lotteryAmoeAbi = [
  {
    type: 'function',
    name: 'getAmoeMessageHash',
    stateMutability: 'view',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'submitAmoeEntry',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
  // PR 4 — PLONK ZK path. The router enforces:
  //   * pubInputs[1] == uint160(creatorCoin)
  //   * pubInputs[3] == epoch
  //   * pubInputs[4] == allowlistRootOf[epoch]
  //   * pubInputs[6] == pointsLedgerRootOf[epoch]
  //   * pubInputs[7] not previously used (global nullifier)
  // and then verifies the proof against AmoePlonkVerifier. See
  // contracts/utilities/lottery/zk/IAmoePlonkVerifier.sol for the public-
  // input slot layout. The 24-element proof array is the snarkjs PLONK
  // calldata format (`zkey export solidityverifier`).
  {
    type: 'function',
    name: 'submitAmoeEntryZK',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'epoch', type: 'uint64' },
      { name: 'proof', type: 'uint256[24]' },
      { name: 'pubInputs', type: 'uint256[8]' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
] as const

// PR 2 — calls into PR 1's `processAmoeEntry` on `CreatorLotteryManager`.
// This function is gated to the authorized relayer key on-chain (single-address
// allowlist), so calldata produced here can only be successfully submitted by a
// transaction signed by that key. See PR 1 audit handoff for full trust model.
const creatorLotteryManagerAmoeAbi = [
  {
    type: 'function',
    name: 'processAmoeEntry',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'pointsBurnedAsUSD', type: 'uint256' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
] as const

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isBytes32Like(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

function getBaseRpcUrls(): string[] {
  const fromEnv = (process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map(normalizeRpcUrl)
    .filter((x): x is string => Boolean(x))
  const fallback = ['https://mainnet.base.org', 'https://base.llamarpc.com']
  return Array.from(new Set([...fromEnv, ...fallback]))
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

async function ensureAmoeSchema(db: Db): Promise<void> {
  if (amoeSchemaEnsured) return
  await ensureWaitlistSchema(db as any)
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_nonces (
      nonce TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      creator_coin TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS lottery_amoe_nonces_wallet_creator_idx ON lottery_amoe_nonces (wallet_address, creator_coin, expires_at);`

  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_entries (
      id BIGSERIAL PRIMARY KEY,
      nonce_hash TEXT NOT NULL UNIQUE,
      nonce TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      creator_coin TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'attested',
      attestation_deadline BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_daily_twitter_checkins (
      wallet_address TEXT NOT NULL,
      checkin_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (wallet_address, checkin_date)
    );
  `

  // AMOE-eligibility view. Mirrors
  // `supabase/migrations/20260427180000_amoe_eligible_points_view.sql`.
  // Bootstrap parity matters because dev/preview envs may not have the
  // migration applied yet — without this CREATE OR REPLACE here, the
  // first AMOE submit on a fresh DB would fail with `relation does not
  // exist`. The migration remains the source of truth in CI / prod; this
  // is the runtime safety net.
  //
  // KEEP THIS BLOCK BYTE-FOR-BYTE IDENTICAL TO THE MIGRATION. If you
  // change one, update the other.
  await db.sql`
    CREATE OR REPLACE VIEW points_amoe_eligible_balance AS
    SELECT
      signup_id,
      COALESCE(
        ROUND(
          SUM(
            CASE
              WHEN source = 'amoe_entry_spend'    THEN amount
              WHEN source = 'amoe_entry_refund'   THEN amount
              WHEN source = 'amoe_twitter_daily'  THEN amount * 1.00
              WHEN source = 'amoe_checkin'        THEN amount * 1.00
              WHEN source = 'waitlist_signup'     THEN amount * 1.00
              WHEN source = 'csw_link'            THEN amount * 1.00
              WHEN source = 'resolve_csw'         THEN amount * 0.60
              WHEN source LIKE 'social_%'         THEN amount * 0.50
              WHEN source LIKE 'bonus_%'          THEN amount * 0.30
              WHEN source = 'task'                THEN amount * 0.30
              WHEN source IN (
                'agent_feedback',
                'agent_reputation',
                'lens_identity',
                'grove_proof'
              )                                    THEN amount * 0.40
              WHEN source IN (
                'link_email',
                'link_google',
                'link_apple',
                'link_telegram',
                'link_tiktok',
                'link_twitter',
                'link_external_eoa',
                'link_zora'
              )                                    THEN amount * 0.60
              ELSE 0
            END
          )
        ),
        0
      )::bigint AS credits
    FROM points
    GROUP BY signup_id;
  `

  amoeSchemaEnsured = true
}

function normalizeRefId(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw.slice(0, 190) : null
}

async function resolveOrCreateProfileForWallet(db: Db, wallet: `0x${string}`): Promise<number> {
  const normalizedWallet = wallet.toLowerCase()
  // Tombstone-aware: if the wallet matches a merged-away profile, follow
  // `merged_into_profile_id` to the canonical survivor. Prefer profiles
  // with a real (non-synthetic) email so AMOE claims always attach to
  // the canonical account when one exists — satisfies the AGENTS.md
  // identity invariant that verified email wins.
  const existing = await db.sql`
    WITH matched AS (
      SELECT p.id, p.merged_into_profile_id, p.email, p.updated_at, p.created_at
      FROM profiles p
      WHERE LOWER(p.primary_wallet) = ${normalizedWallet}
         OR LOWER(p.embedded_wallet) = ${normalizedWallet}
         OR LOWER(p.primary_embedded_eoa) = ${normalizedWallet}
         OR LOWER(p.csw_address) = ${normalizedWallet}
         OR LOWER(p.primary_smart_wallet) = ${normalizedWallet}
         OR LOWER(p.base_sub_account) = ${normalizedWallet}
         OR EXISTS (
           SELECT 1
           FROM profile_wallets pw
           WHERE pw.profile_id = p.id
             AND LOWER(pw.address) = ${normalizedWallet}
         )
    ),
    resolved AS (
      SELECT p2.id, p2.email,
             -- Score: canonical (real email) first, then most-recently-updated.
             CASE
               WHEN p2.email IS NOT NULL AND p2.email <> ''
                 AND LOWER(p2.email) NOT LIKE '%@wallet.4626.fun'
                 AND LOWER(p2.email) NOT LIKE '%@noemail.4626.fun'
               THEN 0
               ELSE 1
             END AS bucket,
             COALESCE(p2.updated_at, p2.created_at) AS ranked_at
      FROM matched m
      JOIN profiles p2 ON p2.id = COALESCE(m.merged_into_profile_id, m.id)
      WHERE p2.merged_into_profile_id IS NULL
    )
    SELECT DISTINCT id
    FROM resolved
    ORDER BY bucket ASC, ranked_at DESC NULLS LAST
    LIMIT 1;
  `
  const existingIdRaw = existing.rows?.[0]?.id
  const existingId = typeof existingIdRaw === 'number' ? existingIdRaw : Number(existingIdRaw)
  if (Number.isFinite(existingId) && existingId > 0) return Math.floor(existingId)

  const syntheticEmail = `amoe-${sha256Hex(normalizedWallet).slice(0, 24)}@wallet.4626.fun`
  await db.sql`
    INSERT INTO profiles (email, primary_wallet, created_at, updated_at)
    VALUES (${syntheticEmail}, ${normalizedWallet}, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
      SET primary_wallet = COALESCE(profiles.primary_wallet, EXCLUDED.primary_wallet),
          updated_at = NOW();
  `
  const created = await db.sql`
    SELECT id
    FROM profiles
    WHERE email = ${syntheticEmail}
    LIMIT 1;
  `
  const createdIdRaw = created.rows?.[0]?.id
  const createdId = typeof createdIdRaw === 'number' ? createdIdRaw : Number(createdIdRaw)
  if (!Number.isFinite(createdId) || createdId <= 0) {
    throw new Error('amoe_profile_resolve_failed')
  }
  return Math.floor(createdId)
}

/**
 * Total weighted points for a signup — used for leaderboard, tier
 * progression, and "Your points" UI surfaces.
 *
 * Includes paid-action sources (`has_creator_coin`) and tainted sources
 * (`referral_passthrough`, deprecated `referral_*`). Do NOT use this for
 * AMOE eligibility — use `readAmoeEligibleCreditsForSignup` instead.
 */
async function readUnifiedPointsForSignup(db: Db, signupId: number): Promise<number> {
  const result = await db.sql`
    SELECT COALESCE(
      ROUND(
        SUM(
          CASE
            WHEN source = 'amoe_entry_spend' THEN amount
            WHEN source = 'amoe_twitter_daily' THEN amount * 1.00
            -- amoe_checkin must mirror the AMOE eligibility view's 1.00x
            -- weight; otherwise unified points (leaderboard/tier) would
            -- under-count and AMOE-eligible credits could exceed unified
            -- points, breaking the documented "eligible subset" invariant.
            WHEN source = 'amoe_checkin' THEN amount * 1.00
            WHEN source = 'waitlist_signup' THEN amount * 1.00
            WHEN source = 'csw_link' THEN amount * 1.00
            WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
            WHEN source LIKE 'social_%' THEN amount * 0.50
            WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
            WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
            WHEN source IN ('link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram', 'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin')
              THEN amount * 0.60
            ELSE amount * 0.30
          END
        )
      ),
      0
    )::bigint AS points
    FROM points
    WHERE signup_id = ${signupId};
  `
  const valueRaw = Number(result.rows?.[0]?.points ?? 0)
  const value = Number.isFinite(valueRaw) ? Math.floor(valueRaw) : 0
  return Math.max(0, value)
}

/**
 * AMOE-eligible weighted points for a signup — the strict-allowlist
 * subset of `readUnifiedPointsForSignup` that excludes paid-action and
 * tainted sources. Used to gate free lottery entries.
 *
 * Compliance contract: the underlying `points_amoe_eligible_balance`
 * view's source allowlist is the database-level enforcement of the
 * "no purchase necessary" wall on the AMOE path. See
 * `docs/security/amoe-points-source-audit.md` for the per-source
 * rationale.
 */
async function readAmoeEligibleCreditsForSignup(
  db: Db,
  signupId: number,
): Promise<number> {
  const result = await db.sql`
    SELECT credits
    FROM points_amoe_eligible_balance
    WHERE signup_id = ${signupId}
    LIMIT 1;
  `
  const valueRaw = Number(result.rows?.[0]?.credits ?? 0)
  const value = Number.isFinite(valueRaw) ? Math.floor(valueRaw) : 0
  return Math.max(0, value)
}

function normalizeWallet(wallet: `0x${string}`): `0x${string}` {
  return wallet.toLowerCase() as `0x${string}`
}

function dayKeyUtc(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10)
}

function toCreditSnapshot(wallet: `0x${string}`, credits: number) {
  const normalizedCredits = Math.max(0, Math.floor(credits))
  const entriesAvailable = Math.floor(normalizedCredits / AMOE_CREDITS_PER_ENTRY)
  const nextEntryAtCredits =
    entriesAvailable > 0
      ? (entriesAvailable + 1) * AMOE_CREDITS_PER_ENTRY
      : AMOE_CREDITS_PER_ENTRY
  return {
    wallet,
    credits: normalizedCredits,
    creditsPerEntry: AMOE_CREDITS_PER_ENTRY,
    entriesAvailable,
    nextEntryAtCredits,
  }
}

export async function getAmoeCreditSnapshot(params: { wallet: `0x${string}` }): Promise<{
  wallet: `0x${string}`
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
  nextEntryAtCredits: number
}> {
  const wallet = normalizeWallet(params.wallet)
  const db = await getDb()
  if (!db) {
    return toCreditSnapshot(wallet, memCredits.get(wallet) ?? 0)
  }

  await ensureAmoeSchema(db)
  const signupId = await resolveOrCreateProfileForWallet(db, wallet)
  const credits = await readAmoeEligibleCreditsForSignup(db, signupId)
  return toCreditSnapshot(wallet, credits)
}

export async function claimDailyTwitterCheckin(params: { wallet: `0x${string}` }): Promise<{
  wallet: `0x${string}`
  awarded: boolean
  awardedCredits: number
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
}> {
  const wallet = normalizeWallet(params.wallet)
  const now = Date.now()
  const dayKey = dayKeyUtc(now)

  const db = await getDb()
  if (!db) {
    const memKey = `${wallet}:${dayKey}`
    const alreadyClaimed = memDailyTwitterCheckins.has(memKey)
    if (!alreadyClaimed) {
      memDailyTwitterCheckins.add(memKey)
      memCredits.set(wallet, (memCredits.get(wallet) ?? 0) + AMOE_DAILY_TWITTER_CREDIT)
    }
    const snapshot = toCreditSnapshot(wallet, memCredits.get(wallet) ?? 0)
    return {
      wallet,
      awarded: !alreadyClaimed,
      awardedCredits: alreadyClaimed ? 0 : AMOE_DAILY_TWITTER_CREDIT,
      credits: snapshot.credits,
      creditsPerEntry: snapshot.creditsPerEntry,
      entriesAvailable: snapshot.entriesAvailable,
    }
  }

  await ensureAmoeSchema(db)
  const inserted = await db.sql`
    INSERT INTO lottery_amoe_daily_twitter_checkins (wallet_address, checkin_date)
    VALUES (${wallet}, ${dayKey})
    ON CONFLICT (wallet_address, checkin_date) DO NOTHING
    RETURNING wallet_address;
  `
  const awarded = Boolean(inserted.rows?.[0]?.wallet_address)
  const signupId = await resolveOrCreateProfileForWallet(db, wallet)

  if (awarded) {
    await db.sql`
      INSERT INTO points (signup_id, source, source_id, amount, created_at)
      VALUES (${signupId}, ${'amoe_twitter_daily'}, ${dayKey}, ${AMOE_DAILY_TWITTER_CREDIT}, NOW())
      ON CONFLICT DO NOTHING;
    `
    // Best-effort: if the wallet is linked to a Privy-backed waitlist
    // profile, also credit that profile with `amoe_checkin` points so
    // the activity counts toward tier progression. Failures here
    // never block the check-in — the credit pool write above is the
    // source of truth for AMOE economics.
    try {
      await awardAmoeCheckinPoints({ db, wallet, dayKey })
    } catch {
      // swallow — points are additive
    }
  }

  const credits = await readAmoeEligibleCreditsForSignup(db, signupId)
  const snapshot = toCreditSnapshot(wallet, credits)
  return {
    wallet,
    awarded,
    awardedCredits: awarded ? AMOE_DAILY_TWITTER_CREDIT : 0,
    credits: snapshot.credits,
    creditsPerEntry: snapshot.creditsPerEntry,
    entriesAvailable: snapshot.entriesAvailable,
  }
}

export async function consumeAmoeCreditsForEntry(params: {
  wallet: `0x${string}`
  requiredCredits?: number
  refId?: string
}): Promise<{
  wallet: `0x${string}`
  consumed: number
  creditsRemaining: number
  creditsPerEntry: number
  entriesAvailable: number
  /**
   * ISO-8601 timestamp of the persisted burn row (`points.created_at`).
   * For idempotent retries against the same `refId`, this returns the
   * ORIGINAL burn time — not `Date.now()` at retry time. Callers that
   * derive epoch / scheduling metadata from the burn (e.g. phase B
   * `eligibleSubmitAfter`) MUST use this field, not the wall clock,
   * to keep retries stable.
   */
  burnedAt: string
  /**
   * AMOE epoch derived from `burnedAt` via `computeAmoeEpoch`. Same
   * stability guarantee as `burnedAt`. Returned as a string to avoid
   * BigInt JSON-serialization issues at the API boundary.
   */
  burnEpoch: string
}> {
  const wallet = normalizeWallet(params.wallet)
  const requiredCredits =
    typeof params.requiredCredits === 'number' && Number.isFinite(params.requiredCredits)
      ? Math.max(1, Math.floor(params.requiredCredits))
      : AMOE_CREDITS_PER_ENTRY

  const db = await getDb()
  if (!db) {
    const current = memCredits.get(wallet) ?? 0
    if (current < requiredCredits) throw new AmoeInsufficientCreditsError()
    const nextCredits = current - requiredCredits
    memCredits.set(wallet, nextCredits)
    const snapshot = toCreditSnapshot(wallet, nextCredits)
    // Mem-fallback path is test-only (no DB). Without persistence we
    // cannot meaningfully replay an "original" burn time, so we return
    // wall-clock — tests that care about idempotent stability should
    // pin time via `vi.useFakeTimers()`.
    const nowMs = Date.now()
    return {
      wallet,
      consumed: requiredCredits,
      creditsRemaining: snapshot.credits,
      creditsPerEntry: snapshot.creditsPerEntry,
      entriesAvailable: snapshot.entriesAvailable,
      burnedAt: new Date(nowMs).toISOString(),
      burnEpoch: computeAmoeEpochLocal(BigInt(Math.floor(nowMs / 1000))).toString(),
    }
  }

  await ensureAmoeSchema(db)
  const signupId = await resolveOrCreateProfileForWallet(db, wallet)
  const spendRefId =
    normalizeRefId(params.refId) ??
    `amoe-spend:${wallet}:${Date.now().toString(36)}:${randomBytes(6).toString('hex')}`

  // AMOE eligibility: spend is gated on the AMOE-eligible balance only.
  // The `points_amoe_eligible_balance` view enforces the strict allowlist —
  // paid-action sources (e.g. has_creator_coin) and referral_* contribute 0,
  // so they cannot fund AMOE entries even though they still count toward
  // tier/leaderboard via `readUnifiedPointsForSignup`.
  //
  // We `RETURNING created_at` from the INSERT so the new-insert path can
  // surface the actual persisted burn time (Fix #2 from PR #457 review).
  const spendAttempt = await db.sql`
    WITH current AS (
      SELECT COALESCE(credits, 0)::bigint AS credits
      FROM points_amoe_eligible_balance
      WHERE signup_id = ${signupId}
    ),
    ins AS (
      INSERT INTO points (signup_id, source, source_id, amount, created_at)
      SELECT ${signupId}, ${'amoe_entry_spend'}, ${spendRefId}, ${-requiredCredits}, NOW()
      FROM current
      WHERE current.credits >= ${requiredCredits}
      ON CONFLICT DO NOTHING
      RETURNING id, created_at
    )
    SELECT
      (SELECT credits FROM current) AS credits_before,
      EXISTS(SELECT 1 FROM ins) AS inserted,
      (SELECT created_at FROM ins) AS inserted_at;
  `
  const inserted = spendAttempt.rows?.[0]?.inserted === true
  let burnedAtRaw: unknown = inserted ? spendAttempt.rows?.[0]?.inserted_at : null
  if (!inserted) {
    // Idempotent retry path: source `created_at` from the existing
    // persisted row so the returned `burnedAt`/`burnEpoch` match the
    // ORIGINAL debit, not the retry's wall clock (Fix #2).
    const existingSpend = await db.sql`
      SELECT id, created_at
      FROM points
      WHERE signup_id = ${signupId}
        AND source = ${'amoe_entry_spend'}
        AND source_id = ${spendRefId}
        AND amount = ${-requiredCredits}
      LIMIT 1;
    `
    const existingRow = existingSpend.rows?.[0]
    const alreadySpent = Boolean(existingRow?.id)
    if (!alreadySpent) throw new AmoeInsufficientCreditsError()
    burnedAtRaw = existingRow?.created_at ?? null
  }

  const creditsRemaining = await readAmoeEligibleCreditsForSignup(db, signupId)

  // Coerce DB `created_at` (Date | string | null) to ISO. If the driver
  // returned null (shouldn't happen — the row was just observed), fall
  // back to wall-clock so the response shape stays valid; observability
  // would catch the path via the typecheck on `burnedAt` being non-empty.
  const burnedAtMs =
    burnedAtRaw instanceof Date
      ? burnedAtRaw.getTime()
      : typeof burnedAtRaw === 'string' && burnedAtRaw.length > 0
        ? Date.parse(burnedAtRaw)
        : NaN
  const burnedAtMsResolved = Number.isFinite(burnedAtMs) ? burnedAtMs : Date.now()
  const burnedAtIso = new Date(burnedAtMsResolved).toISOString()
  const burnEpoch = computeAmoeEpochLocal(BigInt(Math.floor(burnedAtMsResolved / 1000))).toString()

  const snapshot = toCreditSnapshot(wallet, creditsRemaining)
  return {
    wallet,
    consumed: requiredCredits,
    creditsRemaining: snapshot.credits,
    creditsPerEntry: snapshot.creditsPerEntry,
    entriesAvailable: snapshot.entriesAvailable,
    burnedAt: burnedAtIso,
    burnEpoch,
  }
}

export type AmoeMessageFields = {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  issuedAt: string
  expiresAt: string
  chainId: number
  lotteryManager: `0x${string}`
}

export function buildAmoeEntryMessage(fields: AmoeMessageFields): string {
  return [
    AMOE_MESSAGE_TITLE,
    '',
    `Wallet: ${fields.wallet}`,
    `Creator Coin: ${fields.creatorCoin}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expires At: ${fields.expiresAt}`,
    `Chain ID: ${fields.chainId}`,
    `Lottery Manager: ${fields.lotteryManager}`,
  ].join('\n')
}

export function parseAmoeEntryMessage(message: string): AmoeMessageFields | null {
  if (typeof message !== 'string' || message.trim().length === 0) return null
  const lines = message.split('\n').map((line) => line.trim())
  if (lines[0] !== AMOE_MESSAGE_TITLE) return null

  const readField = (prefix: string): string | null => {
    const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return null
    const raw = line.slice(prefix.length).trim()
    return raw.length > 0 ? raw : null
  }

  const wallet = readField('Wallet:')
  const creatorCoin = readField('Creator Coin:')
  const nonce = readField('Nonce:')
  const issuedAt = readField('Issued At:')
  const expiresAt = readField('Expires At:')
  const chainIdRaw = readField('Chain ID:')
  const lotteryManager = readField('Lottery Manager:')
  if (!wallet || !creatorCoin || !nonce || !issuedAt || !expiresAt || !chainIdRaw || !lotteryManager) return null
  if (!isAddressLike(wallet) || !isAddressLike(creatorCoin) || !isAddressLike(lotteryManager)) return null
  if (!isBytes32Like(nonce)) return null
  const chainId = Number(chainIdRaw)
  if (!Number.isFinite(chainId)) return null

  return {
    wallet: wallet.toLowerCase() as `0x${string}`,
    creatorCoin: creatorCoin.toLowerCase() as `0x${string}`,
    nonce: nonce.toLowerCase() as `0x${string}`,
    issuedAt,
    expiresAt,
    chainId: Math.floor(chainId),
    lotteryManager: lotteryManager.toLowerCase() as `0x${string}`,
  }
}

export async function issueAmoeNonce(params: { wallet: `0x${string}`; creatorCoin: `0x${string}` }): Promise<{
  nonce: `0x${string}`
  issuedAt: string
  expiresAt: string
}> {
  const wallet = params.wallet.toLowerCase() as `0x${string}`
  const creatorCoin = params.creatorCoin.toLowerCase() as `0x${string}`
  const issuedAt = nowIso()
  const expiresAt = new Date(Date.now() + AMOE_NONCE_TTL_SECONDS * 1000).toISOString()
  const nonce = `0x${randomBytes(32).toString('hex')}` as `0x${string}`

  const db = await getDb()
  if (!db) {
    memNonces.set(nonce, { wallet, creatorCoin, issuedAt, expiresAt, consumed: false })
    return { nonce, issuedAt, expiresAt }
  }

  await ensureAmoeSchema(db)
  await db.sql`
    INSERT INTO lottery_amoe_nonces (nonce, wallet_address, creator_coin, expires_at)
    VALUES (${nonce}, ${wallet}, ${creatorCoin}, ${expiresAt});
  `
  return { nonce, issuedAt, expiresAt }
}

function encodeSignatureWrapper(ownerIndex: number, signatureData: `0x${string}`, encodeAbiParameters: any): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: 'tuple' as const,
        components: [
          { name: 'ownerIndex', type: 'uint256' as const },
          { name: 'signatureData', type: 'bytes' as const },
        ],
      },
    ],
    [{ ownerIndex: BigInt(ownerIndex), signatureData }],
  )
}

/**
 * Verify a personal_sign / EIP-191 signature against a wallet, with
 * EIP-1271 fallback for smart wallets (Coinbase Smart Wallet owner-index
 * scan included).
 *
 * Exported under `verifyAmoeWalletSignature` for the ZK submit path
 * (PR 3) which needs the same wallet-sig check but NOT the EIP-191
 * message parsing inside `verifyAmoeEntryProof`. Local callers continue
 * to use the unprefixed name.
 */
export async function verifyAmoeWalletSignature(params: {
  wallet: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  return verifyWalletMessageSignature(params)
}

async function verifyWalletMessageSignature(params: {
  wallet: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const { verifyMessage, createPublicClient, hashMessage, http, encodeAbiParameters } = await import('viem')
  const { base } = await import('viem/chains')

  try {
    const ok = await verifyMessage({
      address: params.wallet,
      message: params.message,
      signature: params.signature,
    })
    if (ok) return true
  } catch {
    // fall through to EIP-1271 verification
  }

  const digest = hashMessage(params.message)
  for (const url of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })
      const code = await client.getBytecode({ address: params.wallet })
      if (!code || code === '0x') continue

      let scanLimit = 16
      try {
        const ownerCountRaw = (await client.readContract({
          address: params.wallet,
          abi: coinbaseSmartWalletOwnersAbi,
          functionName: 'ownerCount',
          args: [],
        })) as bigint
        let upperBound = Number(ownerCountRaw)
        if (!Number.isFinite(upperBound) || upperBound < 0) upperBound = 0
        try {
          const nextOwnerIndexRaw = (await client.readContract({
            address: params.wallet,
            abi: coinbaseSmartWalletOwnersAbi,
            functionName: 'nextOwnerIndex',
            args: [],
          })) as bigint
          const nextOwnerIndex = Number(nextOwnerIndexRaw)
          if (Number.isFinite(nextOwnerIndex) && nextOwnerIndex > 0) upperBound = nextOwnerIndex
        } catch {
          // ignore and keep ownerCount bound
        }
        scanLimit = Math.min(Math.max(upperBound, 1), 128)
      } catch {
        // ignore and keep default scan limit
      }

      const candidateSignatures: `0x${string}`[] = [params.signature]
      for (let i = 0; i < scanLimit; i += 1) {
        candidateSignatures.push(encodeSignatureWrapper(i, params.signature, encodeAbiParameters))
      }

      for (const candidateSignature of candidateSignatures) {
        try {
          const magic = await client.readContract({
            address: params.wallet,
            abi: eip1271Abi,
            functionName: 'isValidSignature',
            args: [digest, candidateSignature],
          })
          if (String(magic).toLowerCase() === EIP1271_MAGICVALUE) return true
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }

  return false
}

async function consumeAmoeNonce(params: { wallet: `0x${string}`; creatorCoin: `0x${string}`; nonce: `0x${string}` }): Promise<void> {
  const db = await getDb()
  if (!db) {
    const rec = memNonces.get(params.nonce)
    if (!rec) throw new Error('nonce_not_found')
    if (rec.consumed) throw new Error('nonce_used')
    if (rec.wallet !== params.wallet.toLowerCase()) throw new Error('nonce_wallet_mismatch')
    if (rec.creatorCoin !== params.creatorCoin.toLowerCase()) throw new Error('nonce_creator_mismatch')
    if (Date.parse(rec.expiresAt) < Date.now()) throw new Error('nonce_expired')
    rec.consumed = true
    memNonces.set(params.nonce, rec)
    return
  }

  await ensureAmoeSchema(db)
  const updated = await db.sql`
    UPDATE lottery_amoe_nonces
    SET consumed_at = NOW()
    WHERE nonce = ${params.nonce}
      AND wallet_address = ${params.wallet.toLowerCase()}
      AND creator_coin = ${params.creatorCoin.toLowerCase()}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING nonce;
  `
  if (!updated.rows?.[0]?.nonce) throw new Error('nonce_invalid_or_used')
}

export async function verifyAmoeEntryProof(params: {
  creatorCoin: `0x${string}`
  message: string
  signature: `0x${string}`
  lotteryManager: `0x${string}`
}): Promise<{
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  expiresAt: string
}> {
  const parsed = parseAmoeEntryMessage(params.message)
  if (!parsed) throw new AmoeBadRequestError('invalid_message')
  if (parsed.creatorCoin !== params.creatorCoin.toLowerCase()) throw new AmoeBadRequestError('creator_mismatch')
  if (parsed.lotteryManager !== params.lotteryManager.toLowerCase()) throw new AmoeBadRequestError('lottery_manager_mismatch')
  if (parsed.chainId !== 8453) throw new AmoeBadRequestError('invalid_chain')
  if (Date.parse(parsed.expiresAt) <= Date.now()) throw new AmoeBadRequestError('message_expired')

  const ok = await verifyWalletMessageSignature({
    wallet: parsed.wallet,
    message: params.message,
    signature: params.signature,
  })
  if (!ok) throw new AmoeBadRequestError('signature_invalid')

  await consumeAmoeNonce({
    wallet: parsed.wallet,
    creatorCoin: parsed.creatorCoin,
    nonce: parsed.nonce,
  })

  return {
    wallet: parsed.wallet,
    creatorCoin: parsed.creatorCoin,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
  }
}

export async function createAmoeAttestation(params: {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  expiresAt: string
  lotteryManager: `0x${string}`
}): Promise<{
  buyer: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  deadline: number
  signature: `0x${string}`
  callData: `0x${string}`
  to: `0x${string}`
}> {
  const pkRaw = (process.env.LOTTERY_AMOE_SIGNER_PRIVATE_KEY ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(pkRaw)) {
    throw new AmoeServerError('amoe_signer_private_key_missing')
  }
  const expiresAtMs = Date.parse(params.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new AmoeBadRequestError('message_expired')
  }
  if (!isBytes32Like(params.nonce)) throw new AmoeBadRequestError('invalid_nonce')

  const { createPublicClient, encodeFunctionData, http } = await import('viem')
  const { base } = await import('viem/chains')
  const { privateKeyToAccount } = await import('viem/accounts')

  // Keep attestation TTL short and bounded by the user challenge expiry.
  //
  // The on-chain `LotteryAmoeRouter` enforces `deadline >= block.timestamp +
  // MIN_DEADLINE_BUFFER` (60s) to absorb miner-timestamp drift (audit §4.2).
  // We MUST mirror that floor here so we never sign a calldata blob that the
  // contract is guaranteed to revert on with `DeadlineTooSoon`. In relay mode
  // (_amoeSubmit.ts) credits are consumed before the on-chain call, so a
  // systematic late-window revert would burn user credits for nothing.
  const MIN_DEADLINE_BUFFER_SEC = 60
  const nowSec = Math.floor(Date.now() / 1000)
  const maxDeadlineSec = nowSec + 15 * 60
  const expiresSec = Math.floor(expiresAtMs / 1000)
  const deadline = Math.min(maxDeadlineSec, expiresSec)
  if (deadline <= nowSec) throw new AmoeBadRequestError('message_expired')
  if (deadline - nowSec < MIN_DEADLINE_BUFFER_SEC) {
    // Surfaced as a 4xx by the handler; clients should retry with a fresh
    // challenge rather than burn credits on a known-dead attestation.
    throw new AmoeBadRequestError('message_expires_too_soon')
  }
  let amoeMessageHash: `0x${string}` | null = null
  for (const url of getBaseRpcUrls()) {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })
      amoeMessageHash = await publicClient.readContract({
        address: params.lotteryManager,
        abi: lotteryAmoeAbi,
        functionName: 'getAmoeMessageHash',
        args: [params.wallet, params.creatorCoin, params.nonce, BigInt(deadline)],
      })
      break
    } catch {
      continue
    }
  }
  if (!amoeMessageHash) throw new AmoeServerError('amoe_hash_read_failed')

  const signer = privateKeyToAccount(pkRaw as `0x${string}`)
  const signature = await signer.signMessage({ message: { raw: amoeMessageHash } })

  const callData = encodeFunctionData({
    abi: lotteryAmoeAbi,
    functionName: 'submitAmoeEntry',
    args: [params.wallet, params.creatorCoin, params.nonce, BigInt(deadline), signature],
  })

  const db = await getDb()
  if (db) {
    await ensureAmoeSchema(db)
    const nonceHash = sha256Hex(params.nonce)
    await db.sql`
      INSERT INTO lottery_amoe_entries (nonce_hash, nonce, wallet_address, creator_coin, attestation_deadline)
      VALUES (${nonceHash}, ${params.nonce}, ${params.wallet.toLowerCase()}, ${params.creatorCoin.toLowerCase()}, ${deadline})
      ON CONFLICT (nonce_hash) DO NOTHING;
    `
  }

  return {
    buyer: params.wallet,
    creatorCoin: params.creatorCoin,
    nonce: params.nonce,
    deadline,
    signature,
    callData,
    to: params.lotteryManager,
  }
}

// =====================================================================
// PR 2 — variable-points-amount AMOE entry path
// =====================================================================

/**
 * Build the calldata for a relayer-mode AMOE entry that targets PR 1's
 * `CreatorLotteryManager.processAmoeEntry(buyer, creatorCoin, pointsBurnedAsUSD)`.
 *
 * Unlike `createAmoeAttestation` (which produced an ECDSA-signed payload
 * for `LotteryAmoeRouter.submitAmoeEntry`), this path has no on-chain
 * signature verification — the on-chain function is gated to a single
 * relayer-key allowlist. The user-signed message remains the off-chain
 * authorization + anti-replay artifact (verified via `verifyAmoeEntryProof`)
 * but is NOT included in the on-chain call.
 *
 * Trust assumption (PR 2): the relayer key is fully trusted to bind
 * `pointsBurned` honestly. PR 4 will move that binding into a zkMetal
 * Groth16 public input. See docs/security/amoe-pr1-handoff.md and the
 * companion PR 2 handoff for the full model.
 *
 * @param params.wallet The buyer (already verified via signed message).
 * @param params.creatorCoin The creator coin the entry is for.
 * @param params.pointsBurned Points being burned (must be in [MIN, MAX]).
 * @param params.lotteryManager Address of the deployed CreatorLotteryManager.
 * @returns The transaction calldata + target address for the relayer to send.
 */
export async function buildProcessAmoeEntryCall(params: {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  pointsBurned: number
  lotteryManager: `0x${string}`
}): Promise<{
  to: `0x${string}`
  callData: `0x${string}`
  pointsBurned: number
  pointsBurnedAsUSD: string
  estimatedWinChancePPM: number
}> {
  const pointsBurnedAsUSD = pointsToUsd1e6(params.pointsBurned)
  const { encodeFunctionData } = await import('viem')
  const callData = encodeFunctionData({
    abi: creatorLotteryManagerAmoeAbi,
    functionName: 'processAmoeEntry',
    args: [params.wallet, params.creatorCoin, pointsBurnedAsUSD],
  })
  return {
    to: params.lotteryManager,
    callData,
    pointsBurned: params.pointsBurned,
    // Encode bigint as decimal string — JSON.stringify cannot serialize bigint.
    pointsBurnedAsUSD: pointsBurnedAsUSD.toString(),
    estimatedWinChancePPM: estimateWinChancePPM(pointsBurnedAsUSD),
  }
}

// =====================================================================
// PR 4 — PLONK ZK entry path
// =====================================================================

/**
 * Validate a single PLONK field element. Public-input slots and proof
 * scalars MUST be in [0, Q) — the router enforces this on-chain via
 * AmoePlonkVerifier's `checkField` patch (see
 * docs/security/amoe-plonk-migration.md), but we also enforce it here so
 * a malformed input fails before the relayer pays gas for a
 * guaranteed-revert transaction.
 */
function assertFieldElement(value: bigint, slotLabel: string): void {
  if (value < 0n) {
    throw new AmoeBadRequestError(`${slotLabel}_negative`)
  }
  if (value >= AMOE_BN254_SCALAR_FIELD_Q) {
    throw new AmoeBadRequestError(`${slotLabel}_above_field_q`)
  }
}

/**
 * Coerce an input that may be number | bigint | hex-string | decimal-string
 * into a bigint. Used because snarkjs emits public-input values as decimal
 * strings ("1000000") in calldata.txt while many on-chain helpers prefer
 * 0x-hex.
 */
function toBigIntField(value: bigint | number | string, slotLabel: string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    // PLONK proof + public-input scalars routinely exceed 2^53 - 1, so a
    // JS `number` cannot losslessly represent them. Accepting a non-safe
    // integer here would silently round the value before BigInt() ever
    // sees it, then sail through the [0, Q) field check and emit
    // calldata with the wrong scalar — a deterministic on-chain
    // InvalidProof. Reject anything outside Number.isSafeInteger so the
    // upstream prover is forced to hand us a string or bigint.
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AmoeBadRequestError(`${slotLabel}_not_safe_uint`)
    }
    return BigInt(value)
  }
  // string
  const trimmed = value.trim()
  if (trimmed === '') {
    throw new AmoeBadRequestError(`${slotLabel}_empty_string`)
  }
  try {
    // BigInt() accepts both 0x-prefixed hex and decimal.
    return BigInt(trimmed)
  } catch {
    throw new AmoeBadRequestError(`${slotLabel}_unparseable`)
  }
}

export interface AmoeZKBuildInputs {
  /** The buyer (already verified via signed message off-chain). */
  wallet: `0x${string}`
  /** The creator coin the entry is for. MUST equal pubInputs[1] when masked to uint160. */
  creatorCoin: `0x${string}`
  /** Lottery epoch. MUST equal pubInputs[3]. */
  epoch: bigint | number
  /**
   * The 24-element PLONK proof emitted by
   * `snarkjs zkey export solidityverifier`. Each element is a BN254 field
   * scalar in [0, Q).
   */
  proof: ReadonlyArray<bigint | number | string>
  /**
   * The 8 PLONK public inputs in the slot layout pinned by
   * `AMOE_PLONK_PUB_INPUT_SLOT`. Each element is a BN254 field scalar
   * in [0, Q).
   */
  pubInputs: ReadonlyArray<bigint | number | string>
  /** Address of the deployed `LotteryAmoeRouter`. */
  lotteryAmoeRouter: `0x${string}`
}

export interface AmoeZKBuildResult {
  /** Target address — the LotteryAmoeRouter. */
  to: `0x${string}`
  /** ABI-encoded calldata for `submitAmoeEntryZK`. */
  callData: `0x${string}`
  /** USD-1e6 value the proof binds. Pulled from pubInputs[5] for convenience. */
  pointsBurnedAsUSD: string
  /** UI win-chance preview, derived from pubInputs[5] (PPM). */
  estimatedWinChancePPM: number
}

/**
 * Build calldata for the PLONK ZK entry path
 * (`LotteryAmoeRouter.submitAmoeEntryZK`).
 *
 * What this function IS:
 *   * A pure ABI encoder + field-bounds validator. Takes a pre-computed
 *     proof + public-input array and returns the on-chain calldata.
 *   * The narrow contract surface that the eventual proof-generation
 *     server will hand its output to. Decouples "have a proof" from
 *     "submit a proof."
 *
 * What this function ISN'T:
 *   * A proof generator. Witness construction (Merkle paths over the
 *     allowlist tree and points-ledger tree, Poseidon commits, snarkjs
 *     PLONK prove) is downstream and lives outside this module — see
 *     issue #403 §2 ("Server relayer flip to ZK path") for the open
 *     scope.
 *   * A replay guard. The on-chain router maintains the global nullifier
 *     map (`usedPointsBurnNullifier`); the relayer is expected to also
 *     skip submission when it sees a previously-used nullifier (also
 *     tracked in the same issue).
 *
 * Trust model: the on-chain `LotteryAmoeRouter` re-checks every input
 * against `AmoePlonkVerifier` and the per-epoch root maps; this builder
 * is purely client-side. A malformed proof produced here will be
 * rejected on-chain.
 *
 * @throws AmoeBadRequestError if the proof or pubInputs arrays have the
 *         wrong length or contain non-canonical encodings.
 */
export async function buildAmoeEntryZKCall(
  inputs: AmoeZKBuildInputs,
): Promise<AmoeZKBuildResult> {
  if (!isAddressLike(inputs.wallet)) {
    throw new AmoeBadRequestError('zk_invalid_wallet')
  }
  if (!isAddressLike(inputs.creatorCoin)) {
    throw new AmoeBadRequestError('zk_invalid_creator_coin')
  }
  if (!isAddressLike(inputs.lotteryAmoeRouter)) {
    throw new AmoeBadRequestError('zk_invalid_router_address')
  }

  // Length checks first — catches "snarkjs emitted the wrong shape"
  // before we waste cycles on field-bounds.
  if (inputs.proof.length !== AMOE_PLONK_PROOF_LEN) {
    throw new AmoeBadRequestError('zk_proof_wrong_length')
  }
  if (inputs.pubInputs.length !== AMOE_PLONK_PUB_INPUTS_LEN) {
    throw new AmoeBadRequestError('zk_pub_inputs_wrong_length')
  }

  const epochBig = toBigIntField(inputs.epoch, 'zk_epoch')
  if (epochBig > 0xffffffffffffffffn) {
    throw new AmoeBadRequestError('zk_epoch_above_uint64')
  }

  // Coerce + field-bound every proof scalar.
  const proofScalars = inputs.proof.map((value, idx) => {
    const big = toBigIntField(value, `zk_proof_${idx}`)
    assertFieldElement(big, `zk_proof_${idx}`)
    return big
  })

  // Coerce + field-bound every public input. Mirrors the on-chain
  // checkField loop — if any of these is >= Q the router will reject
  // the tx with InvalidProof, so we reject locally to avoid burning gas.
  const pubInputScalars = inputs.pubInputs.map((value, idx) => {
    const big = toBigIntField(value, `zk_pub_input_${idx}`)
    assertFieldElement(big, `zk_pub_input_${idx}`)
    return big
  })

  // Enforce the calldata→pubInputs binding the router enforces. This is
  // belt-and-suspenders: getting any of these wrong here would just mean
  // a guaranteed-revert tx, but failing loudly client-side is cheaper.
  const creatorCoinAsField = BigInt(inputs.creatorCoin)
  if (creatorCoinAsField !== pubInputScalars[AMOE_PLONK_PUB_INPUT_SLOT.creatorCoinAddr]) {
    throw new AmoeBadRequestError('zk_creator_coin_pub_input_mismatch')
  }
  if (epochBig !== pubInputScalars[AMOE_PLONK_PUB_INPUT_SLOT.epoch]) {
    throw new AmoeBadRequestError('zk_epoch_pub_input_mismatch')
  }

  // Build the typed fixed-length tuples viem expects for `uint256[24]` /
  // `uint256[8]`. We use intermediate variables so TS keeps the
  // tuple-arity narrowing.
  const proofTuple = proofScalars as unknown as readonly [
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  ]
  const pubTuple = pubInputScalars as unknown as readonly [
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  ]

  // Mirror the on-chain `PointsValueOutOfRange` guard
  // (LotteryAmoeRouter.submitAmoeEntryZK rejects pointsBurnedAsUSD == 0
  // or > MAX_POINTS_AS_USD). Without this check a buggy/malformed prover
  // can produce calldata that's perfectly well-formed at the field level
  // but reverts deterministically on-chain. Catch it client-side so the
  // builder's stated fail-fast contract actually holds.
  const pointsBurnedAsUSD = pubInputScalars[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnedAsUSD]
  if (pointsBurnedAsUSD === 0n) {
    throw new AmoeBadRequestError('zk_points_burned_zero')
  }
  if (pointsBurnedAsUSD > AMOE_MAX_POINTS_AS_USD) {
    throw new AmoeBadRequestError('zk_points_burned_above_max')
  }

  const { encodeFunctionData } = await import('viem')
  const callData = encodeFunctionData({
    abi: lotteryAmoeAbi,
    functionName: 'submitAmoeEntryZK',
    args: [inputs.wallet, inputs.creatorCoin, epochBig, proofTuple, pubTuple],
  })

  return {
    to: inputs.lotteryAmoeRouter,
    callData,
    pointsBurnedAsUSD: pointsBurnedAsUSD.toString(),
    estimatedWinChancePPM: estimateWinChancePPM(pointsBurnedAsUSD),
  }
}

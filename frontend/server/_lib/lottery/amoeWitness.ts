// SPDX-License-Identifier: MIT
//
// PR 4 follow-up — AMOE PLONK witness assembly.
//
// SCOPE
// =====
// Pure-function entry point that takes raw, *unhashed* AMOE entry inputs
// (wallet address, nonce, signup/spend/twitter identifiers, epoch, points
// burned, plus the two Merkle snapshots for the day) and returns a fully
// populated `AmoeEligibilityWitness` ready to be handed to
// `proveAmoeEntryPlonk()` from PR #421.
//
// This module owns the *binding* logic between user-facing data and the
// 14 signals the circuit consumes:
//
//   Public:   walletAddrCommit, creatorCoinAddr, nonceCommit, epoch,
//             allowlistRoot, pointsBurnedAsUSD, pointsLedgerRoot,
//             pointsBurnNullifier
//   Private:  wallet, nonce, twitterCreditNullifier, pathElements[],
//             pathIndices[], signupIdHash, spendRefIdHash,
//             pointsLedgerPathElements[], pointsLedgerPathIndices[]
//
// That makes this the single place where Poseidon arities matter, where
// the leaf-hash schema is encoded, and where bit-bound checks (160 for
// `creatorCoinAddr`, 64 for `epoch`/`pointsBurnedAsUSD`) live in TS.
// Splitting it from `amoeMerkleTree.ts` keeps the tree primitive
// reusable for other circuits and keeps this file's surface area
// strictly about AMOE.
//
// HASH SCHEMA (mirrors `amoe/circuits/amoe_eligibility.circom`)
// =============================================================
//   walletAddrCommit    = Poseidon2(wallet, twitterCreditNullifier)
//   nonceCommit         = Poseidon3(nonce, wallet, creatorCoinAddr)
//   pointsBurnNullifier = Poseidon4(signupIdHash, spendRefIdHash,
//                                   pointsBurnedAsUSD, epoch)
//   allowlistLeaf       = Poseidon2(wallet, epoch)
//   ledgerLeaf          = Poseidon5(signupIdHash, spendRefIdHash,
//                                   pointsBurnedAsUSD, epoch,
//                                   walletAddrCommit)
//
// CIRCUIT BIT BOUNDS
// ==================
//   * `creatorCoinAddr`  Num2Bits(160) — must fit in 160 bits.
//   * `epoch`            Num2Bits(64)  — must fit in 64 bits.
//   * `pointsBurnedAsUSD` Num2Bits(64) — must fit in 64 bits. (The actual
//                        admissibility band — 100..1_000_000 points,
//                        1¢ per point ⇒ 10_000..100_000_000 USD-cents —
//                        is enforced by the Solidity layer; the circuit
//                        only requires representability.)
//
// CROSS-VALIDATION
// ================
// The companion test file (`amoeWitness.test.ts`) loads the canonical
// `amoe/circuits/build/input_v2.json` fixture and asserts that the
// witness this module produces, given the *raw* inputs (wallet, nonce,
// twitterCreditNullifier, signupIdHash, spendRefIdHash, pointsBurnedAsUSD,
// epoch, creatorCoinAddr) bit-exactly matches the fixture's expected
// public commits. If any of those drift, the suite fails loudly.
//
// ESLINT NOTE
// ===========
// The repo's ESLint config forbids throw-literal patterns. We throw
// `AmoeProofGenerationError` only — a real Error subclass — so the
// usual `throw` is fine here.

import {
  poseidon2,
  poseidon3,
  poseidon4,
  poseidon5,
} from 'poseidon-lite'

import {
  AMOE_MERKLE_DEPTH,
  AmoeProofGenerationError,
  type AmoeEligibilityWitness,
} from './proveAmoeEntryPlonk.js'
import {
  AMOE_MERKLE_TREE_DEPTH,
  AMOE_MERKLE_TREE_MAX_LEAVES,
  buildAmoeMerkleSnapshot,
  getAmoeMerklePath,
  readAmoeMerkleLeaf,
  verifyAmoeMerklePath,
  type AmoeMerklePath,
  type AmoeMerkleSnapshot,
} from './amoeMerkleTree.js'

// ----------------------------------------------------------------------------
// Constants — mirror the circuit's Num2Bits widths
// ----------------------------------------------------------------------------

/**
 * Maximum value for `creatorCoinAddr`. Mirrors `Num2Bits(160)` in
 * `amoe_eligibility.circom` line 153. EVM addresses are 160-bit, so this
 * is exactly the 20-byte address space.
 */
export const AMOE_MAX_CREATOR_COIN_ADDR = (1n << 160n) - 1n

/**
 * Maximum value for `epoch`. Mirrors `Num2Bits(64)` in
 * `amoe_eligibility.circom` line 157. Epoch is the daily counter
 * (uint64 on-chain), so 64 bits gives ~5 × 10^11 years of headroom.
 */
export const AMOE_MAX_EPOCH = (1n << 64n) - 1n

/**
 * Maximum value for `pointsBurnedAsUSD` (the circuit's Num2Bits(64) bound).
 * The Solidity / business-rule cap (100..1_000_000 points ⇒ 1_000_000..
 * 10_000_000_000 USD-cents) is much smaller and enforced elsewhere.
 */
export const AMOE_MAX_POINTS_BURNED_AS_USD = (1n << 64n) - 1n

/**
 * Genesis timestamp for the AMOE epoch counter, in seconds since the Unix
 * epoch (UTC). The first epoch (E=0) starts at this instant; subsequent
 * epochs roll over every {@link AMOE_EPOCH_LENGTH_SECONDS} seconds.
 *
 * **Pinned value:** `2026-04-30T00:00:00Z` = 1_777_507_200. This is the
 * first UTC midnight strictly after PR #426 (the witness module) merged
 * at 2026-04-29T06:10:43Z, satisfying the design constraint in
 * `docs/security/amoe-points-burn-ledger-sot.md` §10. Verified:
 * `Date.UTC(2026, 3, 30, 0, 0, 0) / 1000 === 1_777_507_200`.
 *
 * **Why a hard-coded constant, not env:** the epoch index is a public
 * input to every PLONK proof and is bound on-chain by
 * `LotteryAmoeRouter.allowlistRootOf` / `pointsLedgerRootOf`. Allowing the
 * publisher to differ from the prover by even one epoch would silently
 * desync every downstream proof. Pinning here means both modules import
 * the same value at module load.
 *
 * **Single source of truth:** `amoeSubmitZk.ts` re-exports this value
 * (under the legacy name `AMOE_EPOCH_GENESIS_UNIX_SEC`) so that the
 * submit-handler and the points-burn-ledger publisher cannot drift
 * apart. A regression test in `amoeSubmitZk.test.ts` asserts the two
 * names point at the same bigint.
 *
 * **Mutation forbidden post-launch:** changing this value is equivalent
 * to invalidating every previously-published epoch root and would brick
 * every in-flight proof. Treat it as a circuit constant.
 */
export const AMOE_EPOCH_GENESIS_SECONDS = 1_777_507_200n as const

/**
 * Length of one AMOE epoch in seconds — 86400 = 1 UTC day.
 *
 * **Pinned value:** the daily cadence is locked into the circuit (see
 * `amoeWitness.ts:102` epoch-is-daily comment and the daily rhythm of
 * `amoe_twitter_daily` / `amoe_checkin` in the points ledger). Changing
 * this post-launch would require a circuit regeneration — it is not a
 * v1 decision, it is a constant.
 */
export const AMOE_EPOCH_LENGTH_SECONDS = 86_400n as const

/**
 * Grace window (in seconds) the publisher waits past `epoch_close(E)`
 * before declaring epoch `E` eligible for projection / publishing. This
 * absorbs clock skew between API servers, the publisher cron, and the
 * database — a row written 30s before `epoch_close(E)` with a server
 * clock that is 30s fast can land in the database 60s after the boundary,
 * and we want it to land in epoch `E`'s snapshot, not `E+1`'s.
 *
 * 60 seconds is well above worst-case observed Postgres / API clock
 * drift. Increase only if monitoring shows late-arriving rows.
 */
export const AMOE_EPOCH_GRACE_SECONDS = 60n as const

/**
 * Compute the AMOE epoch index for a `created_at` timestamp.
 *
 * @param createdAtSeconds Unix timestamp in seconds (UTC). Bigint to avoid
 *                         the JS-number 53-bit cliff for far-future
 *                         epochs.
 * @returns The epoch counter `E` such that `genesis + E*length <=
 *          createdAt < genesis + (E+1)*length`.
 * @throws  Range error (as a plain `Error` — not an AmoeProofGenerationError
 *          since this is not a witness-time check) if `createdAt` is
 *          before genesis.
 */
export function epochForTimestamp(createdAtSeconds: bigint): bigint {
  if (typeof createdAtSeconds !== 'bigint') {
    throw new Error(
      `epochForTimestamp: createdAtSeconds must be a bigint (got ${typeof createdAtSeconds})`,
    )
  }
  if (createdAtSeconds < AMOE_EPOCH_GENESIS_SECONDS) {
    throw new Error(
      `epochForTimestamp: createdAtSeconds=${createdAtSeconds.toString()} is before AMOE genesis=${AMOE_EPOCH_GENESIS_SECONDS.toString()}`,
    )
  }
  const elapsed = createdAtSeconds - AMOE_EPOCH_GENESIS_SECONDS
  return elapsed / AMOE_EPOCH_LENGTH_SECONDS
}

/**
 * Compute the close-time of epoch `E`, in Unix seconds.
 *
 * `epoch_close(E) = genesis + (E + 1) * length`. A row whose
 * `created_at >= epoch_close(E)` belongs to epoch `E+1`, not `E`.
 */
export function epochCloseAt(epoch: bigint): bigint {
  if (typeof epoch !== 'bigint' || epoch < 0n) {
    throw new Error(`epochCloseAt: epoch must be a non-negative bigint`)
  }
  return AMOE_EPOCH_GENESIS_SECONDS + (epoch + 1n) * AMOE_EPOCH_LENGTH_SECONDS
}

/**
 * Return the current AMOE epoch given a wall-clock millisecond timestamp
 * (e.g. `Date.now()`). Pure helper — no I/O, no dependency on the system
 * clock at module-load time.
 */
export function currentAmoeEpoch(nowMs: number): bigint {
  return epochForTimestamp(BigInt(Math.floor(nowMs / 1000)))
}

/**
 * Returns true iff epoch `E` is eligible for projection / publishing —
 * i.e. its close-time plus the grace window has passed. Used by the
 * publisher cron to decide which epochs to materialize.
 */
export function isAmoeEpochEligibleForPublish(
  epoch: bigint,
  nowMs: number,
): boolean {
  const nowSec = BigInt(Math.floor(nowMs / 1000))
  const eligibleAt = epochCloseAt(epoch) + AMOE_EPOCH_GRACE_SECONDS
  return nowSec >= eligibleAt
}

/**
 * BN254 scalar field modulus. Every signal in the circuit must lie in
 * `[0, Q)`. Inputs whose domain is naturally bounded by Q (EVM addresses,
 * uint64 counters, USD-cent amounts) are strict-checked; bytes32-domain
 * inputs (server-issued random nonces, off-chain identifier hashes) are
 * canonicalized via {@link canonicalizeAmoeBytes32ToField} — see that
 * helper for the rationale.
 */
export const AMOE_BN254_FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

/**
 * Maximum bytes32 value (2^256 - 1). Used as the domain bound for
 * `canonicalizeAmoeBytes32ToField`. Any input larger than this is a
 * caller bug — e.g. a 33-byte buffer parsed as a bigint, or a negative
 * bigint coerced via two's complement.
 */
export const AMOE_BYTES32_DOMAIN_MAX = (1n << 256n) - 1n

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Raw, application-level inputs the API handler receives. Each value is
 * a `bigint` — callers are responsible for parsing whatever wire format
 * they got (decimal string from JSON, hex from the wallet, etc.) into a
 * canonical `bigint` before invoking `assembleAmoeWitness`.
 *
 * Why bigints and not strings?
 *   * The circuit consumes field elements (`bigint` semantics).
 *   * Forcing the caller to parse explicitly avoids silent base-mismatches
 *     (e.g. a hex string parsed as decimal). The handler that converts
 *     wire → bigint is the right place to surface a parse error.
 */
export interface AmoeWitnessRawInputs {
  /** EVM wallet address as a 160-bit bigint (e.g. `BigInt('0x...')`). */
  wallet: bigint
  /**
   * Server-issued bytes32 nonce. Domain: `[0, 2^256)`. Will be reduced
   * mod the BN254 scalar field modulus (`Q`) by the assembler before
   * being hashed into `nonceCommit`. ~81% of `randomBytes(32)` outputs
   * are above `Q` — see `lotteryAmoe.ts::issueAmoeNonce` for the issuer.
   */
  nonce: bigint
  /**
   * Nullifier derived from the user's Twitter credential. Bytes32 domain;
   * canonicalized mod Q before hashing.
   */
  twitterCreditNullifier: bigint
  /** Creator coin contract address as a 160-bit bigint. */
  creatorCoinAddr: bigint
  /** Daily epoch counter, ≤ 2^64 - 1. */
  epoch: bigint
  /**
   * Hash of the user's signup ID (off-chain). Bytes32 domain;
   * canonicalized mod Q before hashing.
   */
  signupIdHash: bigint
  /**
   * Hash of the points-burn spend reference. Bytes32 domain; canonicalized
   * mod Q before hashing.
   */
  spendRefIdHash: bigint
  /**
   * Points burned, expressed in USD-cents (i.e. `points * 10_000`). Must
   * fit in 64 bits per the circuit. Business-rule bands (100..1M points)
   * are enforced by the Solidity layer.
   */
  pointsBurnedAsUSD: bigint
}

/**
 * Tree context the witness assembler needs — typically supplied by the
 * daily snapshot publisher. Two trees because the circuit verifies
 * inclusion in *both*: the wallet's allowlist membership, and the burn
 * row's presence in the day's points-burn ledger.
 */
export interface AmoeWitnessTreeContext {
  /**
   * The allowlist snapshot for `epoch`. Leaves are
   * `Poseidon2(wallet, epoch)` for every wallet allowlisted in this epoch.
   */
  allowlistSnapshot: AmoeMerkleSnapshot
  /** Index of *this* wallet's leaf in the allowlist snapshot. */
  allowlistLeafIndex: number
  /**
   * The points-burn ledger snapshot for `epoch`. Leaves are
   * `Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch,
   * walletAddrCommit)`.
   */
  pointsLedgerSnapshot: AmoeMerkleSnapshot
  /** Index of *this* burn row's leaf in the ledger snapshot. */
  pointsLedgerLeafIndex: number
}

/**
 * Combined input for {@link assembleAmoeWitness}. Splits cleanly between
 * "what the user supplied" and "what the daily snapshot publisher
 * supplied" so callers can compose the two streams independently.
 */
export interface AssembleAmoeWitnessArgs {
  raw: AmoeWitnessRawInputs
  trees: AmoeWitnessTreeContext
}

// ----------------------------------------------------------------------------
// Canonicalization
// ----------------------------------------------------------------------------

/**
 * Reduce a bytes32-domain bigint to a canonical BN254 field element.
 *
 * RATIONALE
 * =========
 * Several AMOE inputs are produced as random / opaque 32-byte values
 * before the witness layer ever sees them:
 *
 *   * `nonce` — server emits `randomBytes(32)`; ~81% of those exceed `Q`.
 *     (See `lotteryAmoe.ts::issueAmoeNonce`.)
 *   * `twitterCreditNullifier`, `signupIdHash`, `spendRefIdHash` —
 *     hash-derived identifiers from off-chain stores; same situation.
 *
 * The PLONK circuit, like all circom-on-BN254 circuits, can only consume
 * field elements in `[0, Q)`. Hard-rejecting any bytes32 above `Q` would
 * break ~81% of legitimate entries. The standard remediation is to
 * canonicalize at the witness boundary by reducing mod `Q` — the same
 * convention `circomlibjs` uses for its native bytes32 → field helpers.
 *
 * SAFETY
 * ======
 * Reduction is structure-preserving: two bytes32 values that differ
 * only by a multiple of `Q` collide post-reduction. With Q being
 * ~2^254, collisions on uniformly-random bytes32 are exactly when the
 * upper 2 bits of the bytes32 represent the same `floor(v / Q)` value
 * AND the lower bits match — i.e. ~2^-254 per pair, completely
 * negligible. For the AMOE replay/nullifier guarantees this is the
 * same security level as if the issuer had emitted a 254-bit value.
 *
 * The reduction MUST be applied identically by every component that
 * recomputes a commit (server, contract that re-derives, future
 * publisher) so the same on-chain `nonceCommit` falls out regardless
 * of which side computes it. This module is the source of truth.
 *
 * VALIDATION
 * ==========
 * Inputs must be a non-negative bigint with `v <= 2^256 - 1`. Anything
 * larger almost certainly indicates a caller-side parse bug (e.g. a
 * 33-byte buffer parsed as a bigint, or a negative bigint coerced via
 * two's complement) and we throw `plonk_witness_input_invalid` rather
 * than silently reducing it.
 */
export function canonicalizeAmoeBytes32ToField(
  name: string,
  v: unknown,
): bigint {
  if (typeof v !== 'bigint') {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" must be a bigint`,
    )
  }
  if (v < 0n) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" must be non-negative, got ${v.toString()}`,
    )
  }
  if (v > AMOE_BYTES32_DOMAIN_MAX) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" exceeds bytes32 domain (max 2^256 - 1)`,
    )
  }
  return v % AMOE_BN254_FIELD_MODULUS
}

// ----------------------------------------------------------------------------
// Hash helpers (each mirrors a circuit hash exactly)
// ----------------------------------------------------------------------------

/**
 * `walletAddrCommit = Poseidon2(wallet, twitterCreditNullifier)`. This is
 * the public signal used on-chain to identify the entry without revealing
 * the wallet ↔ credential binding.
 */
export function computeAmoeWalletAddrCommit(
  wallet: bigint,
  twitterCreditNullifier: bigint,
): bigint {
  return poseidon2([wallet, twitterCreditNullifier])
}

/**
 * `nonceCommit = Poseidon3(nonce, wallet, creatorCoinAddr)`. Binds the
 * nonce to a specific (wallet, creator) pair so a nonce can't be replayed
 * across creators or wallets. Public signal.
 */
export function computeAmoeNonceCommit(
  nonce: bigint,
  wallet: bigint,
  creatorCoinAddr: bigint,
): bigint {
  return poseidon3([nonce, wallet, creatorCoinAddr])
}

/**
 * `pointsBurnNullifier = Poseidon4(signupIdHash, spendRefIdHash,
 * pointsBurnedAsUSD, epoch)`. Public signal — the on-chain replay store
 * tracks these to forbid double-spending the same burn row.
 *
 * Note the absence of `wallet` from the inputs: the binding to wallet is
 * via `walletAddrCommit` being a separate public signal that the contract
 * cross-checks against `msg.sender`. That keeps this nullifier
 * deterministic per burn row regardless of the wallet that submits it,
 * which is required for the "any wallet may sweep an unclaimed burn"
 * design currently locked.
 */
export function computeAmoePointsBurnNullifier(
  signupIdHash: bigint,
  spendRefIdHash: bigint,
  pointsBurnedAsUSD: bigint,
  epoch: bigint,
): bigint {
  return poseidon4([signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch])
}

/**
 * Allowlist leaf — `Poseidon2(wallet, epoch)`. The publisher uses the same
 * function when building the daily allowlist snapshot, so caller-vs-tree
 * is guaranteed in-sync.
 */
export function computeAmoeAllowlistLeaf(
  wallet: bigint,
  epoch: bigint,
): bigint {
  return poseidon2([wallet, epoch])
}

/**
 * Points-burn ledger leaf — `Poseidon5(signupIdHash, spendRefIdHash,
 * pointsBurnedAsUSD, epoch, walletAddrCommit)`.
 *
 * The leaf binds the burn row to the wallet *commit* (not the wallet
 * itself), so the ledger publisher only needs the public commit — which
 * keeps the published ledger zero-knowledge with respect to wallet
 * addresses.
 */
export function computeAmoeLedgerLeaf(
  signupIdHash: bigint,
  spendRefIdHash: bigint,
  pointsBurnedAsUSD: bigint,
  epoch: bigint,
  walletAddrCommit: bigint,
): bigint {
  return poseidon5([
    signupIdHash,
    spendRefIdHash,
    pointsBurnedAsUSD,
    epoch,
    walletAddrCommit,
  ])
}

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

/**
 * Field-element guard: asserts a value is a non-negative bigint < Q.
 * Throws `AmoeProofGenerationError('plonk_witness_input_invalid')` on
 * violation, with the offending field name in the message.
 */
function assertFieldElement(name: string, v: unknown): asserts v is bigint {
  if (typeof v !== 'bigint') {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" must be a bigint`,
    )
  }
  if (v < 0n) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" must be non-negative, got ${v.toString()}`,
    )
  }
  if (v >= AMOE_BN254_FIELD_MODULUS) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" exceeds BN254 field modulus`,
    )
  }
}

function assertBitBound(name: string, v: bigint, max: bigint): void {
  if (v > max) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: "${name}" exceeds bit-bound (max ${max.toString()}, got ${v.toString()})`,
    )
  }
}

function assertSnapshotShape(
  name: string,
  snapshot: AmoeMerkleSnapshot,
): void {
  if (
    !snapshot ||
    typeof snapshot.root !== 'bigint' ||
    !(snapshot.nodes instanceof Map) ||
    !(snapshot.leavesByIndex instanceof Map) ||
    typeof snapshot.leafCount !== 'number'
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: ${name} snapshot is malformed (missing root / nodes / leavesByIndex)`,
    )
  }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Assemble a fully-populated, circuit-ready `AmoeEligibilityWitness` from
 * raw inputs and the day's two Merkle snapshots.
 *
 * Validation performed (in order):
 *   1. Every raw input is a non-negative bigint < BN254 field modulus.
 *   2. Bit-bounds: `creatorCoinAddr` ≤ 2^160 - 1, `epoch` ≤ 2^64 - 1,
 *      `pointsBurnedAsUSD` ≤ 2^64 - 1.
 *   3. Both snapshots have the expected sparse shape.
 *   4. Computed allowlist leaf at `allowlistLeafIndex` matches the
 *      snapshot's level-0 entry at that index.
 *   5. Computed ledger leaf at `pointsLedgerLeafIndex` matches the
 *      snapshot's level-0 entry at that index.
 *   6. (Defensive) The Merkle path produced by `getAmoeMerklePath`
 *      verifies against the snapshot root — catches off-by-one bugs
 *      locally rather than 5-30s into a snarkjs prove.
 *
 * Returns an object whose shape is exactly `AmoeEligibilityWitness` from
 * `proveAmoeEntryPlonk.ts`. All bigints are returned as bigints (snarkjs
 * accepts both `bigint` and decimal-string; we stay in bigint until the
 * very last serialization step in the prover wrapper).
 *
 * @throws {AmoeProofGenerationError} on any structural / bounds / inclusion
 *         failure. Code is always `'plonk_witness_input_invalid'`.
 */
export function assembleAmoeWitness(
  args: AssembleAmoeWitnessArgs,
): AmoeEligibilityWitness {
  if (!args || typeof args !== 'object') {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: args must be an object',
    )
  }
  const { raw, trees } = args
  if (!raw || typeof raw !== 'object') {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: args.raw must be an object',
    )
  }
  if (!trees || typeof trees !== 'object') {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: args.trees must be an object',
    )
  }

  // --- Step 1a: domain-bounded inputs that MUST already be in [0, Q) ------
  // These are inputs whose domain (EVM address, uint64 counter, USD-cents)
  // is strictly smaller than Q. A value above Q here can only mean a
  // caller bug (wrong-base parse, wrong field) — surface loudly.
  assertFieldElement('wallet', raw.wallet)
  assertFieldElement('creatorCoinAddr', raw.creatorCoinAddr)
  assertFieldElement('epoch', raw.epoch)
  assertFieldElement('pointsBurnedAsUSD', raw.pointsBurnedAsUSD)

  // --- Step 1b: bytes32-domain inputs — canonicalize mod Q ---------------
  // Server-issued nonces and hash-derived identifiers may exceed Q
  // (~81% of randomBytes(32)); reducing mod Q is the standard
  // canonicalization. See `canonicalizeAmoeBytes32ToField` for the
  // full rationale.
  const nonce = canonicalizeAmoeBytes32ToField('nonce', raw.nonce)
  const twitterCreditNullifier = canonicalizeAmoeBytes32ToField(
    'twitterCreditNullifier',
    raw.twitterCreditNullifier,
  )
  const signupIdHash = canonicalizeAmoeBytes32ToField(
    'signupIdHash',
    raw.signupIdHash,
  )
  const spendRefIdHash = canonicalizeAmoeBytes32ToField(
    'spendRefIdHash',
    raw.spendRefIdHash,
  )

  // --- Step 2: enforce circuit-side Num2Bits widths. ----------------------
  // wallet has no explicit Num2Bits in the circuit, but it's an EVM address
  // so we apply the same 160-bit bound defensively. If a future caller
  // wanted to reuse this for a non-EVM wallet space, lift this bound and
  // add a separate flag.
  assertBitBound('wallet', raw.wallet, AMOE_MAX_CREATOR_COIN_ADDR)
  assertBitBound('creatorCoinAddr', raw.creatorCoinAddr, AMOE_MAX_CREATOR_COIN_ADDR)
  assertBitBound('epoch', raw.epoch, AMOE_MAX_EPOCH)
  assertBitBound(
    'pointsBurnedAsUSD',
    raw.pointsBurnedAsUSD,
    AMOE_MAX_POINTS_BURNED_AS_USD,
  )

  // --- Step 3: validate snapshot shapes. ----------------------------------
  assertSnapshotShape('allowlist', trees.allowlistSnapshot)
  assertSnapshotShape('pointsLedger', trees.pointsLedgerSnapshot)

  if (
    !Number.isInteger(trees.allowlistLeafIndex) ||
    trees.allowlistLeafIndex < 0
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: trees.allowlistLeafIndex must be a non-negative integer (got ${String(trees.allowlistLeafIndex)})`,
    )
  }
  if (
    !Number.isInteger(trees.pointsLedgerLeafIndex) ||
    trees.pointsLedgerLeafIndex < 0
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: trees.pointsLedgerLeafIndex must be a non-negative integer (got ${String(trees.pointsLedgerLeafIndex)})`,
    )
  }

  // --- Step 4: derive public commits / nullifier. -------------------------
  // We use the *canonicalized* bytes32-domain values so the witness
  // matches whatever a downstream re-deriver (server check, future
  // contract recomputation, publisher index lookup) would produce when
  // it applies the same canonicalization. The strict-domain inputs
  // (wallet, creatorCoinAddr, epoch, pointsBurnedAsUSD) flow through
  // unchanged.
  const walletAddrCommit = computeAmoeWalletAddrCommit(
    raw.wallet,
    twitterCreditNullifier,
  )
  const nonceCommit = computeAmoeNonceCommit(
    nonce,
    raw.wallet,
    raw.creatorCoinAddr,
  )
  const pointsBurnNullifier = computeAmoePointsBurnNullifier(
    signupIdHash,
    spendRefIdHash,
    raw.pointsBurnedAsUSD,
    raw.epoch,
  )

  // --- Step 5: derive both leaves and confirm placement in snapshots. -----
  const allowlistLeaf = computeAmoeAllowlistLeaf(raw.wallet, raw.epoch)
  if (trees.allowlistLeafIndex >= AMOE_MERKLE_TREE_MAX_LEAVES) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: allowlistLeafIndex ${trees.allowlistLeafIndex} >= 2^${AMOE_MERKLE_TREE_DEPTH}`,
    )
  }
  if (
    readAmoeMerkleLeaf(trees.allowlistSnapshot, trees.allowlistLeafIndex) !==
    allowlistLeaf
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: derived allowlist leaf does not match snapshot at allowlistLeafIndex (caller likely passed the wrong index or a stale snapshot)',
    )
  }

  const ledgerLeaf = computeAmoeLedgerLeaf(
    signupIdHash,
    spendRefIdHash,
    raw.pointsBurnedAsUSD,
    raw.epoch,
    walletAddrCommit,
  )
  if (trees.pointsLedgerLeafIndex >= AMOE_MERKLE_TREE_MAX_LEAVES) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: pointsLedgerLeafIndex ${trees.pointsLedgerLeafIndex} >= 2^${AMOE_MERKLE_TREE_DEPTH}`,
    )
  }
  if (
    readAmoeMerkleLeaf(
      trees.pointsLedgerSnapshot,
      trees.pointsLedgerLeafIndex,
    ) !== ledgerLeaf
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: derived ledger leaf does not match snapshot at pointsLedgerLeafIndex (caller likely passed the wrong index or a stale snapshot)',
    )
  }

  // --- Step 6: read inclusion paths + sanity-verify locally. --------------
  const allowlistPath: AmoeMerklePath = getAmoeMerklePath(
    trees.allowlistSnapshot,
    trees.allowlistLeafIndex,
  )
  const ledgerPath: AmoeMerklePath = getAmoeMerklePath(
    trees.pointsLedgerSnapshot,
    trees.pointsLedgerLeafIndex,
  )

  if (
    !verifyAmoeMerklePath({
      leaf: allowlistLeaf,
      root: trees.allowlistSnapshot.root,
      path: allowlistPath,
    })
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: allowlist Merkle path failed local verification (snapshot internal inconsistency)',
    )
  }
  if (
    !verifyAmoeMerklePath({
      leaf: ledgerLeaf,
      root: trees.pointsLedgerSnapshot.root,
      path: ledgerPath,
    })
  ) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'assembleAmoeWitness: ledger Merkle path failed local verification (snapshot internal inconsistency)',
    )
  }

  // --- Step 7: pack the witness in the exact shape proveAmoeEntryPlonk expects.
  // The two `AMOE_MERKLE_DEPTH` references below are the same constant — we
  // import it from proveAmoeEntryPlonk to make the source-of-truth coupling
  // explicit, even though the value is also locally defined.
  if (allowlistPath.pathElements.length !== AMOE_MERKLE_DEPTH) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: internal — allowlist path length ${allowlistPath.pathElements.length} != ${AMOE_MERKLE_DEPTH}`,
    )
  }
  if (ledgerPath.pathElements.length !== AMOE_MERKLE_DEPTH) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `assembleAmoeWitness: internal — ledger path length ${ledgerPath.pathElements.length} != ${AMOE_MERKLE_DEPTH}`,
    )
  }

  const witness: AmoeEligibilityWitness = {
    // ---- Public ------------------------------------------------------
    walletAddrCommit,
    creatorCoinAddr: raw.creatorCoinAddr,
    nonceCommit,
    epoch: raw.epoch,
    allowlistRoot: trees.allowlistSnapshot.root,
    pointsBurnedAsUSD: raw.pointsBurnedAsUSD,
    pointsLedgerRoot: trees.pointsLedgerSnapshot.root,
    pointsBurnNullifier,
    // ---- Private (allowlist) ----------------------------------------
    // Canonicalized values flow into the witness so the circuit's
    // `nonceCommit === Poseidon3(nonce, wallet, creatorCoinAddr)`
    // assertion holds with the same `nonce` we hashed above.
    wallet: raw.wallet,
    nonce,
    twitterCreditNullifier,
    pathElements: allowlistPath.pathElements,
    pathIndices: allowlistPath.pathIndices,
    // ---- Private (points-burn) --------------------------------------
    signupIdHash,
    spendRefIdHash,
    pointsLedgerPathElements: ledgerPath.pathElements,
    pointsLedgerPathIndices: ledgerPath.pathIndices,
  }
  return witness
}

// ----------------------------------------------------------------------------
// Convenience: build empty (single-leaf) snapshots for tests / integration.
// ----------------------------------------------------------------------------

/**
 * Build a single-leaf snapshot — the wallet's allowlist leaf at index 0,
 * with the rest zero-padded. Useful for fixture parity tests where the
 * canonical input has all-zero `pathElements` (i.e. the only real leaf is
 * at position 0) and as a starting point for end-to-end integration
 * before the daily publisher is wired up.
 */
export function buildAmoeAllowlistSnapshotFromSingleWallet(
  wallet: bigint,
  epoch: bigint,
): AmoeMerkleSnapshot {
  const leaf = computeAmoeAllowlistLeaf(wallet, epoch)
  return buildAmoeMerkleSnapshot([leaf])
}

/**
 * Build a single-leaf points-burn ledger snapshot for the given burn row.
 * Mirrors the shape used by the canonical fixture (single leaf at index
 * 0). Production publishers will replace this with a multi-leaf builder
 * once the ledger source-of-truth design (#403 §2) is finalized.
 */
export function buildAmoeLedgerSnapshotFromSingleEntry(args: {
  signupIdHash: bigint
  spendRefIdHash: bigint
  pointsBurnedAsUSD: bigint
  epoch: bigint
  walletAddrCommit: bigint
}): AmoeMerkleSnapshot {
  const leaf = computeAmoeLedgerLeaf(
    args.signupIdHash,
    args.spendRefIdHash,
    args.pointsBurnedAsUSD,
    args.epoch,
    args.walletAddrCommit,
  )
  return buildAmoeMerkleSnapshot([leaf])
}

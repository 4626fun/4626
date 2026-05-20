// SPDX-License-Identifier: MIT
//
// AMOE ZK submit orchestration — the steps that turn a verified entry
// request into a `submitAmoeEntryZK` calldata blob, factored out of
// `_amoeSubmitZk.ts` so each piece is independently unit-testable.
//
// Flow recap (full handler view in
// `docs/security/amoe-pr3-handler-swap-plan.md` §4):
//
//   verify wallet sig → consume nonce → balance preflight →
//   derive nullifiers → assemble witness → prove → build calldata
//
// This module owns the last 4 steps. The handler owns auth, rate
// limiting, parsing, balance gate, relay, and the credit debit so it
// stays the single place that touches HTTP / Vercel surface.
//
// LOCKED INVARIANTS:
//   * `signupIdHash` is bound to `profiles.id` (bigint), resolved
//     upstream by `resolveAmoeWallet`. We never re-resolve here.
//   * `epoch` is `floor(now_seconds / AMOE_EPOCH_SECONDS)`. The genesis
//     anchor (PR 3 era) is `2026-04-30 00:00 UTC` per the locked plan;
//     the constant below is the per-day length. Together they pin the
//     same epoch the circuit uses (`amoe_eligibility.circom:157`).
//   * Snapshot state is sourced from `amoeLedgerSnapshotStub` until PR 5
//     wires the real publisher.

import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AMOE_PLONK_PUB_INPUT_SLOT,
  buildAmoeEntryZKCall,
  pointsToUsd1e6,
  type AmoeZKBuildResult,
} from './lotteryAmoe.js'
import {
  deriveSignupIdHash,
  deriveSpendRefIdHash,
  deriveTwitterCreditNullifier,
  readAmoeSignupSalt,
} from './amoeIdentifiers.js'
import { buildAmoeLedgerSnapshotStub } from './amoeLedgerSnapshotStub.js'
import type { AmoeLedgerSnapshotReader } from './amoeLedgerSnapshotReader.js'
import {
  AMOE_EPOCH_GENESIS_SECONDS,
  AMOE_EPOCH_LENGTH_SECONDS,
  assembleAmoeWitness,
  buildAmoeAllowlistSnapshotFromSingleWallet,
  computeAmoeWalletAddrCommit,
  type AmoeWitnessTreeContext,
} from './amoeWitness.js'
import {
  proveAmoeEntryPlonk,
  type AmoeProveResult,
  type SnarkjsLike,
} from './proveAmoeEntryPlonk.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from './lotteryAmoeErrors.js'

declare const process: { env: Record<string, string | undefined>; cwd(): string }

/**
 * Daily AMOE epoch length, in seconds. Pinned at 86400 — must match
 * `EPOCH_SECONDS` in `amoe/circuits/amoe_eligibility.circom:157`.
 *
 * **Single source of truth:** this is now a re-export of
 * {@link AMOE_EPOCH_LENGTH_SECONDS} from `amoeWitness.ts`. The two
 * names exist for historical reasons (this module predates the witness
 * module's promotion to canonical-constant owner in PR 5a) but they
 * MUST always equal the same bigint — a desync would mean the submit
 * handler computes a different epoch than the points-burn-ledger
 * publisher, leaving entries unprovable.
 *
 * Changing this is a breaking change to the circuit and requires
 * regenerating the zkey, the verifier, and every fixture. Do not
 * touch without an explicit zk-circuit change ticket.
 */
export const AMOE_EPOCH_SECONDS = AMOE_EPOCH_LENGTH_SECONDS

/**
 * Genesis anchor for the AMOE epoch counter — first UTC midnight after
 * PR #426 (witness construction) merged.
 *
 * **Single source of truth:** this is now a re-export of
 * {@link AMOE_EPOCH_GENESIS_SECONDS} from `amoeWitness.ts`. The two
 * names exist for historical reasons; a regression test in
 * `amoeSubmitZk.test.ts` pins `AMOE_EPOCH_GENESIS_UNIX_SEC ===
 * AMOE_EPOCH_GENESIS_SECONDS` so they cannot silently drift apart.
 *
 * Value: `2026-04-30T00:00:00Z` → `Date.UTC(2026, 3, 30) / 1000` =
 * 1_777_507_200.
 */
export const AMOE_EPOCH_GENESIS_UNIX_SEC = AMOE_EPOCH_GENESIS_SECONDS

/**
 * Compute the current AMOE epoch number for a given Unix-second
 * timestamp. Exposed as a named function so tests can pin specific
 * epochs without monkey-patching `Date.now`.
 *
 * @returns Non-negative bigint epoch counter. Returns 0 for any time
 *          before AMOE_EPOCH_GENESIS_UNIX_SEC (which would only occur
 *          in a misconfigured clock-skewed test environment).
 */
export function computeAmoeEpoch(nowSec: bigint): bigint {
  if (nowSec <= AMOE_EPOCH_GENESIS_UNIX_SEC) return 0n
  return (nowSec - AMOE_EPOCH_GENESIS_UNIX_SEC) / AMOE_EPOCH_SECONDS
}

/**
 * Inputs the orchestration helper needs from the handler. All
 * validation is the handler's responsibility — by the time we get
 * here, every value is well-formed.
 */
export interface AmoeSubmitZkOrchestrationInputs {
  /** Wallet entering the lottery. */
  wallet: `0x${string}`
  /** Creator coin the entry is for. */
  creatorCoin: `0x${string}`
  /** Points being burned (already validated to be in [MIN, MAX]). */
  pointsBurned: number
  /** The bytes32 nonce previously issued by `/api/v1/lottery/amoe/nonce`. */
  nonce: `0x${string}`
  /** Twitter handle (raw user-supplied; we normalise inside). */
  twitterHandle: string
  /**
   * Opaque external reference for the points-burn row (the
   * idempotency key used by the points ledger). Hash-bound into
   * `spendRefIdHash`.
   */
  spendRefId: string
  /**
   * `profiles.id` (Postgres bigint). Resolved upstream by
   * `resolveAmoeWallet`. Required — handlers MUST refuse to proceed
   * without a profile because the LOCKED binding is profile-id, not
   * wallet.
   */
  profileId: bigint | number
  /**
   * Address of the deployed `LotteryAmoeRouter` (env-driven; passed in
   * to keep this module pure).
   */
  lotteryAmoeRouter: `0x${string}`
}

/**
 * Snarkjs + zkey/wasm wiring the helper expects. Tests inject mocks;
 * production reads from disk via `defaultProveOptions()`.
 */
export interface AmoeSubmitZkProveOptions {
  wasmPath: string
  zkeyPath: string
  snarkjs?: SnarkjsLike
  /**
   * Optional override of `Date.now()` source — tests use this to pin
   * the epoch deterministically.
   */
  nowSec?: bigint
  /**
   * PR 5b: production injects an `AmoeLedgerSnapshotPgReader` here so
   * the orchestrator pulls the CONFIRMED L2 snapshot from
   * `amoe_points_burn_ledger_snapshots` instead of the single-leaf
   * stub. When omitted, falls back to the stub (gated by
   * AMOE_ZK_SNAPSHOT_STUB_ALLOW=1; production deployments must NOT
   * leave the reader unset).
   *
   * Note: the stub still owns the *allowlist* half until the allowlist
   * publisher PR ships. The reader injected here only replaces the
   * points-burn half; the allowlist single-leaf snapshot is built
   * inline from the requesting wallet.
   */
  ledgerSnapshotReader?: AmoeLedgerSnapshotReader
}

export interface AmoeSubmitZkOrchestrationResult {
  /** Built calldata + meta for relay. */
  call: AmoeZKBuildResult
  /** The PLONK proof + 8-element pubInputs (for downstream logging / replay store). */
  proof: AmoeProveResult
  /** The epoch the entry was bound to (for response payload + PR 4 replay store). */
  epoch: bigint
  /** USD-1e6 value the entry will burn (echo of pubInputs[5] for response payload). */
  pointsBurnedAsUSD: bigint
  /**
   * The twitter-credit nullifier (private input the orchestrator
   * derived from the user's twitter handle), exported so the handler
   * can persist it on the replay row at `markProven` time. The PR 5b
   * publisher reads this column when projecting the burn into the
   * points-burn ledger — without it, the L1 row cannot be bound to
   * the same wallet-addr commitment that the proof committed to.
   */
  twitterCreditNullifier: bigint
}

/**
 * Best-effort default for the prover wasm + zkey paths.
 *
 * Resolution order:
 *   1. `AMOE_ZK_WASM_PATH` / `AMOE_ZK_ZKEY_PATH` env vars (preferred for
 *      Vercel — set them at deploy time).
 *   2. Bundled assets under `amoe-zk-assets/` next to this module
 *      (included in Vercel via `includeFiles` on `api/[...path].ts`).
 *
 * PR 6 will swap the env-or-fallback strategy for an
 * `S3-presigned-URL` strategy at module-load. Until then, disk paths.
 */
const AMOE_ZK_ASSETS_DIR = resolvePath(
  dirname(fileURLToPath(import.meta.url)),
  'amoe-zk-assets',
)

export function defaultAmoeZkAssetPaths(): { wasmPath: string; zkeyPath: string } {
  const envWasm = String(process.env.AMOE_ZK_WASM_PATH ?? '').trim()
  const envZkey = String(process.env.AMOE_ZK_ZKEY_PATH ?? '').trim()

  const bundledWasm = resolvePath(AMOE_ZK_ASSETS_DIR, 'amoe_eligibility.wasm')
  const bundledZkey = resolvePath(AMOE_ZK_ASSETS_DIR, 'amoe_plonk_final.zkey')

  return {
    wasmPath: envWasm.length > 0 ? envWasm : bundledWasm,
    zkeyPath: envZkey.length > 0 ? envZkey : bundledZkey,
  }
}

/**
 * Run the AMOE ZK orchestration: derive identifiers, assemble witness,
 * prove, build calldata. Pure function modulo `Date.now()` (overridable
 * via `proveOpts.nowSec`).
 *
 * @throws AmoeServerError on misconfig (missing salt, snapshot stub
 *         not allowed in this env)
 * @throws AmoeBadRequestError on caller-fault validation that survived
 *         the handler (defense-in-depth)
 * @throws AmoeProofGenerationError on prover crash / witness mismatch
 */
/**
 * Internal: resolve `AmoeWitnessTreeContext` from either the real PG
 * reader (PR 5b production) or the single-leaf stub (PR 3 dev/staging).
 */
async function resolveAmoeWitnessTrees(args: {
  reader: AmoeLedgerSnapshotReader | undefined
  walletBigint: bigint
  epoch: bigint
  signupIdHash: bigint
  spendRefIdHash: bigint
  twitterCreditNullifier: bigint
  pointsBurnedAsUSD: bigint
  spendRefId: string
  profileId: bigint
}): Promise<AmoeWitnessTreeContext> {
  if (args.reader) {
    // Production path: real points-burn ledger snapshot from L2.
    const readResult = await args.reader.readSnapshotForBurn({
      signupId: args.profileId,
      spendRefId: args.spendRefId,
    })
    if (readResult.epoch !== args.epoch) {
      // Defensive: the reader returned a snapshot for a different
      // epoch than the one we're submitting against. This would only
      // happen if a burn was projected into the wrong epoch (publisher
      // bug), or if the request raced an epoch rollover. Either way,
      // refuse rather than build a witness against the wrong root.
      throw new AmoeServerError('amoe_ledger_snapshot_epoch_mismatch')
    }
    // Allowlist remains the single-leaf inline build until the
    // allowlist publisher PR ships. This is identical to what the stub
    // would produce; we just don't gate it on AMOE_ZK_SNAPSHOT_STUB_ALLOW
    // because the points-burn half is already production-grade.
    const allowlistSnapshot = buildAmoeAllowlistSnapshotFromSingleWallet(
      args.walletBigint,
      args.epoch,
    )
    return {
      allowlistSnapshot,
      allowlistLeafIndex: 0,
      pointsLedgerSnapshot: readResult.pointsLedgerSnapshot,
      pointsLedgerLeafIndex: readResult.pointsLedgerLeafIndex,
    }
  }
  // Dev/staging path: single-leaf stub for both halves. Gated by
  // AMOE_ZK_SNAPSHOT_STUB_ALLOW=1.
  // Reference computeAmoeWalletAddrCommit so the import stays live in
  // builds that don't take the reader-injected path.
  void computeAmoeWalletAddrCommit
  return buildAmoeLedgerSnapshotStub({
    walletBigint: args.walletBigint,
    epoch: args.epoch,
    signupIdHash: args.signupIdHash,
    spendRefIdHash: args.spendRefIdHash,
    twitterCreditNullifier: args.twitterCreditNullifier,
    pointsBurnedAsUSD: args.pointsBurnedAsUSD,
  })
}

export async function orchestrateAmoeSubmitZk(
  inputs: AmoeSubmitZkOrchestrationInputs,
  proveOpts: AmoeSubmitZkProveOptions,
): Promise<AmoeSubmitZkOrchestrationResult> {
  // ------------------------------------------------------------------
  // Step 1: epoch
  // ------------------------------------------------------------------
  const nowSec = proveOpts.nowSec ?? BigInt(Math.floor(Date.now() / 1000))
  const epoch = computeAmoeEpoch(nowSec)
  if (epoch === 0n) {
    // Handlers should reject before this point in production; surface
    // here as a server error so a clock-skewed sandbox doesn't issue
    // an entry under epoch 0 (which is also a magic value in the circuit).
    throw new AmoeServerError('amoe_epoch_pre_genesis')
  }

  // ------------------------------------------------------------------
  // Step 2: derive private identifiers
  // ------------------------------------------------------------------
  const salt = readAmoeSignupSalt()
  const twitterCreditNullifier = deriveTwitterCreditNullifier({
    twitterHandle: inputs.twitterHandle,
    salt,
  })
  const signupIdHash = deriveSignupIdHash({
    profileId: inputs.profileId,
    salt,
  })
  const spendRefIdHash = deriveSpendRefIdHash({
    spendRefId: inputs.spendRefId,
    salt,
  })

  // ------------------------------------------------------------------
  // Step 3: bigint coercions for circuit-domain inputs
  // ------------------------------------------------------------------
  const walletBigint = BigInt(inputs.wallet)
  const creatorCoinBigint = BigInt(inputs.creatorCoin)
  const nonceBigint = BigInt(inputs.nonce)
  const pointsBurnedAsUSD = pointsToUsd1e6(inputs.pointsBurned)

  // ------------------------------------------------------------------
  // Step 4: snapshot resolution
  // ------------------------------------------------------------------
  // PR 5b production path: when a real `AmoeLedgerSnapshotPgReader` is
  // injected, pull the CONFIRMED L2 snapshot for the requesting burn.
  // The reader throws `amoe_ledger_snapshot_unavailable` (mapped by the
  // handler to a retryable 503) when:
  //   * the burn has not yet been projected to L1, or
  //   * the L2 snapshot for that burn's epoch has not yet been
  //     confirmed on-chain.
  //
  // The allowlist half is still the single-leaf stub until the
  // allowlist publisher PR ships; we build it inline here so we don't
  // depend on the AMOE_ZK_SNAPSHOT_STUB_ALLOW gate when a real points-
  // ledger reader is in use.
  const trees: AmoeWitnessTreeContext = await resolveAmoeWitnessTrees({
    reader: proveOpts.ledgerSnapshotReader,
    walletBigint,
    epoch,
    signupIdHash,
    spendRefIdHash,
    twitterCreditNullifier,
    pointsBurnedAsUSD,
    spendRefId: inputs.spendRefId,
    profileId:
      typeof inputs.profileId === 'bigint'
        ? inputs.profileId
        : BigInt(Math.trunc(Number(inputs.profileId))),
  })

  // ------------------------------------------------------------------
  // Step 5: assemble witness
  // ------------------------------------------------------------------
  const witness = assembleAmoeWitness({
    raw: {
      wallet: walletBigint,
      nonce: nonceBigint,
      twitterCreditNullifier,
      creatorCoinAddr: creatorCoinBigint,
      epoch,
      signupIdHash,
      spendRefIdHash,
      pointsBurnedAsUSD,
    },
    trees,
  })

  // ------------------------------------------------------------------
  // Step 6: prove (PLONK)
  // ------------------------------------------------------------------
  const proof = await proveAmoeEntryPlonk(witness, {
    wasmPath: proveOpts.wasmPath,
    zkeyPath: proveOpts.zkeyPath,
    snarkjs: proveOpts.snarkjs,
  })

  // Defense-in-depth: confirm the prover handed back a value bound to
  // the same `pointsBurnedAsUSD` we committed to. If a buggy/mocked
  // prover returns a stale fixture we want to fail HERE (server error)
  // rather than build calldata that the on-chain router would revert.
  const provenUsd = proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnedAsUSD]
  if (provenUsd !== pointsBurnedAsUSD) {
    throw new AmoeServerError('amoe_zk_prover_pub_inputs_drift')
  }

  // ------------------------------------------------------------------
  // Step 7: build calldata
  // ------------------------------------------------------------------
  const call = await buildAmoeEntryZKCall({
    wallet: inputs.wallet,
    creatorCoin: inputs.creatorCoin,
    epoch,
    proof: proof.proof,
    pubInputs: proof.pubInputs,
    lotteryAmoeRouter: inputs.lotteryAmoeRouter,
  })

  return {
    call,
    proof,
    epoch,
    pointsBurnedAsUSD,
    twitterCreditNullifier,
  }
}

/**
 * Read + validate the deployed `LotteryAmoeRouter` address from env.
 * Separate from `getApiContracts` so we don't have to widen the typed
 * contracts surface in PR 3 — PR 5 (publisher) will fold this into
 * `ApiContracts` properly.
 */
export function readLotteryAmoeRouterAddress(): `0x${string}` | null {
  const raw = String(process.env.LOTTERY_AMOE_ROUTER ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase() as `0x${string}`
}

/**
 * Read the `AMOE_ZK_SUBMIT_ENABLED` feature flag. Defaults to `false`.
 */
export function isAmoeZkSubmitEnabled(): boolean {
  return String(process.env.AMOE_ZK_SUBMIT_ENABLED ?? '').trim() === '1'
}

/**
 * Defense-in-depth: re-validate that the orchestration inputs the
 * handler is about to pass us are well-formed. The handler already
 * validates these, but the cost is one regex per field so we accept
 * the duplication for the layered-checks property.
 */
export function assertOrchestrationInputsShape(
  inputs: AmoeSubmitZkOrchestrationInputs,
): void {
  const ADDR = /^0x[a-fA-F0-9]{40}$/
  const B32 = /^0x[a-fA-F0-9]{64}$/
  if (!ADDR.test(inputs.wallet)) {
    throw new AmoeBadRequestError('zk_invalid_wallet')
  }
  if (!ADDR.test(inputs.creatorCoin)) {
    throw new AmoeBadRequestError('zk_invalid_creator_coin')
  }
  if (!ADDR.test(inputs.lotteryAmoeRouter)) {
    throw new AmoeBadRequestError('zk_invalid_router_address')
  }
  if (!B32.test(inputs.nonce)) {
    throw new AmoeBadRequestError('invalid_nonce')
  }
  if (typeof inputs.twitterHandle !== 'string' || inputs.twitterHandle.trim().length === 0) {
    throw new AmoeBadRequestError('amoe_twitter_handle_empty')
  }
  if (typeof inputs.spendRefId !== 'string' || inputs.spendRefId.trim().length === 0) {
    throw new AmoeBadRequestError('amoe_spend_ref_empty')
  }
  const pid =
    typeof inputs.profileId === 'bigint'
      ? inputs.profileId
      : BigInt(Math.trunc(Number(inputs.profileId)))
  if (pid <= 0n) {
    throw new AmoeBadRequestError('amoe_signup_id_invalid')
  }
}

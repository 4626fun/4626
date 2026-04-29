// SPDX-License-Identifier: MIT
//
// AMOE ledger snapshot stub — a single-leaf in-memory snapshot that
// makes the PR 3 handler end-to-end runnable BEFORE the real ledger
// publisher (PR 5) lands.
//
// The contract this stub satisfies is exactly what `assembleAmoeWitness`
// requires:
//
//   {
//     allowlistSnapshot:    AmoeMerkleSnapshot,
//     allowlistLeafIndex:   number,
//     pointsLedgerSnapshot: AmoeMerkleSnapshot,
//     pointsLedgerLeafIndex:number,
//   }
//
// PR 5 replaces this module wholesale with a database-backed reader
// that pulls (a) the published allowlist root + the wallet's path from
// the publisher table, and (b) the points-burn ledger row + path from
// the projection table. Until then, this stub:
//
//   * Builds a single-leaf allowlist tree containing only the entering
//     wallet — every other index is the zero-hash. The on-chain
//     allowlist root will diverge from this once real publishing
//     starts; that's fine because PR 3 ships behind
//     AMOE_ZK_SUBMIT_ENABLED=false and is not yet used in production.
//
//   * Builds a single-leaf points-burn ledger tree containing only
//     the burn row currently being submitted. Same caveat.
//
// This intentionally trades production-quality state for end-to-end
// runnability in tests + staging. Anyone deploying with this stub in
// the prod path is misconfigured — the handler MUST refuse to run in
// production until the stub is replaced. We surface that contract by
// requiring a feature flag (`AMOE_ZK_SNAPSHOT_STUB_ALLOW=1`) before the
// stub will return a snapshot. Forgetting to set it triggers a 503 in
// any environment that wires this stub up — the whole point is that
// it's loud, not silent.
//
// See:
//   * docs/security/amoe-pr3-handler-swap-plan.md \u00a75 (file list)
//   * docs/security/amoe-points-burn-ledger-sot.md (real ledger design)

import {
  buildAmoeAllowlistSnapshotFromSingleWallet,
  buildAmoeLedgerSnapshotFromSingleEntry,
  computeAmoeWalletAddrCommit,
  type AmoeWitnessTreeContext,
} from './amoeWitness.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

/**
 * Inputs needed to materialize a single-leaf snapshot pair for the
 * requesting entry.
 */
export interface AmoeLedgerSnapshotStubInputs {
  /** EVM wallet address as bigint (uint160). */
  walletBigint: bigint
  /** Daily epoch counter (≤ 2^64 - 1). */
  epoch: bigint
  /** Pre-canonicalized `signupIdHash`. */
  signupIdHash: bigint
  /** Pre-canonicalized `spendRefIdHash`. */
  spendRefIdHash: bigint
  /** Pre-canonicalized `twitterCreditNullifier`. */
  twitterCreditNullifier: bigint
  /** Points burned in USD-1e6 units. */
  pointsBurnedAsUSD: bigint
}

/**
 * Read the snapshot-stub allowlist flag.
 *
 * Returns `true` iff `AMOE_ZK_SNAPSHOT_STUB_ALLOW === '1'`. Anything
 * else (including unset) returns `false`. Production deployments MUST
 * leave this unset.
 */
export function isAmoeLedgerSnapshotStubAllowed(): boolean {
  return String(process.env.AMOE_ZK_SNAPSHOT_STUB_ALLOW ?? '').trim() === '1'
}

/**
 * Build a single-leaf snapshot pair for the requesting entry.
 *
 * Throws `AmoeServerError('amoe_ledger_snapshot_stub_not_allowed')` if
 * the stub flag is not explicitly enabled. That maps to a 5xx and
 * makes any deployment that forgets to wire up the real publisher
 * fail loudly.
 *
 * @returns A `{trees}` object suitable as `args.trees` for
 *          `assembleAmoeWitness`. Both `*LeafIndex` values are 0 because
 *          the stub puts the only real leaf at position 0.
 */
export function buildAmoeLedgerSnapshotStub(
  inputs: AmoeLedgerSnapshotStubInputs,
): AmoeWitnessTreeContext {
  if (!isAmoeLedgerSnapshotStubAllowed()) {
    throw new AmoeServerError('amoe_ledger_snapshot_stub_not_allowed')
  }

  const allowlistSnapshot = buildAmoeAllowlistSnapshotFromSingleWallet(
    inputs.walletBigint,
    inputs.epoch,
  )

  const walletAddrCommit = computeAmoeWalletAddrCommit(
    inputs.walletBigint,
    inputs.twitterCreditNullifier,
  )

  const pointsLedgerSnapshot = buildAmoeLedgerSnapshotFromSingleEntry({
    signupIdHash: inputs.signupIdHash,
    spendRefIdHash: inputs.spendRefIdHash,
    pointsBurnedAsUSD: inputs.pointsBurnedAsUSD,
    epoch: inputs.epoch,
    walletAddrCommit,
  })

  return {
    allowlistSnapshot,
    allowlistLeafIndex: 0,
    pointsLedgerSnapshot,
    pointsLedgerLeafIndex: 0,
  }
}

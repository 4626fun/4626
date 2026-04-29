// SPDX-License-Identifier: MIT
//
// AMOE nonce store — public, typed-error wrapper around the
// `lottery_amoe_nonces` table consumed at submit time.
//
// Why a separate module:
//   * The legacy `_amoeSubmit` handler consumes the nonce inside
//     `verifyAmoeEntryProof`, which is wedded to the legacy
//     ECDSA-attestation flow (parses the EIP-191 message, etc.). The
//     ZK submit handler still needs nonce uniqueness + row-locked
//     consumption, but doesn't need the EIP-191 parse.
//   * Pulling the consumption out into its own module lets PR 4
//     (replay store) extend it without touching the legacy handler.
//   * The function below uses `AmoeBadRequestError` for client-visible
//     failures (consumed/expired/wrong-creator) so the handler's
//     error-classification code maps them to 400/409 instead of 500.
//
// LOCKING SEMANTICS:
//   The Postgres path uses a single conditional UPDATE that succeeds
//   iff the row is currently:
//     * present
//     * matching wallet
//     * matching creatorCoin
//     * not yet consumed
//     * not yet expired
//   ...and atomically marks it consumed. Concurrent submitters with
//   the same nonce see exactly one UPDATE return a row; the others
//   see zero rows and throw `nonce_already_used`. No SELECT...FOR
//   UPDATE is needed because the UPDATE itself is the lock.

import { getDb } from '../db/postgres.js'
import { AmoeBadRequestError, AmoeServerError } from './lotteryAmoeErrors.js'

/**
 * Bytes32 hex predicate (lowercase or mixed case).
 */
function isBytes32Hex(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/**
 * Address predicate (lowercase or mixed case).
 */
function isAddressHex(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

/**
 * Consume a previously-issued AMOE nonce and atomically mark it used.
 *
 * @throws {AmoeBadRequestError} `'invalid_nonce'`           — nonce is not a
 *                                                              bytes32 hex
 * @throws {AmoeBadRequestError} `'nonce_already_used'`      — already consumed,
 *                                                              expired, or never issued
 *                                                              for this (wallet, creator) pair
 * @throws {AmoeServerError}     `'amoe_db_unavailable'`     — Postgres handle missing
 *                                                              (we deliberately do NOT fall
 *                                                              back to in-memory storage in
 *                                                              the ZK path; production must
 *                                                              have the DB)
 */
export async function consumeAmoeNonceForSubmit(params: {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
}): Promise<void> {
  if (!isBytes32Hex(params.nonce)) {
    throw new AmoeBadRequestError('invalid_nonce')
  }
  if (!isAddressHex(params.wallet) || !isAddressHex(params.creatorCoin)) {
    throw new AmoeBadRequestError('invalid_nonce')
  }

  const db = await getDb()
  if (!db) {
    // The legacy `consumeAmoeNonce` falls back to an in-memory map when
    // there's no DB. That fallback is fine in the legacy path (which
    // tolerates light test environments) but we MUST NOT replicate it
    // here: the ZK submit handler is intended to ship into production
    // where DB-less mode is a misconfiguration, and a silent in-memory
    // bypass would let the same nonce be reused across cold starts.
    throw new AmoeServerError('amoe_db_unavailable')
  }

  const wallet = params.wallet.toLowerCase()
  const creatorCoin = params.creatorCoin.toLowerCase()

  // Single conditional UPDATE — see "Locking semantics" in the file
  // header. Returns the consumed nonce on success, no rows on failure.
  const updated = await db.sql`
    UPDATE lottery_amoe_nonces
    SET consumed_at = NOW()
    WHERE nonce = ${params.nonce}
      AND wallet_address = ${wallet}
      AND creator_coin = ${creatorCoin}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING nonce;
  `
  if (!updated.rows?.[0]?.nonce) {
    // We deliberately collapse the four failure modes (not-found, wrong
    // wallet, wrong creator, already-consumed-or-expired) into one
    // public error code so a malicious caller can't probe the table by
    // brute-forcing nonces and watching for differential responses. The
    // server logs already include the (wallet, creator, nonce) tuple.
    throw new AmoeBadRequestError('nonce_already_used')
  }
}

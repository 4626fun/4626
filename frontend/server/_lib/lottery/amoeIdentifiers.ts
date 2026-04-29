// SPDX-License-Identifier: MIT
//
// AMOE identifier derivation — single source of truth for the three
// bytes32-domain values that flow into the PLONK witness as private
// inputs and out as public commits/nullifiers:
//
//   * `twitterCreditNullifier` := canonicalize(keccak256(twitterHandle ‖ AMOE_SIGNUP_SALT))
//   * `signupIdHash`           := canonicalize(keccak256(bigintToBe32Bytes(profiles.id) ‖ AMOE_SIGNUP_SALT))
//   * `spendRefIdHash`         := canonicalize(keccak256(spendRefId ‖ AMOE_SIGNUP_SALT))
//
// Where `canonicalize` is `canonicalizeAmoeBytes32ToField` from
// `amoeWitness.ts` (mod-Q reduction). The witness module also applies
// canonicalization itself; we pre-canonicalize here so the value the
// orchestration layer hands to `assembleAmoeWitness` is already a
// circuit-domain field element, which makes server-side cross-checks
// (e.g. "does this signupIdHash match the published ledger projection?")
// unambiguous.
//
// LOCKED DECISIONS (see docs/security/amoe-pr3-handler-swap-plan.md §8.1
// and docs/security/amoe-points-burn-ledger-sot.md §2):
//
//   * `signupIdHash` is bound to `profiles.id` (Postgres bigint), NOT
//     the wallet address and NOT `privy_user_id`. `profiles.id` is the
//     canonical durable identity that survives wallet rotation AND
//     Privy account merges (via the `merged_into_profile_id` tombstone
//     chain).
//
//   * `AMOE_SIGNUP_SALT` is a per-environment 32-byte cryptographic
//     secret. Salt rotation is **NOT supported** — see
//     `docs/operations/deployment/amoe-signup-salt-provisioning.md`.
//     Changing the salt invalidates every prior nullifier and would
//     allow one human to submit twice.
//
//   * The salt is REQUIRED — handlers MUST refuse to proceed if it is
//     missing or malformed. Failing open would emit nullifiers from a
//     zero-length salt, which is rainbow-table-trivial against the
//     known `profiles.id` distribution.

import { keccak256 } from 'viem'

import {
  AMOE_BYTES32_DOMAIN_MAX,
  canonicalizeAmoeBytes32ToField,
} from './amoeWitness.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

/**
 * keccak256 of a byte buffer, returned as a 32-byte Uint8Array.
 *
 * `viem.keccak256` returns a `0x`-hex string by default; we wrap it so
 * downstream code can stay in raw-bytes land until the final
 * bigint-conversion step. Intermediate hex round-trips would obscure
 * the byte-level reasoning in `bigintToBe32Bytes`.
 */
function keccak32(buf: Uint8Array): Uint8Array {
  // viem accepts a Uint8Array and returns 0x-prefixed 32-byte hex.
  const hex = keccak256(buf)
  // Strip 0x and decode 64 hex chars → 32 bytes.
  if (typeof hex !== 'string' || !hex.startsWith('0x') || hex.length !== 66) {
    throw new AmoeServerError('amoe_identifier_hash_unexpected_format')
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i += 1) {
    out[i] = parseInt(hex.slice(2 + i * 2, 2 + i * 2 + 2), 16)
  }
  return out
}

/**
 * Length, in bytes, of the AMOE signup salt. Pinned to 32 — matches the
 * keccak256 block size and the runbook in
 * `docs/operations/deployment/amoe-signup-salt-provisioning.md`.
 */
export const AMOE_SIGNUP_SALT_LENGTH_BYTES = 32 as const

/**
 * Read + validate `AMOE_SIGNUP_SALT` from the environment. The salt is a
 * lower- or upper-case hex string of exactly 64 hex chars (32 bytes),
 * with or without a leading `0x`. Malformed or missing salt throws
 * `AmoeServerError('amoe_signup_salt_misconfigured')` — handlers should
 * map that to a 5xx (NOT 4xx) so a misconfigured deployment doesn't
 * silently serve insecure nullifiers.
 *
 * Why an env var (and not Vercel KV / Supabase secret): the salt must
 * be available synchronously at module load to keep the hot path free
 * of network reads, and it must NEVER be readable from the database
 * (otherwise a SQL injection that leaks `signupIdHash` rows could be
 * combined with a salt leak to deanonymize the ledger). Vercel
 * encrypted env is the right primitive.
 */
export function readAmoeSignupSalt(): Uint8Array {
  const raw = String(process.env.AMOE_SIGNUP_SALT ?? '').trim()
  if (raw.length === 0) {
    throw new AmoeServerError('amoe_signup_salt_misconfigured')
  }
  const hex = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw
  if (hex.length !== AMOE_SIGNUP_SALT_LENGTH_BYTES * 2) {
    throw new AmoeServerError('amoe_signup_salt_misconfigured')
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new AmoeServerError('amoe_signup_salt_misconfigured')
  }
  const out = new Uint8Array(AMOE_SIGNUP_SALT_LENGTH_BYTES)
  for (let i = 0; i < AMOE_SIGNUP_SALT_LENGTH_BYTES; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * Encode a non-negative bigint as a 32-byte big-endian buffer.
 *
 * Why big-endian + zero-pad: matches Solidity's `abi.encodePacked(uint256)`
 * representation, so any future on-chain re-derivation (e.g. a verifier
 * that wants to recompute `signupIdHash` from a public `profiles.id`)
 * lines up byte-for-byte without an off-chain conversion shim.
 *
 * @throws AmoeServerError if `value` is negative or exceeds 2^256 - 1.
 */
export function bigintToBe32Bytes(value: bigint): Uint8Array {
  if (typeof value !== 'bigint') {
    throw new AmoeServerError('amoe_identifier_input_invalid_type')
  }
  if (value < 0n) {
    throw new AmoeServerError('amoe_identifier_input_negative')
  }
  if (value > AMOE_BYTES32_DOMAIN_MAX) {
    throw new AmoeServerError('amoe_identifier_input_overflow')
  }
  const out = new Uint8Array(32)
  let v = value
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

/**
 * Encode a UTF-8 string as bytes. Trims surrounding whitespace but
 * preserves internal characters exactly so e.g. `'wenakita'` and
 * `'Wenakita'` produce different nullifiers (intentional — Twitter
 * handles are case-sensitive in their canonical lowercase form, see
 * normalisation note below).
 */
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/**
 * Concatenate buffers into a single Uint8Array.
 */
function concatBytes(...parts: ReadonlyArray<Uint8Array>): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/**
 * Convert a 32-byte buffer to a non-negative bigint (big-endian).
 */
function be32BytesToBigint(buf: Uint8Array): bigint {
  if (buf.length !== 32) {
    throw new AmoeServerError('amoe_identifier_hash_unexpected_length')
  }
  let v = 0n
  for (let i = 0; i < 32; i += 1) {
    v = (v << 8n) | BigInt(buf[i] ?? 0)
  }
  return v
}

// ----------------------------------------------------------------------------
// Public derivations
// ----------------------------------------------------------------------------

/**
 * Normalise a Twitter handle for nullifier derivation: trim, strip a
 * leading `@`, lowercase. Same handle entered as `@Wenakita` and
 * `wenakita` MUST produce the same nullifier so the daily-checkin
 * ledger can dedupe; this function is the single source of truth.
 */
export function normaliseTwitterHandle(handle: string): string {
  let h = String(handle ?? '').trim()
  if (h.startsWith('@')) h = h.slice(1)
  return h.toLowerCase()
}

/**
 * Derive the `twitterCreditNullifier` private input.
 *
 *   keccak256(utf8(normaliseTwitterHandle(handle)) ‖ salt) → bigint, then mod Q
 *
 * Domain: bytes32 (we canonicalize). The witness module re-applies
 * canonicalization defensively — passing an already-canonical value is
 * idempotent.
 */
export function deriveTwitterCreditNullifier(args: {
  twitterHandle: string
  salt: Uint8Array
}): bigint {
  const handle = normaliseTwitterHandle(args.twitterHandle)
  if (handle.length === 0) {
    throw new AmoeServerError('amoe_twitter_handle_empty')
  }
  const digest = keccak32(concatBytes(utf8(handle), args.salt))
  return canonicalizeAmoeBytes32ToField(
    'twitterCreditNullifier',
    be32BytesToBigint(digest),
  )
}

/**
 * Derive the `signupIdHash` private input.
 *
 *   keccak256(bigintToBe32Bytes(profileId) ‖ salt) → bigint, then mod Q
 *
 * `profileId` is the Postgres bigint primary key from `profiles.id`,
 * resolved upstream by `resolveAmoeWallet` (which already follows the
 * `merged_into_profile_id` tombstone chain).
 */
export function deriveSignupIdHash(args: {
  profileId: bigint | number
  salt: Uint8Array
}): bigint {
  const pid =
    typeof args.profileId === 'bigint'
      ? args.profileId
      : BigInt(Math.trunc(args.profileId))
  if (pid <= 0n) {
    throw new AmoeServerError('amoe_signup_id_invalid')
  }
  const digest = keccak32(concatBytes(bigintToBe32Bytes(pid), args.salt))
  return canonicalizeAmoeBytes32ToField('signupIdHash', be32BytesToBigint(digest))
}

/**
 * Derive the `spendRefIdHash` private input.
 *
 *   keccak256(utf8(spendRefId) ‖ salt) → bigint, then mod Q
 *
 * `spendRefId` is the opaque external reference for the points-burn
 * row (UUID, idempotency key, etc.). Unlike `signupIdHash`, this value
 * is never re-derived in a different context — its only consumer is
 * the ledger projection that stores `spendRefIdHash` directly. So
 * format flexibility (UUID, hex, opaque token) is fine here.
 */
export function deriveSpendRefIdHash(args: {
  spendRefId: string
  salt: Uint8Array
}): bigint {
  const ref = String(args.spendRefId ?? '').trim()
  if (ref.length === 0) {
    throw new AmoeServerError('amoe_spend_ref_empty')
  }
  const digest = keccak32(concatBytes(utf8(ref), args.salt))
  return canonicalizeAmoeBytes32ToField('spendRefIdHash', be32BytesToBigint(digest))
}

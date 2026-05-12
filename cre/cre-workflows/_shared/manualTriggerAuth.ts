// Shared HMAC + replay-protected auth gate for CRE workflow HTTP triggers.
//
// History
// -------
// 4626-300 / SEV-001 / SEV-010 (audit 2026-04-22). The workflows at
//   cre/cre-workflows/charm-rebalance-manager/main.ts
// expose an `HTTPCapability` trigger that can enqueue rebalance actions.
// The audit finding was that the
// fix existed in docs but not in code; the initial fix shipped in PR #318
// (commit 847fee0) inside each workflow's `onHttpTrigger`.
//
// H-01 (audit 2026-04-25). The shipped fix was a plain string-equality compare
// against `CRE_RUNTIME_WEBHOOK_HMAC_SECRET`, despite the secret name, secrets
// manifest, and documentation advertising HMAC discipline. The server-side
// counterpart in `frontend/server/_lib/cre/runtimeBridge.ts` has always used
// HMAC-SHA256 + timestamp + nonce + constant-time compare; the workflow side
// is now upgraded to mirror that contract exactly.
//
// Wire format
// -----------
// Callers MUST POST a payload of shape:
//   {
//     "authToken": "<hex hmac-sha256(secret, `${timestamp}.${nonce}.${bodyCanonical}`)>",
//     "timestamp": <epoch milliseconds, integer>,
//     "nonce":     "<unique per request, 16+ bytes hex>",
//     ...workflow-specific fields
//   }
// where `bodyCanonical` is `stableJsonStringify(payloadWithoutAuthFields)` —
// the original payload with `authToken`, `timestamp`, and `nonce` removed and
// every nested object key sorted recursively. This mirrors the canonicalization
// used by `runtimeBridge.authenticateRuntimeRequest` so the server-side and
// workflow-side cryptographic contracts cannot drift.
//
// Backwards compatibility
// -----------------------
// Workflows that call the legacy 2-argument form
// `assertManualTriggerAuthorized(token, secret)` still work and continue to
// behave as a plain string-equality compare; that path is now explicitly
// labelled as a legacy fallback and emits no HMAC guarantee. New / migrated
// callers MUST use `assertManualTriggerHmac(payloadWithAuthFields, secret)`,
// which performs:
//   1. shape validation of `authToken` / `timestamp` / `nonce`,
//   2. timestamp-skew rejection (±5 minutes by default),
//   3. canonicalization of the body excluding the auth fields,
//   4. HMAC-SHA256 recomputation and constant-time compare.
//
// Replay protection
// -----------------
// The workflow runtime cannot share a process-local nonce store across CRE
// nodes; replay defense relies on (a) the timestamp window narrowing the
// replay surface to ≤5 minutes, and (b) the downstream server-side replay
// nonce store (`cre_runtime_replay_nonces`) catching duplicate submissions
// when the workflow forwards them. The server-side store is the system of
// record for cross-instance / cold-start replay protection (M-18 / 4626-327).

import { hmac } from "@noble/hashes/hmac"
import { sha256 } from "@noble/hashes/sha2"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { stableJsonStringify } from "./determinism"

export const UNAUTHORIZED_MANUAL_TRIGGER = "unauthorized_manual_trigger"

export type AuthTokenCarrier = { authToken?: string }

export type HmacAuthEnvelope = {
  authToken?: string
  timestamp?: number | string
  nonce?: string
}

export type AssertManualTriggerHmacOptions = {
  /** Maximum acceptable absolute clock skew, in milliseconds. Defaults to ±5 minutes. */
  allowedSkewMs?: number
  /**
   * Override `Date.now()` for deterministic unit tests. Production callers MUST NOT
   * supply this — workflows have no deterministic clock except via the SDK runtime.
   */
  nowMs?: () => number
  /** Minimum nonce length (hex chars). Defaults to 16 (8 bytes). */
  minNonceLength?: number
}

const DEFAULT_ALLOWED_SKEW_MS = 5 * 60 * 1000
const DEFAULT_MIN_NONCE_LENGTH = 16

/**
 * Legacy plain-token gate. Equivalent to the pre-H-01 behavior; kept so that
 * call sites that have not yet migrated continue to compile and function.
 *
 * IMPORTANT: This compare is variable-time and offers no replay protection.
 * Migrate to `assertManualTriggerHmac` for any workflow whose HTTP trigger is
 * reachable from outside the trusted runtime.
 */
export function assertManualTriggerAuthorized(
  providedToken: string | undefined,
  configuredSecret: string,
): void {
  if (!providedToken || providedToken !== configuredSecret) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function coerceTimestampMs(raw: unknown): number | null {
  if (isFiniteNumber(raw)) return Math.trunc(raw)
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

/**
 * Constant-time string equality compare. Used for force-enqueue token compare
 * where the token is a shared secret (not necessarily hex-encoded). The
 * length check is intentionally non-constant-time because the configured
 * secret length is fixed and not derivable from a single mismatch.
 */
export function constantTimeEqualString(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false
  if (left.length !== right.length) return false
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i]! ^ rightBytes[i]!
  }
  return diff === 0
}

function constantTimeEqualHex(left: string, right: string): boolean {
  // Length check is intentionally non-constant-time; we then do a constant-time
  // compare of the byte arrays. An attacker that observes a length-mismatch
  // rejection learns nothing about the secret because the nonce/timestamp are
  // attacker-controlled and the HMAC output is fixed-length (32 bytes hex).
  if (left.length !== right.length) return false
  let leftBytes: Uint8Array
  let rightBytes: Uint8Array
  try {
    leftBytes = hexToBytes(left)
    rightBytes = hexToBytes(right)
  } catch {
    return false
  }
  if (leftBytes.length !== rightBytes.length) return false
  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i]! ^ rightBytes[i]!
  }
  return diff === 0
}

function stripAuthFields(payload: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = {}
  for (const key of Object.keys(payload)) {
    if (key === "authToken" || key === "timestamp" || key === "nonce") continue
    clone[key] = payload[key]
  }
  return clone
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * Verifies an HMAC-signed manual-trigger envelope. Throws
 * `Error('unauthorized_manual_trigger')` on any failure (missing field, bad
 * shape, stale timestamp, signature mismatch). Mirrors the contract of
 * `frontend/server/_lib/cre/runtimeBridge.ts:authenticateRuntimeRequest`.
 *
 * Canonicalization: the signing payload is `${timestamp}.${nonce}.${body}`
 * where `body` is the stable-JSON-stringified payload with `authToken`,
 * `timestamp`, and `nonce` removed (recursive key-sort).
 */
export function assertManualTriggerHmac(
  payload: unknown,
  configuredSecret: string,
  options: AssertManualTriggerHmacOptions = {},
): void {
  if (!configuredSecret || configuredSecret.length === 0) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }
  if (!isRecord(payload)) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }
  const envelope = payload as HmacAuthEnvelope
  const providedToken = typeof envelope.authToken === "string" ? envelope.authToken.trim() : ""
  if (providedToken.length === 0) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }

  const timestampMs = coerceTimestampMs(envelope.timestamp)
  if (timestampMs === null) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }

  const nonce = typeof envelope.nonce === "string" ? envelope.nonce.trim() : ""
  const minNonce = options.minNonceLength ?? DEFAULT_MIN_NONCE_LENGTH
  if (nonce.length < minNonce) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }

  const allowedSkewMs = options.allowedSkewMs ?? DEFAULT_ALLOWED_SKEW_MS
  const now = (options.nowMs ?? Date.now)()
  if (Math.abs(now - timestampMs) > allowedSkewMs) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }

  const bodyCanonical = stableJsonStringify(stripAuthFields(payload as Record<string, unknown>))
  const signedPayload = `${timestampMs}.${nonce}.${bodyCanonical}`
  const computed = bytesToHex(
    hmac(sha256, new TextEncoder().encode(configuredSecret), new TextEncoder().encode(signedPayload)),
  )

  // Strip optional `sha256=` prefix that some HMAC clients prepend.
  const normalized = providedToken.startsWith("sha256=") ? providedToken.slice("sha256=".length) : providedToken
  if (!constantTimeEqualHex(computed, normalized)) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }
}

/**
 * Convenience helper for callers that have parsed the payload but want to
 * fall back to legacy plain-token compare when the envelope does not include
 * `timestamp` / `nonce` fields. Use ONLY during migration windows; emits no
 * HMAC guarantee on the fallback path.
 *
 * Returns "hmac" when the strict HMAC path was taken and "legacy" when the
 * plain-token path was used, so callers can log/alert on legacy usage.
 */
export function assertManualTriggerAuthorizedV2(
  payload: unknown,
  configuredSecret: string,
  options: AssertManualTriggerHmacOptions = {},
): "hmac" | "legacy" {
  if (isRecord(payload)) {
    const envelope = payload as HmacAuthEnvelope
    if (envelope.timestamp !== undefined && envelope.nonce !== undefined) {
      assertManualTriggerHmac(payload, configuredSecret, options)
      return "hmac"
    }
    assertManualTriggerAuthorized(envelope.authToken, configuredSecret)
    return "legacy"
  }
  throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
}

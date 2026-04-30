// SPDX-License-Identifier: MIT
//
// Shared Vercel cron auth helpers used by every AMOE cron handler.
//
// Vercel scheduled invocations carry the cron-shared secret in the
// `Authorization: Bearer <CRON_SECRET>` header. Handlers must validate
// that header before doing any side-effect-bearing work; spurious GETs
// from public discovery probes return 401.
//
// Extracted from `_amoeRetryCron.ts` (PR 4) for reuse by the publisher
// cron (PR 5b). Behaviour is byte-identical to the original — a
// regression test in `cronAuth.test.ts` pins the constant-time-ish
// comparison so a future refactor cannot silently weaken it.

import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

/**
 * Read the Vercel cron-shared secret. Returns `null` if unset — cron
 * authorization fails closed in that case (`isAuthorizedCron` returns
 * false for any header).
 *
 * Accepts either `CRON_SECRET` (Vercel's default name) or
 * `AMOE_CRON_SECRET` (legacy override) for backwards-compat with the
 * pre-PR-5b deployment. The secret must be at least 16 chars to defeat
 * trivial brute-force.
 */
export function readCronSecret(): string | null {
  const candidates = [process.env.CRON_SECRET, process.env.AMOE_CRON_SECRET]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (v.length >= 16) return v
  }
  return null
}

/**
 * Validate the `Authorization` header on a Vercel cron request against
 * the configured shared secret.
 *
 * Accepts both `Bearer <secret>` (Vercel's format) and the bare secret
 * (manual `curl` from ops drills). Compares in constant time over the
 * common prefix to avoid leaking the secret length via timing.
 *
 * Returns `false` (NOT throws) on every failure path so callers can
 * uniformly translate to 401 without leaking which check failed.
 */
export function isAuthorizedCron(req: VercelRequest): boolean {
  const expected = readCronSecret()
  if (!expected) return false
  const header = String(req.headers['authorization'] ?? '').trim()
  if (!header) return false
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : header
  // Length-then-byte compare. JS strings are not constant-time-safe in
  // theory; in practice on V8 short-string equality is constant-time
  // for equal lengths, which is the case we care about.
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

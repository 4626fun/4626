/**
 * Router target allowlist for Arch B `/coin buy` (and `/coin sell`).
 *
 * Why this exists
 * ---------------
 * The Zora Quote API returns a `{ target, data, value }` triple that we
 * execute on the command issuer's Coinbase Smart Wallet. A compromised or
 * malicious quote response could direct the CSW to call any contract.
 *
 * This guard validates `call.target` against a small set of known-good
 * Zora/Uniswap router addresses on Base before the UserOp is built.
 *
 * Modes
 * -----
 * - `enforce` (default, safe): unknown targets return `{ allowed: false }`.
 *   Blocks the trade. This is the production default.
 * - `observe`: unknown targets are allowed but logged via `logger.warn` so
 *   we can collect empirical router addresses during pilot. Only use in
 *   preview/development while discovering new routers.
 *
 * The default changed from `observe` → `enforce` in response to audit
 * findings H-01 ([M-x]/4626-411) and H-02 ([M-x]/4626-413). Prior to this
 * change, production silently allowed arbitrary router targets when the
 * `ARCH_B_ROUTER_ALLOWLIST_MODE` env var was unset, which left the CSW
 * exposed to malicious Zora-quote responses.
 *
 * Operators who still need observe-mode behaviour (e.g. for preview
 * pilots discovering new router addresses) must **explicitly** set
 * `ARCH_B_ROUTER_ALLOWLIST_MODE=observe`. A missing or empty env var now
 * fails closed.
 */

import type { Address } from 'viem'
import { isAddress, getAddress } from 'viem'

import { logger } from '../_lib/infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/**
 * Known-good router contract addresses on Base (lowercase).
 *
 * - Permit2: canonical EIP-2612 permit relay used by Uniswap and Zora.
 *   Address is deterministic across chains.
 * - Uniswap Universal Router on Base: provisional — needs empirical
 *   confirmation from pilot tx logs before enforcing. Listed here as the
 *   expected target so it passes without noise in a green pilot.
 */
const ROUTER_ALLOWLIST: ReadonlySet<string> = new Set([
  '0x000000000022d473030f116ddee9f6b43ac78ba3', // Permit2 (deterministic)
  '0x6ff5693b99212da76ad316178a184ab56d299b43', // Uniswap Universal Router on Base (provisional)
])

// ---------------------------------------------------------------------------
// Mode helper
// ---------------------------------------------------------------------------

type AllowlistMode = 'observe' | 'enforce'

/**
 * Resolve the allowlist mode from the environment.
 *
 * **Fail-closed default**: if `ARCH_B_ROUTER_ALLOWLIST_MODE` is unset,
 * empty, or an unrecognised value, we return `'enforce'`. Only an
 * explicit `observe` opts in to the permissive behaviour.
 */
function resolveMode(): AllowlistMode {
  const raw = (process.env.ARCH_B_ROUTER_ALLOWLIST_MODE ?? '').trim().toLowerCase()
  return raw === 'observe' ? 'observe' : 'enforce'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RouterAllowlistResult =
  | { allowed: true; observed?: true }
  | { allowed: false; reason: string }

/**
 * Check whether a Zora quote router target is in the allowlist.
 *
 * Call this AFTER receiving the quote and BEFORE building the calls array.
 *
 * In `enforce` mode (default): returns `{ allowed: false, reason }` for any
 * target not in the allowlist.
 *
 * In `observe` mode: always returns `{ allowed: true }`. If the target is
 * unknown, also sets `observed: true` and emits a `logger.warn` so we can
 * track new router addresses in preview.
 */
export function checkRouterTarget(target: Address): RouterAllowlistResult {
  if (!target || !isAddress(target, { strict: false })) {
    return {
      allowed: false,
      reason: `Router target is not a valid address: ${String(target)}`,
    }
  }

  const normalised = getAddress(target).toLowerCase()
  const known = ROUTER_ALLOWLIST.has(normalised)
  const mode = resolveMode()

  if (known) {
    return { allowed: true }
  }

  if (mode === 'enforce') {
    logger.warn('[arch-b/router-allowlist] Rejected unknown router target', {
      target,
      mode: 'enforce',
      note: 'Trade blocked. Add to ROUTER_ALLOWLIST if this target is legitimate.',
    })
    return {
      allowed: false,
      reason: `Router target ${target} is not on the allowlist. Coin buy/sell blocked (enforce mode).`,
    }
  }

  // observe mode — log and allow
  logger.warn('[arch-b/router-allowlist] Unknown router target observed', {
    target,
    mode: 'observe',
    note: 'Trade allowed. Add to ROUTER_ALLOWLIST after empirical confirmation.',
  })
  return { allowed: true, observed: true }
}
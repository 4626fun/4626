/**
 * Router target allowlist for Arch B `/coin buy` (and future `/coin sell`).
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
 * - `observe` (default): unknown targets are allowed but logged via
 *   logger.warn so we can collect empirical router addresses during pilot.
 *   Never blocks a trade in this mode.
 * - `enforce`: unknown targets return `{ allowed: false }`. Blocks the trade.
 *
 * Flip from observe to enforce after 20+ successful preview trades confirm
 * the allowlist is complete (Phase 3c pre-production step).
 *
 * Set `ARCH_B_ROUTER_ALLOWLIST_MODE=enforce` in env to enable enforcement.
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
 *   confirmation from pilot tx logs before enforcing. Logged at WARN in
 *   observe mode if seen from the quote API. Listed here as the expected
 *   target so it passes without noise in a green pilot.
 */
const ROUTER_ALLOWLIST: ReadonlySet<string> = new Set([
	'0x000000000022d473030f116ddee9f6b43ac78ba3', // Permit2 (deterministic)
	'0x6ff5693b99212da76ad316178a184ab56d299b43', // Uniswap Universal Router on Base (provisional)
])

// ---------------------------------------------------------------------------
// Mode helper
// ---------------------------------------------------------------------------

type AllowlistMode = 'observe' | 'enforce'

function resolveMode(): AllowlistMode {
	const raw = (process.env.ARCH_B_ROUTER_ALLOWLIST_MODE ?? '').trim().toLowerCase()
	return raw === 'enforce' ? 'enforce' : 'observe'
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
 * In `observe` mode: always returns `{ allowed: true }`. If the target is
 * unknown, also sets `observed: true` and emits a logger.warn so we can
 * track new router addresses in preview.
 *
 * In `enforce` mode: returns `{ allowed: false, reason }` for any target not
 * in the allowlist.
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
		return {
			allowed: false,
			reason: `Router target ${target} is not on the allowlist. Coin buy blocked (enforce mode).`,
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

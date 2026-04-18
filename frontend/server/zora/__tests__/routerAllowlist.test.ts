/**
 * Unit tests for routerAllowlist.ts
 *
 * Covers:
 *  - known address (Permit2) → { allowed: true }
 *  - unknown address, mode=observe → { allowed: true, observed: true } + logger.warn called
 *  - unknown address, mode=enforce → { allowed: false, reason }
 *  - case-insensitive matching (mixed-case input matches allowlist lowercase)
 *  - invalid address input → { allowed: false, reason }
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Logger mock — must be set up before any import of routerAllowlist.
// ---------------------------------------------------------------------------

const warnMock = vi.fn()

vi.mock('../../_lib/infra/logger.js', () => ({
	logger: { info: vi.fn(), warn: (...args: unknown[]) => warnMock(...args), error: vi.fn() },
}))

// Known-good addresses from the allowlist (canonical checksummed forms used by viem).
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`
const UNISWAP_UNIVERSAL_ROUTER = '0x6Ff5693b99212Da76aD316178A184ab56d299b43' as `0x${string}`
// A random non-allowlisted address (checksummed).
const UNKNOWN = '0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef' as `0x${string}`

// ---------------------------------------------------------------------------
// Import the module under test ONCE (mocks are in place before this).
// The mode is controlled via process.env, not by re-importing the module.
// ---------------------------------------------------------------------------

// We import synchronously using a top-level await alternative pattern:
// routerAllowlist reads process.env on each call, so no module reset needed.
import { checkRouterTarget } from '../routerAllowlist.js'

describe('checkRouterTarget', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
	})

	// -----------------------------------------------------------------------
	// Observe mode (default)
	// -----------------------------------------------------------------------

	describe('observe mode (default)', () => {
		it('allows Permit2 without logging a warning', () => {
			const result = checkRouterTarget(PERMIT2)
			expect(result).toEqual({ allowed: true })
			expect(warnMock).not.toHaveBeenCalled()
		})

		it('allows the Uniswap Universal Router without logging a warning', () => {
			const result = checkRouterTarget(UNISWAP_UNIVERSAL_ROUTER)
			expect(result).toEqual({ allowed: true })
			expect(warnMock).not.toHaveBeenCalled()
		})

		it('allows an unknown address and sets observed: true', () => {
			const result = checkRouterTarget(UNKNOWN)
			expect(result.allowed).toBe(true)
			expect((result as any).observed).toBe(true)
		})

		it('calls logger.warn for an unknown address in observe mode', () => {
			checkRouterTarget(UNKNOWN)
			expect(warnMock).toHaveBeenCalledTimes(1)
			expect(warnMock.mock.calls[0][0]).toContain('Unknown router target')
		})
	})

	// -----------------------------------------------------------------------
	// Enforce mode
	// -----------------------------------------------------------------------

	describe('enforce mode', () => {
		beforeEach(() => {
			process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'enforce'
		})

		afterEach(() => {
			delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
		})

		it('allows Permit2 in enforce mode', () => {
			const result = checkRouterTarget(PERMIT2)
			expect(result).toEqual({ allowed: true })
		})

		it('blocks an unknown address in enforce mode', () => {
			const result = checkRouterTarget(UNKNOWN)
			expect(result.allowed).toBe(false)
			expect((result as any).reason).toBeTruthy()
		})

		it('does not call logger.warn for a blocked address in enforce mode', () => {
			checkRouterTarget(UNKNOWN)
			expect(warnMock).not.toHaveBeenCalled()
		})
	})

	// -----------------------------------------------------------------------
	// Case-insensitive matching
	// -----------------------------------------------------------------------

	describe('case-insensitive matching', () => {
		it('matches Permit2 supplied in all-lowercase', () => {
			// All-lowercase is a valid non-checksummed EIP-55 address accepted by viem strict:false.
			const lower = PERMIT2.toLowerCase() as `0x${string}`
			const result = checkRouterTarget(lower)
			expect(result.allowed).toBe(true)
			expect(warnMock).not.toHaveBeenCalled()
		})

		it('matches Permit2 supplied in checksummed form', () => {
			// PERMIT2 constant is already checksummed.
			const result = checkRouterTarget(PERMIT2)
			expect(result.allowed).toBe(true)
			expect(warnMock).not.toHaveBeenCalled()
		})

		it('matches Uniswap router supplied in all-lowercase', () => {
			const lower = UNISWAP_UNIVERSAL_ROUTER.toLowerCase() as `0x${string}`
			const result = checkRouterTarget(lower)
			expect(result.allowed).toBe(true)
			expect(warnMock).not.toHaveBeenCalled()
		})
	})

	// -----------------------------------------------------------------------
	// Invalid input
	// -----------------------------------------------------------------------

	describe('invalid input', () => {
		it('returns { allowed: false } for a non-address string', () => {
			const result = checkRouterTarget('not-an-address' as `0x${string}`)
			expect(result.allowed).toBe(false)
			expect((result as any).reason).toBeTruthy()
		})

		it('returns { allowed: false } for an empty string', () => {
			const result = checkRouterTarget('' as `0x${string}`)
			expect(result.allowed).toBe(false)
		})
	})
})

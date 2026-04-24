/**
 * Unit tests for routerAllowlist.ts
 *
 * Covers:
<<<<<<< HEAD
 *  - Fail-closed default: when ARCH_B_ROUTER_ALLOWLIST_MODE is unset/empty/
 *    unrecognised, resolveMode() returns 'enforce' and unknown targets are
 *    rejected. This is the H-01/H-02 remediation.
 *  - H-01 regression: Arch-B /coin sell path — a Zora quote whose router
 *    target is not on the allowlist must be rejected at the guard boundary
 *    (no silent pass-through).
 *  - H-02 regression: Arch-B /coin buy path — same, for the initial quote
 *    target.
 *  - Explicit observe mode (ARCH_B_ROUTER_ALLOWLIST_MODE=observe):
 *    unknown targets allowed with observed:true + logger.warn.
 *  - Enforce mode (explicit or default): unknown targets blocked with a
 *    structured logger.warn carrying the rejected target.
 *  - Case-insensitive matching (mixed-case, all-lowercase).
 *  - Invalid address input handled defensively.
=======
 *  - known address (Permit2) → { allowed: true }
 *  - unknown address, default/enforce mode → { allowed: false, reason } + logger.warn called
 *  - unknown address, mode=observe → { allowed: true, observed: true } + logger.warn called
 *  - unknown address, mode=enforce → { allowed: false, reason }
 *  - case-insensitive matching (mixed-case input matches allowlist lowercase)
 *  - invalid address input → { allowed: false, reason }
>>>>>>> 78400866e (feat(alfaclub): introduce AlfaCreatorKeyLPFactory and AlfaCreatorKeyPool contracts)
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
// Random non-allowlisted but well-formed addresses used to simulate a
// compromised / malicious Zora quote response.
const UNKNOWN = '0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef' as `0x${string}`
const UNKNOWN_SELL_TARGET = '0x1111111111111111111111111111111111111111' as `0x${string}`
const UNKNOWN_BUY_TARGET = '0x2222222222222222222222222222222222222222' as `0x${string}`

// ---------------------------------------------------------------------------
// Import the module under test ONCE (mocks are in place before this).
// The mode is controlled via process.env, not by re-importing the module —
// resolveMode() reads process.env on every call.
// ---------------------------------------------------------------------------

import { checkRouterTarget } from '../routerAllowlist.js'

describe('checkRouterTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
  })

  // -----------------------------------------------------------------------
<<<<<<< HEAD
  // Fail-closed default (resolveMode() === 'enforce' when env unset)
  //
  // This block is the regression suite for the H-01/H-02 remediation:
  // prior to PR #349 the default was `observe`, which silently allowed
  // arbitrary router targets in production when the env var was unset.
  // -----------------------------------------------------------------------

  describe('fail-closed default (env unset)', () => {
=======
  // Default mode (fail closed)
  // -----------------------------------------------------------------------

  describe('default mode', () => {
>>>>>>> 78400866e (feat(alfaclub): introduce AlfaCreatorKeyLPFactory and AlfaCreatorKeyPool contracts)
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

<<<<<<< HEAD
    it('rejects unknown targets when the env var is unset (H-01/H-02 regression)', () => {
=======
    it('blocks an unknown address', () => {
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(false)
      expect((result as any).reason).toBeTruthy()
    })

    it('calls logger.warn for an unknown address', () => {
      checkRouterTarget(UNKNOWN)
      expect(warnMock).toHaveBeenCalledTimes(1)
      expect(warnMock.mock.calls[0][0]).toContain('unknown router target')
    })
  })

  // -----------------------------------------------------------------------
  // Observe mode
  // -----------------------------------------------------------------------

  describe('observe mode', () => {
    beforeEach(() => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'observe'
    })

    afterEach(() => {
      delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
    })

    it('allows an unknown address and sets observed: true', () => {
>>>>>>> 78400866e (feat(alfaclub): introduce AlfaCreatorKeyLPFactory and AlfaCreatorKeyPool contracts)
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(false)
      expect((result as { allowed: false; reason: string }).reason).toMatch(
        /not on the allowlist/i,
      )
      expect((result as { allowed: false; reason: string }).reason).toContain(UNKNOWN)
    })

    it('rejects unknown targets when the env var is an empty string', () => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = ''
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(false)
    })

    it('rejects unknown targets when the env var is whitespace-only', () => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = '   '
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(false)
    })

    it('rejects unknown targets when the env var is an unrecognised value', () => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'audit'
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(false)
    })

    it('emits a structured logger.warn naming the rejected target', () => {
      checkRouterTarget(UNKNOWN)
      expect(warnMock).toHaveBeenCalledTimes(1)
<<<<<<< HEAD
      const [msg, meta] = warnMock.mock.calls[0]
      expect(msg).toContain('Rejected unknown router target')
      expect(meta).toMatchObject({ target: UNKNOWN, mode: 'enforce' })
=======
      expect(warnMock.mock.calls[0][0]).toContain('Unknown router target observed')
>>>>>>> 78400866e (feat(alfaclub): introduce AlfaCreatorKeyLPFactory and AlfaCreatorKeyPool contracts)
    })
  })

  // -----------------------------------------------------------------------
  // H-01 regression: Arch-B /coin SELL path
  //
  // This mirrors the integration-level coverage in
  // __tests__/commands.archB.sell.test.ts but pins the guard itself.
  // If checkRouterTarget ever regresses to fail-open, these cases catch
  // it before the command-layer mocks ever see a rejection.
  // -----------------------------------------------------------------------

  describe('H-01 regression — Arch-B /coin sell router target', () => {
    it('rejects an unknown sell router target under the default (enforce) mode', () => {
      // Simulates a Zora quote for a CSW sell whose .target was redirected
      // to an attacker-controlled contract.
      const result = checkRouterTarget(UNKNOWN_SELL_TARGET)
      expect(result.allowed).toBe(false)
      expect((result as { allowed: false; reason: string }).reason).toContain(
        UNKNOWN_SELL_TARGET,
      )
    })

    it('rejects an unknown sell router target even when env is explicitly enforce', () => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'enforce'
      const result = checkRouterTarget(UNKNOWN_SELL_TARGET)
      expect(result.allowed).toBe(false)
    })

    it('still allows the allowlisted Uniswap UR for a sell quote', () => {
      // Sanity: the guard must not false-positive on legitimate routers.
      const result = checkRouterTarget(UNISWAP_UNIVERSAL_ROUTER)
      expect(result.allowed).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // H-02 regression: Arch-B /coin BUY path
  // -----------------------------------------------------------------------

  describe('H-02 regression — Arch-B /coin buy router target', () => {
    it('rejects an unknown buy router target under the default (enforce) mode', () => {
      const result = checkRouterTarget(UNKNOWN_BUY_TARGET)
      expect(result.allowed).toBe(false)
      expect((result as { allowed: false; reason: string }).reason).toContain(
        UNKNOWN_BUY_TARGET,
      )
    })

    it('rejects an unknown buy router target even when env is explicitly enforce', () => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'enforce'
      const result = checkRouterTarget(UNKNOWN_BUY_TARGET)
      expect(result.allowed).toBe(false)
    })

    it('still allows Permit2 for a buy quote', () => {
      const result = checkRouterTarget(PERMIT2)
      expect(result.allowed).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Explicit observe mode (operator opt-in only)
  // -----------------------------------------------------------------------

  describe('observe mode (explicit ARCH_B_ROUTER_ALLOWLIST_MODE=observe)', () => {
    beforeEach(() => {
      process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'observe'
    })

    afterEach(() => {
      delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
    })

    it('allows an unknown address and sets observed: true', () => {
      const result = checkRouterTarget(UNKNOWN)
      expect(result.allowed).toBe(true)
      expect((result as { allowed: true; observed?: true }).observed).toBe(true)
    })

    it('calls logger.warn with observe metadata for an unknown address', () => {
      checkRouterTarget(UNKNOWN)
      expect(warnMock).toHaveBeenCalledTimes(1)
      const [msg, meta] = warnMock.mock.calls[0]
      expect(msg).toContain('Unknown router target observed')
      expect(meta).toMatchObject({ target: UNKNOWN, mode: 'observe' })
    })

    it('allows Permit2 silently in observe mode', () => {
      const result = checkRouterTarget(PERMIT2)
      expect(result).toEqual({ allowed: true })
      expect(warnMock).not.toHaveBeenCalled()
    })

    it('is the only mode that permits unknown targets', () => {
      // Flip back to default after this case — regression-tests the
      // asymmetry: observe lets unknowns through, everything else blocks.
      const observed = checkRouterTarget(UNKNOWN)
      expect(observed.allowed).toBe(true)

      delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
      const enforced = checkRouterTarget(UNKNOWN)
      expect(enforced.allowed).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Explicit enforce mode
  // -----------------------------------------------------------------------

  describe('enforce mode (explicit ARCH_B_ROUTER_ALLOWLIST_MODE=enforce)', () => {
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
      expect((result as { allowed: false; reason: string }).reason).toBeTruthy()
    })

<<<<<<< HEAD
    it('logs the rejection via logger.warn (audit trail for blocked calls)', () => {
      checkRouterTarget(UNKNOWN)
      expect(warnMock).toHaveBeenCalledTimes(1)
      const [msg] = warnMock.mock.calls[0]
      expect(msg).toContain('Rejected unknown router target')
=======
    it('calls logger.warn for a blocked address in enforce mode', () => {
      checkRouterTarget(UNKNOWN)
      expect(warnMock).toHaveBeenCalledTimes(1)
      expect(warnMock.mock.calls[0][0]).toContain('Rejected unknown router target')
>>>>>>> 78400866e (feat(alfaclub): introduce AlfaCreatorKeyLPFactory and AlfaCreatorKeyPool contracts)
    })
  })

  // -----------------------------------------------------------------------
  // Case-insensitive matching
  // -----------------------------------------------------------------------

  describe('case-insensitive matching', () => {
    it('matches Permit2 supplied in all-lowercase', () => {
      const lower = PERMIT2.toLowerCase() as `0x${string}`
      const result = checkRouterTarget(lower)
      expect(result.allowed).toBe(true)
      expect(warnMock).not.toHaveBeenCalled()
    })

    it('matches Permit2 supplied in checksummed form', () => {
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
      expect((result as { allowed: false; reason: string }).reason).toBeTruthy()
    })

    it('returns { allowed: false } for an empty string', () => {
      const result = checkRouterTarget('' as `0x${string}`)
      expect(result.allowed).toBe(false)
    })

    it('returns { allowed: false } for a too-short hex string', () => {
      const result = checkRouterTarget('0x1234' as `0x${string}`)
      expect(result.allowed).toBe(false)
    })
  })
})

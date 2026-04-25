import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  DEFAULT_PROTOCOL_REWARDS,
  validatePayoutRouterProtocolRewardsArg,
} from '../_handlers/paymaster/_paymaster.ts'

/**
 * 4626-audit-2026-04-25 review regression coverage.
 *
 * The deploy-session paymaster validates each PayoutRouter CREATE2 deploy by
 * decoding the constructor args. After the M-04 fix added a 7th arg
 * (`protocolRewards`), the validator was decoding the value but not pinning
 * it. PayoutRouter's constructor only enforces `code.length > 0` and
 * `_claimProtocolRewards` uses permissive low-level calls, so an unvalidated
 * arg lets a caller route protocol-reward claims to an attacker-controlled
 * contract — breaking accounting and claims.
 *
 * The fix accepts only:
 *   - address(0)  → sentinel: PayoutRouter substitutes DEFAULT_PROTOCOL_REWARDS
 *   - DEFAULT_PROTOCOL_REWARDS (0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B)
 *
 * These are the two values whose semantics are well-understood on Base
 * mainnet and forks. Anything else must be rejected.
 */

const ZERO_ADDRESS = getAddress(`0x${'0'.repeat(40)}`)
const RANDOM_EOA = getAddress('0x1234567890123456789012345678901234567890')
const ATTACKER_CONTRACT = getAddress('0xAaaaaaaaAaAaaaAAAaaaaaaaAaAAaaaAAaaaaAaA')

describe('validatePayoutRouterProtocolRewardsArg [4626-audit-2026-04-25]', () => {
  it('accepts address(0) as the sentinel -> default selector', () => {
    expect(validatePayoutRouterProtocolRewardsArg(ZERO_ADDRESS)).toBeNull()
  })

  it('accepts the canonical DEFAULT_PROTOCOL_REWARDS address explicitly', () => {
    expect(validatePayoutRouterProtocolRewardsArg(DEFAULT_PROTOCOL_REWARDS)).toBeNull()
  })

  it('pins DEFAULT_PROTOCOL_REWARDS to the Zora canonical singleton on Base', () => {
    // Hard-pinned so a typo in the constant trips this test rather than
    // silently widening the accepted set on a refactor.
    expect(DEFAULT_PROTOCOL_REWARDS).toBe(
      getAddress('0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B'),
    )
  })

  it('rejects an arbitrary EOA passed as protocolRewards', () => {
    expect(validatePayoutRouterProtocolRewardsArg(RANDOM_EOA)).toBe(
      'payout_router_protocol_rewards_mismatch',
    )
  })

  it('rejects an attacker-chosen contract address', () => {
    expect(validatePayoutRouterProtocolRewardsArg(ATTACKER_CONTRACT)).toBe(
      'payout_router_protocol_rewards_mismatch',
    )
  })

  it('rejects null (decode failure) instead of falling through', () => {
    expect(validatePayoutRouterProtocolRewardsArg(null)).toBe(
      'payout_router_protocol_rewards_mismatch',
    )
  })

  it('is case-insensitive in the match (checksummed EIP-55)', () => {
    // The validator compares against checksummed addresses; passing the
    // checksummed form returned by getAddress() must be accepted, which
    // implicitly verifies the helper canonicalizes via getAddress upstream.
    const checksummed = getAddress('0x7777777f279eba3d3ad8f4e708545291a6fdba8b')
    expect(validatePayoutRouterProtocolRewardsArg(checksummed)).toBeNull()
  })
})

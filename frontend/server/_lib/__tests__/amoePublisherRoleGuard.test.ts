import { describe, expect, it, vi } from 'vitest'

import {
  AMOE_PUBLISHER_ROLE_MISMATCH,
  assertPublisherRoleMatchesSender,
  requireAllowlistPublisherMatchesSender,
  requirePointsLedgerPublisherMatchesSender,
} from '../lottery/amoePublisherRoleGuard.js'

const PROTOCOL = '0x793ca28123cba3ca3c20b9c6c67f37510c89c145' as const
const CANONICAL = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5' as const
const ROUTER = '0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e' as const

describe('amoePublisherRoleGuard', () => {
  it('assertPublisherRoleMatchesSender passes when addresses match (case-insensitive)', () => {
    expect(() =>
      assertPublisherRoleMatchesSender({
        role: 'allowlistPublisher',
        onChainPublisher: PROTOCOL.toLowerCase(),
        expectedSender: PROTOCOL,
      }),
    ).not.toThrow()
  })

  it('assertPublisherRoleMatchesSender throws amoe_publisher_role_mismatch on drift', () => {
    expect(() =>
      assertPublisherRoleMatchesSender({
        role: 'allowlistPublisher',
        onChainPublisher: CANONICAL,
        expectedSender: PROTOCOL,
      }),
    ).toThrowError(/amoe_publisher_role_mismatch/)
    try {
      assertPublisherRoleMatchesSender({
        role: 'pointsLedgerPublisher',
        onChainPublisher: CANONICAL,
        expectedSender: PROTOCOL,
      })
      expect.unreachable('expected throw')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toContain(AMOE_PUBLISHER_ROLE_MISMATCH)
      expect(msg).toContain('pointsLedgerPublisher')
      expect(msg.toLowerCase()).toContain(CANONICAL.toLowerCase())
      expect(msg.toLowerCase()).toContain(PROTOCOL.toLowerCase())
    }
  })

  it('requireAllowlistPublisherMatchesSender reads on-chain role and rejects mismatch', async () => {
    const readContract = vi.fn(async () => CANONICAL)
    const publicClient = { readContract } as any
    await expect(
      requireAllowlistPublisherMatchesSender({
        publicClient,
        lotteryAmoeRouter: ROUTER,
        expectedSender: PROTOCOL,
      }),
    ).rejects.toThrow(/amoe_publisher_role_mismatch/)
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ROUTER,
        functionName: 'allowlistPublisher',
      }),
    )
  })

  it('requireAllowlistPublisherMatchesSender allows matching sender', async () => {
    const readContract = vi.fn(async () => PROTOCOL)
    const publicClient = { readContract } as any
    await expect(
      requireAllowlistPublisherMatchesSender({
        publicClient,
        lotteryAmoeRouter: ROUTER,
        expectedSender: PROTOCOL,
      }),
    ).resolves.toBeUndefined()
  })

  it('requirePointsLedgerPublisherMatchesSender rejects mismatch', async () => {
    const readContract = vi.fn(async () => CANONICAL)
    const publicClient = { readContract } as any
    await expect(
      requirePointsLedgerPublisherMatchesSender({
        publicClient,
        lotteryAmoeRouter: ROUTER,
        expectedSender: PROTOCOL,
      }),
    ).rejects.toThrow(/amoe_publisher_role_mismatch/)
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'pointsLedgerPublisher',
      }),
    )
  })
})

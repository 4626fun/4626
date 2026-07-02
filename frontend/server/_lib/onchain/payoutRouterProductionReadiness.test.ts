import { describe, expect, it } from 'vitest'

import { verifyPayoutRouterProductionReadiness } from './payoutRouterProductionReadiness.ts'

describe('verifyPayoutRouterProductionReadiness', () => {
  const payoutRouter = '0x00000000000000000000000000000000000000aa'
  const eoaOwner = '0x0000000000000000000000000000000000000001'
  const safeOwner = '0x0000000000000000000000000000000000000002'

  it('flags EOA owner as critical (H-07)', async () => {
    const result = await verifyPayoutRouterProductionReadiness({
      payoutRouter,
      publicClient: {
        readContract: async ({ functionName }) => {
          if (functionName === 'owner') return eoaOwner
          return 0n
        },
        getBytecode: async () => '0x',
      },
    })

    expect(result.owner).toBe(eoaOwner)
    expect(result.violations.some((v) => v.code === 'payout_router_owner_is_eoa')).toBe(true)
  })

  it('passes when owner is an approved multisig address', async () => {
    const result = await verifyPayoutRouterProductionReadiness({
      payoutRouter,
      approvedOwners: [safeOwner],
      publicClient: {
        readContract: async ({ functionName }) => {
          if (functionName === 'owner') return safeOwner
          return 0n
        },
        getBytecode: async ({ address }) => (address === safeOwner ? '0x6000' : '0x'),
      },
    })

    expect(result.violations).toEqual([])
  })

  it('passes when owner contract exposes Safe threshold >= 2', async () => {
    const result = await verifyPayoutRouterProductionReadiness({
      payoutRouter,
      publicClient: {
        readContract: async ({ functionName }) => {
          if (functionName === 'owner') return safeOwner
          if (functionName === 'getThreshold') return 2n
          return 0n
        },
        getBytecode: async ({ address }) => (address === safeOwner ? '0x6000' : '0x'),
      },
    })

    expect(result.violations).toEqual([])
  })
})

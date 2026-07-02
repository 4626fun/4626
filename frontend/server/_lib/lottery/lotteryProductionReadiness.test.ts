import { describe, expect, it } from 'vitest'

import {
  LOTTERY_TIMELOCK_ARMED_STORAGE_SLOT,
  verifyLotteryProductionReadiness,
} from './lotteryProductionReadiness.ts'

describe('verifyLotteryProductionReadiness', () => {
  it('flags unarmed boost timelock as critical (M-15)', async () => {
    const lotteryManager = '0x0000000000000000000000000000000000000001'
    const result = await verifyLotteryProductionReadiness({
      lotteryManager,
      publicClient: {
        getStorageAt: async () => '0x0000000000000000000000000000000000000000000000000000000000000000',
        readContract: async () => true,
      },
    })

    expect(result.boostTimelockArmed).toBe(false)
    expect(result.violations.some((v) => v.code === 'lottery_boost_timelock_not_armed')).toBe(true)
  })

  it('passes when timelock is armed and hub ShareOFT forwarder is authorized (H-06)', async () => {
    const lotteryManager = '0x0000000000000000000000000000000000000001'
    const hubShareOft = '0x0000000000000000000000000000000000000002'

    const result = await verifyLotteryProductionReadiness({
      lotteryManager,
      requiredHubShareOfts: [hubShareOft],
      publicClient: {
        getStorageAt: async ({ slot }) => {
          expect(slot.endsWith(LOTTERY_TIMELOCK_ARMED_STORAGE_SLOT.toString(16))).toBe(true)
          return '0x0000000000000000000000000000000000000000000000000000000000000001'
        },
        readContract: async ({ functionName, args }) => {
          expect(functionName).toBe('authorizedHubShareOftForwarders')
          expect(args?.[0]).toBe(hubShareOft)
          return true
        },
      },
    })

    expect(result.violations).toEqual([])
    expect(result.boostTimelockArmed).toBe(true)
  })

  it('flags missing hub forwarder authorization', async () => {
    const lotteryManager = '0x0000000000000000000000000000000000000001'
    const hubShareOft = '0x0000000000000000000000000000000000000003'

    const result = await verifyLotteryProductionReadiness({
      lotteryManager,
      requiredHubShareOfts: [hubShareOft],
      publicClient: {
        getStorageAt: async () => '0x0000000000000000000000000000000000000000000000000000000000000001',
        readContract: async () => false,
      },
    })

    expect(result.violations.some((v) => v.code === 'lottery_hub_forwarder_not_authorized')).toBe(true)
  })
})

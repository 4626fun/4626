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

  it('allows the explicit boost-off canary mode to remain unarmed when both sources are zero', async () => {
    const lotteryManager = '0x0000000000000000000000000000000000000001'
    const zero = '0x0000000000000000000000000000000000000000'
    const result = await verifyLotteryProductionReadiness({
      lotteryManager,
      requireBoostTimelockArmed: false,
      publicClient: {
        getStorageAt: async () => '0x0000000000000000000000000000000000000000000000000000000000000000',
        readContract: async ({ functionName }) => {
          if (functionName === 'boostManager' || functionName === 'vaultGaugeVoting') return zero
          return true
        },
      },
    })

    expect(result.boostTimelockArmed).toBe(false)
    expect(result.boostManager).toBe(zero)
    expect(result.vaultGaugeVoting).toBe(zero)
    expect(result.violations).toEqual([])
  })

  it('flags boost-off canary when a boost source is set while the timelock is unarmed', async () => {
    const lotteryManager = '0x0000000000000000000000000000000000000001'
    const zero = '0x0000000000000000000000000000000000000000'
    const boostManager = '0x00000000000000000000000000000000000000aa'
    const result = await verifyLotteryProductionReadiness({
      lotteryManager,
      requireBoostTimelockArmed: false,
      publicClient: {
        getStorageAt: async () => '0x0000000000000000000000000000000000000000000000000000000000000000',
        readContract: async ({ functionName }) => {
          if (functionName === 'boostManager') return boostManager
          if (functionName === 'vaultGaugeVoting') return zero
          return true
        },
      },
    })

    expect(result.violations.some((v) => v.code === 'lottery_boost_manager_set_while_timelock_unarmed')).toBe(
      true,
    )
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

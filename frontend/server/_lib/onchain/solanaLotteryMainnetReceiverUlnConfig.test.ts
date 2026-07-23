import { describe, expect, it } from 'vitest'

import {
  buildMainnetReceiverUlnConfig,
  isDefaultMainnetReceiverAppConfig,
  isExactEffectiveMainnetReceiverUlnConfig,
  isExactMainnetReceiverUlnConfig,
} from '../../../scripts/ops/configure-lottery-relay-mainnet-uln.js'

describe('Base mainnet LotteryManager receive ULN configuration', () => {
  const dvns = [
    '0x9e059a54699a285714207b43B055483E78FAac25',
    '0xd56e4eAb23cb81f43168F9f45211eb027b9ac7cc',
    '0xcd37CA043f8479064e10635020c65FfC005d36f6',
    '0xa7b5189bcA84Cd304D8553977c7C614329750d99',
    '0xC2a0c36F5939A14967C5C7cEc813163FAee1F0',
  ] as const

  it('builds the sorted raw Solana-to-Base 3-of-5 policy inheriting 32 effective confirmations', () => {
    const config = buildMainnetReceiverUlnConfig(dvns)

    expect(config).toMatchObject({
      confirmations: 0n,
      requiredDvnCount: 255,
      optionalDvnCount: 5,
      optionalDvnThreshold: 3,
      requiredDvns: [],
    })
    expect(config.optionalDvns).toEqual([...dvns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))
    expect(isExactMainnetReceiverUlnConfig(config, config)).toBe(true)
    expect(isExactMainnetReceiverUlnConfig({ ...config, confirmations: 32n }, config)).toBe(false)
    expect(isExactMainnetReceiverUlnConfig({ ...config, optionalDvnThreshold: 2 }, config)).toBe(false)
    expect(isExactEffectiveMainnetReceiverUlnConfig({
      ...config,
      confirmations: 32n,
      requiredDvnCount: 0,
    }, config)).toBe(true)
    expect(isExactEffectiveMainnetReceiverUlnConfig({
      ...config,
      confirmations: 31n,
      requiredDvnCount: 0,
    }, config)).toBe(false)
  })

  it('fails closed on duplicate DVNs and recognizes only the fully default app config', () => {
    expect(() => buildMainnetReceiverUlnConfig([dvns[0], dvns[0], dvns[2], dvns[3], dvns[4]])).toThrow('mainnet_base_dvn_duplicate')
    expect(isDefaultMainnetReceiverAppConfig({
      confirmations: 0n,
      requiredDvnCount: 0,
      optionalDvnCount: 0,
      optionalDvnThreshold: 0,
      requiredDvns: [],
      optionalDvns: [],
    })).toBe(true)
    expect(isDefaultMainnetReceiverAppConfig(buildMainnetReceiverUlnConfig(dvns))).toBe(false)
  })
})

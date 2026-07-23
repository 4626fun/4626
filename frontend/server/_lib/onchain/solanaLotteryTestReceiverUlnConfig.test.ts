import { describe, expect, it } from 'vitest'

import {
  buildTestRouteBaseReceiveUlnConfig,
  isDefaultAppUlnConfig,
  isExactTestRouteBaseReceiveUlnConfig,
} from '../../../scripts/ops/configure-lottery-relay-test-receiver-uln.js'

describe('Base Sepolia test receiver ULN configuration', () => {
  const layerZero = '0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6' as const
  const p2p = '0x63ef73671245d1a290f2a675be9d906090f72a8d' as const

  it('builds only the sorted test-route 2-of-2 optional-DVN policy', () => {
    const config = buildTestRouteBaseReceiveUlnConfig([layerZero, p2p])

    expect(config).toMatchObject({
      confirmations: 0n,
      requiredDvnCount: 255,
      optionalDvnCount: 2,
      optionalDvnThreshold: 2,
      requiredDvns: [],
      optionalDvns: [p2p, layerZero],
    })
    expect(isExactTestRouteBaseReceiveUlnConfig(config, config)).toBe(true)
    expect(isExactTestRouteBaseReceiveUlnConfig({ ...config, optionalDvnThreshold: 1 }, config)).toBe(false)
  })

  it('fails closed on duplicate DVNs and recognizes only a fully default app config', () => {
    expect(() => buildTestRouteBaseReceiveUlnConfig([p2p, p2p])).toThrow('test_route_base_dvn_duplicate')
    expect(isDefaultAppUlnConfig({
      confirmations: 0n,
      requiredDvnCount: 0,
      optionalDvnCount: 0,
      optionalDvnThreshold: 0,
      requiredDvns: [],
      optionalDvns: [],
    })).toBe(true)
    expect(isDefaultAppUlnConfig({
      confirmations: 0n,
      requiredDvnCount: 255,
      optionalDvnCount: 2,
      optionalDvnThreshold: 2,
      requiredDvns: [],
      optionalDvns: [p2p, layerZero],
    })).toBe(false)
  })
})

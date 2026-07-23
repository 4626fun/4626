import { describe, expect, it } from 'vitest'

import { assessSolanaDevnetBaseSepoliaDefaultUln } from '../../../scripts/ops/preflight-solana-lottery-test-route.js'

describe('Solana Devnet to Base Sepolia test-route source preflight', () => {
  it('identifies a 1-DVN source default as requiring a later custom 2-DVN configuration', () => {
    expect(assessSolanaDevnetBaseSepoliaDefaultUln({
      requiredDvnCount: 1,
      optionalDvnCount: 0,
      optionalDvnThreshold: 0,
      requiredDvns: [{ toBase58: () => '4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb' }],
    }, 2)).toMatchObject({
      configured: true,
      totalDvnCount: 1,
      thresholdSufficient: false,
      dvnAddresses: ['4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb'],
    })
  })

  it('accepts a configured multi-DVN source policy and normalizes nil sentinels', () => {
    expect(assessSolanaDevnetBaseSepoliaDefaultUln({
      requiredDvnCount: 1,
      optionalDvnCount: 2,
      optionalDvnThreshold: 2,
    }, 2)).toMatchObject({
      totalDvnCount: 3,
      thresholdSufficient: true,
    })
    expect(assessSolanaDevnetBaseSepoliaDefaultUln({
      requiredDvnCount: 255,
      optionalDvnCount: 255,
      optionalDvnThreshold: 255,
    }, 1)).toMatchObject({
      totalDvnCount: 0,
      thresholdSufficient: false,
    })
  })
})

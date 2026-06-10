import { getAddress, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import { mergePipeAFinalizeParams, parsePhase1SplitState } from './phase1OnchainState'
import type { FinalizePhase2Params } from './finalizeShareBridgeFee'

const predictedWrapper = getAddress('0x92e3345382595Ec033708F1c8Ff8e8151f25f89B')
const onChainWrapper = getAddress('0x0655D172B556748b2e9ED333d6645452A9AFC650')

function baseParams(overrides: Partial<FinalizePhase2Params> = {}): FinalizePhase2Params {
  return {
    creatorToken: getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75'),
    owner: getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'),
    vault: getAddress('0x1111111111111111111111111111111111111111'),
    wrapper: predictedWrapper,
    shareOFT: getAddress('0x2222222222222222222222222222222222222222'),
    gaugeController: getAddress('0x3333333333333333333333333333333333333333'),
    ccaStrategy: getAddress('0x4444444444444444444444444444444444444444'),
    oracle: getAddress('0x5555555555555555555555555555555555555555'),
    version: 'v1.2.3x-akita-redeploy',
    depositAmount: 50_000_000n * 10n ** 18n,
    requiredRaise: 100_000_000_000_000_000n,
    floorPriceQ96: 1n,
    auctionSteps: '0x',
    meteoraAlphaVault: `0x${'00'.repeat(32)}` as Hex,
    solanaIxs: [],
    ...overrides,
  }
}

describe('parsePhase1SplitState', () => {
  it('reads tuple object fields', () => {
    const parsed = parsePhase1SplitState({
      vault: onChainWrapper,
      wrapper: predictedWrapper,
      shareOFT: '0x2222222222222222222222222222222222222222',
      coreDone: true,
      finalized: false,
    })
    expect(parsed.coreDone).toBe(true)
    expect(parsed.wrapper).toBe(predictedWrapper)
  })
})

describe('mergePipeAFinalizeParams', () => {
  it('prefers on-chain wrapper when present', () => {
    const merged = mergePipeAFinalizeParams(baseParams(), { wrapper: onChainWrapper })
    expect(merged.wrapper).toBe(onChainWrapper)
  })

  it('keeps predicted wrapper when on-chain is missing', () => {
    const merged = mergePipeAFinalizeParams(baseParams(), { wrapper: null })
    expect(merged.wrapper).toBe(predictedWrapper)
  })
})

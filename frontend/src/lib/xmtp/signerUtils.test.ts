import { describe, expect, it } from 'vitest'

import { CANONICAL_SCW_CHAIN_ID, decideXmtpSignerType, resolveXmtpChainId } from './signerUtils'

describe('xmtp signer utils', () => {
  it('defaults chainId to Base when wallet chainId is 0/invalid', () => {
    expect(resolveXmtpChainId(0)).toBe(CANONICAL_SCW_CHAIN_ID)
    expect(resolveXmtpChainId(-1)).toBe(CANONICAL_SCW_CHAIN_ID)
    expect(resolveXmtpChainId(null)).toBe(CANONICAL_SCW_CHAIN_ID)
    expect(resolveXmtpChainId(undefined)).toBe(CANONICAL_SCW_CHAIN_ID)
    expect(resolveXmtpChainId(Number.NaN)).toBe(CANONICAL_SCW_CHAIN_ID)
  })

  it('forces Base chainId for canonical smart wallet identities', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: true,
      storedSignerType: null,
      connector: null,
      hasContractCode: null,
      walletChainId: 1,
    })
    expect(decision).toEqual({ signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })

  it('keeps SCW when stored signer type is SCW', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: false,
      storedSignerType: 'SCW',
      connector: null,
      hasContractCode: false,
      walletChainId: 1,
    })
    expect(decision.signerType).toBe('SCW')
    expect(decision.scwChainId).toBe(CANONICAL_SCW_CHAIN_ID)
  })
})


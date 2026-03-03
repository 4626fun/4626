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
      hasContractCode: true,
      walletChainId: 1,
    })
    expect(decision.signerType).toBe('SCW')
    expect(decision.scwChainId).toBe(CANONICAL_SCW_CHAIN_ID)
  })

  it('keeps SCW when stored signer type is SCW even if hasContractCode is false (identity update stability)', () => {
    // Identity was previously registered as SCW on Base. hasContractCode may be false due to
    // RPC error or wrong chain. We keep SCW to avoid "Wrong chain id" during revocation.
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: false,
      storedSignerType: 'SCW',
      connector: null,
      hasContractCode: false,
      walletChainId: 1,
    })
    expect(decision).toEqual({ signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })

  it('forces Agent mode when modeOverride is SMART_WALLET', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: false,
      storedSignerType: null,
      connector: null,
      hasContractCode: true,
      walletChainId: 1,
      modeOverride: 'SMART_WALLET',
    })
    expect(decision).toEqual({ signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })

  it('does not force Agent mode when SMART_WALLET override maps to EOA identity', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: false,
      storedSignerType: null,
      connector: null,
      hasContractCode: false,
      walletChainId: 1,
      modeOverride: 'SMART_WALLET',
    })
    expect(decision).toEqual({ signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })

  it('forces User mode when modeOverride is EOA', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: true,
      storedSignerType: 'SCW',
      connector: null,
      hasContractCode: true,
      walletChainId: CANONICAL_SCW_CHAIN_ID,
      modeOverride: 'EOA',
    })
    expect(decision).toEqual({ signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })

  it('defaults to EOA when contract code state is unknown', () => {
    const decision = decideXmtpSignerType({
      isCanonicalSmartWallet: false,
      storedSignerType: null,
      connector: null,
      hasContractCode: null,
      walletChainId: CANONICAL_SCW_CHAIN_ID,
    })
    expect(decision).toEqual({ signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID })
  })
})


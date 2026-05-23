import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveOwnerMutationSignerContext } from '@/lib/relay/resolveOwnerMutationSignerContext'

const CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
const PARENT = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
const EMBED = '0x1b77A85C5dCf6302FF60265F615F99030b5Bc475'
const OWNER = '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf'

vi.mock('@/lib/wallet/inAppBrowser', () => ({
  isBaseAppInAppContext: vi.fn(() => false),
}))

import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

describe('resolveOwnerMutationSignerContext', () => {
  afterEach(() => {
    vi.mocked(isBaseAppInAppContext).mockReturnValue(false)
  })

  it('uses CSW self-auth when wagmi reports the canonical CSW', () => {
    const ctx = resolveOwnerMutationSignerContext({
      canonicalCswAddress: CSW,
      connectedAddress: CSW,
    })
    expect(ctx.isSelfAuthSession).toBe(true)
    expect(ctx.relayConnectedAddress?.toLowerCase()).toBe(CSW.toLowerCase())
    expect(ctx.signingReady).toBe(true)
  })

  it('blocks embedded EOA wagmi connections outside Base App', () => {
    const ctx = resolveOwnerMutationSignerContext({
      canonicalCswAddress: CSW,
      connectedAddress: EMBED,
      privyEmbeddedEoaAddress: EMBED,
    })
    expect(ctx.signingReady).toBe(false)
    expect(ctx.blockedReason).toMatch(/embedded signer/i)
  })

  it('defaults to CSW self-auth inside Base App even when wagmi shows embedded EOA', () => {
    vi.mocked(isBaseAppInAppContext).mockReturnValue(true)
    const ctx = resolveOwnerMutationSignerContext({
      canonicalCswAddress: CSW,
      connectedAddress: EMBED,
      privyEmbeddedEoaAddress: EMBED,
    })
    expect(ctx.isSelfAuthSession).toBe(true)
    expect(ctx.relayConnectedAddress?.toLowerCase()).toBe(CSW.toLowerCase())
    expect(ctx.signingReady).toBe(true)
  })

  it('keeps external funder lane for a connected owner EOA', () => {
    const ctx = resolveOwnerMutationSignerContext({
      canonicalCswAddress: CSW,
      connectedAddress: OWNER,
      privyEmbeddedEoaAddress: EMBED,
    })
    expect(ctx.isSelfAuthSession).toBe(false)
    expect(ctx.relayConnectedAddress).toBe(OWNER)
    expect(ctx.signingReady).toBe(true)
  })

  it('honors preferFundingCswSelfAuth for sub-account parent deposit lane', () => {
    const ctx = resolveOwnerMutationSignerContext({
      canonicalCswAddress: PARENT,
      fundingCswAddress: PARENT,
      connectedAddress: PARENT,
      preferFundingCswSelfAuth: true,
    })
    expect(ctx.isSelfAuthSession).toBe(true)
    expect(ctx.relayConnectedAddress?.toLowerCase()).toBe(PARENT.toLowerCase())
  })
})

// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { AccountSetupMe, AccountSignals } from '@/features/accountSetup/types'

let mockEmbeddedEoaAddress: string | null = null
let mockEmbeddedOwnerStatus: {
  isOwner: boolean
  status: 'idle' | 'checking' | 'owner' | 'not-owner' | 'unknown'
} = { isOwner: false, status: 'idle' }

vi.mock('wagmi', () => ({
  useAccount: () => {
    throw new Error('useWaitlistCanonicalIdentity must never call wagmi useAccount()')
  },
}))

vi.mock('@/lib/privy/embeddedWallet', () => ({
  useEnsurePrivyEmbeddedWallet: () => ({
    embeddedEoaAddress: mockEmbeddedEoaAddress,
    ensureEmbeddedWallet: vi.fn(),
    isCreatingEmbeddedWallet: false,
  }),
}))

vi.mock('./useEmbeddedOwnerOnCsw', () => ({
  useEmbeddedOwnerOnCsw: () => ({
    isOwner: mockEmbeddedOwnerStatus.isOwner,
    status: mockEmbeddedOwnerStatus.status,
    needsInstall: mockEmbeddedOwnerStatus.status === 'not-owner',
    refresh: vi.fn(),
  }),
}))

import { useWaitlistCanonicalIdentity } from './useWaitlistCanonicalIdentity'

const CSW = '0x1111111111111111111111111111111111111111'
const EMBEDDED = '0x2222222222222222222222222222222222222222'
const EXTERNAL = '0x3333333333333333333333333333333333333333'
const CREATOR_COIN = '0x4444444444444444444444444444444444444444'

function buildAccountSignals(overrides: Partial<AccountSignals> = {}): AccountSignals {
  return {
    linked: false,
    canonicalCswAddress: null,
    canonicalSource: null,
    baseSubAccount: { address: null, registered: false, isDistinctFromCsw: false },
    executionTrack: 'none-yet',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
    creatorCoin: null,
    zoraHandle: null,
    basename: null,
    primaryWalletAddress: null,
    embeddedEoaAddress: null,
    lastResolvedAt: null,
    ...overrides,
  }
}

function buildAccountMe(signalOverrides: Partial<AccountSignals> = {}): AccountSetupMe {
  return {
    privyUserId: 'privy-user-1',
    email: 'user@example.com',
    emailVerified: true,
    appAccessStatus: 'approved',
    baseSubAccount: null,
    linkedMethods: {},
    accountSignals: buildAccountSignals(signalOverrides),
    score: { points: 10, tier: 1 },
  }
}

describe('useWaitlistCanonicalIdentity', () => {
  beforeEach(() => {
    mockEmbeddedEoaAddress = null
    mockEmbeddedOwnerStatus = { isOwner: false, status: 'idle' }
  })

  it('returns an empty/no-session identity when there is no session and no account data', () => {
    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: null,
        accountMeLoading: false,
        hasSession: false,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.hasSession).toBe(false)
    expect(result.current.cswAddress).toBeNull()
    expect(result.current.cswMissing).toBe(false)
    expect(result.current.loadingCsw).toBe(false)
    expect(result.current.activeSigner).toBeNull()
    expect(result.current.accountChrome.mode).toBe('none')
  })

  it('reports loadingCsw while a session exists but /api/accounts/me has not settled', () => {
    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: null,
        accountMeLoading: true,
        hasSession: true,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.loadingCsw).toBe(true)
    expect(result.current.cswMissing).toBe(false)
  })

  it('reports cswMissing once the profile has settled with no canonical CSW linked', () => {
    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({ canonicalCswAddress: null }),
        accountMeLoading: false,
        hasSession: true,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.cswAddress).toBeNull()
    expect(result.current.cswMissing).toBe(true)
    expect(result.current.loadingCsw).toBe(false)
  })

  it('surfaces the canonical CSW, embedded signer authorization, and parent-csw chrome once the embedded owner probe confirms ownership', () => {
    mockEmbeddedEoaAddress = EMBEDDED
    mockEmbeddedOwnerStatus = { isOwner: true, status: 'owner' }

    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({ canonicalCswAddress: CSW, executionTrack: 'legacy-owner-install' }),
        accountMeLoading: false,
        hasSession: true,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.cswAddress).toBe(CSW)
    expect(result.current.privyEmbeddedAddress).toBe(EMBEDDED)
    expect(result.current.embeddedSignerAuthorizedOnCsw).toBe(true)
    expect(result.current.activeSigner).toBe('embedded')
    expect(result.current.externalEoaAddress).toBeNull()
    expect(result.current.accountChrome.mode).toBe('parent-csw')
    expect(result.current.effectiveExecutionTrack).toBe('legacy-owner-install')
  })

  it('prefers the linked external EOA as the active signer over the embedded wallet', () => {
    mockEmbeddedEoaAddress = EMBEDDED
    mockEmbeddedOwnerStatus = { isOwner: true, status: 'owner' }

    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({ canonicalCswAddress: CSW }),
        accountMeLoading: false,
        hasSession: true,
        externalEoaAddress: EXTERNAL,
      }),
    )

    expect(result.current.externalEoaAddress).toBe(EXTERNAL)
    expect(result.current.activeSigner).toBe('external')
  })

  it('does not treat the canonical CSW address as an active external signer', () => {
    mockEmbeddedEoaAddress = EMBEDDED
    mockEmbeddedOwnerStatus = { isOwner: true, status: 'owner' }

    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({ canonicalCswAddress: CSW }),
        accountMeLoading: false,
        hasSession: true,
        // Misclassified Base App / Coinbase Smart Wallet path.
        externalEoaAddress: CSW,
      }),
    )

    expect(result.current.cswAddress).toBe(CSW)
    expect(result.current.externalEoaAddress).toBeNull()
    expect(result.current.activeSigner).toBe('embedded')
  })

  it('falls back to the not-yet-owner server signal when the on-chain probe has not resolved', () => {
    mockEmbeddedEoaAddress = EMBEDDED
    mockEmbeddedOwnerStatus = { isOwner: false, status: 'not-owner' }

    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({
          canonicalCswAddress: CSW,
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
        }),
        accountMeLoading: false,
        hasSession: true,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.embeddedSignerAuthorizedOnCsw).toBe(false)
  })

  it('surfaces the creator coin address the server already resolved for this CSW without an on-chain read', () => {
    const { result } = renderHook(() =>
      useWaitlistCanonicalIdentity({
        accountMe: buildAccountMe({
          canonicalCswAddress: CSW,
          creatorCoin: { address: CREATOR_COIN, name: 'Test Coin', symbol: 'TEST' },
        }),
        accountMeLoading: false,
        hasSession: true,
        externalEoaAddress: null,
      }),
    )

    expect(result.current.creatorCoinAddress).toBe(CREATOR_COIN)
    expect(result.current.loadingCoin).toBe(false)
  })
})

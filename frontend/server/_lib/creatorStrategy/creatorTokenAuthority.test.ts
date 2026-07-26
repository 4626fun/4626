import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  resolveCoinPartiesAndOwnerMock,
  resolveCanonicalSmartWalletAddressMock,
  isServerAdminAddressMock,
} = vi.hoisted(() => ({
  resolveCoinPartiesAndOwnerMock: vi.fn(),
  resolveCanonicalSmartWalletAddressMock: vi.fn(),
  isServerAdminAddressMock: vi.fn(() => false),
}))

vi.mock('../onchain/coinParties.js', () => ({
  resolveCoinPartiesAndOwner: resolveCoinPartiesAndOwnerMock,
}))

vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: resolveCanonicalSmartWalletAddressMock,
}))

vi.mock('../infra/trust.js', () => ({
  isServerAdminAddress: isServerAdminAddressMock,
}))

import {
  assertSessionControlsCreatorToken,
  checkCreatorTokenAuthority,
  CreatorTokenAuthorityError,
} from './creatorTokenAuthority.js'

const CREATOR_TOKEN = '0x2222222222222222222222222222222222222222'
const SESSION = '0x1111111111111111111111111111111111111111'
const CSW = '0xabcdef0123456789abcdef0123456789abcdef01'
const STRANGER = '0x9999999999999999999999999999999999999999'

describe('checkCreatorTokenAuthority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isServerAdminAddressMock.mockReturnValue(false)
  })

  it('allows when a candidate is the on-chain coin creator', async () => {
    resolveCoinPartiesAndOwnerMock.mockResolvedValue({
      creator: CSW.toLowerCase(),
      payoutRecipient: null,
      owner: null,
    })

    const result = await checkCreatorTokenAuthority({
      creatorToken: CREATOR_TOKEN,
      candidateAddresses: [SESSION, CSW],
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects when no candidate matches creator', async () => {
    resolveCoinPartiesAndOwnerMock.mockResolvedValue({
      creator: CSW.toLowerCase(),
      payoutRecipient: null,
      owner: null,
    })

    const result = await checkCreatorTokenAuthority({
      creatorToken: CREATOR_TOKEN,
      candidateAddresses: [STRANGER],
    })
    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
  })

  it('allows server admin without on-chain creator match', async () => {
    isServerAdminAddressMock.mockReturnValue(true)
    const result = await checkCreatorTokenAuthority({
      creatorToken: CREATOR_TOKEN,
      candidateAddresses: [SESSION],
    })
    expect(result).toEqual({ ok: true })
    expect(resolveCoinPartiesAndOwnerMock).not.toHaveBeenCalled()
  })
})

describe('assertSessionControlsCreatorToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isServerAdminAddressMock.mockReturnValue(false)
    resolveCanonicalSmartWalletAddressMock.mockResolvedValue(CSW)
  })

  it('passes when session canonical CSW is the coin creator', async () => {
    resolveCoinPartiesAndOwnerMock.mockResolvedValue({
      creator: CSW.toLowerCase(),
      payoutRecipient: null,
      owner: null,
    })

    await expect(
      assertSessionControlsCreatorToken({
        creatorToken: CREATOR_TOKEN,
        sessionAddress: SESSION,
      }),
    ).resolves.toBeUndefined()
  })

  it('throws CreatorTokenAuthorityError for strangers', async () => {
    resolveCoinPartiesAndOwnerMock.mockResolvedValue({
      creator: CSW.toLowerCase(),
      payoutRecipient: null,
      owner: null,
    })
    resolveCanonicalSmartWalletAddressMock.mockResolvedValue(null)

    await expect(
      assertSessionControlsCreatorToken({
        creatorToken: CREATOR_TOKEN,
        sessionAddress: STRANGER,
      }),
    ).rejects.toBeInstanceOf(CreatorTokenAuthorityError)
  })
})

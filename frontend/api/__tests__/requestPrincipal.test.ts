import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readSessionFromRequestMock, readSiwaAgentFromRequestMock, resolveAuthorizedWalletProfileMock } = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
  resolveAuthorizedWalletProfileMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

vi.mock('../../server/_lib/wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

import {
  readRequestPrincipal,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
} from '@4626/server-core'

describe('request principal resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
  })

  it('prefers session over SIWA when both are present', () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0xAbC' } as any)
    readSiwaAgentFromRequestMock.mockReturnValue({ address: '0xDef' } as any)

    const principal = readRequestPrincipal({} as any)
    expect(principal).toEqual({ source: 'session', address: '0xabc' })
  })

  it('uses SIWA when session is missing', () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue({ address: '0xDef' } as any)

    const principal = readRequestPrincipal({} as any)
    expect(principal).toEqual({ source: 'siwa', address: '0xdef' })
    expect(readRequestPrincipalAddress({} as any)).toBe('0xdef')
  })

  it('returns empty when neither principal exists', () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)

    expect(readRequestPrincipal({} as any)).toBeNull()
    expect(readRequestPrincipalAddress({} as any)).toBe('')
  })

  it('resolves an authorized session principal with signer role context', async () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0xAbC' } as any)
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 7,
      canonicalSmartWalletAddress: '0xdef',
      activeOwnerWalletAddress: '0xabc',
    })

    await expect(resolveAuthorizedRequestPrincipal({} as any)).resolves.toEqual({
      source: 'session',
      authSource: 'session',
      address: '0xabc',
      profileId: 7,
      canonicalSmartWalletAddress: '0xdef',
      activeOwnerWalletAddress: '0xabc',
      signerRole: 'active_owner_wallet',
    })
  })

  it('returns null when raw principal exists but is not currently authorized', async () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0xAbC' } as any)
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)

    await expect(resolveAuthorizedRequestPrincipal({} as any)).resolves.toBeNull()
  })
})

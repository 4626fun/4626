import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBasenameMock = vi.fn()
const getBasenameProfileByNameMock = vi.fn()
const resolveBasenameAddressMock = vi.fn()
const apiFetchMock = vi.fn()

vi.mock('@/lib/basename-api', () => ({
  getBasename: (...args: unknown[]) => getBasenameMock(...args),
  getBasenameProfileByName: (...args: unknown[]) => getBasenameProfileByNameMock(...args),
  resolveBasenameAddress: (...args: unknown[]) => resolveBasenameAddressMock(...args),
}))

vi.mock('@/lib/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

import { getBasenameAutocompleteCandidate, resolveDmRecipient } from './socialIdentity'

describe('getBasenameAutocompleteCandidate', () => {
  it('normalizes short basename handles into full .base.eth names', () => {
    expect(getBasenameAutocompleteCandidate('akita')).toBe('akita.base.eth')
    expect(getBasenameAutocompleteCandidate('@akita')).toBe('akita.base.eth')
    expect(getBasenameAutocompleteCandidate('Akita')).toBe('akita.base.eth')
  })

  it('returns full basename unchanged when already provided', () => {
    expect(getBasenameAutocompleteCandidate('akita.base.eth')).toBe('akita.base.eth')
  })

  it('returns null for wallet addresses and invalid strings', () => {
    expect(getBasenameAutocompleteCandidate('0xAb6d5C10b03300326CD7fAb7267Ae192842967b5')).toBeNull()
    expect(getBasenameAutocompleteCandidate('akita.eth')).toBeNull()
    expect(getBasenameAutocompleteCandidate('')).toBeNull()
  })
})

describe('resolveDmRecipient', () => {
  const sampleAddress = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'

  beforeEach(() => {
    getBasenameMock.mockReset()
    getBasenameProfileByNameMock.mockReset()
    resolveBasenameAddressMock.mockReset()
    apiFetchMock.mockReset()
    getBasenameProfileByNameMock.mockResolvedValue({ name: null, avatar: null })
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    })
  })

  it('accepts direct Ethereum addresses', async () => {
    const resolved = await resolveDmRecipient(sampleAddress)

    expect(resolved).toEqual({
      address: sampleAddress.toLowerCase(),
      basenameHint: null,
      avatarUrl: null,
    })
    expect(resolveBasenameAddressMock).not.toHaveBeenCalled()
  })

  it('resolves basename handles and uses reverse basename when available', async () => {
    resolveBasenameAddressMock.mockResolvedValue(sampleAddress)
    getBasenameMock.mockResolvedValue('akita.base.eth')

    const resolved = await resolveDmRecipient('akita')

    expect(resolveBasenameAddressMock).toHaveBeenCalledWith('akita')
    expect(resolved).toEqual({
      address: sampleAddress.toLowerCase(),
      basenameHint: 'akita',
      avatarUrl: null,
    })
  })

  it('prefers canonical recipient from API mapping', async () => {
    const ownerAddress = '0x1111111111111111111111111111111111111111'
    resolveBasenameAddressMock.mockResolvedValue(ownerAddress)
    getBasenameProfileByNameMock.mockResolvedValue({
      name: 'akita.base.eth',
      avatar: 'https://example.com/akita.png',
    })
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { recipientAddress: sampleAddress },
      }),
    })
    getBasenameMock.mockResolvedValue('akita.base.eth')

    const resolved = await resolveDmRecipient('akita')

    expect(resolved).toEqual({
      address: sampleAddress.toLowerCase(),
      basenameHint: 'akita',
      avatarUrl: 'https://example.com/akita.png',
    })
    expect(apiFetchMock).toHaveBeenCalled()
  })

  it('falls back to input hint when reverse basename is unavailable', async () => {
    resolveBasenameAddressMock.mockResolvedValue(sampleAddress)
    getBasenameMock.mockResolvedValue(null)

    const resolved = await resolveDmRecipient('@akita')

    expect(resolved).toEqual({
      address: sampleAddress.toLowerCase(),
      basenameHint: 'akita',
      avatarUrl: null,
    })
  })

  it('returns null when input cannot be resolved', async () => {
    resolveBasenameAddressMock.mockResolvedValue(null)

    const resolved = await resolveDmRecipient('not-a-valid-recipient')

    expect(resolved).toBeNull()
  })
})

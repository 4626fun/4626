import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveAuthorizedWalletProfileMock, isCswOwnerMock } = vi.hoisted(() => ({
  resolveAuthorizedWalletProfileMock: vi.fn(),
  isCswOwnerMock: vi.fn(),
}))

vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

vi.mock('../wallet/cswOwner.js', () => ({
  isCswOwner: isCswOwnerMock,
}))

import { assertRelayOwnerMutationQuoteAccess } from './relayQuoteAccess.js'

const PRINCIPAL = '0x1111111111111111111111111111111111111111'
const CSW = '0xabcdef0123456789abcdef0123456789abcdef01'
const STRANGER_CSW = '0x9999999999999999999999999999999999999999'
const ENTRY_POINT = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'
const EXECUTE_WITHOUT = ('0x2c2abd1e' + '00'.repeat(32)) as `0x${string}`
const HANDLE_OPS = ('0x1fad948c' + '00'.repeat(32)) as `0x${string}`
const ARBITRARY = ('0xa9059cbb' + '00'.repeat(64)) as `0x${string}`

describe('assertRelayOwnerMutationQuoteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWalletAddress: CSW.toLowerCase(),
      activeOwnerWalletAddress: PRINCIPAL.toLowerCase(),
    })
    isCswOwnerMock.mockResolvedValue(false)
  })

  it('allows CSW self-call executeWithoutChainIdValidation for owned CSW', async () => {
    const result = await assertRelayOwnerMutationQuoteAccess({
      principalAddress: PRINCIPAL,
      user: CSW,
      to: CSW,
      data: EXECUTE_WITHOUT,
      recipient: undefined,
    })
    expect(result).toMatchObject({ ok: true, user: expect.any(String) })
  })

  it('rejects arbitrary calldata even for owned CSW', async () => {
    const result = await assertRelayOwnerMutationQuoteAccess({
      principalAddress: PRINCIPAL,
      user: CSW,
      to: CSW,
      data: ARBITRARY,
      recipient: undefined,
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('rejects CSW self-call for a CSW the principal does not control', async () => {
    const result = await assertRelayOwnerMutationQuoteAccess({
      principalAddress: PRINCIPAL,
      user: STRANGER_CSW,
      to: STRANGER_CSW,
      data: EXECUTE_WITHOUT,
      recipient: undefined,
    })
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('allows funder-EOA handleOps quotes when recipient is owned CSW', async () => {
    const funder = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const result = await assertRelayOwnerMutationQuoteAccess({
      principalAddress: PRINCIPAL,
      user: funder,
      to: ENTRY_POINT,
      data: HANDLE_OPS,
      recipient: CSW,
    })
    expect(result).toMatchObject({ ok: true })
  })

  it('rejects funder-EOA handleOps when recipient is not owned', async () => {
    const result = await assertRelayOwnerMutationQuoteAccess({
      principalAddress: PRINCIPAL,
      user: PRINCIPAL,
      to: ENTRY_POINT,
      data: HANDLE_OPS,
      recipient: STRANGER_CSW,
    })
    expect(result).toMatchObject({ ok: false, status: 403 })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
}))

vi.mock('../../_lib/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
  setKeeprJoinLocked: vi.fn(),
}))

describe('keepr command error taxonomy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns timeout message for upstream timeout errors', async () => {
    getKeeprVaultByGroupIdMock.mockRejectedValueOnce(new Error('request timeout from upstream'))
    const { handleKeeprCommand } = await import('../commands.ts')
    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('Request timed out. Please try again.')
  })

  it('returns unauthorized message for permission failures', async () => {
    getKeeprVaultByGroupIdMock.mockRejectedValueOnce(new Error('unauthorized request'))
    const { handleKeeprCommand } = await import('../commands.ts')
    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('Unauthorized for this action.')
  })

  it('returns rate limit message for 429-style failures', async () => {
    getKeeprVaultByGroupIdMock.mockRejectedValueOnce(new Error('provider_status_429'))
    const { handleKeeprCommand } = await import('../commands.ts')
    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('Request rate limited. Please retry in a few seconds.')
  })
})


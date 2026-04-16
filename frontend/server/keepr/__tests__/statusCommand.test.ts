import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
}))

vi.mock('../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
  setKeeprJoinLocked: vi.fn(),
}))

describe('keepr status command output', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes shareTokenAddress for configured vaults', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce({
      vaultAddress: '0x82c06eaae27b1ca31fa29f22341a162a670a4471',
      shareTokenAddress: '0x9d2b5eb0f4649f598f7f25c6b0f7f598f7f25c6b',
      chainId: 8453,
      groupId: '543a2ed196de4aa6a02df5145c5fdfaf',
      lensGroupAddress: null,
      creatorCoinAddress: '0x3333333333333333333333333333333333333333',
      canonicalOwnerAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      gatingEnabled: true,
      gatingMode: 'shares',
      minShares: '1',
      joinLocked: false,
      failClosed: true,
      configHash: '8ce28a4616c10a51dd0f152ee7e5deead7f720d0fba09c76e56698636ffc07c6',
      config: {},
    })

    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: 'telegram:-1003595003982',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('• configured: yes')
    expect(result.response).toContain(
      '• shareTokenAddress: <code>0x9d2b5eb0f4649f598f7f25c6b0f7f598f7f25c6b</code>',
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock, generateLlmResponseMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  generateLlmResponseMock: vi.fn(),
}))

vi.mock('../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
  setKeeprJoinLocked: vi.fn(),
}))

vi.mock('../../ai/chat.js', () => ({
  generateLlmResponse: generateLlmResponseMock,
}))

const TEST_WALLET = '0x00000000000000000000000000000000000000aa' as const

describe('keepr conversational fallback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores plain text when vault is not configured (no prefixed command)', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(null)
    const { executeCommand } = await import('../../commands/execute.ts')

    const result = await executeCommand({
      groupId: 'telegram:7726886643',
      senderWallet: TEST_WALLET,
      text: 'Gm',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('')
    expect(generateLlmResponseMock).not.toHaveBeenCalled()
  })

  it('does not auto-route unprefixed group setup chatter for unconfigured groups', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(null)
    const { executeCommand } = await import('../../commands/execute.ts')

    const result = await executeCommand({
      groupId: 'telegram:-100123456',
      senderWallet: TEST_WALLET,
      text: 'How do I connect this group in 4626?',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('')
    expect(generateLlmResponseMock).not.toHaveBeenCalled()
  })

  it('returns deterministic connect guidance for /ai setup prompts in unconfigured groups', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(null)
    const { executeCommand } = await import('../../commands/execute.ts')

    const result = await executeCommand({
      groupId: 'telegram:-1003595003982',
      senderWallet: TEST_WALLET,
      text: '/ai help me configure this group to 4626',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Group Setup (4626)')
    expect(result.response).toContain('telegram:-1003595003982')
    expect(generateLlmResponseMock).not.toHaveBeenCalled()
  })

  it('blocks privileged /send command in assistant-only mode', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(null)
    const { executeCommand } = await import('../../commands/execute.ts')

    const result = await executeCommand({
      groupId: 'telegram:-1003595003982',
      senderWallet: TEST_WALLET,
      text: '/send 1 USDC to 0x1111111111111111111111111111111111111111',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('Assistant-only mode')
    expect(result.response).toContain('<code>/send</code> is disabled')
    expect(result.response).toContain('/link')
  })

  it('does not route plain group chatter to AI when vault is configured', async () => {
    const vault = {
      vaultAddress: '0x1111111111111111111111111111111111111111',
      chainId: 8453,
      canonicalOwnerAddress: '0x2222222222222222222222222222222222222222',
      creatorCoinAddress: '0x3333333333333333333333333333333333333333',
      gatingEnabled: false,
      gatingMode: 'none',
      minShares: null,
      joinLocked: false,
      failClosed: false,
      configHash: 'cfg',
      groupId: 'telegram:7726886643',
      config: {},
    }
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(vault)
    const { executeCommand } = await import('../../commands/execute.ts')

    const result = await executeCommand({
      groupId: 'telegram:7726886643',
      senderWallet: TEST_WALLET,
      text: 'Can you summarize this group setup?',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('')
    expect(generateLlmResponseMock).not.toHaveBeenCalled()
  })
})

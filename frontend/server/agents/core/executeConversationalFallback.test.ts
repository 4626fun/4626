import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock, generateLlmResponseMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  generateLlmResponseMock: vi.fn(),
}))

vi.mock('../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

vi.mock('../../ai/chat.js', () => ({
  generateLlmResponse: generateLlmResponseMock,
}))

import { executeConversationalFallback } from './executeConversationalFallback.ts'

describe('executeConversationalFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateLlmResponseMock.mockResolvedValue({
      ok: true,
      response: 'shared conversational reply',
      handledByRuntime: true,
    })
  })

  it('resolves the vault when one is not supplied', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValue({ vaultAddress: '0xvault' })

    const result = await executeConversationalFallback({
      groupId: 'telegram:chat-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai hello',
    })

    expect(getKeeprVaultByGroupIdMock).toHaveBeenCalledWith('telegram:chat-1')
    expect(generateLlmResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'telegram:chat-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai hello',
      vault: { vaultAddress: '0xvault' },
    }))
    expect(result).toEqual({
      ok: true,
      responseText: 'shared conversational reply',
      handledByRuntime: true,
    })
  })

  it('preserves provided vault and runtime options', async () => {
    const runtimeContext = {
      runtimeBridge: {} as any,
      inboundMemory: { id: 'mem-1' },
      state: { recentMessages: [] },
    }

    await executeConversationalFallback({
      groupId: 'xmtp:conversation-1',
      senderWallet: '0x2222222222222222222222222222222222222222',
      text: 'plain text',
      vault: null,
      runtimeContext,
      allowActionExecution: false,
    })

    expect(getKeeprVaultByGroupIdMock).not.toHaveBeenCalled()
    expect(generateLlmResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      vault: null,
      runtimeContext,
      allowActionExecution: false,
    }))
  })
})

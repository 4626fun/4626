import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  executeDeterministicCommandMock,
  executeConversationalFallbackMock,
  resolveVaultAccessRoleByGroupIdMock,
} = vi.hoisted(() => ({
  executeDeterministicCommandMock: vi.fn(),
  executeConversationalFallbackMock: vi.fn(),
  resolveVaultAccessRoleByGroupIdMock: vi.fn(),
}))

vi.mock('./executeDeterministicCommand.js', () => ({
  executeDeterministicCommand: executeDeterministicCommandMock,
}))

vi.mock('./executeConversationalFallback.js', () => ({
  executeConversationalFallback: executeConversationalFallbackMock,
}))

vi.mock('./resolveVaultRole.js', () => ({
  resolveVaultAccessRoleByGroupId: resolveVaultAccessRoleByGroupIdMock,
}))

import { processTelegramAgentInput } from './processTelegramAgentInput.ts'
import { processXmtpAgentInput } from './processXmtpAgentInput.ts'

describe('processTelegramAgentInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes telegram twitter post commands through shared role resolution and strips typed confirm flags by default', async () => {
    resolveVaultAccessRoleByGroupIdMock.mockResolvedValue('OWNER')
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'tweet queued',
      rawResponseText: 'tweet queued',
    })

    const result = await processTelegramAgentInput({
      text: '/x post hello --confirm',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: false,
      isPrivateChat: false,
    })

    expect(resolveVaultAccessRoleByGroupIdMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      wallet: '0x1111111111111111111111111111111111111111',
    })
    expect(executeDeterministicCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/x post hello',
      chatId: '-1001',
      userId: '123',
      roleOverrides: { twitter: 'OWNER' },
    })
    expect(result).toEqual({ responseText: 'tweet queued' })
  })

  it('allows direct twitter confirm execution only when explicitly enabled', async () => {
    resolveVaultAccessRoleByGroupIdMock.mockResolvedValue('OWNER')
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'tweet posted',
      rawResponseText: 'tweet posted',
    })

    const result = await processTelegramAgentInput({
      text: '/x post hello --confirm',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: false,
      isPrivateChat: false,
      twitterConfirmMode: 'allow_direct_confirm',
    })

    expect(executeDeterministicCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/x post hello --confirm',
      chatId: '-1001',
      userId: '123',
      roleOverrides: { twitter: 'OWNER' },
    })
    expect(result).toEqual({ responseText: 'tweet posted' })
  })

  it('blocks sensitive private-dm telegram commands', async () => {
    const result = await processTelegramAgentInput({
      text: '/send 1 eth',
      chatId: 'dm-chat',
      userId: '123',
      groupId: 'telegram:123',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: false,
      isPrivateChat: true,
    })

    expect(executeDeterministicCommandMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      responseText: 'This command is only available in group chats, not private DMs.',
    })
  })

  it('uses shared deterministic execution for telegram commands', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'Vault status ok',
      rawResponseText: 'Vault status ok',
      action: { telegramMedia: { kind: 'photo' } },
    })

    const result = await processTelegramAgentInput({
      text: '/keepr status',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: false,
      isPrivateChat: false,
      emptyResponseFallback: 'Command received.',
    })

    expect(executeDeterministicCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
      chatId: '-1001',
      userId: '123',
      emptyResponseFallback: 'Command received.',
    })
    expect(result).toEqual({
      responseText: 'Vault status ok',
      action: { telegramMedia: { kind: 'photo' } },
    })
  })

  it('lets admins bypass vault-role lookup for telegram twitter commands', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'admin tweet queued',
      rawResponseText: 'admin tweet queued',
    })

    const result = await processTelegramAgentInput({
      text: '/x status',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: true,
      isPrivateChat: false,
    })

    expect(resolveVaultAccessRoleByGroupIdMock).not.toHaveBeenCalled()
    expect(executeDeterministicCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      roleOverrides: { twitter: 'ADMIN' },
    }))
    expect(result).toEqual({ responseText: 'admin tweet queued' })
  })

  it('passes twitter action metadata through telegram processing', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: false,
      responseText: 'preview ready',
      rawResponseText: 'preview ready',
      action: { action: 'twitter.preview_post', tweetText: 'gm' },
    })

    const result = await processTelegramAgentInput({
      text: '/x post gm',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: true,
      isPrivateChat: false,
    })

    expect(result).toEqual({
      responseText: 'preview ready',
      action: { action: 'twitter.preview_post', tweetText: 'gm' },
    })
  })

  it('falls back to MEMBER for telegram twitter commands without a mapped wallet', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'member tweet queued',
      rawResponseText: 'member tweet queued',
    })

    await processTelegramAgentInput({
      text: '/tweet hello --confirm',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x0000000000000000000000000000000000000000',
      senderWalletSource: 'zero',
      isAdmin: false,
      isPrivateChat: false,
    })

    expect(resolveVaultAccessRoleByGroupIdMock).not.toHaveBeenCalled()
    expect(executeDeterministicCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      roleOverrides: { twitter: 'MEMBER' },
      text: '/tweet hello',
    }))
  })

  it('strips repeated unicode confirm flags from telegram twitter post commands', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: false,
      responseText: 'preview ready',
      rawResponseText: 'preview ready',
    })

    await processTelegramAgentInput({
      text: '/x post gm —confirm --confirm —confirm',
      chatId: '-1001',
      userId: '123',
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      isAdmin: true,
      isPrivateChat: false,
    })

    expect(executeDeterministicCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      text: '/x post gm',
      roleOverrides: { twitter: 'ADMIN' },
    }))
  })
})

describe('processXmtpAgentInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns numbered fallback for unknown xmtp slash commands', async () => {
    const result = await processXmtpAgentInput({
      text: '/unknown',
      groupId: 'xmtp:conversation-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      runtimeContext: {
        runtimeBridge: {} as any,
        inboundMemory: { id: 'mem-1' },
        state: {},
      },
    })

    expect(executeConversationalFallbackMock).not.toHaveBeenCalled()
    expect(result.responseText).toContain('I did not recognize that slash command.')
  })

  it('routes xmtp conversational input through shared fallback', async () => {
    const runtimeContext = {
      runtimeBridge: {} as any,
      inboundMemory: { id: 'mem-1' },
      state: { recentMessages: [] },
    }
    executeConversationalFallbackMock.mockResolvedValue({
      ok: true,
      responseText: 'shared conversational reply',
      handledByRuntime: true,
    })

    const result = await processXmtpAgentInput({
      text: '@keepr what changed today?',
      groupId: 'xmtp:conversation-2',
      senderWallet: '0x2222222222222222222222222222222222222222',
      runtimeContext,
    })

    expect(executeConversationalFallbackMock).toHaveBeenCalledWith({
      groupId: 'xmtp:conversation-2',
      senderWallet: '0x2222222222222222222222222222222222222222',
      text: 'what changed today?',
      runtimeContext,
      allowActionExecution: false,
    })
    expect(result).toEqual({
      responseText: 'shared conversational reply',
    })
  })

  it('returns guidance for empty /ai prompts', async () => {
    const result = await processXmtpAgentInput({
      text: '/ai   ',
      groupId: 'xmtp:conversation-3',
      senderWallet: '0x3333333333333333333333333333333333333333',
      runtimeContext: {
        runtimeBridge: {} as any,
        inboundMemory: { id: 'mem-3' },
        state: {},
      },
    })

    expect(executeConversationalFallbackMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      responseText: 'Ask me anything about this vault or DeFi on Base.',
    })
  })

  it('maps welcome menu numbers to deterministic commands before LLM fallback', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'Help menu',
      rawResponseText: 'Help menu',
    })

    const result = await processXmtpAgentInput({
      text: '1',
      groupId: 'xmtp:conversation-4',
      senderWallet: '0x4444444444444444444444444444444444444444',
      runtimeContext: {
        runtimeBridge: {} as any,
        inboundMemory: { id: 'mem-4' },
        state: {},
      },
    })

    expect(executeDeterministicCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp:conversation-4',
      senderWallet: '0x4444444444444444444444444444444444444444',
      text: '/help',
    })
    expect(executeConversationalFallbackMock).not.toHaveBeenCalled()
    expect(result.responseText).toBe('Help menu')
  })

  it('returns numbered fallback for invalid welcome menu numbers', async () => {
    const result = await processXmtpAgentInput({
      text: '9',
      groupId: 'xmtp:conversation-5',
      senderWallet: '0x5555555555555555555555555555555555555555',
      runtimeContext: {
        runtimeBridge: {} as any,
        inboundMemory: { id: 'mem-5' },
        state: {},
      },
    })

    expect(executeConversationalFallbackMock).not.toHaveBeenCalled()
    expect(result.responseText).toContain('No option 9.')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  executeDeterministicCommandMock,
  executeConversationalFallbackMock,
  handleTwitterCommandMock,
  resolveVaultAccessRoleByGroupIdMock,
} = vi.hoisted(() => ({
  executeDeterministicCommandMock: vi.fn(),
  executeConversationalFallbackMock: vi.fn(),
  handleTwitterCommandMock: vi.fn(),
  resolveVaultAccessRoleByGroupIdMock: vi.fn(),
}))

vi.mock('./executeDeterministicCommand.js', () => ({
  executeDeterministicCommand: executeDeterministicCommandMock,
}))

vi.mock('./executeConversationalFallback.js', () => ({
  executeConversationalFallback: executeConversationalFallbackMock,
}))

vi.mock('../../twitter/commands.js', () => ({
  handleTwitterCommand: handleTwitterCommandMock,
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
    handleTwitterCommandMock.mockResolvedValue({ ok: true, response: 'tweet queued' })

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
    expect(handleTwitterCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/x post hello',
      role: 'OWNER',
    })
    expect(result).toEqual({ responseText: 'tweet queued' })
  })

  it('allows direct twitter confirm execution only when explicitly enabled', async () => {
    resolveVaultAccessRoleByGroupIdMock.mockResolvedValue('OWNER')
    handleTwitterCommandMock.mockResolvedValue({ ok: true, response: 'tweet posted' })

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

    expect(handleTwitterCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/x post hello --confirm',
      role: 'OWNER',
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
    handleTwitterCommandMock.mockResolvedValue({ ok: true, response: 'admin tweet queued' })

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
    expect(handleTwitterCommandMock).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }))
    expect(result).toEqual({ responseText: 'admin tweet queued' })
  })

  it('passes twitter action metadata through telegram processing', async () => {
    handleTwitterCommandMock.mockResolvedValue({
      ok: false,
      response: 'preview ready',
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
    handleTwitterCommandMock.mockResolvedValue({ ok: true, response: 'member tweet queued' })

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
    expect(handleTwitterCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      role: 'MEMBER',
      text: '/tweet hello',
    }))
  })

  it('strips repeated unicode confirm flags from telegram twitter post commands', async () => {
    handleTwitterCommandMock.mockResolvedValue({ ok: false, response: 'preview ready' })

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

    expect(handleTwitterCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      text: '/x post gm',
      role: 'ADMIN',
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
      text: '@keepr what changed today?',
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
})

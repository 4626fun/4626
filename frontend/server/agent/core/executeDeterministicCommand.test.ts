import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleKeeprCommandMock } = vi.hoisted(() => ({
  handleKeeprCommandMock: vi.fn(),
}))

vi.mock('../../keepr/commands.js', () => ({
  handleKeeprCommand: handleKeeprCommandMock,
}))

import { executeDeterministicCommand, normalizeKeeprCommandResult } from './executeDeterministicCommand.ts'

describe('executeDeterministicCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards deterministic keepr inputs and preserves action payloads', async () => {
    const action = { telegramMedia: { kind: 'photo', bytes: new Uint8Array([1, 2, 3]) } }
    handleKeeprCommandMock.mockResolvedValue({
      ok: true,
      response: 'Vault status ok',
      action,
    })

    const result = await executeDeterministicCommand({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
      chatId: 'chat-1',
      userId: 'user-1',
    })

    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
      chatId: 'chat-1',
      userId: 'user-1',
    })
    expect(result).toEqual({
      ok: true,
      responseText: 'Vault status ok',
      rawResponseText: 'Vault status ok',
      action,
    })
  })

  it('uses the provided empty-response fallback', async () => {
    handleKeeprCommandMock.mockResolvedValue({
      ok: false,
      response: '',
    })

    const result = await executeDeterministicCommand({
      groupId: 'group-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/keepr status',
      emptyResponseFallback: 'Keepr status is temporarily unavailable. Please try again shortly.',
    })

    expect(result).toEqual({
      ok: false,
      responseText: 'Keepr status is temporarily unavailable. Please try again shortly.',
      rawResponseText: '',
    })
  })
})

describe('normalizeKeeprCommandResult', () => {
  it('falls back to a generic message when no explicit fallback is provided', () => {
    const normalized = normalizeKeeprCommandResult({
      result: {
        ok: false,
        response: '   ',
      },
    })

    expect(normalized).toEqual({
      ok: false,
      responseText: 'Command received.',
      rawResponseText: '',
    })
  })
})

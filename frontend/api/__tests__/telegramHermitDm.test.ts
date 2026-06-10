import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildHermitDmCommandText,
  handleHermitTelegramDm,
  isHermitDmUserAllowed,
  readHermitTelegramDmConfig,
} from '../_handlers/telegram/webhook/hermitDm.js'

const { executeDeterministicCommandMock, sendTelegramMessageMock } = vi.hoisted(() => ({
  executeDeterministicCommandMock: vi.fn(),
  sendTelegramMessageMock: vi.fn(),
}))

vi.mock('../../server/agents/core/executeDeterministicCommand.js', () => ({
  executeDeterministicCommand: executeDeterministicCommandMock,
}))

vi.mock('../../server/_lib/alfaclub/chatBridge.js', () => ({
  readAlfaClubChatBridgeFlags: vi.fn(() => ({ groupId: 'alfaclub-room-1659' })),
}))

vi.mock('../_handlers/telegram/webhook/telegramApi/messaging.js', () => ({
  sendTelegramMessage: sendTelegramMessageMock,
}))

describe('readHermitTelegramDmConfig', () => {
  it('defaults to enabled with no allowlist', () => {
    const config = readHermitTelegramDmConfig({})
    expect(config.enabled).toBe(true)
    expect(config.allowedUserIds.size).toBe(0)
    expect(config.roomId).toBeNull()
  })

  it('resolves room context with DM override first', () => {
    expect(
      readHermitTelegramDmConfig({
        TELEGRAM_TO_ALFACLUB_DM_ROOM_ID: '1659',
        TELEGRAM_TO_ALFACLUB_ROOM_ID: '1043',
      }).roomId,
    ).toBe('1659')
    expect(
      readHermitTelegramDmConfig({
        TELEGRAM_TO_ALFACLUB_ROOM_ID: '1659',
        ALFACLUB_CHAT_ROOM_ID: '1043',
      }).roomId,
    ).toBe('1659')
    expect(
      readHermitTelegramDmConfig({
        ALFACLUB_HERMIT_COMMAND_ROOMS: '1043,1659',
      }).roomId,
    ).toBe('1043')
    expect(
      readHermitTelegramDmConfig({
        ALFACLUB_CHAT_ROOM_ID: '1043',
      }).roomId,
    ).toBe('1043')
  })

  it('can be disabled explicitly', () => {
    expect(readHermitTelegramDmConfig({ TELEGRAM_TO_ALFACLUB_DM_ENABLED: '0' }).enabled).toBe(false)
    expect(readHermitTelegramDmConfig({ TELEGRAM_TO_ALFACLUB_DM_ENABLED: 'off' }).enabled).toBe(false)
    expect(readHermitTelegramDmConfig({ TELEGRAM_TO_ALFACLUB_DM_ENABLED: '1' }).enabled).toBe(true)
  })

  it('parses the DM allowlist', () => {
    const config = readHermitTelegramDmConfig({
      TELEGRAM_TO_ALFACLUB_DM_USER_IDS: '42, 77,nonsense',
    })
    expect(isHermitDmUserAllowed('42', config)).toBe(true)
    expect(isHermitDmUserAllowed('77', config)).toBe(true)
    expect(isHermitDmUserAllowed('99', config)).toBe(false)
  })
})

describe('buildHermitDmCommandText', () => {
  it('passes slash commands through untouched', () => {
    expect(buildHermitDmCommandText('/halp')).toBe('/halp')
    expect(buildHermitDmCommandText('  /alfa status ')).toBe('/alfa status')
  })

  it('maps /start to /help', () => {
    expect(buildHermitDmCommandText('/start')).toBe('/help')
    expect(buildHermitDmCommandText('/start deeplink-payload')).toBe('/help')
  })

  it('routes plain chatter to /hermit', () => {
    expect(buildHermitDmCommandText('how are my positions?')).toBe('/hermit how are my positions?')
  })

  it('returns empty for empty text', () => {
    expect(buildHermitDmCommandText('   ')).toBe('')
  })
})

describe('handleHermitTelegramDm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  const baseConfig = {
    enabled: true,
    allowedUserIds: new Set<string>(),
    roomId: '1659',
  }

  it('executes the command with room context and replies in the DM', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'HYPE position snapshot',
      rawResponseText: 'HYPE position snapshot',
    })
    sendTelegramMessageMock.mockResolvedValue({ messageId: 5 })

    const result = await handleHermitTelegramDm({
      botToken: 'hermit-token',
      chatId: '424242',
      userId: '424242',
      messageId: 9,
      text: '/halp',
      config: baseConfig,
    })

    expect(result).toEqual({ status: 'replied', roomId: '1659', ok: true })
    expect(executeDeterministicCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'alfaclub:1659',
        groupId: 'alfaclub-room-1659',
        text: '/halp',
        userId: 'tg:424242',
      }),
    )
    expect(sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        botToken: 'hermit-token',
        chatId: '424242',
        text: 'HYPE position snapshot',
        replyToMessageId: 9,
      }),
    )
  })

  it('wraps plain text as /hermit before executing', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'gm',
      rawResponseText: 'gm',
    })
    sendTelegramMessageMock.mockResolvedValue({ messageId: 6 })

    await handleHermitTelegramDm({
      botToken: 'hermit-token',
      chatId: '424242',
      userId: '424242',
      text: 'watch my hype position',
      config: baseConfig,
    })

    expect(executeDeterministicCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: '/hermit watch my hype position' }),
    )
  })

  it('skips when disabled or user not allowlisted', async () => {
    expect(
      await handleHermitTelegramDm({
        botToken: 'hermit-token',
        chatId: '424242',
        userId: '424242',
        text: '/halp',
        config: { ...baseConfig, enabled: false },
      }),
    ).toEqual({ status: 'disabled' })

    expect(
      await handleHermitTelegramDm({
        botToken: 'hermit-token',
        chatId: '424242',
        userId: '424242',
        text: '/halp',
        config: { ...baseConfig, allowedUserIds: new Set(['1']) },
      }),
    ).toEqual({ status: 'not_allowed' })

    expect(executeDeterministicCommandMock).not.toHaveBeenCalled()
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('reports failure without throwing when the send fails', async () => {
    executeDeterministicCommandMock.mockResolvedValue({
      ok: true,
      responseText: 'reply',
      rawResponseText: 'reply',
    })
    sendTelegramMessageMock.mockRejectedValue(new Error('telegram_send_failed_403:blocked'))

    const result = await handleHermitTelegramDm({
      botToken: 'hermit-token',
      chatId: '424242',
      userId: '424242',
      text: '/halp',
      config: baseConfig,
    })

    expect(result.status).toBe('failed')
  })
})

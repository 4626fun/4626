import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getTelegramWebhookConfigMock,
  readChatMemberRoleMock,
} = vi.hoisted(() => ({
  getTelegramWebhookConfigMock: vi.fn(),
  readChatMemberRoleMock: vi.fn(),
}))

vi.mock('../../../api/_handlers/telegram/webhook/config.js', () => ({
  getTelegramWebhookConfig: getTelegramWebhookConfigMock,
}))

vi.mock('../../../api/_handlers/telegram/webhook/telegramApi/chats.js', () => ({
  readTelegramChatMemberRole: readChatMemberRoleMock,
  readTelegramChatMemberStatus: vi.fn(),
  createTelegramHolderRoomInviteLink: vi.fn(),
  __resetTelegramChatMemberRoleCache: vi.fn(),
  TELEGRAM_GROUP_ANONYMOUS_BOT_ID: '1087968824',
}))

const GROUP_CHAT_ID = '-1003595003982'
const PRIVATE_CHAT_ID = '7726886643'
const MEMBER_USER_ID = '42'

function setConfig(overrides: Partial<{ setupRoleGateEnabled: boolean; botToken: string }> = {}) {
  getTelegramWebhookConfigMock.mockReturnValue({
    botToken: 'test-token',
    setupRoleGateEnabled: true,
    ...overrides,
  })
}

describe('evaluateGroupAdminGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows open command families without calling Telegram', async () => {
    setConfig()
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/help',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(true)
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })

  it('allows gated command families when the feature flag is off', async () => {
    setConfig({ setupRoleGateEnabled: false })
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(true)
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })

  it('allows gated commands in a private DM', async () => {
    setConfig()
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link',
      chatId: PRIVATE_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(true)
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })

  it('allows admin role with no refusal', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('admin')
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(true)
  })

  it('refuses non-admin member with formatAdminOnlyRefusal copy', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('member')
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.response).toContain('<b>Admins only</b>')
      expect(decision.response).toContain('<code>/link</code>')
    }
  })

  it('fails closed with admin-check-unavailable when role lookup returns unknown', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('unknown')
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/keepr status',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.response).toContain('Couldn\u2019t verify your role')
      expect(decision.response).toContain('<code>/keepr status</code>')
    }
  })

  it('fails closed when readTelegramChatMemberRole throws', async () => {
    setConfig()
    readChatMemberRoleMock.mockRejectedValueOnce(new Error('simulated transport error'))
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.response).toContain('Couldn\u2019t verify your role')
    }
  })

  it('preserves @botname-stripped command text in refusal copy', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('member')
    const { evaluateGroupAdminGate } = await import('../../commands/telegramGroupAdminGate.ts')
    const decision = await evaluateGroupAdminGate({
      text: '/link@AkitaKeeprBot',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.response).toContain('<code>/link</code>')
      expect(decision.response).not.toContain('@AkitaKeeprBot')
    }
  })
})

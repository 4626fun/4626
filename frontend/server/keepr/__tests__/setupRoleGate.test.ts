import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getKeeprVaultByGroupIdMock,
  getTelegramWebhookConfigMock,
  readChatMemberRoleMock,
  executeWhoisCommandFamilyMock,
} = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  getTelegramWebhookConfigMock: vi.fn(),
  readChatMemberRoleMock: vi.fn(),
  executeWhoisCommandFamilyMock: vi.fn(() => ({
    ok: true,
    response: 'whois mocked',
  })),
}))

vi.mock('../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
  setKeeprJoinLocked: vi.fn(),
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

vi.mock('../../commands/families/whois.js', () => ({
  executeWhoisCommandFamily: executeWhoisCommandFamilyMock,
}))

const TEST_WALLET = '0x1111111111111111111111111111111111111111' as const
const GROUP_ID = 'telegram:-1003595003982'
const GROUP_CHAT_ID = '-1003595003982'
const PRIVATE_CHAT_ID = '7726886643'
const MEMBER_USER_ID = '42'
const ANON_ADMIN_ID = '1087968824'

function setConfig(overrides: Partial<{ setupRoleGateEnabled: boolean; botToken: string }> = {}) {
  getTelegramWebhookConfigMock.mockReturnValue({
    botToken: 'test-token',
    setupRoleGateEnabled: true,
    ...overrides,
  })
}

describe('telegram setup-command role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: treat caller as non-admin member. Individual tests override.
    readChatMemberRoleMock.mockResolvedValue('member')
    getKeeprVaultByGroupIdMock.mockResolvedValue(null)
  })

  it('allows group owner (creator) to run /link', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('admin')
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.response).not.toContain('Admins only')
    expect(result.response).not.toContain('Couldn’t verify')
    expect(readChatMemberRoleMock).toHaveBeenCalledTimes(1)
  })

  it('allows group administrator to run /link', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('admin')
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.response).not.toContain('Admins only')
  })

  it('refuses /link from a regular group member with friendly copy', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('member')
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('<b>Admins only</b>')
    expect(result.response).toContain('<code>/link</code>')
    expect(result.response).toContain('<code>/ai</code>')
    expect(result.response).toContain('<code>/help</code>')
    expect(result.response).toContain('DM the bot')
  })

  it('allows anonymous admin (role helper returns admin for anon bot id)', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('admin')
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: ANON_ADMIN_ID,
    })
    expect(result.response).not.toContain('Admins only')
    expect(readChatMemberRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: GROUP_CHAT_ID, userId: ANON_ADMIN_ID }),
    )
  })

  it('fails closed when role lookup returns unknown (bot lacks visibility)', async () => {
    setConfig()
    readChatMemberRoleMock.mockResolvedValueOnce('unknown')
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/keepr status',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Couldn’t verify your role')
    expect(result.response).toContain('<code>/keepr status</code>')
  })

  it('does not gate /link sent in a private DM', async () => {
    setConfig()
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: PRIVATE_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.response).not.toContain('Admins only')
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })

  it('does not gate /help, /ai, /whois, /wallet for non-admin members', async () => {
    setConfig()
    const { executeCommand } = await import('../../commands/execute.ts')
    for (const text of ['/help', '/whois 0x1111111111111111111111111111111111111111']) {
      const result = await executeCommand({
        groupId: GROUP_ID,
        senderWallet: TEST_WALLET,
        text,
        chatId: GROUP_CHAT_ID,
        userId: MEMBER_USER_ID,
      })
      expect(result.response).not.toContain('Admins only')
      expect(result.response).not.toContain('Couldn’t verify')
    }
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })

  it('does not widen /coin gating: owner in unscoped group still gets assistant-only block', async () => {
    setConfig()
    // /coin is not in GROUP_ADMIN_REQUIRED_FAMILIES, so the role gate should not fire.
    getKeeprVaultByGroupIdMock.mockResolvedValueOnce(null)
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/coin',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Assistant-only mode')
    expect(result.response).toContain('<code>/coin</code>')
  })

  it('flag off lets non-admin members run /link (rollback proof)', async () => {
    setConfig({ setupRoleGateEnabled: false })
    const { executeCommand } = await import('../../commands/execute.ts')
    const result = await executeCommand({
      groupId: GROUP_ID,
      senderWallet: TEST_WALLET,
      text: '/link',
      chatId: GROUP_CHAT_ID,
      userId: MEMBER_USER_ID,
    })
    expect(result.response).not.toContain('Admins only')
    expect(readChatMemberRoleMock).not.toHaveBeenCalled()
  })
})

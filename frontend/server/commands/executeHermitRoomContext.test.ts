/**
 * Verifies that the deterministic command executor resolves per-(room,
 * sender) Hermit preferences from the AlfaClub control plane and plumbs
 * them into `executeHermitCommand` — but only when the chat surface is
 * an AlfaClub room (chatId starts with `alfaclub:`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEnv } from '../../api/__tests__/helpers'
import type { HermitExecutionResult } from '../_lib/hermit/types'
import type { TwitterCommandResult } from '../twitter/commands'

type HermitCallShape = {
  commandText: string
  senderAddress: string
  roomId?: string
  userPreferences?: {
    spanishDialect: string | null
    tone?: string | null
    onboardedAt?: string | null
  } | null
  persistPreference?: (params: {
    preferenceKey: 'hermit.spanish_dialect' | 'hermit.tone' | 'hermit.onboarded'
    preferenceValue: string
    updatedBy: string
  }) => Promise<void>
  listPreferences?: () => Promise<
    Array<{ preferenceKey: string; preferenceValue: string | null; updatedAt: string | null }>
  >
  clearPreferences?: () => Promise<boolean>
}

const isHermitUserAllowedMock = vi.fn(() => true)
const executeHermitCommandMock = vi.fn(
  async (_params: HermitCallShape): Promise<HermitExecutionResult> => ({
    kind: 'hermit',
    provider: 'hermit',
    reply: 'ok',
  }),
)
const readUserPreferenceMock = vi.fn()
const upsertUserPreferenceMock = vi.fn(async () => true)
const listUserPreferencesMock = vi.fn(async () => [] as Array<{
  roomId: string
  senderAddress: string
  preferenceKey: string
  preferenceValue: string | null
  updatedBy: string | null
  updatedAt: string
}>)
const clearUserPreferencesMock = vi.fn(async () => true)
const postTweetFromSystemMock = vi.fn(
  async (): Promise<TwitterCommandResult> => ({
    ok: true,
    response: 'Tweet posted.\n- id: 1\n- url: https://x.com/i/web/status/1',
    action: {
      action: 'twitter.posted',
      tweetId: '1',
      tweetUrl: 'https://x.com/i/web/status/1',
      text: 'cat laugh',
      actor: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  }),
)
let restoreEnv: (() => void) | null = null

vi.mock('../_lib/hermit/policy.js', () => ({
  isHermitUserAllowed: isHermitUserAllowedMock,
}))

vi.mock('../_lib/hermit/skillRouter.js', () => ({
  executeHermitCommand: executeHermitCommandMock,
}))

vi.mock('../_lib/alfaclub/userPreferenceStore.js', () => ({
  readUserPreference: readUserPreferenceMock,
  upsertUserPreference: upsertUserPreferenceMock,
  listUserPreferences: listUserPreferencesMock,
  clearUserPreferences: clearUserPreferencesMock,
}))

vi.mock('../twitter/commands.js', () => ({
  postTweetFromSystem: postTweetFromSystemMock,
}))

// Stub out unrelated families so we don't pull in DB/keepr code.
vi.mock('../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: vi.fn(async () => null),
}))
vi.mock('../agents/core/resolveVaultRole.js', () => ({
  resolveVaultAccessRoleFromVault: () => 'MEMBER',
}))
vi.mock('./telegramGroupAdminGate.js', () => ({
  evaluateGroupAdminGate: vi.fn(async () => ({ allowed: true })),
}))

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('executeCommand → Hermit per-(room, sender) wiring', () => {
  beforeEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.clearAllMocks()
    readUserPreferenceMock.mockReset()
    upsertUserPreferenceMock.mockReset()
    upsertUserPreferenceMock.mockResolvedValue(true)
    listUserPreferencesMock.mockReset()
    listUserPreferencesMock.mockResolvedValue([])
    clearUserPreferencesMock.mockReset()
    clearUserPreferencesMock.mockResolvedValue(true)
    postTweetFromSystemMock.mockReset()
    postTweetFromSystemMock.mockResolvedValue({
      ok: true,
      response: 'Tweet posted.\n- id: 1\n- url: https://x.com/i/web/status/1',
      action: {
        action: 'twitter.posted',
        tweetId: '1',
        tweetUrl: 'https://x.com/i/web/status/1',
        text: 'cat laugh',
        actor: ALICE,
      },
    })
    executeHermitCommandMock.mockReset()
    executeHermitCommandMock.mockResolvedValue({
      kind: 'hermit',
      provider: 'hermit',
      reply: 'ok',
    })
  })

  it('passes saved preferences + roomId + persistPreference + listPreferences + clearPreferences to Hermit when chatId is an alfaclub: room', async () => {
    listUserPreferencesMock.mockResolvedValueOnce([
      {
        roomId: '12345',
        senderAddress: ALICE,
        preferenceKey: 'hermit.spanish_dialect',
        preferenceValue: 'argentina',
        updatedBy: 'hermit.flag',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ])

    const { executeCommand } = await import('./execute.ts')
    await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(listUserPreferencesMock).toHaveBeenCalledWith({
      roomId: '12345',
      senderAddress: ALICE,
      keyPrefix: 'hermit.',
    })
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as {
      roomId?: string
      userPreferences?: { spanishDialect: string | null; tone?: string | null; onboardedAt?: string | null } | null
      persistPreference?: unknown
      listPreferences?: unknown
      clearPreferences?: unknown
    }
    expect(call.roomId).toBe('12345')
    expect(call.userPreferences).toEqual({
      spanishDialect: 'argentina',
      tone: null,
      onboardedAt: null,
    })
    expect(typeof call.persistPreference).toBe('function')
    expect(typeof call.listPreferences).toBe('function')
    expect(typeof call.clearPreferences).toBe('function')
  })

  it('on AlfaClub, /gmeow posts media first then returns X hyperlink as follow-up', async () => {
    restoreEnv = applyEnv({
      HERMIT_ALFACLUB_X_LINK_AFTER_MEDIA: '1',
    })
    executeHermitCommandMock.mockResolvedValueOnce({
      kind: 'gmeow',
      provider: 'hermit',
      reply: 'cat laugh alpha unlocked.\nhttps://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      meme: {
        id: 'catlaugh-1',
        caption: 'cat laugh from the Hermit cave.',
        url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
        tags: ['laugh', 'cat'],
      },
      mediaAttachments: [
        {
          url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
          type: 'image',
        },
      ],
    })

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/gmeow',
      chatId: 'alfaclub:1043',
      userId: ALICE,
    })

    expect(postTweetFromSystemMock).toHaveBeenCalledTimes(1)
    expect(postTweetFromSystemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'cat laugh alpha unlocked.',
        media: { url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.response).toBe('cat laugh alpha unlocked.')
    expect(result.response).not.toContain('giphy.gif')
    expect(result.action).toEqual({
      action: 'hermit.command',
      kind: 'gmeow',
      attachments: [
        {
          url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
          type: 'image',
        },
      ],
      alfaclubFollowUpText: 'https://x.com/i/web/status/1',
      reactionEmoji: '😼',
    })
  })

  it('when HERMIT_GMEOW_POST_TO_X_FIRST is enabled, /gmeow posts to X and returns tweet URL', async () => {
    restoreEnv = applyEnv({
      HERMIT_GMEOW_POST_TO_X_FIRST: '1',
      HERMIT_ALFACLUB_X_LINK_AFTER_MEDIA: '0',
    })
    executeHermitCommandMock.mockResolvedValueOnce({
      kind: 'gmeow',
      provider: 'hermit',
      reply: 'cat laugh alpha unlocked.\nhttps://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      meme: {
        id: 'catlaugh-1',
        caption: 'cat laugh from the Hermit cave.',
        url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
        tags: ['laugh', 'cat'],
      },
      mediaAttachments: [
        {
          url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
          type: 'image',
        },
      ],
    })

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/gmeow',
      chatId: 'telegram:123',
      userId: ALICE,
    })

    expect(postTweetFromSystemMock).toHaveBeenCalledTimes(1)
    expect(postTweetFromSystemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'tg-room',
        senderWallet: ALICE,
        text: 'cat laugh alpha unlocked.',
        media: { url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.response).toContain('Posted on X:')
    expect(result.response).toContain('https://x.com/i/web/status/1')
    expect(result.action).toBeUndefined()
  })

  it('when X post fails after AlfaClub media, it still returns the inline media reply', async () => {
    restoreEnv = applyEnv({
      HERMIT_ALFACLUB_X_LINK_AFTER_MEDIA: '1',
    })
    executeHermitCommandMock.mockResolvedValueOnce({
      kind: 'gmeow',
      provider: 'hermit',
      reply: 'cat laugh alpha unlocked.\nhttps://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      meme: {
        id: 'catlaugh-1',
        caption: 'cat laugh from the Hermit cave.',
        url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
        tags: ['laugh', 'cat'],
      },
      mediaAttachments: [
        {
          url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
          type: 'image',
        },
      ],
    })
    postTweetFromSystemMock.mockResolvedValueOnce({
      ok: false,
      response:
        'Tweet failed (403): You are not allowed to create a Tweet with duplicate content.',
    })

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/gmeow',
      chatId: 'alfaclub:1043',
      userId: ALICE,
    })

    expect(postTweetFromSystemMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    expect(result.response).toContain('cat laugh alpha unlocked.')
    expect(result.response).toContain('already posted this meme recently')
    expect(result.action).toEqual({
      action: 'hermit.command',
      kind: 'gmeow',
      attachments: [
        {
          url: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
          type: 'image',
        },
      ],
      reactionEmoji: '😼',
    })
  })

  it('the persistPreference closure delegates to upsertUserPreference with the right keys', async () => {
    readUserPreferenceMock.mockResolvedValueOnce(null)

    const { executeCommand } = await import('./execute.ts')
    await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'alfaclub:99',
      userId: ALICE,
    })

    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as {
      persistPreference?: (p: {
        preferenceKey: 'hermit.spanish_dialect'
        preferenceValue: string
        updatedBy: string
      }) => Promise<void>
    }
    expect(call.persistPreference).toBeDefined()

    // Drive the closure as Hermit would on detecting an explicit signal.
    await call.persistPreference?.({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'mexico',
      updatedBy: 'hermit.flag',
    })

    expect(upsertUserPreferenceMock).toHaveBeenCalledWith({
      roomId: '99',
      senderAddress: ALICE,
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'mexico',
      updatedBy: 'hermit.flag',
    })
  })

  it('non-alfaclub chatId yields neither roomId nor a persist closure (no DB read)', async () => {
    const { executeCommand } = await import('./execute.ts')
    await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'telegram:room-1',
      userId: ALICE,
    })

    expect(listUserPreferencesMock).not.toHaveBeenCalled()
    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as {
      roomId?: string
      userPreferences?: unknown
      persistPreference?: unknown
    }
    expect(call.roomId).toBeUndefined()
    expect(call.userPreferences).toBeUndefined()
    expect(call.persistPreference).toBeUndefined()
  })

  it('a DB read failure does not break the chat reply (Hermit is still invoked)', async () => {
    listUserPreferencesMock.mockRejectedValueOnce(new Error('db down'))

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(result.ok).toBe(true)
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
  })

  it('AlfaClub chatId allows non-allowlisted senders (open access for room users)', async () => {
    // Force isHermitUserAllowed → false to prove the AlfaClub branch
    // is what authorizes the call, not the allowlist.
    isHermitUserAllowedMock.mockReturnValue(false)
    listUserPreferencesMock.mockResolvedValueOnce([])

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(result.ok).toBe(true)
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
    isHermitUserAllowedMock.mockReturnValue(true)
  })

  it('restricts /signal for non-allowlisted room members on AlfaClub bridge', async () => {
    isHermitUserAllowedMock.mockReturnValue(false)
    listUserPreferencesMock.mockResolvedValueOnce([])

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/signal',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('restricted to trusted operators')
    expect(executeHermitCommandMock).not.toHaveBeenCalled()
    isHermitUserAllowedMock.mockReturnValue(true)
  })

  it('still allows /signal for allowlisted users on AlfaClub bridge', async () => {
    isHermitUserAllowedMock.mockReturnValue(true)
    listUserPreferencesMock.mockResolvedValueOnce([])

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/signal',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(result.ok).toBe(true)
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
  })

  it('non-alfaclub surfaces still enforce HERMIT_ALLOWED_USERS', async () => {
    isHermitUserAllowedMock.mockReturnValue(false)

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'telegram:room-1',
      userId: ALICE,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toBe('Hermit access denied.')
    expect(listUserPreferencesMock).not.toHaveBeenCalled()
    expect(executeHermitCommandMock).not.toHaveBeenCalled()
    isHermitUserAllowedMock.mockReturnValue(true)
  })

  it('non-alfaclub surfaces with allowlisted sender still execute', async () => {
    isHermitUserAllowedMock.mockReturnValue(true)

    const { executeCommand } = await import('./execute.ts')
    const result = await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'telegram:room-1',
      userId: ALICE,
    })

    expect(result.ok).toBe(true)
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed alfaclub chatIds (room id too long) and treats them as non-room', async () => {
    const tooLongRoomId = 'a'.repeat(200)
    const { executeCommand } = await import('./execute.ts')
    await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: `alfaclub:${tooLongRoomId}`,
      userId: ALICE,
    })

    expect(listUserPreferencesMock).not.toHaveBeenCalled()
    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as { roomId?: string }
    expect(call.roomId).toBeUndefined()
  })

  // Regression guard for a user-reported "Hermit access denied." in
  // AlfaClub room 1043 from sender 0x64c3…94e9. PR #467 opened
  // /hermit, /meme, /gmeow to all room senders on the AlfaClub bridge;
  // this test pins the exact (room, sender, slash-command) tuple so a
  // future refactor that re-tightens the gate fails CI.
  describe('AlfaClub room 1043 — non-allowlisted slash commands stay open', () => {
    const ROOM_1043_SENDER = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    const ROOM_1043_CHAT_ID = 'alfaclub:1043'

    it.each([
      ['/hermit setup'],
      ['/hermit prefs'],
      ['/hermit lang 🇲🇽'],
      ['/hermit announce vault update'],
      ['/meme akita'],
      ['/gmeow'],
    ])('does not deny %s for a non-allowlisted room-1043 sender', async (text) => {
      isHermitUserAllowedMock.mockReturnValue(false)
      listUserPreferencesMock.mockResolvedValueOnce([])

      const { executeCommand } = await import('./execute.ts')
      const result = await executeCommand({
        groupId: 'tg-room',
        senderWallet: ROOM_1043_SENDER,
        text,
        chatId: ROOM_1043_CHAT_ID,
        userId: ROOM_1043_SENDER,
      })

      expect(result.ok).toBe(true)
      expect(result.response).not.toBe('Hermit access denied.')
      isHermitUserAllowedMock.mockReturnValue(true)
    })

    it('routes the message through the AlfaClub branch so persistPreference / listPreferences / clearPreferences are wired', async () => {
      isHermitUserAllowedMock.mockReturnValue(false)
      listUserPreferencesMock.mockResolvedValueOnce([])

      const { executeCommand } = await import('./execute.ts')
      await executeCommand({
        groupId: 'tg-room',
        senderWallet: ROOM_1043_SENDER,
        text: '/hermit setup',
        chatId: ROOM_1043_CHAT_ID,
        userId: ROOM_1043_SENDER,
      })

      // Confirm the AlfaClub-room context made it through to Hermit
      // — proves the gate did NOT deny and the resolver injected the
      // preference callbacks.
      expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
      const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as {
        roomId?: string
        persistPreference?: unknown
        listPreferences?: unknown
        clearPreferences?: unknown
      }
      expect(call.roomId).toBe('1043')
      expect(typeof call.persistPreference).toBe('function')
      expect(typeof call.listPreferences).toBe('function')
      expect(typeof call.clearPreferences).toBe('function')
      isHermitUserAllowedMock.mockReturnValue(true)
    })
  })
})

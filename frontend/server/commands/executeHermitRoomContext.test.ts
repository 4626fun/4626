/**
 * Verifies that the deterministic command executor resolves per-(room,
 * sender) Hermit preferences from the AlfaClub control plane and plumbs
 * them into `executeHermitCommand` — but only when the chat surface is
 * an AlfaClub room (chatId starts with `alfaclub:`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type HermitCallShape = {
  commandText: string
  senderAddress: string
  roomId?: string
  userPreferences?: { spanishDialect: string | null } | null
  persistPreference?: (params: {
    preferenceKey: 'hermit.spanish_dialect'
    preferenceValue: string
    updatedBy: string
  }) => Promise<void>
}

const isHermitUserAllowedMock = vi.fn(() => true)
const executeHermitCommandMock = vi.fn(async (_params: HermitCallShape) => ({
  kind: 'hermit' as const,
  provider: 'pinata' as const,
  reply: 'ok',
}))
const readUserPreferenceMock = vi.fn()
const upsertUserPreferenceMock = vi.fn(async () => true)

vi.mock('../_lib/hermit/policy.js', () => ({
  isHermitUserAllowed: isHermitUserAllowedMock,
}))

vi.mock('../_lib/hermit/skillRouter.js', () => ({
  executeHermitCommand: executeHermitCommandMock,
}))

vi.mock('../_lib/alfaclub/userPreferenceStore.js', () => ({
  readUserPreference: readUserPreferenceMock,
  upsertUserPreference: upsertUserPreferenceMock,
}))

// Stub out unrelated families so we don't pull in DB/keepr code.
vi.mock('../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: vi.fn(async () => null),
}))
vi.mock('../agent/core/resolveVaultRole.js', () => ({
  resolveVaultAccessRoleFromVault: () => 'MEMBER',
}))
vi.mock('./telegramGroupAdminGate.js', () => ({
  evaluateGroupAdminGate: vi.fn(async () => ({ allowed: true })),
}))

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('executeCommand → Hermit per-(room, sender) wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readUserPreferenceMock.mockReset()
    upsertUserPreferenceMock.mockReset()
    upsertUserPreferenceMock.mockResolvedValue(true)
    executeHermitCommandMock.mockReset()
    executeHermitCommandMock.mockResolvedValue({
      kind: 'hermit',
      provider: 'pinata',
      reply: 'ok',
    })
  })

  it('passes saved preference + roomId + persistPreference to Hermit when chatId is an alfaclub: room', async () => {
    readUserPreferenceMock.mockResolvedValueOnce({
      roomId: '12345',
      senderAddress: ALICE,
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: 'argentina',
      updatedBy: 'hermit.flag',
      updatedAt: '2026-05-01T00:00:00Z',
    })

    const { executeCommand } = await import('./execute.ts')
    await executeCommand({
      groupId: 'tg-room',
      senderWallet: ALICE,
      text: '/hermit announce vault update',
      chatId: 'alfaclub:12345',
      userId: ALICE,
    })

    expect(readUserPreferenceMock).toHaveBeenCalledWith({
      roomId: '12345',
      senderAddress: ALICE,
      preferenceKey: 'hermit.spanish_dialect',
    })
    expect(executeHermitCommandMock).toHaveBeenCalledTimes(1)
    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as {
      roomId?: string
      userPreferences?: { spanishDialect: string | null } | null
      persistPreference?: unknown
    }
    expect(call.roomId).toBe('12345')
    expect(call.userPreferences).toEqual({ spanishDialect: 'argentina' })
    expect(typeof call.persistPreference).toBe('function')
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

    expect(readUserPreferenceMock).not.toHaveBeenCalled()
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
    readUserPreferenceMock.mockRejectedValueOnce(new Error('db down'))

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
    readUserPreferenceMock.mockResolvedValueOnce(null)

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
    expect(readUserPreferenceMock).not.toHaveBeenCalled()
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

    expect(readUserPreferenceMock).not.toHaveBeenCalled()
    const call = (executeHermitCommandMock.mock.calls[0]?.[0] as HermitCallShape) as { roomId?: string }
    expect(call.roomId).toBeUndefined()
  })
})

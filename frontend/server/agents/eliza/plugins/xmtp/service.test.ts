import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlfaClubRoomChannelBinding } from '../../../../_lib/alfaclub/roomChannelBindings.js'

const {
  AgentCreateMock,
  createUserMock,
  createSignerMock,
  filterFromSelfMock,
  getInstallationInfoMock,
  lookupRoomBindingByXmtpGroupMock,
  relayXmtpMessageToAlfaClubRoomMock,
  sendAlfaClubRoomTextMock,
} = vi.hoisted(() => ({
  AgentCreateMock: vi.fn(),
  createUserMock: vi.fn(() => ({ id: 'user' })),
  createSignerMock: vi.fn(() => ({ id: 'signer' })),
  filterFromSelfMock: vi.fn(() => false),
  getInstallationInfoMock: vi.fn(async () => ({ totalInstallations: 1 })),
  lookupRoomBindingByXmtpGroupMock: vi.fn(
    async (): Promise<{ available: boolean; binding: AlfaClubRoomChannelBinding | null }> => ({
      available: true,
      binding: null,
    }),
  ),
  relayXmtpMessageToAlfaClubRoomMock: vi.fn(async () => true),
  sendAlfaClubRoomTextMock: vi.fn(async () => ({ lane: 'bot', messageId: 'room-message' })),
}))

vi.mock('@xmtp/agent-sdk', () => ({
  Agent: {
    create: AgentCreateMock,
  },
  createUser: createUserMock,
  createSigner: createSignerMock,
  filter: {
    fromSelf: filterFromSelfMock,
  },
  getInstallationInfo: getInstallationInfoMock,
}))

vi.mock('../../../../_lib/alfaclub/roomChannelBindings.js', () => ({
  lookupEnabledAlfaClubRoomChannelBindingByXmtpGroup: lookupRoomBindingByXmtpGroupMock,
}))

vi.mock('../../../../_lib/alfaclub/roomChannelBridge.js', () => ({
  relayXmtpMessageToAlfaClubRoom: relayXmtpMessageToAlfaClubRoomMock,
}))

vi.mock('../../../../_lib/alfaclub/chatBridge.js', () => ({
  sendAlfaClubRoomText: sendAlfaClubRoomTextMock,
}))

describe('xmtp service lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lookupRoomBindingByXmtpGroupMock.mockResolvedValue({ available: true, binding: null })
    relayXmtpMessageToAlfaClubRoomMock.mockResolvedValue(true)
    delete process.env.ELIZA_XMTP_START_MAX_RETRIES
    delete process.env.ELIZA_XMTP_START_RETRY_BASE_MS
    delete process.env.XMTP_DB_ENCRYPTION_KEY
  })

  it('does not report running when start fails', async () => {
    process.env.ELIZA_XMTP_START_MAX_RETRIES = '1'
    process.env.ELIZA_XMTP_START_RETRY_BASE_MS = '1'

    const stopMock = vi.fn(async () => {})
    const startMock = vi.fn(async () => {
      throw new Error('network timeout')
    })
    const agent = {
      address: '0x1111111111111111111111111111111111111111',
      client: {
        revokeAllOtherInstallations: vi.fn(async () => {}),
      },
      on: vi.fn(),
      start: startMock,
      stop: stopMock,
    }
    AgentCreateMock.mockResolvedValue(agent as any)

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })

    await expect(service.start()).rejects.toBeTruthy()
    expect(service.isRunning).toBe(false)
    expect(service.address).toBeUndefined()
    expect(stopMock).toHaveBeenCalledTimes(1)
  })

  it('preserves non-retryable create errors and avoids redundant retries', async () => {
    process.env.ELIZA_XMTP_START_MAX_RETRIES = '3'
    process.env.ELIZA_XMTP_START_RETRY_BASE_MS = '1'

    AgentCreateMock.mockRejectedValue(new Error('xmtp_owner_index_resolution_failed: signer is not owner'))

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })

    await expect(service.start()).rejects.toMatchObject({
      message: expect.stringContaining('xmtp_owner_index_resolution_failed'),
      retryable: false,
      details: expect.objectContaining({
        maxAttempts: 3,
        lastError: expect.stringContaining('xmtp_owner_index_resolution_failed'),
      }),
    })
    expect(AgentCreateMock).toHaveBeenCalledTimes(1)
    expect(service.isRunning).toBe(false)
  })

  it('keeps retryable create errors retryable with bounded attempts', async () => {
    process.env.ELIZA_XMTP_START_MAX_RETRIES = '3'
    process.env.ELIZA_XMTP_START_RETRY_BASE_MS = '1'

    AgentCreateMock.mockRejectedValue(new Error('network timeout while creating agent'))

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })

    await expect(service.start()).rejects.toMatchObject({
      message: expect.stringContaining('network timeout'),
      retryable: true,
      details: expect.objectContaining({
        maxAttempts: 3,
      }),
    })
    expect(AgentCreateMock).toHaveBeenCalledTimes(3)
    expect(service.isRunning).toBe(false)
  })

  it('falls back to env db key immediately on unsupported format', async () => {
    process.env.ELIZA_XMTP_START_MAX_RETRIES = '1'
    process.env.ELIZA_XMTP_START_RETRY_BASE_MS = '1'
    process.env.XMTP_DB_ENCRYPTION_KEY = `0x${'11'.repeat(32)}`

    const stopMock = vi.fn(async () => {})
    const startMock = vi.fn(async () => {})
    const agent = {
      address: '0x2222222222222222222222222222222222222222',
      client: {
        revokeAllOtherInstallations: vi.fn(async () => {}),
      },
      on: vi.fn(),
      start: startMock,
      stop: stopMock,
    }

    AgentCreateMock.mockImplementation(async (_signer, opts: any) => {
      if (!opts?.dbEncryptionKey) {
        throw new Error('unsupported file format')
      }
      return agent as any
    })

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })

    await expect(service.start()).resolves.toBeUndefined()
    expect(AgentCreateMock).toHaveBeenCalledTimes(2)
    expect((AgentCreateMock.mock.calls[0]?.[1] as any)?.dbEncryptionKey).toBeUndefined()
    expect((AgentCreateMock.mock.calls[1]?.[1] as any)?.dbEncryptionKey).toBe(process.env.XMTP_DB_ENCRYPTION_KEY)
    expect(service.isRunning).toBe(true)
    await service.stop()
  })

  it('drops duplicate inbound messages before invoking command handler', async () => {
    let textHandler: ((ctx: any) => Promise<void>) | null = null
    const sendTextMock = vi.fn(async () => {})
    const onMock = vi.fn((event: string, handler: (ctx: any) => Promise<void>) => {
      if (event === 'text') textHandler = handler
    })

    const agent = {
      address: '0x3333333333333333333333333333333333333333',
      client: {
        revokeAllOtherInstallations: vi.fn(async () => {}),
        preferences: {
          fetchInboxStates: vi.fn(async () => [
            {
              identifiers: [
                {
                  identifierKind: 0,
                  identifier: '0x4444444444444444444444444444444444444444',
                },
              ],
            },
          ]),
        },
      },
      on: onMock,
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    }
    AgentCreateMock.mockResolvedValue(agent as any)

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })
    const messageHandler = vi.fn(async () => 'pong')
    service.setMessageHandler(messageHandler)

    await service.start()
    expect(textHandler).toBeTypeOf('function')

    const ctx = {
      message: {
        id: 'msg-abc',
        content: '/keepr status',
        senderInboxId: 'inbox-1',
        sentAt: new Date('2026-03-15T10:00:00.000Z'),
      },
      conversation: {
        id: 'conv-1',
        sendText: sendTextMock,
      },
      isDm: () => true,
      client: {},
    }

    if (!textHandler) throw new Error('text_handler_missing')
    const invokeTextHandler = textHandler as unknown as (ctx: any) => Promise<void>
    await invokeTextHandler(ctx as any)
    await invokeTextHandler(ctx as any)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(messageHandler).toHaveBeenCalledTimes(1)
    expect(sendTextMock).toHaveBeenCalledTimes(1)

    await service.stop()
  })

  it('retries duplicate key after transient handler failure', async () => {
    let textHandler: ((ctx: any) => Promise<void>) | null = null
    const sendTextMock = vi.fn(async () => {})
    const onMock = vi.fn((event: string, handler: (ctx: any) => Promise<void>) => {
      if (event === 'text') textHandler = handler
    })

    const agent = {
      address: '0x3333333333333333333333333333333333333333',
      client: {
        revokeAllOtherInstallations: vi.fn(async () => {}),
        preferences: {
          fetchInboxStates: vi.fn(async () => [
            {
              identifiers: [
                {
                  identifierKind: 0,
                  identifier: '0x4444444444444444444444444444444444444444',
                },
              ],
            },
          ]),
        },
      },
      on: onMock,
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    }
    AgentCreateMock.mockResolvedValue(agent as any)

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({
      signer: { id: 'mock-signer' } as any,
      env: 'production',
      dbPath: null,
    })

    const messageHandler = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary downstream failure'))
      .mockResolvedValueOnce('retry succeeded')
    service.setMessageHandler(messageHandler)

    await service.start()
    expect(textHandler).toBeTypeOf('function')

    const ctx = {
      message: {
        id: 'msg-retry',
        content: '/keepr status',
        senderInboxId: 'inbox-1',
        sentAt: new Date('2026-03-15T10:00:00.000Z'),
      },
      conversation: {
        id: 'conv-1',
        sendText: sendTextMock,
      },
      isDm: () => true,
      client: {},
    }

    if (!textHandler) throw new Error('text_handler_missing')
    const invokeTextHandler = textHandler as unknown as (ctx: any) => Promise<void>
    await invokeTextHandler(ctx as any)
    await vi.waitFor(() => {
      expect(messageHandler).toHaveBeenCalledTimes(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    await invokeTextHandler(ctx as any)
    await vi.waitFor(() => {
      expect(messageHandler).toHaveBeenCalledTimes(2)
    })
    await vi.waitFor(() => {
      expect(sendTextMock).toHaveBeenCalledTimes(1)
    })

    expect(messageHandler).toHaveBeenCalledTimes(2)
    expect(sendTextMock).toHaveBeenCalledTimes(1)
    expect(sendTextMock).toHaveBeenCalledWith('retry succeeded')

    await service.stop()
  })

  it('routes a configured bridge group with resolved sender metadata and no AI reply', async () => {
    let textHandler: ((ctx: any) => Promise<void>) | null = null
    const senderAddress = '0x4444444444444444444444444444444444444444'
    const fetchInboxStatesMock = vi.fn(async () => [] as Array<{ identifiers: unknown[] }>)
    const agent = {
      address: '0x3333333333333333333333333333333333333333',
      client: {
        revokeAllOtherInstallations: vi.fn(async () => {}),
        preferences: {
          fetchInboxStates: fetchInboxStatesMock,
        },
      },
      on: vi.fn((event: string, handler: (ctx: any) => Promise<void>) => {
        if (event === 'text') textHandler = handler
      }),
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    }
    AgentCreateMock.mockResolvedValue(agent as any)
    lookupRoomBindingByXmtpGroupMock.mockResolvedValue({
      available: true,
      binding: {
        roomId: '202',
        enabled: true,
        rolloutStatus: 'enabled',
        telegram: { enabled: false, chatId: null, threadId: null },
        xmtp: {
          enabled: true,
          groupId: 'group-202',
          syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000000202',
        },
        createdAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    })

    const { XmtpService } = await import('./service.ts')
    const service = new XmtpService({ signer: { id: 'mock-signer' }, dbPath: null })
    const aiHandler = vi.fn()
    service.setMessageHandler(aiHandler)
    await service.start()

    if (!textHandler) throw new Error('text_handler_missing')
    const bridgeContext = {
      message: {
        id: 'xmtp-message-202',
        content: 'bridge text',
        senderInboxId: 'inbox-202',
        sentAt: new Date('2026-07-12T12:00:00.000Z'),
      },
      conversation: { id: 'group-202', sendText: vi.fn() },
      isDm: () => false,
      client: {},
    }
    await (textHandler as (ctx: any) => Promise<void>)(bridgeContext)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(relayXmtpMessageToAlfaClubRoomMock).not.toHaveBeenCalled()

    fetchInboxStatesMock.mockResolvedValue([{
      identifiers: [{ identifierKind: 0, identifier: senderAddress }],
    }])
    await (textHandler as (ctx: any) => Promise<void>)({
      ...bridgeContext,
      message: { ...bridgeContext.message, id: 'xmtp-message-203' },
    })

    await vi.waitFor(() => {
      expect(relayXmtpMessageToAlfaClubRoomMock).toHaveBeenCalledTimes(1)
    })
    expect(relayXmtpMessageToAlfaClubRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'group-202',
        messageId: 'xmtp-message-203',
        senderInboxId: 'inbox-202',
        senderAddress,
      }),
    )
    expect(aiHandler).not.toHaveBeenCalled()
    await service.stop()
  })
})


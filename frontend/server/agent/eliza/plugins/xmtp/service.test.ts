import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  AgentCreateMock,
  createUserMock,
  createSignerMock,
  filterFromSelfMock,
  getInstallationInfoMock,
} = vi.hoisted(() => ({
  AgentCreateMock: vi.fn(),
  createUserMock: vi.fn(() => ({ id: 'user' })),
  createSignerMock: vi.fn(() => ({ id: 'signer' })),
  filterFromSelfMock: vi.fn(() => false),
  getInstallationInfoMock: vi.fn(async () => ({ totalInstallations: 1 })),
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

describe('xmtp service lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})


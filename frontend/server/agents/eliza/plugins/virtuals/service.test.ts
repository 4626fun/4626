import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const entryListeners = new Set<(...args: unknown[]) => void>()
  let transportTimer: ReturnType<typeof setInterval> | null = null

  const runFundingOiRegimeJob = vi.fn(async () => ({
    symbol: 'BTC',
    regime: 'crowded-longs',
    confidence: 87,
    shadowOnly: true,
    responseText: 'Funding/OI regime: CROWDED-LONGS. Advisory only.',
  }))

  const candidate = {
    sessions: [],
    on: vi.fn((_event: string, listener: (...args: unknown[]) => void) => {
      entryListeners.add(listener)
    }),
    start: vi.fn(async (onConnected?: () => void) => {
      transportTimer = setInterval(() => undefined, 1_000)
      onConnected?.()
    }),
    stop: vi.fn(async () => {
      if (transportTimer) clearInterval(transportTimer)
      transportTimer = null
      entryListeners.clear()
    }),
    getAddress: vi.fn<() => Promise<string>>(),
  }

  return {
    candidate,
    entryListeners,
    createAgent: vi.fn(async () => candidate),
    createProvider: vi.fn(async () => ({})),
    runFundingOiRegimeJob,
  }
})

vi.mock('@virtuals-protocol/acp-node-v2', () => ({
  AcpAgent: { create: mocks.createAgent },
  PrivyAlchemyEvmProviderAdapter: { create: mocks.createProvider },
  getEvmChainByChainId: vi.fn(() => ({ id: 8453 })),
}))

vi.mock('../../../../_lib/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('./backtestJobs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./backtestJobs.js')>()),
  runFundingOiRegimeJob: mocks.runFundingOiRegimeJob,
}))

import { VirtualsAcpService } from './service.js'

const ENV_KEYS = [
  'VIRTUALS_ACP_ENABLED',
  'VIRTUALS_ACP_WALLET_ADDRESS',
  'VIRTUALS_ACP_WALLET_ID',
  'VIRTUALS_ACP_SIGNER_PRIVATE_KEY',
  'VIRTUALS_ACP_AUTO_LLM',
] as const

const savedEnv = new Map<string, string | undefined>()

describe('VirtualsAcpService failed startup cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.entryListeners.clear()
    savedEnv.clear()
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key])
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = '0x00000000000000000000000000000000000000aa'
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = `0x${'11'.repeat(32)}`
    process.env.VIRTUALS_ACP_AUTO_LLM = '1'
    mocks.candidate.getAddress.mockRejectedValue(new Error('address configuration failed'))
  })

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    vi.useRealTimers()
  })

  it('stops and clears a started candidate when post-start configuration fails', async () => {
    const service = new VirtualsAcpService()

    const result = await service.start()

    expect(result).toEqual({ started: false, reason: 'address configuration failed' })
    expect(mocks.candidate.start).toHaveBeenCalledOnce()
    expect(mocks.candidate.stop).toHaveBeenCalledOnce()
    expect(mocks.entryListeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(service.getStatus()).toMatchObject({
      running: false,
      ready: false,
      startedAt: null,
      agentAddress: null,
      chainId: null,
      sessions: [],
      lastError: 'address configuration failed',
    })
    const internals = service as unknown as {
      config: unknown
      toolQuota: unknown
      inFlightSessions: Set<string>
    }
    expect(internals.config).toBeNull()
    expect(internals.toolQuota).toBeNull()
    expect(internals.inFlightSessions.size).toBe(0)
  })
})

describe('VirtualsAcpService funding/OI shadow offering route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.entryListeners.clear()
    savedEnv.clear()
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key])
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = '0x00000000000000000000000000000000000000aa'
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = `0x${'11'.repeat(32)}`
    process.env.VIRTUALS_ACP_AUTO_LLM = '1'
    mocks.candidate.getAddress.mockResolvedValue('0x00000000000000000000000000000000000000aa')
  })

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    vi.useRealTimers()
  })

  it('routes a funded purchase through analysis and formally submits the deliverable', async () => {
    const sendMessage = vi.fn(async () => {})
    const submit = vi.fn(async () => {})
    const session = {
      jobId: 'job-123',
      chainId: 8453,
      roles: ['seller'],
      status: 'funded',
      job: {
        description: 'fundingOiRegimeShadow',
        status: 'FUNDED',
        budget: { amount: 0.1 },
      },
      shouldRespond: vi.fn(() => true),
      availableTools: vi.fn(() => [{ name: 'sendMessage' }]),
      toMessages: vi.fn(async () => [{ role: 'user', content: '{"symbol":"BTC"}' }]),
      sendMessage,
      submit,
    }
    const service = new VirtualsAcpService()
    expect(await service.start()).toEqual({ started: true })

    const listener = [...mocks.entryListeners][0]
    expect(listener).toBeDefined()
    listener?.(session, { kind: 'message', contentType: 'requirement' })
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())

    expect(mocks.runFundingOiRegimeJob).toHaveBeenCalledWith('BTC', {
      idempotencyKey: 'virtuals:8453:job-123',
    })
    expect(sendMessage).toHaveBeenCalledWith(
      'Funding/OI regime: CROWDED-LONGS. Advisory only.',
      'text',
    )
    expect(submit).toHaveBeenCalledWith('Funding/OI regime: CROWDED-LONGS. Advisory only.')
    await service.stop()
  })
})

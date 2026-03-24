import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/session/_start.ts'
import { createMockReq, createMockRes } from './helpers'

const { readJsonBodyMock, readSessionFromRequestMock, readSiwaAgentFromRequestMock } = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readSessionFromRequestMock: vi.fn(() => ({ address: '0xsession' })),
  readSiwaAgentFromRequestMock: vi.fn(() => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: readJsonBodyMock,
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://v1.4626.fun'),
}))

const readContractMock = vi.fn()
vi.mock('viem', () => ({
  getAddress: (value: string) => String(value).toLowerCase(),
  encodeAbiParameters: vi.fn(() => '0xownerbytes'),
  createPublicClient: vi.fn(() => ({ readContract: readContractMock })),
  http: vi.fn(() => ({ transport: 'http' })),
}))

vi.mock('viem/chains', () => ({
  base: {},
}))

function createResponse(status: number, payload: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  } as any
}

describe('deploy session start wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSessionFromRequestMock.mockReturnValue({ address: '0xsession' })
    readSiwaAgentFromRequestMock.mockReturnValue(null)
  })

  it('returns 401 for unauthenticated requests', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null as any)

    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('Not authenticated')
  })

  it('passes through create failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createResponse(400, { success: false, error: 'bad_create' })),
    )

    const req = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x0000000000000000000000000000000000000002',
        creatorToken: '0x0000000000000000000000000000000000000003',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('bad_create')
  })

  it('accepts SIWA auth when session cookie is missing', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null as any)
    readSiwaAgentFromRequestMock.mockReturnValueOnce({
      address: '0x0000000000000000000000000000000000000001',
      agentId: 12,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      chainId: 8453,
    } as any)

    const fetchMock = vi.fn(async () => createResponse(400, { success: false, error: 'bad_create' }))
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-siwa-receipt': 'receipt-token' },
      body: {
        smartWallet: '0x0000000000000000000000000000000000000002',
        creatorToken: '0x0000000000000000000000000000000000000003',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('bad_create')
  })

  it('returns wait_for_owner_install when session owner is not installed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) =>
        createResponse(200, {
          success: true,
          data: {
            sessionId: 'sess_1',
            sessionSignerAddress: '0x00000000000000000000000000000000000000f1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        })),
    )

    readContractMock.mockImplementation(async ({ functionName }: any) => {
      if (functionName === 'ownerCount') return 1n
      return '0xnotownerbytes'
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x0000000000000000000000000000000000000002',
        creatorToken: '0x0000000000000000000000000000000000000003',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ownerInstalled).toBe(false)
    expect(res.body?.data?.continueTriggered).toBe(false)
    expect(res.body?.data?.nextAction).toBe('wait_for_owner_install')
  })

  it('continues immediately when session owner is already installed', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/deploy/session/create')) {
        return createResponse(200, {
          success: true,
          data: {
            sessionId: 'sess_1',
            sessionSignerAddress: '0x00000000000000000000000000000000000000f1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        })
      }
      return createResponse(200, { success: true, data: { id: 'sess_1', step: 'phase1_sent' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    readContractMock.mockImplementation(async ({ functionName }: any) => {
      if (functionName === 'ownerCount') return 1n
      return '0xownerbytes'
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x0000000000000000000000000000000000000002',
        creatorToken: '0x0000000000000000000000000000000000000003',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ownerInstalled).toBe(true)
    expect(res.body?.data?.continueTriggered).toBe(true)
    expect(res.body?.data?.nextAction).toBe('poll_status')
  })
})

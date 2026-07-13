import { beforeEach, describe, expect, it, vi } from 'vitest'

const readPrincipalMock = vi.fn()
const listRoomsMock = vi.fn()

vi.mock('@4626/server-core', () => ({
  RATE_LIMITS: { read: { limit: 100, windowMs: 60_000 } },
  checkRateLimit: () => ({ allowed: true, resetAt: Date.now() + 60_000 }),
  getClientIp: () => '127.0.0.1',
  handleOptions: () => false,
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  readRequestPrincipalAddress: (...args: unknown[]) => readPrincipalMock(...args),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/alfaclubMyRooms.js', () => ({
  listMyAlfaClubRoomIds: (...args: unknown[]) => listRoomsMock(...args),
}))

function createResponse() {
  const response = {
    statusCode: 200,
    body: null as unknown,
    setHeader: vi.fn(),
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode
      return response
    }),
    json: vi.fn((body: unknown) => {
      response.body = body
      return response
    }),
  }
  return response
}

describe('wallet friend-key holdings handler', () => {
  beforeEach(() => {
    readPrincipalMock.mockReset()
    listRoomsMock.mockReset()
  })

  it('requires the established request principal', async () => {
    readPrincipalMock.mockReturnValue(null)
    const { default: handler } = await import('../_handlers/wallet/_friendKeyHoldings.js')
    const response = createResponse()

    await handler({ method: 'GET', headers: {} } as never, response as never)

    expect(response.statusCode).toBe(401)
    expect(listRoomsMock).not.toHaveBeenCalled()
  })

  it('resolves holdings from the authenticated account context', async () => {
    const principal = '0x1111111111111111111111111111111111111111'
    readPrincipalMock.mockReturnValue(principal)
    listRoomsMock.mockResolvedValue({
      canonicalCswAddress: '0x2222222222222222222222222222222222222222',
      roomIds: ['1659', '9'],
    })
    const { default: handler } = await import('../_handlers/wallet/_friendKeyHoldings.js')
    const response = createResponse()

    await handler({ method: 'GET', headers: {} } as never, response as never)

    expect(listRoomsMock).toHaveBeenCalledWith(principal)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: { roomIds: ['1659', '9'] },
    })
  })
})

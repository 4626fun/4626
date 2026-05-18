import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  setCorsMock,
  setNoStoreMock,
  getSessionAddressMock,
  isAdminAddressMock,
  readBoundedJsonObjectBodyMock,
  guardAgentApiRequestMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  requireKeeprApiKeyMock,
  upsertAlfaClubRoomAccessPolicyMock,
  preloadAlfaClubRoomAccessPolicyPoolAddressMock,
  joinAlfaClubRoomAccessMock,
  readAlfaClubRoomAccessPolicyMock,
  readAlfaClubRoomAccessMembershipMock,
  recheckAlfaClubRoomAccessMembershipsMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  readBoundedJsonObjectBodyMock: vi.fn(async () => ({})),
  guardAgentApiRequestMock: vi.fn(async () => ({ ok: true, auth: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  requireKeeprApiKeyMock: vi.fn(() => true),
  upsertAlfaClubRoomAccessPolicyMock: vi.fn(),
  preloadAlfaClubRoomAccessPolicyPoolAddressMock: vi.fn(),
  joinAlfaClubRoomAccessMock: vi.fn(),
  readAlfaClubRoomAccessPolicyMock: vi.fn(),
  readAlfaClubRoomAccessMembershipMock: vi.fn(),
  recheckAlfaClubRoomAccessMembershipsMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: handleOptionsMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  guardAgentApiRequest: guardAgentApiRequestMock,
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  requireKeeprApiKey: requireKeeprApiKeyMock,
  RATE_LIMITS: {
    workspaceActions: { windowMs: 60_000, maxRequests: 100 },
  },
}))

vi.mock('../../server/_lib/alfaclub/roomAccessPolicy.js', () => ({
  upsertAlfaClubRoomAccessPolicy: upsertAlfaClubRoomAccessPolicyMock,
  preloadAlfaClubRoomAccessPolicyPoolAddress: preloadAlfaClubRoomAccessPolicyPoolAddressMock,
  joinAlfaClubRoomAccess: joinAlfaClubRoomAccessMock,
  readAlfaClubRoomAccessPolicy: readAlfaClubRoomAccessPolicyMock,
  readAlfaClubRoomAccessMembership: readAlfaClubRoomAccessMembershipMock,
  recheckAlfaClubRoomAccessMemberships: recheckAlfaClubRoomAccessMembershipsMock,
}))

import roomAccessPolicyHandler from '../_handlers/v1/alfaclub/_room-access-policy.ts'
import roomAccessJoinHandler from '../_handlers/v1/alfaclub/_room-access-join.ts'
import roomAccessStatusHandler from '../_handlers/v1/alfaclub/_room-access-status.ts'
import roomAccessRecheckHandler from '../_handlers/v1/alfaclub/_room-access-recheck.ts'

describe('AlfaClub room-access endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    isAdminAddressMock.mockReturnValue(true)
    preloadAlfaClubRoomAccessPolicyPoolAddressMock.mockResolvedValue('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    upsertAlfaClubRoomAccessPolicyMock.mockResolvedValue({
      roomId: '1043',
      tokenId: '77',
      creatorCoinAddress: '0x1111111111111111111111111111111111111111',
      poolAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      keyAmountRaw: '1',
      enterThresholdBps: 10000,
      exitThresholdBps: 9000,
      graceHours: 24,
      enabled: true,
    })
    joinAlfaClubRoomAccessMock.mockResolvedValue({
      policy: { roomId: '1043', enabled: true },
      membership: { roomId: '1043', walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', status: 'active' },
      eligible: true,
      reason: 'balance>=enter_threshold',
    })
    readAlfaClubRoomAccessPolicyMock.mockResolvedValue({
      roomId: '1043',
      enabled: true,
    })
    readAlfaClubRoomAccessMembershipMock.mockResolvedValue({
      roomId: '1043',
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'active',
    })
    recheckAlfaClubRoomAccessMembershipsMock.mockResolvedValue({
      checked: 12,
      autoEntered: 2,
      removed: 1,
      stale: 0,
    })
  })

  it('room-access/policy requires admin session', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomAccessPolicyHandler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })

  it('room-access/policy upserts and returns policy', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({
      roomId: '1043',
      tokenId: '77',
      creatorCoinAddress: '0x1111111111111111111111111111111111111111',
      keyAmountRaw: '1',
      enterThresholdBps: 10000,
      exitThresholdBps: 9000,
      graceHours: 24,
      enabled: true,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomAccessPolicyHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(upsertAlfaClubRoomAccessPolicyMock).toHaveBeenCalledTimes(1)
  })

  it('room-access/join returns 403 when not eligible', async () => {
    joinAlfaClubRoomAccessMock.mockResolvedValueOnce({
      policy: { roomId: '1043', enabled: true },
      membership: { roomId: '1043', walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', status: 'pending' },
      eligible: false,
      reason: 'balance<enter_threshold',
    })
    const req = createMockReq({ method: 'POST', query: { roomId: '1043' } })
    const res = createMockRes()
    await roomAccessJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('not_eligible')
  })

  it('room-access/status returns policy + membership payload', async () => {
    const req = createMockReq({ method: 'GET', query: { roomId: '1043' } })
    const res = createMockRes()
    await roomAccessStatusHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.policy?.roomId).toBe('1043')
    expect(res.body?.data?.membership?.status).toBe('active')
  })

  it('room-access/status supports admin wallet override', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { roomId: '1043', wallet: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    const res = createMockRes()
    await roomAccessStatusHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(readAlfaClubRoomAccessMembershipMock).toHaveBeenCalledWith({
      roomId: '1043',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    })
  })

  it('room-access/join supports admin wallet override', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { roomId: '1043', wallet: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    const res = createMockRes()
    await roomAccessJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(joinAlfaClubRoomAccessMock).toHaveBeenCalledWith({
      roomId: '1043',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    })
  })

  it('room-access/recheck requires keepr api key', async () => {
    requireKeeprApiKeyMock.mockReturnValueOnce(false)
    const req = createMockReq({ method: 'POST', query: { roomId: '1043' } })
    const res = createMockRes()
    await roomAccessRecheckHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(recheckAlfaClubRoomAccessMembershipsMock).not.toHaveBeenCalled()
  })

  it('room-access/recheck returns lifecycle counts', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({ limit: 50 })
    const req = createMockReq({ method: 'POST', query: { roomId: '1043' } })
    const res = createMockRes()
    await roomAccessRecheckHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.checked).toBe(12)
    expect(res.body?.data?.autoEntered).toBe(2)
  })
})

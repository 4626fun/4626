import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  getSessionAddressMock,
  readBoundedJsonObjectBodyMock,
  inspectCreatorCoinLinkMock,
  readCreatorCoinLinkStatusMock,
  issueCreatorCoinLinkChallengeMock,
  consumeCreatorCoinLinkChallengeMock,
  persistCreatorCoinLinkMock,
  verifyCswWalletSignatureMock,
} = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(),
  readBoundedJsonObjectBodyMock: vi.fn(),
  inspectCreatorCoinLinkMock: vi.fn(),
  readCreatorCoinLinkStatusMock: vi.fn(),
  issueCreatorCoinLinkChallengeMock: vi.fn(),
  consumeCreatorCoinLinkChallengeMock: vi.fn(),
  persistCreatorCoinLinkMock: vi.fn(),
  verifyCswWalletSignatureMock: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  checkDurableRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60_000,
  })),
  enforceCookieSessionTrustedOrigin: vi.fn(() => false),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getSessionAddress: getSessionAddressMock,
  handleOptions: vi.fn(() => false),
  RATE_LIMITS: { cswLink: { windowMs: 60_000, maxRequests: 10 } },
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/creatorCoinLink.js', () => {
  class CreatorCoinLinkError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
      message: string,
    ) {
      super(message)
    }
  }
  return {
    CreatorCoinLinkError,
    inspectCreatorCoinLink: inspectCreatorCoinLinkMock,
    readCreatorCoinLinkStatus: readCreatorCoinLinkStatusMock,
    issueCreatorCoinLinkChallenge: issueCreatorCoinLinkChallengeMock,
    consumeCreatorCoinLinkChallenge: consumeCreatorCoinLinkChallengeMock,
    persistCreatorCoinLink: persistCreatorCoinLinkMock,
  }
})

vi.mock('../../server/_lib/zora/cswGateVerification.js', () => ({
  verifyCswWalletSignature: verifyCswWalletSignatureMock,
}))

import challengeHandler from '../_handlers/v1/alfaclub/_creator-coin-challenge'
import statusHandler from '../_handlers/v1/alfaclub/_creator-coin-status'
import verifyHandler from '../_handlers/v1/alfaclub/_creator-coin-verify'

const SESSION = '0x1000000000000000000000000000000000000000'
const COIN = '0x3000000000000000000000000000000000000000'

describe('AlfaClub Creator Coin link endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue(SESSION)
    readCreatorCoinLinkStatusMock.mockResolvedValue({ status: null, link: null })
    inspectCreatorCoinLinkMock.mockResolvedValue({
      status: 'verified_owner',
      verificationMethod: 'direct_owner',
      roomId: '1659',
      tokenId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: SESSION,
    })
    issueCreatorCoinLinkChallengeMock.mockResolvedValue({
      nonce: 'nonce',
      message: 'message',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    consumeCreatorCoinLinkChallengeMock.mockResolvedValue({
      row: {
        profileId: 7,
        roomId: '1659',
        tokenId: '1659',
        creatorCoinAddress: COIN,
        executionAddress: SESSION,
      },
      message: 'message',
    })
    verifyCswWalletSignatureMock.mockResolvedValue({
      ok: true,
      contractValidated: true,
      recoveredSigner: SESSION,
    })
    persistCreatorCoinLinkMock.mockResolvedValue({
      verificationMethod: 'direct_owner',
      creatorCoinAddress: COIN,
    })
  })

  it('requires an authenticated 4626 session', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const req = createMockReq({ method: 'GET', query: { roomId: '1659' } })
    const res = createMockRes()
    await statusHandler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })

  it('returns the durable room link status', async () => {
    const req = createMockReq({ method: 'GET', query: { roomId: '1659' } })
    const res = createMockRes()
    await statusHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(readCreatorCoinLinkStatusMock).toHaveBeenCalledWith({
      sessionAddress: SESSION,
      roomId: '1659',
    })
  })

  it('inspects authority before issuing a challenge', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValue({
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: SESSION,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await challengeHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(inspectCreatorCoinLinkMock).toHaveBeenCalledTimes(1)
    expect(issueCreatorCoinLinkChallengeMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid wallet signature without persisting', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValue({
      nonce: 'nonce',
      signature: `0x${'11'.repeat(65)}`,
    })
    verifyCswWalletSignatureMock.mockResolvedValueOnce({
      ok: false,
      contractValidated: false,
      recoveredSigner: null,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await verifyHandler(req as any, res as any)
    expect(res.statusCode).toBe(401)
    expect(persistCreatorCoinLinkMock).not.toHaveBeenCalled()
  })

  it('reruns authority verification after signature and persists the immutable link', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValue({
      nonce: 'nonce',
      signature: `0x${'11'.repeat(65)}`,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await verifyHandler(req as any, res as any)
    expect(res.statusCode).toBe(201)
    expect(inspectCreatorCoinLinkMock).toHaveBeenCalledWith({
      sessionAddress: SESSION,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: SESSION,
    })
    expect(persistCreatorCoinLinkMock).toHaveBeenCalledTimes(1)
  })
})

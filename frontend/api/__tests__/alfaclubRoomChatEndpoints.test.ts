import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  setCorsMock,
  setNoStoreMock,
  getSessionAddressMock,
  readBoundedJsonObjectBodyMock,
  guardAgentApiRequestMock,
  checkRateLimitMock,
  checkDurableRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  listAlfaClubRoomChatMessagesMock,
  readAlfaClubRoomChannelBindingMock,
  resolveAuthorizedWalletProfileMock,
  resolveRoomChatViewAccessMock,
  resolveRoomChatWriteAccessMock,
  claimAlfaClubCrossChannelIngressMock,
  linkAlfaClubCrossChannelIngressMock,
  readAlfaClubChatBridgeFlagsMock,
  sendAlfaClubRoomTextMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  getSessionAddressMock: vi.fn(),
  readBoundedJsonObjectBodyMock: vi.fn(async () => ({})),
  guardAgentApiRequestMock: vi.fn(
    async (): Promise<{ ok: true; auth: { address: string } | null }> => ({
      ok: true,
      auth: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    }),
  ),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
  checkDurableRateLimitMock: vi.fn(async () => ({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  listAlfaClubRoomChatMessagesMock: vi.fn(),
  readAlfaClubRoomChannelBindingMock: vi.fn(),
  resolveAuthorizedWalletProfileMock: vi.fn(),
  resolveRoomChatViewAccessMock: vi.fn(),
  resolveRoomChatWriteAccessMock: vi.fn(),
  claimAlfaClubCrossChannelIngressMock: vi.fn(),
  linkAlfaClubCrossChannelIngressMock: vi.fn(),
  readAlfaClubChatBridgeFlagsMock: vi.fn(() => ({})),
  sendAlfaClubRoomTextMock: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: handleOptionsMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
  getSessionAddress: getSessionAddressMock,
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  guardAgentApiRequest: guardAgentApiRequestMock,
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkDurableRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    read: { windowMs: 60_000, maxRequests: 120 },
    workspaceActions: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/alfaclub/chatIngestStore.js', () => ({
  listAlfaClubRoomChatMessages: listAlfaClubRoomChatMessagesMock,
}))

vi.mock('../../server/_lib/alfaclub/roomChannelBindings.js', () => ({
  readAlfaClubRoomChannelBinding: readAlfaClubRoomChannelBindingMock,
}))

vi.mock('../../server/_lib/wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

vi.mock('../../server/_lib/alfaclub/roomChatViewAccess.js', () => ({
  resolveRoomChatViewAccess: resolveRoomChatViewAccessMock,
  resolveRoomChatWriteAccess: resolveRoomChatWriteAccessMock,
}))

vi.mock('../../server/_lib/alfaclub/crossChannelIngress.js', () => ({
  claimAlfaClubCrossChannelIngress: claimAlfaClubCrossChannelIngressMock,
  linkAlfaClubCrossChannelIngress: linkAlfaClubCrossChannelIngressMock,
}))

vi.mock('../../server/_lib/alfaclub/chatBridge.js', () => ({
  readAlfaClubChatBridgeFlags: readAlfaClubChatBridgeFlagsMock,
  sendAlfaClubRoomText: sendAlfaClubRoomTextMock,
}))

import roomChatHandler from '../_handlers/v1/alfaclub/_room-chat.ts'

describe('AlfaClub room-chat endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    listAlfaClubRoomChatMessagesMock.mockResolvedValue([
      {
        roomId: '1659',
        messageId: 'm1',
        senderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        text: 'hello',
        dateMs: 1_700_000_000_000,
        dateIso: '2023-11-14T22:13:20.000Z',
        username: 'alice',
        avatarUrl: null,
        isBot: false,
        replyId: null,
        replyText: null,
        replySender: null,
        replyUsername: null,
        origin: 'web4626',
      },
    ])
    readAlfaClubRoomChannelBindingMock.mockResolvedValue({
      roomId: '1659',
      enabled: true,
      rolloutStatus: 'enabled',
      telegram: { enabled: true, chatId: '-100', threadId: null },
      xmtp: {
        enabled: true,
        groupId: 'group-1659',
        syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000001659',
      },
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    resolveRoomChatViewAccessMock.mockResolvedValue({
      allowed: true,
      reason: 'room_key',
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      canWrite: true,
    })
    resolveRoomChatWriteAccessMock.mockResolvedValue({
      allowed: true,
      reason: 'room_key',
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      activeOwnerWalletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    claimAlfaClubCrossChannelIngressMock.mockResolvedValue({
      claimed: true,
      ingress: { id: 'ing-1' },
    })
    linkAlfaClubCrossChannelIngressMock.mockResolvedValue({ id: 'ing-1' })
    sendAlfaClubRoomTextMock.mockResolvedValue({
      lane: 'bot_token_without_reply_id',
      messageId: 'alfaclub-msg-1',
    })
  })

  it('GET returns messages, channel flags, and chatAccess for an authenticated session', async () => {
    const req = createMockReq({ method: 'GET', query: { roomId: '1659', limit: '25' } })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(listAlfaClubRoomChatMessagesMock).toHaveBeenCalledWith({
      roomId: '1659',
      limit: 25,
      beforeMessageId: null,
      beforeDateMs: null,
    })
    expect(res.body?.data?.messages?.[0]?.origin).toBe('web4626')
    expect(res.body?.data?.channels).toMatchObject({
      enabled: true,
      telegramEnabled: true,
      xmtpEnabled: true,
    })
    expect(res.body?.data?.chatAccess).toMatchObject({
      allowed: true,
      canWrite: true,
      reason: 'room_key',
    })
  })

  it('GET allows coin-equivalent readers with canWrite false', async () => {
    resolveRoomChatViewAccessMock.mockResolvedValueOnce({
      allowed: true,
      reason: 'coin_equivalent',
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      canWrite: false,
    })
    const req = createMockReq({ method: 'GET', query: { roomId: '1659' } })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.chatAccess).toMatchObject({
      allowed: true,
      reason: 'coin_equivalent',
      canWrite: false,
    })
    expect(listAlfaClubRoomChatMessagesMock).toHaveBeenCalled()
  })

  it('GET rejects unauthenticated requests before reading chat history', async () => {
    guardAgentApiRequestMock.mockResolvedValueOnce({ ok: true, auth: null })
    getSessionAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'GET', query: { roomId: '1659', limit: '1' } })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Authentication required')
    expect(listAlfaClubRoomChatMessagesMock).not.toHaveBeenCalled()
    expect(readAlfaClubRoomChannelBindingMock).not.toHaveBeenCalled()
  })

  it('GET fails closed when the ingest store is unavailable', async () => {
    listAlfaClubRoomChatMessagesMock.mockRejectedValueOnce(new Error('db_not_configured'))
    const req = createMockReq({ method: 'GET', query: { roomId: '1659' } })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('db_not_configured')
  })

  it('POST denies when canonical issuer cannot be resolved', async () => {
    resolveAuthorizedWalletProfileMock.mockResolvedValueOnce(null)
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({
      roomId: '1659',
      text: 'hi',
      clientMessageId: 'web-1',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('issuer_unavailable')
    expect(sendAlfaClubRoomTextMock).not.toHaveBeenCalled()
  })

  it('POST denies coin-only viewers without FriendKey', async () => {
    resolveRoomChatWriteAccessMock.mockResolvedValueOnce({
      allowed: false,
      reason: 'friendkey_required',
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({
      roomId: '1659',
      text: 'hi',
      clientMessageId: 'web-2',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('friendkey_required')
    expect(claimAlfaClubCrossChannelIngressMock).not.toHaveBeenCalled()
    expect(sendAlfaClubRoomTextMock).not.toHaveBeenCalled()
  })

  it('POST allows FriendKey holders to send', async () => {
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({
      roomId: '1659',
      text: '/help',
      clientMessageId: 'web-3',
      replyToMessageId: 'parent-1',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)

    expect(resolveRoomChatWriteAccessMock).toHaveBeenCalledWith({
      roomId: '1659',
      sessionAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(res.statusCode).toBe(200)
    expect(claimAlfaClubCrossChannelIngressMock).toHaveBeenCalledWith({
      sourceChannel: 'web4626',
      sourceMessageId: 'web-3',
      sourceConversationId: 'web4626:1659',
      targetRoomId: '1659',
      originalText: '/help',
    })
    expect(sendAlfaClubRoomTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '1659',
        text: '/help',
        origin: 'web4626',
        replyToMessageId: 'parent-1',
        clientMessageId: 'web4626:1659:web-3',
      }),
    )
    expect(linkAlfaClubCrossChannelIngressMock).toHaveBeenCalledWith({
      sourceChannel: 'web4626',
      sourceMessageId: 'web-3',
      alfaclubRoomId: '1659',
      alfaclubMessageId: 'alfaclub-msg-1',
      validatedProfileId: 42,
      validatedIssuer: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    expect(res.body?.data?.message?.messageId).toBe('alfaclub-msg-1')
    expect(res.body?.data?.issuer).toBe('0xcccccccccccccccccccccccccccccccccccccccc')
  })

  it('POST rejects duplicate client message ids without re-sending', async () => {
    claimAlfaClubCrossChannelIngressMock.mockResolvedValueOnce({
      claimed: false,
      ingress: { id: 'ing-dup' },
    })
    readBoundedJsonObjectBodyMock.mockResolvedValueOnce({
      roomId: '1659',
      text: 'dup',
      clientMessageId: 'web-dup',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await roomChatHandler(req as any, res as any)
    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('duplicate_client_message_id')
    expect(sendAlfaClubRoomTextMock).not.toHaveBeenCalled()
  })
})

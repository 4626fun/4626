import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readAlfaClubChatTokenMetaMock,
  readAlfaClubChatTokenMock,
  upsertAlfaClubChatTokenMock,
  clearAlfaClubChatTokenMock,
  getSessionAddressMock,
  isAdminAddressMock,
} = vi.hoisted(() => ({
  readAlfaClubChatTokenMetaMock: vi.fn(),
  readAlfaClubChatTokenMock: vi.fn(),
  upsertAlfaClubChatTokenMock: vi.fn(),
  clearAlfaClubChatTokenMock: vi.fn(),
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/chatTokenStore.js', () => ({
  readAlfaClubChatTokenMeta: readAlfaClubChatTokenMetaMock,
  readAlfaClubChatToken: readAlfaClubChatTokenMock,
  upsertAlfaClubChatToken: upsertAlfaClubChatTokenMock,
  clearAlfaClubChatToken: clearAlfaClubChatTokenMock,
}))

vi.mock('../../server/_lib/auth/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

import handler from '../_handlers/v1/alfaclub/_chat-token.ts'

const ADMIN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`

describe('/api/v1/alfaclub/chat-token', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      ALFACLUB_CHAT_JWT: '',
    })
    getSessionAddressMock.mockReturnValue(ADMIN)
    isAdminAddressMock.mockReturnValue(true)
    readAlfaClubChatTokenMetaMock.mockResolvedValue({
      hasToken: false,
      updatedAt: null,
      expiresAt: null,
      updatedBy: null,
      isExpired: null,
    })
    readAlfaClubChatTokenMock.mockResolvedValue(null)
    upsertAlfaClubChatTokenMock.mockResolvedValue({
      hasToken: true,
      updatedAt: '2026-04-23T17:00:00.000Z',
      expiresAt: '2026-04-23T18:00:00.000Z',
      updatedBy: ADMIN.toLowerCase(),
      isExpired: false,
    })
    clearAlfaClubChatTokenMock.mockResolvedValue({
      hasToken: false,
      updatedAt: '2026-04-23T17:00:00.000Z',
      expiresAt: null,
      updatedBy: ADMIN.toLowerCase(),
      isExpired: null,
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'PUT' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 401 when no session exists', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when session is not admin', async () => {
    isAdminAddressMock.mockReturnValue(false)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('GET returns db-backed metadata when present', async () => {
    readAlfaClubChatTokenMetaMock.mockResolvedValueOnce({
      hasToken: true,
      updatedAt: '2026-04-23T17:00:00.000Z',
      expiresAt: '2026-04-23T18:00:00.000Z',
      updatedBy: ADMIN.toLowerCase(),
      isExpired: false,
    })
    readAlfaClubChatTokenMock.mockResolvedValueOnce({
      jwt: 'aaa.bbb.ccc',
      updatedAt: '2026-04-23T17:00:00.000Z',
      expiresAt: '2026-04-23T18:00:00.000Z',
      updatedBy: ADMIN.toLowerCase(),
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.activeSource).toBe('db')
    expect(res.body?.data?.db?.hasToken).toBe(true)
    expect(String(res.body?.data?.tokenFingerprint ?? '')).toContain('…')
  })

  it('GET falls back to env source when db token is absent', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      ALFACLUB_CHAT_JWT: 'header.payload.signature',
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.activeSource).toBe('env')
    expect(res.body?.data?.envFallbackConfigured).toBe(true)
  })

  it('POST rejects malformed jwt payload', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { jwt: 'not-a-jwt' },
      rawBody: JSON.stringify({ jwt: 'not-a-jwt' }),
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(upsertAlfaClubChatTokenMock).not.toHaveBeenCalled()
  })

  it('POST writes token metadata to the store', async () => {
    const token = 'header.payload.signature'
    const req = createMockReq({
      method: 'POST',
      body: { jwt: token },
      rawBody: JSON.stringify({ jwt: token }),
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(upsertAlfaClubChatTokenMock).toHaveBeenCalledTimes(1)
    expect(upsertAlfaClubChatTokenMock).toHaveBeenCalledWith({
      jwt: token,
      updatedBy: ADMIN.toLowerCase(),
    })
    expect(res.body?.data?.activeSource).toBe('db')
  })

  it('DELETE clears the db token', async () => {
    const req = createMockReq({ method: 'DELETE' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(clearAlfaClubChatTokenMock).toHaveBeenCalledTimes(1)
    expect(clearAlfaClubChatTokenMock).toHaveBeenCalledWith({
      clearedBy: ADMIN.toLowerCase(),
    })
  })
})


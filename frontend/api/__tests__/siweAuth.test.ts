import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import { makeNonceToken } from '../../server/auth/_shared.ts'
import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, upsertProfileByWalletMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  upsertProfileByWalletMock: vi.fn(async () => {}),
}))

const { createPublicClientMock, httpMock } = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(() => {
    const testOwner = '0x2681c2ca956015724567c969bdc23207ec0cc0e6'
    const encodedOwner = `0x${'00'.repeat(12)}${testOwner.slice(2)}`
    return {
      getBytecode: vi.fn(async () => '0x60016000'),
      readContract: vi.fn(async (opts: any) => {
        const fn = String(opts?.functionName ?? '')
        if (fn === 'ownerCount' || fn === 'nextOwnerIndex') return 1n
        if (fn === 'ownerAtIndex') return encodedOwner
        if (fn === 'isOwnerAddress') {
          const owner = String(opts?.args?.[0] ?? '').toLowerCase()
          return owner === testOwner
        }
        return true
      }),
    }
  }),
  httpMock: vi.fn(() => ({ transport: 'http' })),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/profileSync.js', () => ({
  upsertProfileByWallet: upsertProfileByWalletMock,
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: httpMock,
  }
})

vi.mock('viem/chains', async () => {
  const actual = await vi.importActual<any>('viem/chains')
  return {
    ...actual,
    base: {},
  }
})

import nonceHandler from '../_handlers/auth/_nonce.ts'
import verifyHandler from '../_handlers/auth/_verify.ts'

type NonceState = {
  expiresAtMs: number
  consumedAtMs: number | null
}

function createNonceDb() {
  const rows = new Map<string, NonceState>()

  return {
    rows,
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('create table if not exists auth_nonces')) {
        return { rows: [] }
      }
      if (text.includes('create index if not exists auth_nonces_expires_idx')) {
        return { rows: [] }
      }
      if (text.includes('insert into auth_nonces')) {
        const nonce = String(values[0])
        const expiresAtMs = Date.parse(String(values[1]))
        if (!rows.has(nonce)) rows.set(nonce, { expiresAtMs, consumedAtMs: null })
        return { rows: [] }
      }
      if (text.includes('update auth_nonces') && text.includes('returning nonce')) {
        const nonce = String(values[0])
        const rec = rows.get(nonce)
        if (!rec) return { rows: [] }
        if (rec.consumedAtMs !== null) return { rows: [] }
        if (rec.expiresAtMs <= Date.now()) return { rows: [] }
        rec.consumedAtMs = Date.now()
        return { rows: [{ nonce }] }
      }

      return { rows: [] }
    },
  }
}

function makeSiweMessage(params: {
  domain: string
  address: string
  uri: string
  chainId: number
  nonce: string
  issuedAt: string
}): string {
  return `${params.domain} wants you to sign in with your Ethereum account:\n${params.address}\n\nURI: ${params.uri}\nVersion: 1\nChain ID: ${params.chainId}\nNonce: ${params.nonce}\nIssued At: ${params.issuedAt}`
}

describe('siwe auth hardening', () => {
  const account = privateKeyToAccount('0x59c6995e998f97a5a0044976f4fdf96d4f03f4a2f5bc4f6ce4f95f7c03aefb27')
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      APP_ORIGIN: 'https://4626.fun',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('allows first verify and blocks nonce replay', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonceReq = createMockReq({
      method: 'GET',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https' },
    })
    const nonceRes = createMockRes()
    await nonceHandler(nonceReq, nonceRes)

    expect(nonceRes.statusCode).toBe(200)
    const nonce = String(nonceRes.body?.data?.nonce)
    const nonceToken = String(nonceRes.body?.data?.nonceToken)
    const nonceCookie = readSetCookies(nonceRes)[0]?.split(';')[0]

    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const firstReq = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: nonceCookie },
      body: { message, signature, nonceToken },
    })
    const firstRes = createMockRes()
    await verifyHandler(firstReq, firstRes)

    expect(firstRes.statusCode).toBe(200)
    expect(firstRes.body?.success).toBe(true)

    const replayReq = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: nonceCookie },
      body: { message, signature, nonceToken },
    })
    const replayRes = createMockRes()
    await verifyHandler(replayReq, replayRes)

    expect(replayRes.statusCode).toBe(400)
    expect(replayRes.body?.error).toBe('Nonce already used or expired')
  })

  it('rejects wrong chain id', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonce = 'nonce-wrong-chain'
    db.rows.set(nonce, { expiresAtMs: Date.now() + 15 * 60 * 1000, consumedAtMs: null })

    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 1,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }) },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid chain')
  })

  it('rejects wrong URI', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonce = 'nonce-wrong-uri'
    db.rows.set(nonce, { expiresAtMs: Date.now() + 15 * 60 * 1000, consumedAtMs: null })

    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://evil.test',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }) },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('URI mismatch')
  })

  it('issues nonces with canonical origin, not forwarded host headers', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'evil.test',
        'x-forwarded-host': 'evil.test',
        'x-forwarded-proto': 'https',
      },
    })
    const res = createMockRes()

    await nonceHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.uri).toBe('https://4626.fun')
    expect(res.body?.data?.domain).toBe('4626.fun')
  })

  it('rejects SIWE domain not present in trusted origin set', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonce = 'nonce-wrong-domain'
    db.rows.set(nonce, { expiresAtMs: Date.now() + 15 * 60 * 1000, consumedAtMs: null })

    const message = makeSiweMessage({
      domain: 'evil.test',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }) },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Domain mismatch')
  })

  it('rejects expired nonces', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonce = 'nonce-expired'
    db.rows.set(nonce, { expiresAtMs: Date.now() - 60_000, consumedAtMs: null })

    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }) },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Nonce already used or expired')
  })

  it('fails closed when nonce DB is unavailable during verify', async () => {
    getDbMock.mockResolvedValue(null)

    const nonce = 'nonce-no-db'
    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }) },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('Auth service unavailable')
  })

  it('persists canonical CSW when SIWE owner verification proves ownership', async () => {
    const db = createNonceDb()
    getDbMock.mockResolvedValue(db)

    const nonce = 'nonce-csw-owner'
    db.rows.set(nonce, { expiresAtMs: Date.now() + 15 * 60 * 1000, consumedAtMs: null })

    const cswAddress = '0x000000000000000000000000000000000000cAFe'
    const message = makeSiweMessage({
      domain: '4626.fun',
      address: account.address,
      uri: 'https://4626.fun',
      chainId: 8453,
      nonce,
      issuedAt: new Date().toISOString(),
    })
    const signature = await account.signMessage({ message })

    const req = createMockReq({
      method: 'POST',
      headers: { host: '4626.fun', 'x-forwarded-proto': 'https', cookie: `cv_auth_nonce=${nonce}` },
      body: { message, signature, nonceToken: makeNonceToken({ nonce }), cswAddress },
    })
    const res = createMockRes()

    await verifyHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertProfileByWalletMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        primaryWallet: account.address.toLowerCase(),
        cswAddress: cswAddress.toLowerCase(),
        baseSubAccount: cswAddress.toLowerCase(),
      }),
    )
  })
})

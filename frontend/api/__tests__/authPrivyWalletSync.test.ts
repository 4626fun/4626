import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler, {
  pickPrivySessionAddress,
  resetPrivyAuthDbSyncThrottleForTests,
} from '../_handlers/auth/_privy.ts'
import {
  classifyLinkedAccounts as realClassifyLinkedAccounts,
  type ClassifiedLinkedAccounts,
} from '../../server/_lib/wallet/walletMapping.ts'
import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const CANONICAL_ADDRESS = '0x00000000000000000000000000000000000000aa'
const EMBEDDED_ADDRESS = '0x00000000000000000000000000000000000000bb'
const NON_AUTHORITY_ADDRESS = '0x0000000000000000000000000000000000000099'

let persistedProfileRow: Record<string, unknown> | null
let persistedRoleWalletRows: Array<{ address: string }>

function setPersistedAuthority(params: {
  canonical?: string | null
  primary?: string | null
  embedded?: string | null
  roleWallets?: string[]
}) {
  persistedProfileRow = {
    id: 1,
    canonical_wallet: params.canonical ?? null,
    csw_address: params.canonical ?? null,
    primary_wallet: params.primary ?? null,
    primary_embedded_eoa: params.embedded ?? null,
  }
  persistedRoleWalletRows = (params.roleWallets ?? []).map((address) => ({ address }))
}

function createAuthorityDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('as canonical_wallet') && text.includes('from profiles')) {
        return { rows: persistedProfileRow ? [persistedProfileRow] : [] }
      }
      if (text.includes('from profile_wallets') && text.includes('is_embedded_eoa = true')) {
        return { rows: persistedRoleWalletRows }
      }
      return { rows: [] }
    }),
  }
}

function makeClassified(params: {
  canonical?: string | null
  embedded?: string | null
  otherSmartWallet?: string | null
}): ClassifiedLinkedAccounts {
  const allWallets: ClassifiedLinkedAccounts['allWallets'] = []
  if (params.canonical) {
    allWallets.push({
      address: params.canonical,
      walletType: 'smart_wallet',
      provider: 'coinbase_wallet',
      chain: 'evm',
      clientType: 'coinbase_wallet',
    })
  }
  if (params.embedded) {
    allWallets.push({
      address: params.embedded,
      walletType: 'embedded_eoa',
      provider: 'privy',
      chain: 'evm',
      clientType: 'privy',
    })
  }
  if (params.otherSmartWallet) {
    allWallets.push({
      address: params.otherSmartWallet,
      walletType: 'smart_wallet',
      provider: 'coinbase_wallet',
      chain: 'evm',
      clientType: 'coinbase_wallet',
    })
  }
  return {
    embeddedEoa: params.embedded
      ? { address: params.embedded, chainType: 'evm', clientType: 'privy' }
      : null,
    activeOwnerWallet: params.embedded
      ? { address: params.embedded, provider: 'privy', walletType: 'embedded_eoa' }
      : null,
    canonicalSmartWallet: params.canonical
      ? { address: params.canonical, provider: 'coinbase_wallet' }
      : params.otherSmartWallet
        ? { address: params.otherSmartWallet, provider: 'coinbase_wallet' }
        : null,
    canonicalSolanaWallet: null,
    operationalSolanaWallet: null,
    allWallets,
    primaryWalletAddress: params.canonical ?? params.embedded ?? params.otherSmartWallet ?? null,
  }
}

const {
  getDbMock,
  checkRateLimitMock,
  checkDurableRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  ensureWaitlistSchemaMock,
  syncUserWalletsMock,
  verifyAuthTokenMock,
  getUserByIdMock,
  createWalletsMock,
  walletApiCreateMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  checkDurableRateLimitMock: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  syncUserWalletsMock: vi.fn(async () => ({
    profileId: 1,
    canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
    activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
    embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
    connectedWallets: [],
    primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
  })),
  verifyAuthTokenMock: vi.fn(async () => ({ userId: 'did:privy:test-user' })),
  getUserByIdMock: vi.fn(async (): Promise<{
    id: string
    linkedAccounts: Array<{
      type: string
      address: string
      walletClientType?: string
      chainType?: string
    }>
  }> => ({
    id: 'did:privy:test-user',
    linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
  })),
  createWalletsMock: vi.fn(async (): Promise<{
    id: string
    linkedAccounts: Array<{
      type: string
      address: string
      walletClientType?: string
      chainType?: string
    }>
  }> => ({
    id: 'did:privy:test-user',
    linkedAccounts: [],
  })),
  walletApiCreateMock: vi.fn(async () => ({
    id: 'wallet-id',
    address: '0x00000000000000000000000000000000000000dd',
  })),
}))

vi.mock('@4626/server-core', () => ({
  COOKIE_SESSION: '__Host-4626_session',
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  setCookie: vi.fn((_req: any, res: any, name: string, value: string) => {
    const current = res.getHeader('set-cookie')
    const next = `${name}=${value}; Path=/; HttpOnly`
    if (!current) {
      res.setHeader('set-cookie', [next])
      return
    }
    if (Array.isArray(current)) {
      res.setHeader('set-cookie', [...current, next])
      return
    }
    res.setHeader('set-cookie', [String(current), next])
  }),
  makeSessionToken: vi.fn(() => 'test-session-token'),
  getDb: getDbMock,
  RATE_LIMITS: {
    authPrivy: { windowMs: 60_000, maxRequests: 20 },
  },
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkDurableRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  classifyLinkedAccounts: vi.fn((user: any) => realClassifyLinkedAccounts(user)),
  syncUserWallets: syncUserWalletsMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    verifyAuthToken = verifyAuthTokenMock
    getUserById = getUserByIdMock
    createWallets = createWalletsMock
    walletApi = {
      create: walletApiCreateMock,
    }
  },
}))

describe('auth privy wallet sync', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    resetPrivyAuthDbSyncThrottleForTests()
    setPersistedAuthority({
      canonical: CANONICAL_ADDRESS,
      embedded: EMBEDDED_ADDRESS,
      roleWallets: [CANONICAL_ADDRESS, EMBEDDED_ADDRESS],
    })
    getDbMock.mockResolvedValue(createAuthorityDb())
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 })
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:test-user' })
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
    })
    createWalletsMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    walletApiCreateMock.mockResolvedValue({
      id: 'wallet-id',
      address: '0x00000000000000000000000000000000000000dd',
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
      embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    })
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('prefers the linked canonical CSW from persisted authority', () => {
    const classified = makeClassified({
      canonical: CANONICAL_ADDRESS,
      embedded: EMBEDDED_ADDRESS,
    })

    expect(
      pickPrivySessionAddress({
        classified,
        persistedAuthorityAddresses: [CANONICAL_ADDRESS, EMBEDDED_ADDRESS],
      }),
    ).toBe(CANONICAL_ADDRESS)
  })

  it('uses a linked embedded owner to prove the persisted canonical CSW session', () => {
    const classified = makeClassified({
      embedded: EMBEDDED_ADDRESS,
      otherSmartWallet: NON_AUTHORITY_ADDRESS,
    })

    expect(
      pickPrivySessionAddress({
        classified,
        persistedAuthorityAddresses: [CANONICAL_ADDRESS, EMBEDDED_ADDRESS],
      }),
    ).toBe(CANONICAL_ADDRESS)
  })

  it('does not select a linked Coinbase smart wallet without a persisted authority role', () => {
    const classified = makeClassified({ otherSmartWallet: NON_AUTHORITY_ADDRESS })

    expect(
      pickPrivySessionAddress({
        classified,
        persistedAuthorityAddresses: [CANONICAL_ADDRESS, EMBEDDED_ADDRESS],
      }),
    ).toBeNull()
  })

  it('fails closed when no persisted authority candidate exists', () => {
    const classified = makeClassified({
      canonical: CANONICAL_ADDRESS,
      embedded: EMBEDDED_ADDRESS,
    })

    expect(
      pickPrivySessionAddress({
        classified,
        persistedAuthorityAddresses: [],
      }),
    ).toBeNull()
  })

  it('uses syncUserWallets for canonical wallet session sync', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(readSetCookies(res).length).toBeGreaterThan(0)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('prefers synced canonical wallet over raw Privy smart wallet for session address', async () => {
    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
      embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('returns recovery-required when DB sync reports identity recovery required', async () => {
    syncUserWalletsMock.mockRejectedValueOnce(
      Object.assign(new Error('collision'), {
        code: 'IDENTITY_RECOVERY_REQUIRED',
        reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      }),
    )

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Recovery required')
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_EMAIL_BOUND')
    expect(res.body?.recoveryRequired).toBe(true)
  })

  it('uses persisted canonical wallet when DB sync is throttled', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue(createAuthorityDb())

    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
    })

    const makeRequest = () =>
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      })
    await handler(makeRequest(), createMockRes())
    syncUserWalletsMock.mockClear()

    const res = createMockRes()
    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).not.toHaveBeenCalled()
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('does not throttle one Privy user behind another user in the same process', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })
    getDbMock.mockResolvedValue(createAuthorityDb())
    verifyAuthTokenMock
      .mockResolvedValueOnce({ userId: 'did:privy:throttle-user-a' })
      .mockResolvedValueOnce({ userId: 'did:privy:throttle-user-b' })

    const makeRequest = () =>
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      })

    const firstResponse = createMockRes()
    const secondResponse = createMockRes()
    await handler(makeRequest(), firstResponse)
    await handler(makeRequest(), secondResponse)

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(2)
  })

  it('does not throttle wallet persistence when the profile has no session address', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })

    const makeRequest = () =>
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      })

    await handler(makeRequest(), createMockRes())
    syncUserWalletsMock.mockClear()

    const res = createMockRes()
    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(400)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
  })

  it('bypasses sync throttling when persisted and Privy-derived session addresses disagree', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue(createAuthorityDb())

    const makeRequest = () =>
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      })
    await handler(makeRequest(), createMockRes())
    syncUserWalletsMock.mockClear()

    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x0000000000000000000000000000000000000099' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000cc', provider: 'coinbase_wallet' },
      activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
      embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000cc',
    })

    const res = createMockRes()
    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(400)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.code).toBe('PRIVY_WALLET_NOT_READY')
  })

  it('mints the canonical session proven by the embedded owner instead of a non-role smart wallet', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [
        { type: 'smart_wallet', address: NON_AUTHORITY_ADDRESS },
        {
          type: 'wallet',
          address: EMBEDDED_ADDRESS,
          walletClientType: 'privy',
          chainType: 'ethereum',
        },
      ],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: NON_AUTHORITY_ADDRESS, provider: 'coinbase_wallet' },
      activeOwnerWallet: {
        address: EMBEDDED_ADDRESS,
        provider: 'privy',
        walletType: 'embedded_eoa',
      },
      embeddedEoa: {
        address: EMBEDDED_ADDRESS,
        chainType: 'evm',
        clientType: 'privy',
      },
      connectedWallets: [],
      primaryWalletAddress: NON_AUTHORITY_ADDRESS,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.address).toBe(CANONICAL_ADDRESS)
    expect(readSetCookies(res).length).toBeGreaterThan(0)

    const secondRes = createMockRes()
    await handler(req, secondRes)
    expect(secondRes.statusCode).toBe(200)
    expect(secondRes.body?.data?.address).toBe(CANONICAL_ADDRESS)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
  })

  it('does not mint a session for a stale synced canonical wallet absent from current Privy-linked wallets', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue(createAuthorityDb())

    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x0000000000000000000000000000000000000099' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: null,
      embeddedEoa: null,
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.code).toBe('PRIVY_WALLET_NOT_READY')
  })

  it('returns 503 when Privy server auth is not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: undefined,
      PRIVY_APP_SECRET: undefined,
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toContain('Privy server auth is not configured')
  })

  it('returns 503 instead of wallet-not-ready when the identity database is unavailable', async () => {
    getDbMock.mockResolvedValue(null)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('Auth service unavailable')
    expect(readSetCookies(res)).toEqual([])
  })

  it('returns 401 when the Privy bearer token is missing', async () => {
    const req = createMockReq({
      method: 'POST',
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Missing Privy auth token')
  })

  it('returns 400 when no Privy wallet is ready yet', async () => {
    persistedProfileRow = null
    persistedRoleWalletRows = []
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    createWalletsMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    walletApiCreateMock.mockRejectedValue(new Error('wallet api unavailable'))
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: null,
      activeOwnerWallet: null,
      embeddedEoa: null,
      connectedWallets: [],
      primaryWalletAddress: null,
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(createWalletsMock).toHaveBeenCalledWith({
      userId: 'did:privy:test-user',
      createEthereumWallet: true,
      createSolanaWallet: false,
      createEthereumSmartWallet: false,
      numberOfEthereumWalletsToCreate: 1,
    })
    expect(walletApiCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chainType: 'ethereum',
        owner: { userId: 'did:privy:test-user' },
      }),
    )
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('No Privy wallet is ready yet')
  })

  it('falls back to walletApi.create when createWallets leaves the user empty', async () => {
    setPersistedAuthority({
      embedded: '0x00000000000000000000000000000000000000dd',
      roleWallets: ['0x00000000000000000000000000000000000000dd'],
    })
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    createWalletsMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    walletApiCreateMock.mockResolvedValue({
      id: 'wallet-id',
      address: '0x00000000000000000000000000000000000000dd',
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: null,
      activeOwnerWallet: {
        address: '0x00000000000000000000000000000000000000dd',
        provider: 'privy',
        walletType: 'embedded_eoa',
      },
      embeddedEoa: {
        address: '0x00000000000000000000000000000000000000dd',
        chainType: 'evm',
        clientType: 'embedded',
      },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000dd',
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(walletApiCreateMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000dd')
  })

  it('provisions a user-owned embedded EOA when the Privy user has zero wallets', async () => {
    setPersistedAuthority({
      embedded: '0x00000000000000000000000000000000000000cc',
      roleWallets: ['0x00000000000000000000000000000000000000cc'],
    })
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    createWalletsMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [
        {
          type: 'wallet',
          address: '0x00000000000000000000000000000000000000cc',
          walletClientType: 'privy',
          chainType: 'ethereum',
        },
      ],
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: null,
      activeOwnerWallet: {
        address: '0x00000000000000000000000000000000000000cc',
        provider: 'privy',
        walletType: 'embedded_eoa',
      },
      embeddedEoa: {
        address: '0x00000000000000000000000000000000000000cc',
        chainType: 'evm',
        clientType: 'embedded',
      },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000cc',
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(createWalletsMock).toHaveBeenCalledWith({
      userId: 'did:privy:test-user',
      createEthereumWallet: true,
      createSolanaWallet: false,
      createEthereumSmartWallet: false,
      numberOfEthereumWalletsToCreate: 1,
    })
    expect(walletApiCreateMock).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000cc')
  })

  it('mints a session for base_account linked accounts when connector identity is on type', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'base_account', address: '0x00000000000000000000000000000000000000aa' }],
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: null as any,
      embeddedEoa: null as any,
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

})

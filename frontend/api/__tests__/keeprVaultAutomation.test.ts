import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const ACTOR = '0x00000000000000000000000000000000000000aa'
const STALE_HISTORICAL_WALLET = '0x0000000000000000000000000000000000000011'
const VAULT = '0x00000000000000000000000000000000000000bb'
const CANONICAL_CSW = '0x00000000000000000000000000000000000000cc'
const OTHER_CSW = '0x00000000000000000000000000000000000000dd'
const EMBEDDED_EOA = '0x00000000000000000000000000000000000000ee'
const OTHER_EMBEDDED_EOA = '0x00000000000000000000000000000000000000ff'
const PRIVY_WALLET_ID = 'wallet-abc123'
const REVOKED_AT = '2026-03-10T12:00:00.000Z'

function buildIdentity(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 42,
    canonicalSmartWallet: CANONICAL_CSW,
    embeddedEoa: EMBEDDED_EOA,
    privyUserId: 'did:privy:user-1',
    ...overrides,
  }
}

function buildVault(overrides: Record<string, unknown> = {}) {
  return {
    vaultAddress: VAULT,
    canonicalOwnerAddress: CANONICAL_CSW,
    ...overrides,
  }
}

function buildAutomationRow(overrides: Record<string, unknown> = {}) {
  return {
    vaultAddress: VAULT,
    profileId: 42,
    canonicalCswAddress: CANONICAL_CSW,
    embeddedEoaAddress: EMBEDDED_EOA,
    privyWalletId: PRIVY_WALLET_ID,
    authorizationSource: 'owner_session',
    automationEnabled: true,
    automationScope: 'ajna_min_bucket_only',
    lastOwnerCheckAt: '2026-03-10T11:00:00.000Z',
    revokedAt: null,
    metadata: {},
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T11:00:00.000Z',
    ...overrides,
  }
}

type WalletSyncPersistedIdentity = {
  primaryWallet: string | null
  canonicalSmartWallet: string | null
  canonicalSolanaWallet: string | null
  operationalSolanaWallet: string | null
  embeddedEoa: string | null
  preprovZoraHandle: string | null
}

function buildPersistedIdentity(
  overrides: Partial<WalletSyncPersistedIdentity> = {},
): WalletSyncPersistedIdentity {
  return {
    primaryWallet: ACTOR,
    canonicalSmartWallet: CANONICAL_CSW,
    canonicalSolanaWallet: null,
    operationalSolanaWallet: null,
    embeddedEoa: EMBEDDED_EOA,
    preprovZoraHandle: null,
    ...overrides,
  }
}

type MockedResolverHarness = {
  handler: (req: any, res: any) => Promise<unknown>
  getApiHandler: (subpath: string) => Promise<unknown>
  mocks: {
    getSessionAddressMock: ReturnType<typeof vi.fn>
    resolvePersistedWalletIdentityMock: ReturnType<typeof vi.fn>
    getKeeprVaultByVaultAddressMock: ReturnType<typeof vi.fn>
    getKeeprVaultAutomationByVaultAddressMock: ReturnType<typeof vi.fn>
    upsertKeeprVaultAutomationMock: ReturnType<typeof vi.fn>
    disableKeeprVaultAutomationMock: ReturnType<typeof vi.fn>
  }
}

type RealResolverHarness = {
  handler: (req: any, res: any) => Promise<unknown>
  mocks: {
    getSessionAddressMock: ReturnType<typeof vi.fn>
    readPersistedIdentityMock: ReturnType<typeof vi.fn>
    ensureCanonicalWalletsSchemaMock: ReturnType<typeof vi.fn>
    getKeeprVaultByVaultAddressMock: ReturnType<typeof vi.fn>
    getKeeprVaultAutomationByVaultAddressMock: ReturnType<typeof vi.fn>
    upsertKeeprVaultAutomationMock: ReturnType<typeof vi.fn>
    disableKeeprVaultAutomationMock: ReturnType<typeof vi.fn>
    dbSqlMock: ReturnType<typeof vi.fn>
  }
}

async function loadAutomationHandlerWithMockedResolver(params: {
  sessionAddress?: string | null
  identity?: ReturnType<typeof buildIdentity> | null
  vault?: ReturnType<typeof buildVault> | null
  automationRow?: ReturnType<typeof buildAutomationRow> | null
  upsertRow?: ReturnType<typeof buildAutomationRow> | null
  disableRow?: ReturnType<typeof buildAutomationRow> | null
  getAutomationError?: Error | null
  upsertError?: Error | null
  disableError?: Error | null
} = {}): Promise<MockedResolverHarness> {
  vi.resetModules()

  const getSessionAddressMock = vi.fn().mockReturnValue(
    params.sessionAddress === undefined ? ACTOR : params.sessionAddress,
  )
  const resolvePersistedWalletIdentityMock = vi.fn().mockResolvedValue(
    params.identity === undefined ? buildIdentity() : params.identity,
  )
  const getKeeprVaultByVaultAddressMock = vi.fn().mockResolvedValue(
    params.vault === undefined ? buildVault() : params.vault,
  )
  const getKeeprVaultAutomationByVaultAddressMock = params.getAutomationError
    ? vi.fn().mockRejectedValue(params.getAutomationError)
    : vi.fn().mockResolvedValue(
        params.automationRow === undefined ? buildAutomationRow() : params.automationRow,
      )
  const upsertKeeprVaultAutomationMock = params.upsertError
    ? vi.fn().mockRejectedValue(params.upsertError)
    : vi.fn().mockResolvedValue(
        params.upsertRow === undefined ? buildAutomationRow() : params.upsertRow,
      )
  const disableKeeprVaultAutomationMock = params.disableError
    ? vi.fn().mockRejectedValue(params.disableError)
    : vi.fn().mockResolvedValue(
        params.disableRow === undefined
          ? buildAutomationRow({
              automationEnabled: false,
              revokedAt: REVOKED_AT,
            })
          : params.disableRow,
      )

  vi.doMock('../../server/_lib/session.js', () => ({
    getSessionAddress: getSessionAddressMock,
  }))
  vi.doMock('../../server/_lib/canonicalWalletResolver.js', () => ({
    resolvePersistedWalletIdentity: resolvePersistedWalletIdentityMock,
  }))
  vi.doMock('../../server/_lib/keeprRegistry.js', () => ({
    getKeeprVaultByVaultAddress: getKeeprVaultByVaultAddressMock,
  }))
  vi.doMock('../../server/_lib/keeprAutomation.js', () => ({
    getKeeprVaultAutomationByVaultAddress: getKeeprVaultAutomationByVaultAddressMock,
    upsertKeeprVaultAutomation: upsertKeeprVaultAutomationMock,
    disableKeeprVaultAutomation: disableKeeprVaultAutomationMock,
  }))

  const [{ default: handler }, { getApiHandler }] = await Promise.all([
    import('../_handlers/keepr/vault/_automation.js'),
    import('../_handlers/_routes.js'),
  ])

  return {
    handler,
    getApiHandler,
    mocks: {
      getSessionAddressMock,
      resolvePersistedWalletIdentityMock,
      getKeeprVaultByVaultAddressMock,
      getKeeprVaultAutomationByVaultAddressMock,
      upsertKeeprVaultAutomationMock,
      disableKeeprVaultAutomationMock,
    },
  }
}

async function loadAutomationHandlerWithRealResolver(params: {
  sessionAddress?: string | null
  profileRows?: Array<{ id: number; privy_user_id?: string | null }>
  persistedIdentity?: WalletSyncPersistedIdentity | null
  vault?: ReturnType<typeof buildVault> | null
  automationRow?: ReturnType<typeof buildAutomationRow> | null
  upsertRow?: ReturnType<typeof buildAutomationRow> | null
  disableRow?: ReturnType<typeof buildAutomationRow> | null
} = {}): Promise<RealResolverHarness> {
  vi.resetModules()
  vi.doUnmock('../../server/_lib/canonicalWalletResolver.js')

  const profileRows = params.profileRows ?? [{ id: 42, privy_user_id: 'did:privy:user-1' }]
  const dbSqlMock = vi.fn(async () => ({ rows: profileRows }))
  const getSessionAddressMock = vi.fn().mockReturnValue(
    params.sessionAddress === undefined ? ACTOR : params.sessionAddress,
  )
  const readPersistedIdentityMock = vi.fn().mockResolvedValue(
    params.persistedIdentity === undefined ? buildPersistedIdentity() : params.persistedIdentity,
  )
  const ensureCanonicalWalletsSchemaMock = vi.fn().mockResolvedValue(undefined)
  const getKeeprVaultByVaultAddressMock = vi.fn().mockResolvedValue(
    params.vault === undefined ? buildVault() : params.vault,
  )
  const getKeeprVaultAutomationByVaultAddressMock = vi.fn().mockResolvedValue(
    params.automationRow === undefined ? buildAutomationRow() : params.automationRow,
  )
  const upsertKeeprVaultAutomationMock = vi.fn().mockResolvedValue(
    params.upsertRow === undefined ? buildAutomationRow() : params.upsertRow,
  )
  const disableKeeprVaultAutomationMock = vi.fn().mockResolvedValue(
    params.disableRow === undefined
      ? buildAutomationRow({
          automationEnabled: false,
          revokedAt: REVOKED_AT,
        })
      : params.disableRow,
  )

  vi.doMock('../../server/_lib/session.js', () => ({
    getSessionAddress: getSessionAddressMock,
  }))
  vi.doMock('../../server/_lib/postgres.js', () => ({
    getDb: vi.fn(async () => ({ sql: dbSqlMock })),
    isDbConfigured: vi.fn(() => true),
  }))
  vi.doMock('../../server/_lib/canonicalWalletsSchema.js', () => ({
    ensureCanonicalWalletsSchema: ensureCanonicalWalletsSchemaMock,
  }))
  vi.doMock('../../server/_lib/walletSync.js', () => ({
    readPersistedIdentity: readPersistedIdentityMock,
  }))
  vi.doMock('../../server/_lib/keeprRegistry.js', () => ({
    getKeeprVaultByVaultAddress: getKeeprVaultByVaultAddressMock,
  }))
  vi.doMock('../../server/_lib/keeprAutomation.js', () => ({
    getKeeprVaultAutomationByVaultAddress: getKeeprVaultAutomationByVaultAddressMock,
    upsertKeeprVaultAutomation: upsertKeeprVaultAutomationMock,
    disableKeeprVaultAutomation: disableKeeprVaultAutomationMock,
  }))

  const { default: handler } = await import('../_handlers/keepr/vault/_automation.js')

  return {
    handler,
    mocks: {
      getSessionAddressMock,
      readPersistedIdentityMock,
      ensureCanonicalWalletsSchemaMock,
      getKeeprVaultByVaultAddressMock,
      getKeeprVaultAutomationByVaultAddressMock,
      upsertKeeprVaultAutomationMock,
      disableKeeprVaultAutomationMock,
      dbSqlMock,
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('../../server/_lib/session.js')
  vi.doUnmock('../../server/_lib/canonicalWalletResolver.js')
  vi.doUnmock('../../server/_lib/keeprRegistry.js')
  vi.doUnmock('../../server/_lib/keeprAutomation.js')
  vi.doUnmock('../../server/_lib/postgres.js')
  vi.doUnmock('../../server/_lib/canonicalWalletsSchema.js')
  vi.doUnmock('../../server/_lib/walletSync.js')
})

describe('keepr/vault/automation', () => {
  it('registers keepr/vault/automation in the static route map', async () => {
    const { getApiHandler } = await loadAutomationHandlerWithMockedResolver()
    const handler = await getApiHandler('keepr/vault/automation')
    expect(typeof handler).toBe('function')
  })

  it('requires an authenticated session', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver({
      sessionAddress: null,
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: CANONICAL_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Sign in required')
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('only allows the canonical vault owner to enable or disable automation', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver({
      identity: buildIdentity({ canonicalSmartWallet: OTHER_CSW }),
    })

    const enableReq = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: OTHER_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const enableRes = createMockRes()
    await handler(enableReq, enableRes)

    const disableReq = createMockReq({
      method: 'DELETE',
      body: { vaultAddress: VAULT },
    })
    const disableRes = createMockRes()
    await handler(disableReq, disableRes)

    expect(enableRes.statusCode).toBe(403)
    expect(String(enableRes.body?.error ?? '')).toContain('OWNER authorization required')
    expect(disableRes.statusCode).toBe(403)
    expect(String(disableRes.body?.error ?? '')).toContain('OWNER authorization required')
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
    expect(mocks.disableKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('requires vaultAddress, cswAddress, embeddedEoaAddress, and privyWalletId to enable automation', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'POST',
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('vaultAddress, cswAddress, embeddedEoaAddress, and privyWalletId are required')
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('requires cswAddress to match the stored canonical smart wallet for the actor', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: OTHER_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('canonical smart wallet')
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('requires embeddedEoaAddress to match the stored embedded EOA for the actor', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: CANONICAL_CSW,
        embeddedEoaAddress: OTHER_EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('embedded EOA')
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('defaults automation scope to ajna_min_bucket_only', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: CANONICAL_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.upsertKeeprVaultAutomationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultAddress: VAULT,
        profileId: 42,
        canonicalCswAddress: CANONICAL_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
        automationEnabled: true,
        automationScope: 'ajna_min_bucket_only',
      }),
    )
    expect(res.body?.data?.automationScope).toBe('ajna_min_bucket_only')
  })

  it('disabling automation flips automation_enabled=false and sets revoked_at', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'DELETE',
      body: { vaultAddress: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.disableKeeprVaultAutomationMock).toHaveBeenCalledTimes(1)
    expect(mocks.disableKeeprVaultAutomationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultAddress: VAULT,
        revokedAt: expect.any(Date),
      }),
    )
    expect(res.body?.data?.automationEnabled).toBe(false)
    expect(res.body?.data?.revokedAt).toBe(REVOKED_AT)
  })

  it('returns the current automation status for the canonical vault owner', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithMockedResolver()
    const req = createMockReq({
      method: 'GET',
      query: { vaultAddress: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.getKeeprVaultAutomationByVaultAddressMock).toHaveBeenCalledWith(VAULT)
    expect(res.body?.data).toEqual(buildAutomationRow())
  })

  it('returns a generic 500 response instead of leaking raw internals', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { handler } = await loadAutomationHandlerWithMockedResolver({
      getAutomationError: new Error('db://sensitive-connection-string'),
    })
    const req = createMockReq({
      method: 'GET',
      query: { vaultAddress: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'Internal server error' })
    expect(JSON.stringify(res.body)).not.toContain('db://sensitive-connection-string')
    errorSpy.mockRestore()
  })
})

describe('keepr/vault/automation owner auth hardening', () => {
  it('stale historical wallet does not authorize automation toggle', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithRealResolver({
      sessionAddress: STALE_HISTORICAL_WALLET,
      persistedIdentity: buildPersistedIdentity({
        primaryWallet: STALE_HISTORICAL_WALLET,
      }),
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: CANONICAL_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('OWNER authorization required')
    expect(mocks.readPersistedIdentityMock).toHaveBeenCalledTimes(1)
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it('ambiguous multi-profile resolution fails closed', async () => {
    const { handler, mocks } = await loadAutomationHandlerWithRealResolver({
      sessionAddress: CANONICAL_CSW,
      profileRows: [
        { id: 42, privy_user_id: 'did:privy:user-1' },
        { id: 77, privy_user_id: 'did:privy:user-2' },
      ],
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: VAULT,
        cswAddress: CANONICAL_CSW,
        embeddedEoaAddress: EMBEDDED_EOA,
        privyWalletId: PRIVY_WALLET_ID,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('OWNER authorization required')
    expect(mocks.readPersistedIdentityMock).not.toHaveBeenCalled()
    expect(mocks.upsertKeeprVaultAutomationMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      label: 'canonical',
      actor: EMBEDDED_EOA,
      persistedIdentity: buildPersistedIdentity({
        canonicalSmartWallet: null,
      }),
    },
    {
      label: 'embedded',
      actor: CANONICAL_CSW,
      persistedIdentity: buildPersistedIdentity({
        embeddedEoa: null,
      }),
    },
  ])('missing current $label identity fails closed', async ({ actor, persistedIdentity }) => {
    const { handler, mocks } = await loadAutomationHandlerWithRealResolver({
      sessionAddress: actor,
      persistedIdentity,
    })
    const req = createMockReq({
      method: 'GET',
      query: { vaultAddress: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('OWNER authorization required')
    expect(mocks.getKeeprVaultAutomationByVaultAddressMock).not.toHaveBeenCalled()
  })
})

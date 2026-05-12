import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import creHandler from '../_handlers/vaults/_activeProtected.ts'
import publicHandler from '../_handlers/vaults/_active.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  ensureKeeprSchemaMock,
  getDbMock,
  isDbConfiguredMock,
  validateCreatorRegistryBindingMock,
} = vi.hoisted(() => ({
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  validateCreatorRegistryBindingMock: vi.fn(async () => ({ ok: true as const })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../../server/_lib/onchain/creatorRegistryVerification.js', () => ({
  validateCreatorRegistryBinding: validateCreatorRegistryBindingMock,
}))

type MockVaultRow = {
  vault_address: `0x${string}`
  chain_id: number
  creator_coin_address: `0x${string}`
  group_id: string
  config_json: Record<string, unknown>
  graduated_at: string | null
  settled_at: string | null
  created_at: string
}

type MockAutomationRow = {
  vault_address: `0x${string}`
  profile_id?: number | null
  canonical_csw_address?: string | null
  embedded_eoa_address?: string | null
  privy_wallet_id?: string | null
  authorization_source?: string | null
  automation_enabled?: boolean | null
  automation_scope?: string | null
  last_owner_check_at?: string | null
  revoked_at?: string | null
  metadata?: unknown
  created_at?: string | null
  updated_at?: string | null
}

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createDbMock(seed: {
  vaultRows: MockVaultRow[]
  automationRows?: MockAutomationRow[]
}) {
  const state = {
    vaultRows: [...seed.vaultRows],
    automationRows: [...(seed.automationRows ?? [])],
  }

  return {
    state,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = normalizeSql(strings)

      if (text.includes('from keepr_vaults')) {
        return { rows: [...state.vaultRows] }
      }

      if (text.includes('from keepr_vault_automation')) {
        const requestedVaults = values
          .flatMap((value) => Array.isArray(value) ? value : [value])
          .map((value) => String(value).toLowerCase())

        const rows = requestedVaults.length > 0
          ? state.automationRows.filter((row) => requestedVaults.includes(row.vault_address.toLowerCase()))
          : state.automationRows

        return { rows }
      }

      return { rows: [] }
    }),
  }
}

function makeVaultRow(params: {
  vaultAddress: `0x${string}`
  creatorCoinAddress: `0x${string}`
  groupId: string
}): MockVaultRow {
  return {
    vault_address: params.vaultAddress.toLowerCase() as `0x${string}`,
    chain_id: 8453,
    creator_coin_address: params.creatorCoinAddress.toLowerCase() as `0x${string}`,
    group_id: params.groupId,
    config_json: {},
    graduated_at: null,
    settled_at: null,
    created_at: '2026-03-10T00:00:00.000Z',
  }
}

function makeAutomationRow(params: {
  vaultAddress: `0x${string}`
  canonicalCswAddress: `0x${string}`
  embeddedEoaAddress: `0x${string}`
  privyWalletId: string
}): MockAutomationRow {
  return {
    vault_address: params.vaultAddress.toLowerCase() as `0x${string}`,
    profile_id: 42,
    canonical_csw_address: params.canonicalCswAddress.toLowerCase() as `0x${string}`,
    embedded_eoa_address: params.embeddedEoaAddress.toLowerCase() as `0x${string}`,
    privy_wallet_id: params.privyWalletId,
    authorization_source: 'owner_proof',
    automation_enabled: true,
    automation_scope: 'vault',
    last_owner_check_at: '2026-03-10T00:00:00.000Z',
    revoked_at: null,
    metadata: { provider: 'privy' },
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
  }
}

describe('/api/(cre/)?vaults/active automation exposure', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    validateCreatorRegistryBindingMock.mockImplementation(async () => ({ ok: true }))
    isDbConfiguredMock.mockReturnValue(true)
    restoreEnv = applyEnv({ KEEPR_API_KEY: 'test-keepr-key' })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('includes private automation signer details in the protected active-vault feed and keeps other vaults visible', async () => {
    const optedInVault = '0x1000000000000000000000000000000000000001'
    const plainVault = '0x1000000000000000000000000000000000000002'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: optedInVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000001',
          groupId: 'group-opted-in',
        }),
        makeVaultRow({
          vaultAddress: plainVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000002',
          groupId: 'group-no-automation',
        }),
      ],
      automationRows: [
        makeAutomationRow({
          vaultAddress: optedInVault,
          canonicalCswAddress: '0x3000000000000000000000000000000000000001',
          embeddedEoaAddress: '0x4000000000000000000000000000000000000001',
          privyWalletId: 'wallet-abc123',
        }),
      ],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer test-keepr-key' },
    })
    const res = createMockRes()

    await creHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: optedInVault,
        automation: {
          automationEnabled: true,
          automationScope: 'vault',
          canonicalCswAddress: '0x3000000000000000000000000000000000000001',
          embeddedEoaAddress: '0x4000000000000000000000000000000000000001',
          privyWalletId: 'wallet-abc123',
        },
      }),
      expect.objectContaining({
        vaultAddress: plainVault,
        automation: {
          automationEnabled: false,
        },
      }),
    ])
  })

  it('omits private automation credentials from the public active-vault feed', async () => {
    const optedInVault = '0x1000000000000000000000000000000000000003'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: optedInVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000003',
          groupId: 'group-public',
        }),
      ],
      automationRows: [
        makeAutomationRow({
          vaultAddress: optedInVault,
          canonicalCswAddress: '0x3000000000000000000000000000000000000003',
          embeddedEoaAddress: '0x4000000000000000000000000000000000000003',
          privyWalletId: 'wallet-public-hidden',
        }),
      ],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await publicHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: optedInVault,
        automation: {
          automationEnabled: true,
          automationScope: 'vault',
        },
      }),
    ])
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('privyWalletId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('canonicalCswAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('embeddedEoaAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('profileId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('authorizationSource')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('metadata')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('lastOwnerCheckAt')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('revokedAt')
  })

  it('keeps vaults without automation context in the public active-vault feed with automation disabled', async () => {
    const plainVault = '0x1000000000000000000000000000000000000004'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: plainVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000004',
          groupId: 'group-public-no-automation',
        }),
      ],
      automationRows: [],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await publicHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: plainVault,
        automation: {
          automationEnabled: false,
        },
      }),
    ])
  })

  it('keeps disabled automation rows in the public feed without leaking internal fields', async () => {
    const disabledVault = '0x1000000000000000000000000000000000000005'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: disabledVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000005',
          groupId: 'group-disabled',
        }),
      ],
      automationRows: [
        {
          ...makeAutomationRow({
            vaultAddress: disabledVault,
            canonicalCswAddress: '0x3000000000000000000000000000000000000005',
            embeddedEoaAddress: '0x4000000000000000000000000000000000000005',
            privyWalletId: 'wallet-disabled',
          }),
          automation_enabled: false,
          revoked_at: '2026-03-11T00:00:00.000Z',
        },
      ],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await publicHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: disabledVault,
        automation: {
          automationEnabled: false,
          automationScope: 'vault',
        },
      }),
    ])
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('privyWalletId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('canonicalCswAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('embeddedEoaAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('profileId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('authorizationSource')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('metadata')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('lastOwnerCheckAt')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('revokedAt')
  })

  it('keeps the public feed alive when legacy automation rows have malformed private fields', async () => {
    const legacyVault = '0x1000000000000000000000000000000000000006'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: legacyVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000006',
          groupId: 'group-legacy-public',
        }),
      ],
      automationRows: [
        {
          vault_address: legacyVault,
          profile_id: null,
          canonical_csw_address: 'not-an-address',
          embedded_eoa_address: 'still-not-an-address',
          privy_wallet_id: 'wallet-legacy-public',
          authorization_source: null,
          automation_enabled: true,
          automation_scope: 'vault',
          last_owner_check_at: 'not-a-date',
          revoked_at: 'still-not-a-date',
          metadata: 'not-json',
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: '2026-03-10T00:00:00.000Z',
        },
      ],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await publicHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: legacyVault,
        automation: {
          automationEnabled: true,
          automationScope: 'vault',
        },
      }),
    ])
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('privyWalletId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('canonicalCswAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('embeddedEoaAddress')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('profileId')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('authorizationSource')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('metadata')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('lastOwnerCheckAt')
    expect(res.body?.data?.vaults?.[0]?.automation).not.toHaveProperty('revokedAt')
  })

  it('keeps the protected feed alive when legacy automation rows are partially populated', async () => {
    const legacyVault = '0x1000000000000000000000000000000000000007'
    const plainVault = '0x1000000000000000000000000000000000000008'
    const db = createDbMock({
      vaultRows: [
        makeVaultRow({
          vaultAddress: legacyVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000007',
          groupId: 'group-legacy-protected',
        }),
        makeVaultRow({
          vaultAddress: plainVault,
          creatorCoinAddress: '0x2000000000000000000000000000000000000008',
          groupId: 'group-plain-protected',
        }),
      ],
      automationRows: [
        {
          vault_address: legacyVault,
          profile_id: null,
          canonical_csw_address: null,
          embedded_eoa_address: 'not-an-address',
          privy_wallet_id: 'wallet-legacy-protected',
          authorization_source: null,
          automation_enabled: true,
          automation_scope: 'vault',
          last_owner_check_at: 'not-a-date',
          revoked_at: 'still-not-a-date',
          metadata: 'not-json',
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: '2026-03-10T00:00:00.000Z',
        },
      ],
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer test-keepr-key' },
    })
    const res = createMockRes()

    await creHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.vaults).toEqual([
      expect.objectContaining({
        vaultAddress: legacyVault,
        automation: {
          automationEnabled: true,
          automationScope: 'vault',
          canonicalCswAddress: null,
          embeddedEoaAddress: null,
          privyWalletId: 'wallet-legacy-protected',
        },
      }),
      expect.objectContaining({
        vaultAddress: plainVault,
        automation: {
          automationEnabled: false,
        },
      }),
    ])
  })
})

describe('ensureKeeprSchema migration-first guardrails', () => {
  afterEach(() => {
    vi.doUnmock('../../server/_lib/db/postgres.js')
    vi.doUnmock('../../server/_lib/keepr/keeprSchema.js')
  })

  it('fails fast with actionable missing-schema details instead of runtime DDL', async () => {
    vi.resetModules()
    vi.doUnmock('../../server/_lib/keepr/keeprSchema.js')

    const sqlCalls: string[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        sqlCalls.push(normalizeSql(strings))
        return { rows: [] }
      }),
    }

    vi.doMock('../../server/_lib/db/postgres.js', () => ({
      getDb: vi.fn(async () => db),
      isDbConfigured: vi.fn(() => true),
    }))

    const { ensureKeeprSchema } = await import('../../server/_lib/keepr/keeprSchema.js')
    await expect(ensureKeeprSchema()).rejects.toThrow(/keepr_schema_migration_required:/)

    const sqlText = sqlCalls.join('\n')
    expect(sqlText).not.toContain('create table if not exists keepr_vault_automation')
    expect(sqlText).not.toContain('alter table keepr_vault_automation add column if not exists')
    expect(sqlText).not.toContain('create index if not exists keepr_vault_automation_profile_idx')
    expect(sqlText).not.toContain('create index if not exists keepr_vault_automation_enabled_idx')
  })
})

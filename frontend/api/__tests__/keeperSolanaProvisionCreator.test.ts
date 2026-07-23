import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import handler from '../_handlers/keeper/_solanaProvisionCreator.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'
import { deriveCreatorShareHookPdas } from '../../server/_lib/onchain/creatorShareHookPdas.js'
import { deriveMeteoraCustomizablePoolAddress } from '../../server/_lib/onchain/solanaMeteoraPoolStatus.js'

const CREATOR_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'
const SHARE_OFT = '0x459ea17556082ebd586870f3aba81b822f104626'
const SHARE_MESH_MINT = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const METEORA_PROGRAM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
const POOL_ADDRESS = deriveMeteoraCustomizablePoolAddress({
  tokenMintX: SHARE_MESH_MINT,
  tokenMintY: SOL_MINT,
  programId: METEORA_PROGRAM,
})

const {
  getDbForCronMock,
  isDbConfiguredMock,
  readBoundedJsonObjectBodyMock,
  requireKeeprApiKeyMock,
  listActivationsForCreatorMock,
  creatorHasSolanaShareMeshEntitlementMock,
  ensureSolanaShareMeshMappingsSchemaMock,
  ensureSolanaMeteoraPoolStatusSchemaMock,
  ensureSolanaHookStatusSchemaMock,
  readSolanaHookStatusByCreatorTokenMock,
  enqueueSolanaB2ReadinessVerificationMock,
} = vi.hoisted(() => ({
  getDbForCronMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: any) => req.body),
  requireKeeprApiKeyMock: vi.fn(() => true),
  listActivationsForCreatorMock: vi.fn(async () => []),
  creatorHasSolanaShareMeshEntitlementMock: vi.fn(async () => true),
  ensureSolanaShareMeshMappingsSchemaMock: vi.fn(async () => {}),
  ensureSolanaMeteoraPoolStatusSchemaMock: vi.fn(async () => {}),
  ensureSolanaHookStatusSchemaMock: vi.fn(async () => {}),
  readSolanaHookStatusByCreatorTokenMock: vi.fn(async (..._args: unknown[]): Promise<any> => null),
  enqueueSolanaB2ReadinessVerificationMock: vi.fn(async () => ({ enqueued: true })),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  requireKeeprApiKey: requireKeeprApiKeyMock,
  getDbForCron: getDbForCronMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/creatorStrategy/activations.js', () => ({
  listActivationsForCreator: listActivationsForCreatorMock,
}))

vi.mock('../../server/_lib/creatorStrategy/solanaShareMeshProvisioning.js', () => ({
  creatorHasSolanaShareMeshEntitlement: creatorHasSolanaShareMeshEntitlementMock,
}))

vi.mock('../../server/_lib/db/schemaBootstrap.js', () => ({
  ensureSolanaShareMeshMappingsSchema: ensureSolanaShareMeshMappingsSchemaMock,
  ensureSolanaMeteoraPoolStatusSchema: ensureSolanaMeteoraPoolStatusSchemaMock,
  ensureSolanaHookStatusSchema: ensureSolanaHookStatusSchemaMock,
}))

vi.mock('../../server/_lib/onchain/solanaHookStatus.js', () => ({
  readSolanaHookStatusByCreatorToken: readSolanaHookStatusByCreatorTokenMock,
}))

vi.mock('../../server/_lib/onchain/solanaRelayConfigSync.js', () => ({
  enqueueSolanaB2ReadinessVerification: enqueueSolanaB2ReadinessVerificationMock,
}))

const HOOK_PDAS = deriveCreatorShareHookPdas(SHARE_MESH_MINT)!
const CREATOR_CONFIG = HOOK_PDAS.creatorConfig
const PENDING_ENTRIES = HOOK_PDAS.pendingEntries
const WINNER_RECORD = HOOK_PDAS.winnerRecord

function makeDb(
  mappingRows: any[] = [],
  claims: { hook?: boolean; pool?: boolean } = {},
) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ..._values: any[]) => {
      const query = strings.join('?')
      if (query.includes('FROM solana_share_mesh_mappings')) {
        return { rows: mappingRows }
      }
      if (query.includes('claim_hook_provision')) {
        return { rows: claims.hook === false ? [] : [{ id: 1 }] }
      }
      if (query.includes('claim_meteora_pool_provision')) {
        return { rows: claims.pool === false ? [] : [{ id: 1 }] }
      }
      return { rows: [] }
    }),
  }
}

describe('keeper solana provision creator handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
    getDbForCronMock.mockResolvedValue(makeDb())
    creatorHasSolanaShareMeshEntitlementMock.mockResolvedValue(true)
    listActivationsForCreatorMock.mockResolvedValue([])
    readSolanaHookStatusByCreatorTokenMock.mockResolvedValue(null)
  })

  it('creates the Meteora DLMM pool through the provisioner when the share-mesh mint is known', async () => {
    const db = makeDb([
      {
        id: 7,
        creator_token: CREATOR_TOKEN,
        share_oft: SHARE_OFT,
        share_mesh_mint: SHARE_MESH_MINT,
        source_session_id: 'dep_123',
        status: 'applied',
        apply_attempt_count: 1,
        created_at: '2026-06-28T00:00:00.000Z',
        updated_at: '2026-06-28T00:00:00.000Z',
      },
    ])
    getDbForCronMock.mockResolvedValue(db)
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({ ok: true, secretSet: true, payerConfigured: true, payerHealthy: true, solanaRpcConfigured: true, extendedEndpointsEnabled: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/setup-creator')) {
        return new Response(
          JSON.stringify({
            success: true,
            mint: SHARE_MESH_MINT,
            pdas: {
              creatorConfig: CREATOR_CONFIG,
              pendingEntries: PENDING_ENTRIES,
              winnerRecord: WINNER_RECORD,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: true, data: {
        poolAddress: POOL_ADDRESS,
        signature: 'PoolSig111111111111111111111111111111111111111111111111111111111111',
      } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_METEORA_POOL_BIN_STEP: '25',
      SOLANA_METEORA_POOL_ACTIVE_ID: '0',
      SOLANA_STRICT_SOL_PAIR: '1',
    })
    try {
      const req = createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN, trigger: 'post_deploy' } })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.shareMeshMapping).toMatchObject({
        status: 'found',
        shareOft: SHARE_OFT,
        shareMeshMint: SHARE_MESH_MINT,
      })
      expect(res.body?.data?.hookLane).toMatchObject({
        status: 'completed',
        hookMint: SHARE_MESH_MINT,
        creatorConfig: CREATOR_CONFIG,
      })
      expect(res.body?.data?.meteoraPool).toMatchObject({
        status: 'completed',
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
      })
      expect(fetchMock).toHaveBeenCalledTimes(4)
      const setupCall = (fetchMock.mock.calls as any[]).find(([url]) => String(url).includes('/setup-creator'))
      expect(setupCall?.[0]).toBe('https://provisioner.4626.fun/setup-creator')
      expect(JSON.parse(String(setupCall?.[1]?.body))).toMatchObject({
        mint: SHARE_MESH_MINT,
        hubCreatorCoin: getAddress(CREATOR_TOKEN),
        hubShareToken: SHARE_OFT,
        ammPrograms: ['LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'],
      })
      const [url, init] = (fetchMock.mock.calls as any[]).find(([callUrl]) => String(callUrl).includes('/create-pool')) as [
        string,
        { headers?: Record<string, string>; body?: string },
      ]
      expect(url).toBe('https://provisioner.4626.fun/create-pool')
      expect(init.headers?.Authorization).toBe('Bearer pool-secret')
      expect(JSON.parse(String(init.body))).toMatchObject({
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
        mode: 'b2',
        binStep: 25,
        activeId: 0,
      })
      expect(ensureSolanaHookStatusSchemaMock).toHaveBeenCalled()
      expect(ensureSolanaMeteoraPoolStatusSchemaMock).toHaveBeenCalled()
      const createdHookStatusCall = db.sql.mock.calls.find(
        (call) =>
          String(call[0]?.join?.('') ?? '').includes('solana_hook_status') &&
          call.some((arg) => arg === 'created'),
      )
      expect(createdHookStatusCall).toBeDefined()
      const createdPoolStatusCall = db.sql.mock.calls.find(
        (call) =>
          String(call[0]?.join?.('') ?? '').includes('solana_meteora_pool_status') &&
          call.some((arg) => arg === 'created'),
      )
      expect(createdPoolStatusCall).toBeDefined()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('waits for the post-deploy share-mesh mapping before trying to create the pool', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([]))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
    })
    try {
      const req = createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN, trigger: 'payment' } })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.shareMeshMapping).toEqual({ status: 'missing' })
      expect(res.body?.data?.hookLane).toMatchObject({ status: 'waiting_for_share_oft' })
      expect(res.body?.data?.meteoraPool).toMatchObject({ status: 'waiting_for_share_mesh_mint' })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('creates the Meteora pool on post_lz when hook provisioning is disabled (B1 path)', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/setup-creator')) {
        throw new Error(`unexpected request: ${url}`)
      }
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({
          ok: true,
          secretSet: true,
          payerConfigured: true,
          payerHealthy: true,
          solanaRpcConfigured: true,
          extendedEndpointsEnabled: true,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        success: true,
        data: {
          poolAddress: POOL_ADDRESS,
          signature: 'PoolSig111111111111111111111111111111111111111111111111111111111111',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: undefined,
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_STRICT_SOL_PAIR: '1',
      SOLANA_B2_READINESS_VERIFICATION_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN, b2Stage: 'b1' } }), res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toEqual({
        status: 'disabled',
        reason: 'B1 lane does not provision the lottery hook',
      })
      expect(res.body?.data?.meteoraPool).toMatchObject({
        status: 'completed',
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const createPoolCall = (fetchMock.mock.calls as any[]).find(([url]) => String(url).includes('/create-pool'))
      expect(createPoolCall).toBeDefined()
      expect(JSON.parse(String(createPoolCall?.[1]?.body))).toMatchObject({ mode: 'b1' })
      expect(enqueueSolanaB2ReadinessVerificationMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('does not call create-pool when health reports an unfunded payer', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({
      ok: false,
      secretSet: true,
      payerConfigured: true,
      payerHealthy: false,
      solanaRpcConfigured: true,
      extendedEndpointsEnabled: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '0',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_STRICT_SOL_PAIR: '1',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: {
        creatorToken: CREATOR_TOKEN,
        b2Stage: 'b1',
      } }), res)

      expect(res.body?.data?.meteoraPool).toEqual({
        status: 'failed',
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
        error: 'create_pool_provisioner_not_ready',
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/healthz')
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === 'create_pool_provisioner_not_ready'))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('rejects a successful create-pool response for a different deterministic pool', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({
          ok: true,
          secretSet: true,
          payerConfigured: true,
          payerHealthy: true,
          solanaRpcConfigured: true,
          extendedEndpointsEnabled: true,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        success: true,
        data: {
          poolAddress: CREATOR_CONFIG,
          signature: 'PoolSig111111111111111111111111111111111111111111111111111111111111',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '0',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_STRICT_SOL_PAIR: '1',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: {
        creatorToken: CREATOR_TOKEN,
        b2Stage: 'b1',
      } }), res)

      expect(res.body?.data?.meteoraPool).toMatchObject({
        status: 'failed',
        error: `create_pool_address_mismatch:${CREATOR_CONFIG}:${POOL_ADDRESS}`,
      })
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === `create_pool_address_mismatch:${CREATOR_CONFIG}:${POOL_ADDRESS}`))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('rejects hook_pre_lz when shareOft is missing', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([]))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({
        method: 'POST',
        body: {
          creatorToken: CREATOR_TOKEN,
          b2Stage: 'hook_pre_lz',
          shareMeshMint: SHARE_MESH_MINT,
        },
      }), res)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        success: false,
        error: 'hook_pre_lz requires an applied creator-scoped share-mesh mapping',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('keeps hook_pre_lz isolated from pool creation and readiness', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) return new Response(JSON.stringify({ ok: true, secretSet: true, payerConfigured: true, payerHealthy: true, solanaRpcConfigured: true, extendedEndpointsEnabled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (!url.includes('/setup-creator')) throw new Error(`unexpected request: ${url}`)
      return new Response(JSON.stringify({
        success: true,
        mint: SHARE_MESH_MINT,
        pdas: {
          creatorConfig: CREATOR_CONFIG,
          pendingEntries: PENDING_ENTRIES,
          winnerRecord: WINNER_RECORD,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_B2_READINESS_VERIFICATION_ENABLED: '1',
    })
    try {
      const req = createMockReq({ method: 'POST', body: {
        creatorToken: CREATOR_TOKEN,
        b2Stage: 'hook_pre_lz',
      } })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({
        b2Stage: 'hook_pre_lz',
        shareMeshMapping: { status: 'found' },
        hookLane: { status: 'completed' },
        meteoraPool: { status: 'disabled', reason: 'post_lz_stage_required_for_pool_creation' },
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/setup-creator'))).toBe(true)
      expect(enqueueSolanaB2ReadinessVerificationMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('keeps hook provisioning disabled by default', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({ SOLANA_HOOK_PROVISIONING_ENABLED: undefined })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toEqual({
        status: 'disabled',
        reason: 'SOLANA_HOOK_PROVISIONING_ENABLED is not enabled',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it.each([
    ['url', undefined, 'hook-secret', 'setup_creator_provisioner_url_missing'],
    ['secret', 'https://provisioner.4626.fun/setup-creator', undefined, 'setup_creator_provisioner_secret_missing'],
  ])('fails closed when the provisioner %s is missing', async (_field, url, secret, reason) => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: url,
      SOLANA_HOOK_PROVISIONER_SECRET: secret,
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: undefined,
      METEORA_IX_PROVISIONER_SECRET: undefined,
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toEqual({ status: 'skipped_unconfigured', reason })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('persists a fail-closed status when the provisioner times out', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError')
    }))
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toEqual({ status: 'failed', error: 'setup_creator_provisioner_health_timeout' })
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === 'setup_creator_provisioner_health_timeout'))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('persists a fail-closed status when setup-creator returns an upstream failure', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/healthz')) return new Response(JSON.stringify({ ok: true, secretSet: true, payerConfigured: true, payerHealthy: true, solanaRpcConfigured: true, extendedEndpointsEnabled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ success: false, error: 'setup_creator_rpc_failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }))
    const restoreEnv = applyEnv({ SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator', SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0' })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.body?.data?.hookLane).toMatchObject({ status: 'failed', error: 'setup_creator_rpc_failed', upstreamStatusCode: 502 })
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === 'setup_creator_rpc_failed'))).toBe(true)
    } finally {
      restoreEnv(); vi.unstubAllGlobals()
    }
  })

  it('does not call setup-creator when health reports an unfunded payer', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({
      ok: false, secretSet: true, payerConfigured: true, payerHealthy: false, solanaRpcConfigured: true, extendedEndpointsEnabled: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.body?.data?.hookLane).toEqual({ status: 'failed', error: 'setup_creator_provisioner_not_ready' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/healthz')
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('rejects a successful provisioner response for a different mint', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    const wrongMint = 'So11111111111111111111111111111111111111112'
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) return new Response(JSON.stringify({ ok: true, secretSet: true, payerConfigured: true, payerHealthy: true, solanaRpcConfigured: true, extendedEndpointsEnabled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ success: true, mint: wrongMint, pdas: {
        creatorConfig: CREATOR_CONFIG, pendingEntries: PENDING_ENTRIES, winnerRecord: WINNER_RECORD,
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({ SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator', SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0' })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.body?.data?.hookLane).toMatchObject({ status: 'failed', error: expect.stringContaining('setup_creator_hook_mint_mismatch') })
    } finally {
      restoreEnv(); vi.unstubAllGlobals()
    }
  })

  it('reuses an already-created same-mint hook without a duplicate mutation', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    readSolanaHookStatusByCreatorTokenMock.mockResolvedValue({
      status: 'created',
      hookMint: SHARE_MESH_MINT,
      creatorConfig: CREATOR_CONFIG,
      pendingEntries: PENDING_ENTRIES,
      winnerRecord: WINNER_RECORD,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toMatchObject({ status: 'completed', hookMint: SHARE_MESH_MINT })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('rejects a cached created hook row with a non-derived PDA', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    const wrongCreatorConfig = 'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB'
    readSolanaHookStatusByCreatorTokenMock.mockResolvedValue({
      status: 'created',
      hookMint: SHARE_MESH_MINT,
      creatorConfig: wrongCreatorConfig,
      pendingEntries: PENDING_ENTRIES,
      winnerRecord: WINNER_RECORD,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)

      const error = `existing_hook_pda_mismatch:creator_config:${wrongCreatorConfig}:${CREATOR_CONFIG}`
      expect(res.body?.data?.hookLane).toEqual({ status: 'failed', error })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === error))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('rejects a successful provisioner response with a non-derived hook PDA', async () => {
    const db = makeDb([mappingRow()])
    getDbForCronMock.mockResolvedValue(db)
    const wrongCreatorConfig = 'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB'
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({
          ok: true,
          secretSet: true,
          payerConfigured: true,
          payerHealthy: true,
          solanaRpcConfigured: true,
          extendedEndpointsEnabled: true,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        success: true,
        mint: SHARE_MESH_MINT,
        pdas: {
          creatorConfig: wrongCreatorConfig,
          pendingEntries: PENDING_ENTRIES,
          winnerRecord: WINNER_RECORD,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)

      const error = `setup_creator_pda_mismatch:creator_config:${wrongCreatorConfig}:${CREATOR_CONFIG}`
      expect(res.body?.data?.hookLane).toMatchObject({ status: 'failed', error })
      expect(db.sql.mock.calls.some((call) => call.some((arg) => arg === error))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('atomically suppresses a concurrent hook provisioning mutation', async () => {
    const db = makeDb([mappingRow()], { hook: false })
    getDbForCronMock.mockResolvedValue(db)
    readSolanaHookStatusByCreatorTokenMock.mockResolvedValue({
      status: 'creating',
      hookMint: SHARE_MESH_MINT,
      creatorConfig: null,
      pendingEntries: null,
      winnerRecord: null,
    })
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes('/healthz')) throw new Error(`unexpected mutation request: ${url}`)
      return new Response(JSON.stringify({
        ok: true,
        secretSet: true,
        payerConfigured: true,
        payerHealthy: true,
        solanaRpcConfigured: true,
        extendedEndpointsEnabled: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_HOOK_PROVISIONER_TIMEOUT_MS: '600000',
      SOLANA_HOOK_PROVISIONING_STALE_MS: '60000',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)

      expect(res.body?.data?.hookLane).toEqual({
        status: 'in_progress',
        reason: 'hook_provisioning_already_in_progress',
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/healthz')
      const claimCall = db.sql.mock.calls.find((call) => String(call[0]?.join?.('') ?? '').includes('claim_hook_provision'))
      expect(claimCall).toBeDefined()
      expect(claimCall?.slice(1)).toEqual(expect.arrayContaining([630_000]))
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('atomically suppresses a concurrent Meteora pool creation', async () => {
    const db = makeDb([mappingRow()], { pool: false })
    getDbForCronMock.mockResolvedValue(db)
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({
      ok: true,
      secretSet: true,
      payerConfigured: true,
      payerHealthy: true,
      solanaRpcConfigured: true,
      extendedEndpointsEnabled: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '0',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '1',
      SOLANA_METEORA_POOL_PROVISIONER_URL: 'https://provisioner.4626.fun/create-pool',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      SOLANA_STRICT_SOL_PAIR: '1',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: {
        creatorToken: CREATOR_TOKEN,
        b2Stage: 'b1',
      } }), res)

      expect(res.body?.data?.meteoraPool).toEqual({
        status: 'in_progress',
        reason: 'meteora_pool_provisioning_already_in_progress',
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/healthz')
      expect(db.sql.mock.calls.some((call) => String(call[0]?.join?.('') ?? '').includes('claim_meteora_pool_provision'))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })

  it('does not trust a created hook row when a required PDA is missing', async () => {
    getDbForCronMock.mockResolvedValue(makeDb([mappingRow()]))
    readSolanaHookStatusByCreatorTokenMock.mockResolvedValue({
      status: 'created',
      hookMint: SHARE_MESH_MINT,
      creatorConfig: CREATOR_CONFIG,
      pendingEntries: null,
      winnerRecord: WINNER_RECORD,
    })
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({
          ok: true,
          secretSet: true,
          payerConfigured: true,
          payerHealthy: true,
          solanaRpcConfigured: true,
          extendedEndpointsEnabled: true,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        success: true,
        mint: SHARE_MESH_MINT,
        pdas: {
          creatorConfig: CREATOR_CONFIG,
          pendingEntries: PENDING_ENTRIES,
          winnerRecord: WINNER_RECORD,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
      SOLANA_HOOK_PROVISIONING_ENABLED: '1',
      SOLANA_HOOK_PROVISIONER_URL: 'https://provisioner.4626.fun/setup-creator',
      SOLANA_HOOK_PROVISIONER_SECRET: 'hook-secret',
      SOLANA_METEORA_POOL_PROVISIONING_ENABLED: '0',
    })
    try {
      const res = createMockRes()
      await handler(createMockReq({ method: 'POST', body: { creatorToken: CREATOR_TOKEN } }), res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.hookLane).toMatchObject({
        status: 'completed',
        pendingEntries: PENDING_ENTRIES,
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/setup-creator'))).toBe(true)
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })
})

function mappingRow() {
  return {
    id: 7,
    creator_token: CREATOR_TOKEN,
    share_oft: SHARE_OFT,
    share_mesh_mint: SHARE_MESH_MINT,
    source_session_id: 'dep_123',
    status: 'applied',
    apply_attempt_count: 1,
    created_at: '2026-06-28T00:00:00.000Z',
    updated_at: '2026-06-28T00:00:00.000Z',
  }
}

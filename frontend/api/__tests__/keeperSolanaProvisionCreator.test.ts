import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keeper/_solanaProvisionCreator.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const CREATOR_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'
const SHARE_OFT = '0x459ea17556082ebd586870f3aba81b822f104626'
const SHARE_MESH_MINT = 'ShareMesh111111111111111111111111111111111'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

const {
  getDbForCronMock,
  isDbConfiguredMock,
  readBoundedJsonObjectBodyMock,
  requireKeeprApiKeyMock,
  listActivationsForCreatorMock,
  creatorHasSolanaShareMeshEntitlementMock,
  ensureSolanaShareMeshMappingsSchemaMock,
  ensureSolanaMeteoraPoolStatusSchemaMock,
} = vi.hoisted(() => ({
  getDbForCronMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: any) => req.body),
  requireKeeprApiKeyMock: vi.fn(() => true),
  listActivationsForCreatorMock: vi.fn(async () => []),
  creatorHasSolanaShareMeshEntitlementMock: vi.fn(async () => true),
  ensureSolanaShareMeshMappingsSchemaMock: vi.fn(async () => {}),
  ensureSolanaMeteoraPoolStatusSchemaMock: vi.fn(async () => {}),
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
}))

function makeDb(mappingRows: any[] = []) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ..._values: any[]) => {
      const query = strings.join('?')
      if (query.includes('FROM solana_share_mesh_mappings')) {
        return { rows: mappingRows }
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
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { poolAddress: 'Pool1111111111111111111111111111111111111' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const restoreEnv = applyEnv({
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
      expect(res.body?.data?.meteoraPool).toMatchObject({
        status: 'completed',
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = (fetchMock.mock.calls as any[])[0] as [string, { headers?: Record<string, string>; body?: string }]
      expect(url).toBe('https://provisioner.4626.fun/create-pool')
      expect(init.headers?.Authorization).toBe('Bearer pool-secret')
      expect(JSON.parse(String(init.body))).toMatchObject({
        tokenMintX: SHARE_MESH_MINT,
        tokenMintY: SOL_MINT,
        binStep: 25,
        activeId: 0,
      })
      expect(ensureSolanaMeteoraPoolStatusSchemaMock).toHaveBeenCalled()
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
      expect(res.body?.data?.meteoraPool).toMatchObject({ status: 'waiting_for_share_mesh_mint' })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
      vi.unstubAllGlobals()
    }
  })
})
